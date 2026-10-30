import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createCalendarHandler} from '../server/course-calendar.mjs';
import {addDays} from '../apps/course-finder/calendar.mjs';
import {INITIAL_FILTERS,filterTitle,formatLine,formatText,formatCSV} from '../apps/course-finder/format.mjs';
import {weekOptions,weekLabel,toggleWeek,groupCoursesByWeek} from '../apps/course-finder/weeks.mjs';

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

test('selected weeks fetch only chosen weeks including gaps, in chronological order',async()=>{
  const fetched = [];
  const handle = createCalendarHandler(options(async url=>{fetched.push(new URL(url).searchParams.get('filter_time'));return htmlResponse(url);}));
  const data = await (await handle(request('selected=2026-11-16,2026-11-02,2026-10-26'))).json();
  assert.deepEqual(data.selected,['2026-10-26','2026-11-02','2026-11-16']);
  assert.deepEqual(fetched.sort(),['2026/10/26','2026/11/02','2026/11/16']);
  assert.equal(data.total,3); assert.equal(data.loaded,3);
  assert.equal(data.courses.some(course=>course.date === '2026-11-09'),false);
  const all = await (await handle(request('selected='+weekOptions('2026-10-30').join(',')))).json();
  assert.equal(all.total,9); assert.equal(all.loaded,9);
});

test('invalid, repeated, empty and out-of-range selected weeks never fetch upstream',async()=>{
  let count = 0;
  const handle = createCalendarHandler(options(async url=>{count++;return htmlResponse(url);}));
  for (const selected of ['', '2026-11-02,2026-11-02','2026-10-27','2026-10-19','2026-12-28','2026-02-30','invalid','2026-11-02,']) {
    assert.equal((await handle(request('selected='+selected))).status,400,selected);
  }
  assert.equal(count,0);
});

test('week selections and separators handle deselection, gaps and year boundaries without mutation',()=>{
  const selected = ['2026-12-28'];
  assert.deepEqual(toggleWeek(selected,'2027-01-11'),['2026-12-28','2027-01-11']);
  assert.deepEqual(toggleWeek(selected,'2026-12-28'),[]);
  assert.deepEqual(selected,['2026-12-28']);
  assert.equal(weekLabel('2026-12-28'),'2026/12/28 – 2027/01/03');
  assert.equal(weekLabel('2027-01-04'),'01/04 – 01/10');
  const base = {time:'12:00',store:'內湖店',name:'SB初2兒',color:'#cfe2f3',source:''};
  const courses = ['2026-12-28','2027-01-03','2027-01-11'].map(date=>({...base,date}));
  assert.deepEqual(groupCoursesByWeek(courses).map(([week,rows])=>[week,rows.length]),[['2026-12-28',2],['2027-01-11',1]]);
  const text = formatText(courses,INITIAL_FILTERS);
  assert.equal(text.split('──────────').length,2);
  assert.match(text,/01\/03 \(日\).*\n\n──────────\n\n01\/11 \(一\)/);
  assert.equal(formatText([],INITIAL_FILTERS),'SB初');
  assert.doesNotMatch(formatCSV(courses),/──────────/);
});

test('week selector replaces duplicate period and old count controls',async()=>{
  const html = await readFile(new URL('../apps/course-finder/index.html',import.meta.url),'utf8');
  assert.match(html,/週次（多選）/);
  assert.doesNotMatch(html,/查詢期間|顯示週數|id="previous"|data-weeks=/);
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
