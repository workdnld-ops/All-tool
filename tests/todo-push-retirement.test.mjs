import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../workers/todo-reminders/src/index.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const html = await read('apps/todo-board/index.html');
const sw = await read('sw.js');
const sourceFunction = name => html.match(new RegExp(`    function ${name}\\([\\s\\S]*?^    }`, 'm'))[0];

test('todo no longer exposes push configuration or subscription writes; page script is valid', async () => {
  assert.doesNotMatch(html, /enablePush|settings-modal|push-worker-url|Notification|PushManager|savePushSubscription|repeat-reminder-input|reminder-hour-select|days-before-input/);
  assert.doesNotMatch(await read('apps/todo-board/todo-data.js'), /pushSubscriptions|savePushSubscription/);
  assert.match(html, /畫面提醒/);
  assert.match(html, /id="recurrence-type-input"/);
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  new vm.Script(script.replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g, ''));
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const [, id] of script.matchAll(/document\.getElementById\("([^"]+)"\)/g)) {
    assert.ok(ids.has(id), `Missing element: ${id}`);
  }
});

test('on-screen overdue carry-over and pinned/reminder sorting remain intact', () => {
  const card = (id, dueDate, extra = {}) => ({id, dueDate, boxId:'default', completed:false, pinned:false, order:0, createdAt:'2026-01-01', reminder:{enabled:true}, ...extra});
  const state = {activeMonth:'2026-10', activeBoxId:'default', boxes:[{id:'default'}], cards:[
    card('future','2026-11-01'), card('old','2026-08-01'), card('today','2026-10-21'),
    card('tomorrow','2026-10-22'), card('done','2026-08-01',{completed:true}),
    card('other','2026-08-01',{boxId:'other'}),
    card('none','2026-01-01',{reminder:{enabled:false}}),
    card('pinned','2026-10-25',{pinned:true}),
  ]};
  const context = vm.createContext({state, todayKey:()=> '2026-10-21', monthKeyFromDateKey:date=>date.slice(0,7), DEFAULT_BOX:{id:'default'}, TAIPEI_TZ:'Asia/Taipei'});
  for (const name of ['parseDate','toDateKey','addDays','activeBoxId','reminderSortPriority','sortedCards','activeMonthCards']) vm.runInContext(sourceFunction(name), context);
  assert.deepEqual(Array.from(vm.runInContext('activeMonthCards().map(card => card.id)', context)), ['pinned','old','today','tomorrow','none']);
  state.activeMonth = '2026-12';
  assert.ok(vm.runInContext('activeMonthCards().some(card => card.id === "old")', context));
});

for (const mode of ['subscribed', 'unsupported', 'failure']) {
  test(`service worker safely retires only its own subscription (${mode})`, async () => {
    const handlers = new Map(), removed = [];
    let unsubscribed = 0, claimed = 0, pending;
    const pushManager = mode === 'unsupported' ? undefined : {getSubscription:async () => {
      if (mode === 'failure') throw new Error('unavailable');
      return {unsubscribe:async () => { unsubscribed++; return true; }};
    }};
    const context = vm.createContext({
      self:{registration:{pushManager}, addEventListener:(event,fn)=>handlers.set(event,fn), clients:{claim:async()=> { claimed++; }}},
      caches:{keys:async()=>['ops-toolbox-v21','ops-toolbox-v22','purchase-cache'], delete:async key=>removed.push(key)},
    });
    vm.runInContext(sw,context);
    assert.equal(handlers.has('push'),false);
    assert.equal(handlers.has('notificationclick'),false);
    handlers.get('activate')({waitUntil:value=>{pending=value;}});
    await pending;
    assert.equal(unsubscribed,mode === 'subscribed' ? 1 : 0);
    assert.equal(claimed,1);
    assert.deepEqual(removed,['ops-toolbox-v21']);
  });
}

test('retired Worker has no schedule or public routes and does no Firebase/push work', async () => {
  const config = JSON.parse(await read('workers/todo-reminders/wrangler.jsonc'));
  assert.deepEqual(config.triggers.crons,[]);
  assert.equal(config.workers_dev,false);
  assert.equal(config.preview_urls,false);
  assert.equal(config.observability.enabled,false);
  const forbidden = new Proxy({}, {get(){throw new Error('Retired Worker accessed environment');}});
  for (const path of ['/','/public-key','/run','/test']) {
    const response = await worker.fetch(new Request(`https://example.com${path}`),forbidden,forbidden);
    assert.equal(response.status,410);
    assert.equal((await response.json()).retired,true);
  }
  await worker.scheduled(forbidden,forbidden,forbidden);
  assert.doesNotMatch(await read('workers/todo-reminders/src/index.js'), /await fetch|sendPush|getFirebase/);
});
