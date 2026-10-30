import { SOURCE, addDays, monday, parseCalendar, taipeiNow } from '../apps/course-finder/calendar.mjs';
import { parseSelectedWeeks } from '../apps/course-finder/weeks.mjs';

const TTL = 60000;
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});

export function createCalendarHandler({fetcher = fetch, now = () => Date.now(), today = () => taipeiNow(), edgeCache, timeoutMs = 10000, cacheTimeoutMs = 500} = {}) {
  const memory = new Map();
  const pending = new Map();
  async function loadWeek(week, origin) {
    const saved = memory.get(week);
    if (saved && now() - saved.at < TTL) return saved;
    if (pending.has(week)) return pending.get(week);
    const controller = new AbortController();
    const timed = async (operation, milliseconds, onTimeout = () => {}) => {
      let timer;
      try {
        return await Promise.race([operation, new Promise((_,reject)=>{
          timer = setTimeout(()=>{ onTimeout(); reject(new DOMException('讀取逾時','TimeoutError')); },milliseconds);
        })]);
      } finally { clearTimeout(timer); }
    };
    const job = (async () => {
      const key = new Request(`${origin}/_course-calendar-cache/v1/${week}`);
      try {
        const hit = await timed(Promise.resolve(edgeCache?.match(key)),cacheTimeoutMs);
        if (hit) {
          const entry = await timed(hit.json(),cacheTimeoutMs);
          if (now() - entry.at < TTL && Array.isArray(entry.courses)) return entry;
        }
      } catch { /* A cache failure must not prevent a live lookup. */ }
      const response = await fetcher(`${SOURCE}&filter_time=${week.replaceAll('-','/')}`, {
        signal:controller.signal, headers:{Accept:'text/html','Cache-Control':'no-cache'}, redirect:'follow'
      });
      if (!response.ok) throw new Error(`原站暫時無法讀取（${response.status}）`);
      const html = await response.text();
      if (controller.signal.aborted) throw new DOMException('讀取逾時','TimeoutError');
      if (html.length > 2500000) throw new Error('課表資料異常');
      const courses = parseCalendar(html, '1', week).filter(course => ['內湖店','瑞光店'].includes(course.store));
      const entry = {at:now(), courses};
      if (memory.size >= 16) memory.clear();
      memory.set(week, entry);
      try {
        await timed(Promise.resolve(edgeCache?.put(key, Response.json(entry, {headers:{'Cache-Control':'public, max-age=60'}}))),cacheTimeoutMs);
      } catch { /* In-memory caching remains available. */ }
      return entry;
    })();
    const bounded = timed(job,timeoutMs,()=>controller.abort());
    pending.set(week, bounded);
    try { return await bounded; } finally { pending.delete(week); }
  }
  return async request => {
    if (request.method !== 'GET') return json({error:'僅支援 GET 查詢'}, 405);
    const url = new URL(request.url);
    let jobs;
    if (url.searchParams.has('selected')) {
      try { jobs = parseSelectedWeeks(url.searchParams.get('selected'),today()); }
      catch (error) { return json({error:error.message},400); }
    } else {
      // Preserve the original API for previously opened pages.
      const start = url.searchParams.get('start') || monday(today().slice(0,10));
      const weeks = Number(url.searchParams.get('weeks') || 2);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(Date.parse(start)) || new Date(start+'T12:00:00Z').toISOString().slice(0,10) !== start || ![1,2,4].includes(weeks)) {
        return json({error:'日期或週數不正確'}, 400);
      }
      const current = monday(today().slice(0,10));
      if (start < current || start > addDays(current,56) || monday(start) !== start) return json({error:'請選擇本週至未來八週之間的週一'},400);
      jobs = Array.from({length:weeks}, (_,i) => addDays(start,i*7));
    }
    const results = [];
    const warnings = [];
    let index = 0;
    await Promise.all(Array.from({length:Math.min(3,jobs.length)}, async () => {
      while (index < jobs.length) {
        const week = jobs[index++];
        try { results.push(await loadWeek(week,url.origin)); }
        catch (error) { warnings.push(`內湖／瑞光 · ${week}：${error.name === 'TimeoutError' ? '原站讀取逾時' : error.message || '讀取失敗'}`); }
      }
    }));
    if (!results.length) return json({error:'目前無法取得原站課表，請稍後重試。', warnings},502);
    const unique = new Map();
    for (const entry of results) for (const course of entry.courses) {
      const key = [course.date,course.time,course.store,course.name].join('|');
      if (!unique.has(key) || course.available && !unique.get(key).available) unique.set(key,course);
    }
    const courses = [...unique.values()].sort((a,b) => (a.date+a.time+a.store+a.name).localeCompare(b.date+b.time+b.store+b.name));
    return json({courses, warnings:warnings.sort(), selected:jobs, start:jobs[0], end:addDays(jobs.at(-1),6), fetchedAt:new Date(Math.min(...results.map(r=>r.at))).toISOString(), loaded:results.length, total:jobs.length});
  };
}
