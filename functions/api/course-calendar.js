import { createCalendarHandler } from '../../server/course-calendar.mjs';

let handler;
export function onRequest(context) {
  handler ??= createCalendarHandler({edgeCache:globalThis.caches?.default});
  return handler(context.request);
}
