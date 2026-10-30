export const LOCATIONS = [{ id: '1', name: '台北（內湖／瑞光）' }, { id: '2', name: '新竹店' }, { id: '4', name: '桃園店' }, { id: '7', name: '台中店' }, { id: '8', name: '台南店' }];
export const SOURCE = 'https://www.iski.com.tw/index.php?route=information/calender';
export function updateFilters(f, key, value) {
    const next = { ...f, [key]: value };
    if (['sport', 'stage', 'level', 'audience'].includes(key))
        next.exact = '';
    if (key === 'sport') {
        next.audience = '';
        next.level = '';
        next.stage = value === 'training' ? '' : (f.stage || '初');
    }
    if (key === 'stage') {
        next.audience = '';
        next.level = '';
    }
    if (key === 'audience' && value === '幼')
        next.level = '';
    return next;
}
export function addDays(date, days) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function taipeiNow() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()); }
export function monday(date) { const n = new Date(date + 'T12:00:00Z').getUTCDay(); return addDays(date, -((n + 6) % 7)); }
function clean(s) { return s.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').replace(/&amp;/g, '&').replace(/\s+/g, '').trim(); }
export function classify(name) { const m = name.match(/^(SB|SK)(初|中|高)(\d+)?(成|兒|幼|全)?$/); return { sport: m?.[1] || '', stage: m?.[2] || '', level: m?.[3] || '', audience: m?.[4] || '' }; }
export function isColorAvailable(color) { const s = color.toLowerCase(); const m = s.match(/^#([a-f0-9]{6})$/); if (!m)
    return false; const rgb = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); return Math.max(...rgb) - Math.min(...rgb) > 12; }
export function parseCalendar(html, locationId, requestedWeek) {
    const loc = LOCATIONS.find(l => l.id === locationId);
    if (!loc)
        throw new Error('未知場館');
    const section = html.match(/<section\b[^>]*id=["']calendar["'][^>]*>([\s\S]*?)<\/section>/i)?.[1];
    const period = section?.match(/class=["']subject["'][^>]*>\s*(\d{4})\/(\d{2})\/(\d{2})\s*~\s*(\d{4})\/(\d{2})\/(\d{2})/i);
    const table = section?.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
    if (!period || !table)
        throw new Error('原站課表尚未提供，或格式已變更');
    const week = `${period[1]}-${period[2]}-${period[3]}`;
    if (week !== requestedWeek)
        throw new Error('原站尚未提供所選週次的課表');
    const header = table.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '';
    const dates = [...header.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => clean(m[1])).filter(s => s.includes('/'));
    const calendarDates = dates.filter(s => /\d{2}\/\d{2}/.test(s));
    if (calendarDates.length !== 7 || calendarDates.some((s, i) => !s.endsWith(addDays(week, i).slice(5).replace('-', '/'))))
        throw new Error('日期欄位格式已變更');
    const body = table.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
    if (!body)
        throw new Error('無法辨識課表');
    let time = '';
    let rowCount = 0;
    const courses = [];
    const source = `${SOURCE}&location_id=${locationId}&filter_time=${week.replaceAll('-', '/')}`;
    for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        rowCount++;
        const heads = [...row[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => clean(m[1]));
        const foundTime = heads.find(s => /^\d{2}:\d{2}$/.test(s));
        if (foundTime)
            time = foundTime;
        const store = locationId === '1' ? heads.find(s => s.endsWith('店')) : loc.name;
        const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
        if (cells.length !== 7 || !time || !store)
            throw new Error('時間或店別欄位格式已變更');
        cells.forEach((cell, day) => {
            let slot = 0;
            for (const div of cell[1].matchAll(/<div\b([^>]*)>([\s\S]*?)<\/div>/gi)) {
                slot++;
                const name = clean(div[2]);
                if (!name || /不開放|內部訓練|僅限/.test(name))
                    continue;
                let color = div[1].match(/background-color\s*:\s*(#[a-f0-9]{6})/i)?.[1]?.toLowerCase();
                if (!color) {
                    if (/background-color\s*:\s*["']/i.test(div[1]))
                        continue;
                    throw new Error('課程顏色格式已變更');
                }
                const date = addDays(week, day);
                courses.push({ id: `${locationId}-${date}-${time}-${slot}-${store}`, date, time, store, name, color, available: isColorAvailable(color), ...classify(name), source });
            }
        });
    }
    if (!rowCount)
        throw new Error('課表目前沒有時段');
    return courses;
}
export function matches(c, f, now) {
    if (!c.available || `${c.date} ${c.time}` < now)
        return false;
    if (f.sport === 'training') {
        if (!c.name.includes('自主'))
            return false;
    }
    else
        for (const key of ['sport', 'stage', 'level', 'audience'])
            if (f[key] && c[key] !== f[key])
                return false;
    if (f.exact && c.name !== f.exact || f.store && c.store !== f.store)
        return false;
    const day = new Date(c.date + 'T12:00:00Z').getUTCDay();
    if (f.day === 'weekend' && day !== 0 && day !== 6 || f.day === 'weekday' && (day === 0 || day === 6))
        return false;
    const hour = Number(c.time.slice(0, 2));
    if (f.time === 'morning' && hour >= 12 || f.time === 'afternoon' && (hour < 12 || hour >= 18) || f.time === 'evening' && hour < 18)
        return false;
    return true;
}
