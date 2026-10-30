export function createWeekLoader({fetcher = fetch, timeoutMs = 15000, now = () => Date.now()} = {}) {
  const cache = new Map();
  return async function loadWeeks(weeks, {signal, onProgress = () => {}, refresh = false} = {}) {
    const results = new Map(), failures = new Map();
    const snapshot = () => ({
      courses: [...results.values()].flatMap(result=>result.courses).sort((a,b)=>(a.date+a.time+a.store+a.name).localeCompare(b.date+b.time+b.store+b.name)),
      warnings: [...failures.values()], loaded: results.size, total: weeks.length,
      fetchedAt: new Date(results.size ? Math.min(...[...results.values()].map(result=>Date.parse(result.fetchedAt))) : now()).toISOString()
    });
    const missing = [];
    for (const week of weeks) {
      const saved = cache.get(week);
      if (!refresh && saved && now()-saved.at < 60000) results.set(week,saved.result);
      else missing.push(week);
    }
    if (!signal.aborted) onProgress(snapshot());
    let index = 0;
    await Promise.all(Array.from({length:Math.min(3,missing.length)},async()=>{
      while (index < missing.length && !signal.aborted) {
        const week = missing[index++], controller = new AbortController();
        let timer, cancel;
        const interruption = new Promise((_,reject)=>{
          cancel = () => { controller.abort(); reject(new DOMException('查詢已取消','AbortError')); };
          signal.addEventListener('abort',cancel,{once:true});
          timer = setTimeout(()=>{controller.abort();reject(new DOMException('讀取逾時','TimeoutError'));},timeoutMs);
        });
        try {
          const operation = (async()=>{
            const response = await fetcher(`../../api/course-calendar?selected=${week}`,{signal:controller.signal,cache:'no-store'});
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('課表服務暫時無法使用');
            const result = await response.json();
            if (!response.ok) throw new Error(result.warnings?.join('；') || result.error || '讀取失敗');
            if (!Array.isArray(result.courses) || !Number.isFinite(Date.parse(result.fetchedAt))) throw new Error('課表資料格式異常');
            return result;
          })();
          const result = await Promise.race([operation,interruption]);
          if (signal.aborted) return;
          cache.set(week,{at:now(),result});
          if (cache.size > 10) cache.delete(cache.keys().next().value);
          results.set(week,result);
        } catch (error) {
          if (signal.aborted) return;
          failures.set(week,`${week}：${error.name === 'TimeoutError' ? '讀取逾時，請重新整理重試' : error.message}`);
        } finally {
          clearTimeout(timer); signal.removeEventListener('abort',cancel);
        }
        if (!signal.aborted) onProgress(snapshot());
      }
    }));
    return snapshot();
  };
}
