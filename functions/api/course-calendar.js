import { createCalendarHandler } from '../../server/course-calendar.mjs';

export function onRequest(context) {
  // Workers I/O promises belong to their request; share only serialized cache data.
  const handler = createCalendarHandler({edgeCache:globalThis.caches?.default});
  return handler(context.request);
}
