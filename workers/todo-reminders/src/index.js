const TAIPEI_TZ = "Asia/Taipei";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
    const url = new URL(request.url);
    if (url.pathname === "/public-key") {
      return json({ publicKey: env.VAPID_PUBLIC_KEY || "" });
    }
    if (url.pathname === "/run") {
      const result = await runReminderSweep(env);
      return json(result);
    }
    if (url.pathname === "/test" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const subscriptions = await getFirebase(env, "pushSubscriptions");
      const active = Object.values(subscriptions || {}).filter((item) => item?.active !== false);
      const results = await Promise.all(active.map((subscription) => sendPush(env, subscription, {
        title: "待辦事項提醒測試",
        body: body.body || "如果你看到這則通知，推播已經可以運作。",
        url: body.url || "/apps/todo-board/index.html",
        badgeCount: 1,
      })));
      return json({ sent: results.filter(Boolean).length, total: active.length });
    }
    return json({ ok: true, service: "todo-reminders" });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runReminderSweep(env, controller.scheduledTime));
  },
};

async function runReminderSweep(env, scheduledTime = Date.now()) {
  const now = new Date(scheduledTime);
  const cards = await getFirebase(env, "cards");
  const subscriptions = await getFirebase(env, "pushSubscriptions");
  const activeCards = Object.entries(cards || {})
    .map(([id, card]) => normalizeCard(id, card))
    .filter((card) => !card.completed && card.reminder.enabled);
  const activeSubscriptions = Object.entries(subscriptions || {})
    .map(([id, subscription]) => ({ id, ...subscription }))
    .filter((subscription) => subscription.active !== false && subscription.endpoint);
  const dueCards = activeCards.filter((card) => shouldSendReminder(card, now));
  const badgeCount = Object.values(cards || {}).filter((card) => {
    const normalized = normalizeCard("", card);
    return !normalized.completed && normalized.dueDate <= dateKey(now);
  }).length;

  let sent = 0;
  const staleSubscriptions = [];
  for (const card of dueCards) {
    const reminderKey = reminderKeyFor(card, now);
    let delivered = false;
    for (const subscription of activeSubscriptions) {
      const ok = await sendPush(env, subscription, {
        title: "待辦事項提醒",
        body: `${card.title}（${card.dueDate}）`,
        url: `/apps/todo-board/index.html?card=${encodeURIComponent(card.id)}`,
        badgeCount,
      });
      if (ok === "stale") staleSubscriptions.push(subscription.id);
      else if (ok) {
        sent += 1;
        delivered = true;
      }
    }
    if (delivered) {
      await patchFirebase(env, `cards/${card.id}/reminder/sentKeys/${encodeKey(reminderKey)}`, true);
    }
  }

  await Promise.all(staleSubscriptions.map((id) => patchFirebase(env, `pushSubscriptions/${id}/active`, false)));
  return {
    checkedAt: now.toISOString(),
    dueCards: dueCards.length,
    activeSubscriptions: activeSubscriptions.length,
    sent,
    staleSubscriptions: staleSubscriptions.length,
  };
}

function normalizeCard(id, card = {}) {
  const reminder = card.reminder || {};
  return {
    id: String(card.id || id),
    title: String(card.title || "未命名任務"),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(card.dueDate || "") ? card.dueDate : dateKey(new Date()),
    completed: card.completed === true,
    reminder: {
      enabled: reminder.enabled === true,
      daysBefore: Math.max(0, Number.parseInt(reminder.daysBefore, 10) || 0),
      time: /^\d{2}:\d{2}$/.test(reminder.time || "") ? reminder.time : "09:00",
      repeatUntilDone: reminder.repeatUntilDone === true,
      sentKeys: reminder.sentKeys && typeof reminder.sentKeys === "object" ? reminder.sentKeys : {},
    },
  };
}

function shouldSendReminder(card, now) {
  const key = reminderKeyFor(card, now);
  if (card.reminder.sentKeys?.[encodeKey(key)]) return false;
  const today = dateKey(now);
  const time = timeKey(now);
  if (time < card.reminder.time) return false;
  const reminderDate = addDays(card.dueDate, -card.reminder.daysBefore);
  if (today === reminderDate) return true;
  return card.reminder.repeatUntilDone && today > card.dueDate;
}

function reminderKeyFor(card, now) {
  return `${card.id}:${dateKey(now)}:${card.reminder.time}`;
}

