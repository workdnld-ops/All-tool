import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {protectToolbox,issueSession,hasSession,SESSION_SECONDS,safeReturn} from '../server/toolbox-auth.mjs';

const env = {TOOLBOX_PASSWORD:'only-for-automated-tests',TOOLBOX_SESSION_SECRET:'test-only-signing-key-not-used-in-production-012345'};
const origin = 'https://all-tool.example.test';
const now = Date.parse('2026-10-30T08:00:00Z');
const req = (path,options={}) => new Request(origin+path,options);
const wrap = (request,overrides={}) => ({request,env,next:async()=>new Response('<html><head></head><body>private</body></html>',{headers:{'Content-Type':'text/html'}}),...overrides});
const options = () => ({now,attempts:new Map()});
const login = (password=env.TOOLBOX_PASSWORD,next='/apps/drink-calculator/') => req('/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password,next})});
const withToken = (path,token) => req(path,{headers:{Cookie:`__Host-toolbox-session=${token}`}});

test('every direct tool entry, API and asset requires a session',async()=>{
  for (const path of ['/','/apps/drink-calculator/','/apps/purchase-accounting/dist/index.html','/apps/todo-board/','/api/course-calendar','/apps/work-assignment/app.mjs']) {
    let called = false;
    const response = await protectToolbox(wrap(req(path),{next:async()=>{called=true;return new Response('private');}}),options());
    assert.equal(called,false,path);
    assert.ok([303,401].includes(response.status),path);
    assert.match(response.headers.get('cache-control'),/no-store/);
  }
});
test('login issues a secure remembered cookie and never echoes the password',async()=>{
  const response = await protectToolbox(wrap(login()),options());
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/apps/drink-calculator/');
  const cookie = response.headers.get('set-cookie');
  for (const value of ['__Host-toolbox-session=','HttpOnly','Secure','SameSite=Lax','Path=/',`Max-Age=${SESSION_SECONDS}`]) assert.ok(cookie.includes(value),value);
  assert.ok(!cookie.includes(env.TOOLBOX_PASSWORD));
  assert.equal(await response.text(),'');
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(await hasSession(withToken('/',token),env,now+86400000),true);
});
test('tampering, expiration, other domains and rotated secrets invalidate sessions',async()=>{
  const token = await issueSession(env,origin,now);
  assert.equal(await hasSession(withToken('/',token),env,now),true);
  assert.equal(await hasSession(withToken('/',token+'x'),env,now),false);
  assert.equal(await hasSession(withToken('/',token),env,now+SESSION_SECONDS*1000),false);
  assert.equal(await hasSession(new Request('https://other.example/',{headers:{cookie:`__Host-toolbox-session=${token}`}}),env,now),false);
  assert.equal(await hasSession(withToken('/',token),{...env,TOOLBOX_PASSWORD:'a-changed-password'},now),false);
  assert.equal(await hasSession(withToken('/',token),{...env,TOOLBOX_SESSION_SECRET:'another-long-secret-0123456789012345'},now),false);
  for (const invalid of ['a.b.c','bad','@@@@.bad']) assert.equal(await hasSession(withToken('/',invalid),env,now),false);
});
test('wrong passwords are rejected and repeated failures have a retry limit',async()=>{
  const settings = options();
  for(let i=0;i<10;i++) assert.equal((await protectToolbox(wrap(login('wrong')),settings)).status,401);
  assert.equal((await protectToolbox(wrap(login()),settings)).status,429);
  assert.equal((await protectToolbox(wrap(login()),{...settings,now:now+300001})).status,303);
});
test('cross-site forms, oversized bodies and unsafe redirects are rejected',async()=>{
  const foreign = login(); foreign.headers.set('Origin','https://evil.example');
  assert.equal((await protectToolbox(wrap(foreign),options())).status,403);
  assert.equal((await protectToolbox(wrap(login('x'.repeat(9000))),options())).status,400);
  for(const target of ['https://evil.example','//evil.example','/\\evil.example','/login','/logout','/_auth/session']) assert.equal(safeReturn(target,origin),'/');
  assert.equal(safeReturn('/apps/drink-calculator/?v=3',origin),'/apps/drink-calculator/?v=3');
});
test('logout clears only the login cookie and protected HTML receives revalidation',async()=>{
  const token = await issueSession(env,origin,now);
  const response = await protectToolbox(wrap(withToken('/',token)),options());
  assert.equal(response.status,200);
  assert.match(await response.text(),/<head><script src="\/_auth\/client.js"><\/script>/);
  const logout = await protectToolbox(wrap(req('/logout',{method:'POST',headers:{Origin:origin}})),options());
  assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal(logout.headers.get('clear-site-data'),null);
});
test('missing setup fails closed, while worker updates remove only offline caches',async()=>{
  assert.equal((await protectToolbox(wrap(req('/'),{env:{}}),options())).status,503);
  const response = await protectToolbox(wrap(req('/apps/purchase-accounting/dist/sw.js'),{env:{}}),options());
  assert.equal(response.status,200);
  const script = await response.text();
  assert.match(script,/caches.delete/);
  assert.doesNotMatch(script,/indexedDB|localStorage|respondWith/);
  const routes = JSON.parse(await readFile(new URL('../_routes.json',import.meta.url)));
  assert.deepEqual(routes.include,['/*']);
});
