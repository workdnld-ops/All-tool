import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6aZhiruY_wqBfNPElCsybIQvKByld6_8",
  authDomain: "money-card-6bf98.firebaseapp.com",
  databaseURL: "https://money-card-6bf98-default-rtdb.firebaseio.com",
  projectId: "money-card-6bf98",
  storageBucket: "money-card-6bf98.firebasestorage.app",
  messagingSenderId: "245245451690",
  appId: "1:245245451690:web:e939a519af0009b8d1dfd3",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const userId = "single-user";
const rootPath = `users/${userId}/todoBoard`;

export const DEFAULT_REMINDER = {
  enabled: false,
  daysBefore: 0,
  time: "09:00",
  repeatUntilDone: false,
  sentKeys: {},
};

export const DEFAULT_RECURRENCE = {
  type: "none",
  interval: 1,
  weekdays: [],
  monthMode: "same-day",
};

export const DEFAULT_BOX = {
  id: "default",
  name: "一般待辦",
  order: 0,
  createdAt: "2026-07-15T00:00:00.000Z",
};

export function todayKey(date = new Date()) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function monthKeyFromDateKey(dateKey) {
  return String(dateKey || todayKey()).slice(0, 7);
}

export function normalizeCard(card, fallbackId) {
  const reminder = { ...DEFAULT_REMINDER, ...(card.reminder || {}) };
  const recurrence = { ...DEFAULT_RECURRENCE, ...(card.recurrence || {}) };
  return {
    id: String(card.id || fallbackId),
    boxId: String(card.boxId || DEFAULT_BOX.id),
    title: String(card.title || "未命名任務"),
    notes: String(card.notes || ""),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(card.dueDate || "") ? card.dueDate : todayKey(),
    order: Number.isFinite(Number(card.order)) ? Number(card.order) : Number.MAX_SAFE_INTEGER,
    createdAt: card.createdAt || new Date().toISOString(),
    updatedAt: card.updatedAt || new Date().toISOString(),
    completed: card.completed === true,
    completedAt: card.completedAt || "",
    reminder: {
      enabled: reminder.enabled === true,
      daysBefore: Math.max(0, Number.parseInt(reminder.daysBefore, 10) || 0),
      time: /^\d{2}:\d{2}$/.test(reminder.time || "") ? reminder.time : "09:00",
      repeatUntilDone: reminder.repeatUntilDone === true,
      sentKeys: reminder.sentKeys && typeof reminder.sentKeys === "object" ? reminder.sentKeys : {},
    },
    recurrence: {
      type: ["none", "daily", "weekly", "monthly", "yearly"].includes(recurrence.type)
        ? recurrence.type
        : "none",
      interval: Math.max(1, Number.parseInt(recurrence.interval, 10) || 1),
      weekdays: Array.isArray(recurrence.weekdays)
        ? recurrence.weekdays.map(Number).filter((day) => day >= 0 && day <= 6)
        : [],
      monthMode: recurrence.monthMode === "end-of-month" ? "end-of-month" : "same-day",
    },
  };
}

export function normalizeBox(box, fallbackId) {
  return {
    id: String(box.id || fallbackId || DEFAULT_BOX.id),
    name: String(box.name || DEFAULT_BOX.name),
    order: Number.isFinite(Number(box.order)) ? Number(box.order) : 0,
    createdAt: box.createdAt || new Date().toISOString(),
  };
}

function normalizeCards(data) {
  return Object.entries(data || {})
    .map(([id, card]) => normalizeCard(card || {}, id))
    .sort((a, b) => a.order - b.order || a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt));
}

function normalizeBoxes(data) {
  const boxes = Object.entries(data || {})
    .map(([id, box]) => normalizeBox(box || {}, id))
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  if (!boxes.some((box) => box.id === DEFAULT_BOX.id)) boxes.unshift(DEFAULT_BOX);
  return boxes;
}

function normalizeCompletions(data) {
  return Object.entries(data || {})
    .map(([id, item]) => ({
      id,
      cardId: String(item.cardId || ""),
      boxId: String(item.boxId || DEFAULT_BOX.id),
      title: String(item.title || ""),
      dueDate: String(item.dueDate || ""),
      completedAt: String(item.completedAt || ""),
      nextDueDate: String(item.nextDueDate || ""),
    }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export function subscribeBoxes(onChange, onError) {
  const boxesRef = ref(database, `${rootPath}/boxes`);
  return onValue(
    boxesRef,
    async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        await set(ref(database, `${rootPath}/boxes/${DEFAULT_BOX.id}`), DEFAULT_BOX);
      }
      onChange(normalizeBoxes(data));
    },
    (error) => {
      console.error("Todo boxes read error:", error);
      onError?.(error);
    },
  );
}

export function subscribeCards(onChange, onError) {
  return onValue(
    ref(database, `${rootPath}/cards`),
    (snapshot) => onChange(normalizeCards(snapshot.val())),
    (error) => {
      console.error("Todo cards read error:", error);
      onError?.(error);
    },
  );
}

export function subscribeCompletions(onChange, onError) {
  return onValue(
    ref(database, `${rootPath}/completions`),
    (snapshot) => onChange(normalizeCompletions(snapshot.val())),
    (error) => {
      console.error("Todo completions read error:", error);
      onError?.(error);
    },
  );
}

export async function saveBox(box) {
  const now = new Date().toISOString();
  if (box.id) {
    const normalized = normalizeBox({ ...box, createdAt: box.createdAt || now }, box.id);
    await set(ref(database, `${rootPath}/boxes/${normalized.id}`), normalized);
    return normalized.id;
  }
  const boxRef = push(ref(database, `${rootPath}/boxes`));
  const normalized = normalizeBox({
    ...box,
    id: boxRef.key,
    createdAt: now,
  }, boxRef.key);
  await set(boxRef, normalized);
  return normalized.id;
}

export async function saveCard(card) {
  const now = new Date().toISOString();
  if (card.id) {
    const normalized = normalizeCard({ ...card, updatedAt: now }, card.id);
    await set(ref(database, `${rootPath}/cards/${normalized.id}`), normalized);
    return normalized.id;
  }
  const cardRef = push(ref(database, `${rootPath}/cards`));
  const normalized = normalizeCard({
    ...card,
    id: cardRef.key,
    createdAt: now,
    updatedAt: now,
  }, cardRef.key);
  await set(cardRef, normalized);
  return normalized.id;
}

export async function updateCard(id, updates) {
  await update(ref(database, `${rootPath}/cards/${id}`), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCard(id) {
  await remove(ref(database, `${rootPath}/cards/${id}`));
}

export async function addCompletion(completion) {
  const completionRef = push(ref(database, `${rootPath}/completions`));
  await set(completionRef, completion);
}

export async function savePushSubscription(subscription) {
  const key = btoa(subscription.endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-80);
  await set(ref(database, `${rootPath}/pushSubscriptions/${key}`), {
    ...subscription,
    id: key,
    userAgent: navigator.userAgent,
    createdAt: new Date().toISOString(),
    active: true,
  });
}