function encodeKey(value) {
  return String(value).replace(/[.#$\[\]/:]/g, "_");
}

function dateKey(date) {
  return date.toLocaleDateString("sv-SE", { timeZone: TAIPEI_TZ });
}

function timeKey(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TAIPEI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function addDays(dateValue, amount) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0));
  return date.toLocaleDateString("sv-SE", { timeZone: TAIPEI_TZ });
}

async function getFirebase(env, path) {
  const response = await fetch(firebaseUrl(env, path));
  if (!response.ok) throw new Error(`Firebase read failed: ${response.status}`);
  return response.json();
}

async function patchFirebase(env, path, value) {
  const response = await fetch(firebaseUrl(env, path), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Firebase write failed: ${response.status}`);
}

function firebaseUrl(env, path) {
  const root = (env.TODO_ROOT_PATH || "users/single-user/todoBoard").replace(/^\/+|\/+$/g, "");
  const databaseUrl = (env.FIREBASE_DATABASE_URL || "").replace(/\/+$/g, "");
  const token = env.FIREBASE_AUTH_TOKEN ? `?auth=${encodeURIComponent(env.FIREBASE_AUTH_TOKEN)}` : "";
  return `${databaseUrl}/${root}/${path}.json${token}`;
}

async function sendPush(env, subscription, payload) {
  try {
    const body = await encryptPushPayload(subscription, JSON.stringify(payload));
    const endpoint = new URL(subscription.endpoint);
    const jwt = await createVapidJwt(env, endpoint.origin);
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: "86400",
        urgency: "normal",
      },
      body,
    });
    if (response.status === 404 || response.status === 410) return "stale";
    return response.ok;
  } catch (error) {
    console.error("Push failed:", error);
    return false;
  }
}

async function encryptPushPayload(subscription, plaintext) {
  const userPublicKey = base64UrlToBytes(subscription.keys?.p256dh || "");
  const authSecret = base64UrlToBytes(subscription.keys?.auth || "");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));
  const remotePublicKey = await crypto.subtle.importKey("raw", userPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: remotePublicKey }, localKeys.privateKey, 256));

  const keyInfo = concat(utf8("WebPush: info\0"), userPublicKey, localPublicKey);
  const ecdhSecret = await hmac(await hmacKey(authSecret), sharedSecret);
  const ikm = await hmac(await hmacKey(ecdhSecret), concat(keyInfo, new Uint8Array([1])));
  const prk = await hmac(await hmacKey(salt), ikm);
  const cek = (await hmac(await hmacKey(prk), utf8("Content-Encoding: aes128gcm\0\x01"))).slice(0, 16);
  const nonce = (await hmac(await hmacKey(prk), utf8("Content-Encoding: nonce\0\x01"))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const record = concat(utf8(plaintext), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, record));
  const rs = new Uint8Array([0, 0, 16, 0]);
  const keyLength = new Uint8Array([localPublicKey.length]);
  return concat(salt, rs, keyLength, localPublicKey, ciphertext);
}

async function createVapidJwt(env, audience) {
  const header = base64UrlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || "mailto:admin@example.com",
  }));
  const data = `${header}.${payload}`;
  const privateKey = await importVapidPrivateKey(env.VAPID_PRIVATE_KEY || "", env.VAPID_PUBLIC_KEY || "");
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    utf8(data),
  ));
  return `${data}.${bytesToBase64Url(signature)}`;
}

async function importVapidPrivateKey(value, publicKey) {
  const bytes = value.includes("BEGIN")
    ? pemToBytes(value)
    : base64UrlToBytes(value);
  if (bytes.length === 32) {
    const publicBytes = base64UrlToBytes(publicKey);
    if (publicBytes.length === 65 && publicBytes[0] === 4) {
      return crypto.subtle.importKey(
        "jwk",
        {
          kty: "EC",
          crv: "P-256",
          d: bytesToBase64Url(bytes),
          x: bytesToBase64Url(publicBytes.slice(1, 33)),
          y: bytesToBase64Url(publicBytes.slice(33, 65)),
          ext: false,
          key_ops: ["sign"],
        },
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      );
    }
  }
  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

function pemToBytes(pem) {
  const base64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function hmac(key, data) {
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

function utf8(value) {
  return new TextEncoder().encode(value);
}

function concat(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function base64UrlEncode(value) {
  return bytesToBase64Url(utf8(value));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}
