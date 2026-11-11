const DAY = 86400000;
export const dayKey = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
export function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === value ? +date : null;
}
const season = date => date.getUTCMonth() === 0 || date.getUTCMonth() >= 6 ? 'peak' : 'off';
export function analyze(records = {}, year = new Date().getFullYear()) {
  const dates = new Set();
  for (const [y, text] of Object.entries(records)) {
    if (!/^\d{4}$/.test(y) || typeof text !== 'string') continue;
    for (const token of text.split(/[\n,，、\s]+/)) {
      const match = /^(\d{1,2})\/(\d{1,2})$/.exec(token);
      if (!match) continue;
      const date = parseDay(`${y}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`);
      if (date !== null) dates.add(date);
    }
  }
  const sorted = [...dates].sort((a,b) => b-a);
  const stats = Object.fromEntries(['full','year','peak','off'].map(key => [key,{total:0,count:0}]));
  const intervals = [];
  for (let i=0; i<sorted.length-1; i++) {
    const date = new Date(sorted[i]), days = (sorted[i]-sorted[i+1])/DAY;
    intervals.push(days);
    for (const key of ['full',season(date), ...(date.getUTCFullYear() === +year ? ['year'] : [])]) {
      stats[key].total += days; stats[key].count++;
    }
  }
  const rates = {};
  for (const key of ['peak','off']) {
    const sample = stats[key].count ? stats[key] : stats.full;
    rates[key] = sample.count ? sample.count/sample.total : null;
  }
  const periods = [
    ...[0,1,2,3].map(q => ({key:`q${q+1}`,name:`第 ${q+1} 季`,months:[q*3,q*3+1,q*3+2]})),
    {key:'year',name:'全年',months:Array.from({length:12},(_,i)=>i)},
    {key:'peak',name:'旺季（1、7～12 月）',months:[0,6,7,8,9,10,11]},
    {key:'off',name:'淡季（2～6 月）',months:[1,2,3,4,5]},
  ].map(period => {
    let estimate = 0;
    for (const month of period.months) {
      const date = new Date(Date.UTC(+year,month,1));
      const rate = rates[season(date)];
      if (rate === null) { estimate = null; break; }
      estimate += new Date(Date.UTC(+year,month+1,0)).getUTCDate()*rate;
    }
    const recorded = sorted.filter(t => { const d=new Date(t); return d.getUTCFullYear()===+year && period.months.includes(d.getUTCMonth()); }).length;
    return {...period,recorded,estimate};
  });
  return {stats,intervals,rates,periods};
}

export function stockForecast(stock, rates, today = dayKey()) {
  const start = parseDay(stock?.date ?? ''), now = parseDay(today);
  const quantity = stock?.quantity;
  if (start === null || now === null || start > now || !Number.isSafeInteger(quantity) || quantity < 0) return null;
  if (quantity === 0) return {remaining:0,days:0,end:stock.date};
  if (!(rates.peak > 0) || !(rates.off > 0)) return null;
  let remaining = quantity;
  for (let day=start; day<now; day+=DAY) remaining -= rates[season(new Date(day))];
  remaining = remaining < 1e-8 ? 0 : remaining;
  if (!remaining) return {remaining:0,days:0,end:today};
  let balance=remaining, cursor=now, days=0;
  // Jump month-by-month so large inventories do not block the UI.
  while (balance > 0 && days < 365250) {
    const date=new Date(cursor), rate=rates[season(date)];
    const next=Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1);
    const span=(next-cursor)/DAY;
    if (balance <= span*rate) { days += balance/rate; balance=0; }
    else { balance-=span*rate; days+=span; cursor=next; }
  }
  if (balance > 0) return {remaining,days:null,end:null};
  const wholeDays=Math.floor(days + 1e-8);
  return {remaining,days:wholeDays,end:new Date(now+wholeDays*DAY).toISOString().slice(0,10)};
}
