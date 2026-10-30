import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('staff workload appears only in the people management view', async () => {
  const html = await readFile(new URL('../apps/work-assignment/index.html', import.meta.url), 'utf8');
  const work = html.match(/<section id="view-work">([\s\S]*?)<\/section>/)[1];
  const people = html.match(/<section id="view-people" hidden>([\s\S]*?)<\/section>/)[1];
  assert.doesNotMatch(work, /id="workloads"/);
  assert.match(people, /id="staff-list"/);
  assert.match(people, /id="workloads"/);
  assert.equal([...html.matchAll(/id="workloads"/g)].length, 1);
});

test('all toolbox destinations remain present and new tool is registered once', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const destinations=[...html.matchAll(/data-tool-url="([^"]+)"/g)].map(match=>match[1]);
  const expected=['credit-card-slip-stats','purchase-accounting','drink-calculator','cleaning-schedule','celebration-calculator','schedule-record','todo-board','cash-change-planner','store-cost-sharing','acceptance-form','leave-lottery','work-assignment','course-finder'];
  for(const name of expected) assert.equal(destinations.filter(url=>url.startsWith(`apps/${name}/`)).length,1,name);
  for(const url of destinations) await access(new URL(`../${url}${url.endsWith('/')?'index.html':''}`,import.meta.url));
  assert.match(html,/window\.location\.replace\(toolUrl\)/);
});
test('deployment includes new tool and service worker only deletes its own old caches', async () => {
  const deploy=await readFile(new URL('../scripts/prepare-deploy.mjs',import.meta.url),'utf8');
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(deploy,/\["apps\/work-assignment", "apps\/work-assignment"\]/);
  assert.match(sw,/pathname\.startsWith\("\/apps\/work-assignment\/"\)/);
  assert.match(sw,/key\.startsWith\("ops-toolbox-"\) && key !== CACHE_NAME/);
});
