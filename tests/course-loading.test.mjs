import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWeekLoader} from '../apps/course-finder/load-weeks.mjs';
import {createCalendarHandler} from '../server/course-calendar.mjs';

const result = week => ({courses:[{date:week,time:'12:00',store:'內湖店',name:'SB初2兒'}],fetchedAt:'2026-10-30T00:00:00Z'});
const request = () => new Request('https://example.test/api/course-calendar?selected=2026-11-02');
const options = {today:()=> '2026-10-30',timeoutMs:30,cacheTimeoutMs:5};

test('a hanging upstream or body cannot keep the API pending and failed jobs can retry',async()=>{
  let calls = 0;
  const handle = createCalendarHandler({...options,fetcher:async()=>{calls++;return new Promise(()=>{});}});
  for (let i=0;i<2;i++) {
    const response = await handle(request());
    assert.equal(response.status,502);
    assert.match((await response.json()).warnings[0],/逾時/);
  }
  assert.equal(calls,2);
  const body = createCalendarHandler({...options,fetcher:async()=>({ok:true,text:()=>new Promise(()=>{})})});
  assert.equal((await body(request())).status,502);
});

test('hanging optional edge cache cannot prevent an upstream attempt',async()=>{
  let calls = 0;
  const handle = createCalendarHandler({...options,edgeCache:{match:()=>new Promise(()=>{})},fetcher:async()=>{calls++;return new Response('',{status:503});}});
  assert.equal((await handle(request())).status,502);
  assert.equal(calls,1);
});

test('Pages creates request-owned handlers rather than retaining pending Workers I/O',async()=>{
  const source = await readFile(new URL('../functions/api/course-calendar.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/let handler|handler \?\?=/);
  assert.match(source,/const handler = createCalendarHandler/);
});

test('ready weeks display before a stalled week, which becomes a warning',async()=>{
  const progress = [];
  const load = createWeekLoader({timeoutMs:30,fetcher:async url=>url.endsWith('11-02') ? Response.json(result('2026-11-02')) : new Promise(()=>{})});
  const data = await load(['2026-11-02','2026-11-09'],{signal:new AbortController().signal,onProgress:value=>progress.push(value)});
  assert.ok(progress.some(value=>value.loaded === 1 && value.warnings.length === 0));
  assert.equal(data.loaded,1); assert.equal(data.total,2);
  assert.match(data.warnings[0],/2026-11-09.*逾時/);
});

test('switching selections uses valid cached weeks; explicit refresh fetches again',async()=>{
  let calls = 0;
  const load = createWeekLoader({fetcher:async url=>{calls++;return Response.json(result(url.split('=').at(-1)));}});
  const opts = {signal:new AbortController().signal};
  await load(['2026-11-02'],opts);
  const data = await load(['2026-11-02','2026-11-09'],opts);
  assert.equal(calls,2); assert.equal(data.loaded,2);
  await load(['2026-11-02'],{...opts,refresh:true});
  assert.equal(calls,3);
});

test('cancellation stops stale progress and body timeouts settle',async()=>{
  const controller = new AbortController(), progress = [];
  const load = createWeekLoader({timeoutMs:20,fetcher:async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:()=>new Promise(()=>{})})});
  const pending = load(['2026-11-02'],{signal:controller.signal,onProgress:data=>progress.push(data)});
  controller.abort(); await pending;
  assert.equal(progress.length,1);
  const data = await load(['2026-11-02'],{signal:new AbortController().signal});
  assert.equal(data.loaded,0); assert.equal(data.warnings.length,1);
});
