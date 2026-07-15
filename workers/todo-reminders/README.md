# Todo Reminders Worker

Cloudflare Worker for the iOS PWA todo board. It scans Firebase Realtime Database on a cron schedule and sends Web Push reminders.

## Required secrets

Set these before deployment:

```powershell
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
```

`VAPID_PUBLIC_KEY` must be the URL-safe base64 public key used by the PWA. `VAPID_PRIVATE_KEY` may be the usual 32-byte URL-safe base64 VAPID private key, URL-safe base64 PKCS8, or a PEM private key.

Optional:

```powershell
wrangler secret put FIREBASE_AUTH_TOKEN
```

Use it only if Firebase REST reads/writes require an auth token.

## Local test

```powershell
wrangler dev --test-scheduled
```

Then open:

```text
http://localhost:8787/public-key
http://localhost:8787/cdn-cgi/handler/scheduled
```
