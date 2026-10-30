import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createCalendarHandler} from '../server/course-calendar.mjs';
import {addDays} from '../apps/course-finder/calendar.mjs';
import {INITIAL_FILTERS,filterTitle,formatLine,formatText,formatCSV} from '../apps/course-finder/format.mjs';

const request = query => new Request('https://example.test/api/course-calendar?'+query);
function fixture(week) {
  const date = value => value.replaceAll('-','/');
  const headers = Array.from({length:7},(_,i)=>`<th>${date(addDays(week,i)).slice(5)}</th>`).join('');
  const cells = '<td><div style="background-color: #d2d2d2">SB初2兒</div><div style="background-color: #cfe2f3">SB初2兒</div></td>'+'<td></td>'.repeat(6);
  return `<section id="calendar"><div class="subject">${date(week)} ~ ${date(addDays(week,6))}</div><table><thead><tr>${headers}</tr></thead><tbody><tr><th rowspan="2">12:00</th><th>內湖店</th>${cells}</tr><tr><th>瑞光店</th>${cells}</tr></tbody></table></section>`;
}
const options = fetcher => ({fetcher,today:()=> '2026-10-30',now:()=>Date.parse('2026-10-30T02:00:00Z')});
const htmlResponse = url => new Response(fixture(new URL(url).searchParams.get('filter_time').replaceAll('/','-')));

test('calendar endpoint validates ranges before contacting fixed upstream',async()=>{
  let calls = 0;
  const handle = createCalendarHandler(options(async url=>{calls++; assert.equal(new URL(url).hostname,'www.iski.com.tw'); return htmlResponse(url);}));
  for (const query of ['start=invalid','start=2026-02-30','start=2026-10-27','start=2026-10-19','start=2027-01-04','weeks=200','weeks=NaN']) {
    assert.equal((await handle(request(query))).status,400,query);
  }
  assert.equal((await handle(new Request(request(''),{method:'POST'}))).status,405);
  assert.equal(calls,0);
  const response = await handle(request('start=2026-10-26&weeks=4&url=https://bad.example'));
  const data = await response.json();
  assert.equal(data.loaded,4); assert.equal(data.total,4); assert.equal(calls,4);
  assert.equal(data.end,'2026-11-22'); assert.equal(data.courses.length,8);
  assert.deepEqual([...new Set(data.courses.map(c=>c.store))],['內湖店','瑞光店']);
  assert.ok(data.courses.every(c=>c.available));
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('calendar caches weeks across ranges, expires after sixty seconds and shares pending fetches',async()=>{
  let time = Date.parse('2026-10-30T02:00:00Z'), calls = 0;
  const handle = createCalendarHandler({...options(async url=>{calls++; return htmlResponse(url);}),now:()=>time});
  await Promise.all([handle(request('weeks=2')),handle(request('weeks=2'))]);
  assert.equal(calls,2);
  await handle(request('weeks=4')); assert.equal(calls,4);
  time += 61000; await handle(request('weeks=1')); assert.equal(calls,5);
});

test('partial failures remain warnings and full failure is never an empty successful calendar',async()=>{
  const handle = createCalendarHandler(options(async url=>new URL(url).searchParams.get('filter_time') === '2026/10/26' ? htmlResponse(url) : new Response('unavailable',{status:503})));
  const partial = await (await handle(request('weeks=2'))).json();
  assert.equal(partial.loaded,1); assert.equal(partial.warnings.length,1); assert.equal(partial.courses.length,2);
  const failure = await handle(request('start=2026-11-02&weeks=1'));
  assert.equal(failure.status,502); assert.match((await failure.json()).error,/無法取得/);
  const changed = createCalendarHandler(options(async()=>new Response('<html>maintenance</html>')));
  assert.equal((await changed(request('weeks=1'))).status,502);
});

test('edge cache is optional and cache errors do not prevent live queries',async()=>{
  let calls = 0;
  const entries = new Map();
  const edgeCache = {match:async key=>entries.get(key.url)?.clone(),put:async(key,res)=>entries.set(key.url,res)};
  const settings = {...options(async url=>{calls++;return htmlResponse(url);}),edgeCache};
  await createCalendarHandler(settings)(request('weeks=1'));
  await createCalendarHandler(settings)(request('weeks=1'));
  assert.equal(calls,1);
  const broken = createCalendarHandler({...settings,edgeCache:{match:async()=>{throw Error('cache');},put:async()=>{throw Error('cache');}}});
  assert.equal((await broken(request('weeks=1'))).status,200);
});

test('text exports match plain-text date, branch and course format',()=>{
  const courses = [{date:'2026-11-02',time:'12:00',store:'內湖店',name:'SB初2兒',color:'#cfe2f3',source:'https://www.iski.com.tw/'}];
  const filters = {...INITIAL_FILTERS,level:'2'};
  assert.equal(formatLine(courses[0]),'11/02 (一) 內湖 12:00 SB初2兒');
  assert.equal(formatText(courses,filters),'SB初2\n11/02 (一) 內湖 12:00 SB初2兒');
  assert.equal(filterTitle({...filters,sport:'training'}),'自主訓練');
  assert.equal(filterTitle({...filters,exact:'SK中幼'}),'SK中幼');
  assert.match(formatCSV(courses),/"內湖店","SB初2兒"/);
  assert.match(formatCSV([{...courses[0],name:'=1+1'}]),/"'=1\+1"/);
});

test('only calendar API invokes Pages Functions and SW never freezes calendar results',async()=>{
  const routes = JSON.parse(await readFile(new URL('../_routes.json',import.meta.url)));
  assert.deepEqual(routes,{version:1,include:['/api/course-calendar'],exclude:[]});
  const sw = await readFile(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(sw,/pathname\.startsWith\("\/apps\/course-finder\/"\)/);
  assert.match(sw,/pathname === "\/api\/course-calendar"/);
  const deploy = await readFile(new URL('../scripts/prepare-deploy.mjs',import.meta.url),'utf8');
  assert.match(deploy,/\["apps\/course-finder", "apps\/course-finder"\]/);
  assert.match(deploy,/\["_routes.json", "_routes.json"\]/);
  await access(new URL('../functions/api/course-calendar.js',import.meta.url));
});
