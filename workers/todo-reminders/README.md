# Todo Reminders Worker (retired)

Retired on 2026-10-21. Todo board v7.17.0 removes Web Push setup and subscription
writes. Existing card dates, on-screen reminders, overdue carry-over, recurring
tasks, completions and app badges are retained. No Firebase records are deleted.

## Disable the existing deployment

The Pages/GitHub deployment does NOT deploy this separate Worker. Run once from
this directory against the configured account:

```powershell
wrangler deploy
```

The configuration explicitly sets `triggers.crons` to `[]` (omitting it would
leave existing schedules active), disables `workers_dev`, `preview_urls` and
observability. The inert handler performs no network or database requests, even
if an old scheduled event arrives while Cloudflare propagates the change.

Verify that the `todo-reminders` Worker has no Cron Triggers and no workers.dev or
preview URLs enabled. Previously it ran every five minutes (288 times per day).
Cron changes can take up to 15 minutes to propagate. Do not re-enable or roll back
this service unless Web Push is deliberately being restored.

The toolbox service worker unsubscribes its own old PushManager subscription on
activation; it does not unregister service workers or clear other tools' caches.
Old subscription rows and secrets are left untouched for recoverability but are
no longer read or used. Former implementation remains in Git history.

Reference: https://developers.cloudflare.com/workers/configuration/cron-triggers/
