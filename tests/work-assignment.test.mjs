import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, initializeIfMissing, validateState, fromFirebase, applyCommand, selectTasks, statistics, duplicates, backup, parseBackup, SUPPLIES_NOTE, executionHistory, listLogs, localDateKey, logFingerprint } from '../apps/work-assignment/model.mjs';
import { createLocalRepository, createFirebaseRepository, CLOUD_PATH, CACHE_KEY } from '../apps/work-assignment/storage.mjs';
const initial = () => createInitialState('2026-10-19T00:00:00.000Z');
const addPerson = (state, id = 'person-a', name = '同仁 A') => applyCommand(state, {type:'addPerson',id,name});
const edit = (state, id, changes) => applyCommand(state, {type:'editTask',id,changes});
const fakeStorage = () => {
  const map = new Map();
  return { getItem:key => map.has(key) ? map.get(key) : null, setItem:(key,value) => map.set(key,value) };
};

test('local colleague view includes primary and collaborating owners, not shared or past execution', () => {
  let state = addPerson(addPerson(initial()), 'person-b', 'B');
  const [primary, collaborating, shared, completed] = state.tasks;
  state = applyCommand(state,{type:'assignTask',id:primary.id,ids:['person-a'],shared:false});
  state = applyCommand(state,{type:'assignTask',id:collaborating.id,ids:['person-b','person-a'],shared:false});
  state = applyCommand(state,{type:'assignTask',id:shared.id,ids:[],shared:true});
  state = applyCommand(state,{type:'addLog',id:completed.id,log:{id:'past-run',at:'2026-10-22T04:00:00Z',text:'完成工作',executorIds:['person-a']}});
  const before = structuredClone(state);
  const mine = {onlyLocal:true,localPersonId:'person-a'};
  assert.deepEqual(selectTasks(state,mine).map(t=>t.id),[primary.id,collaborating.id]);
  assert.deepEqual(selectTasks(state,{...mine,person:'person-b'}).map(t=>t.id),[collaborating.id]);
  assert.equal(selectTasks(state,{...mine,unassigned:true}).length,0);
  assert.equal(selectTasks(state,{...mine,category:'category-2'}).length,0);
  assert.equal(selectTasks(state,{...mine,difficulty:'5'}).length,0);
  assert.deepEqual(selectTasks(state,{...mine,search:primary.name}).map(t=>t.id),[primary.id]);
  assert.equal(selectTasks(state,{...mine,onlyLocal:false}).length,44);
  assert.deepEqual(state,before);
});

test('local colleague filter follows fixed IDs and never falls back to all tasks for invalid defaults', () => {
  let state = addPerson(addPerson(initial()), 'person-b', 'B');
  state = applyCommand(state,{type:'assignTask',id:state.tasks[0].id,ids:['person-a'],shared:false});
  state = applyCommand(state,{type:'renamePerson',id:'person-a',name:'改名'});
  assert.equal(selectTasks(state,{onlyLocal:true,localPersonId:'person-a'}).length,1);
  for (const id of ['',undefined,'missing','person-b']) {
    assert.equal(selectTasks(state,{onlyLocal:true,localPersonId:id}).length,0);
  }
  state.staff[0].active = false;
  assert.equal(selectTasks(state,{onlyLocal:true,localPersonId:'person-a'}).length,0);
  state.staff[0].active = true;
  state.staff[0].deleted = true;
  assert.equal(selectTasks(state,{onlyLocal:true,localPersonId:'person-a'}).length,0);
});

test('legacy logs can be corrected, reassigned and deleted with statistics recomputed', () => {
  let state = addPerson(addPerson(initial()), 'person-b', 'B');
  const id = state.tasks[0].id;
  state = applyCommand(state,{type:'addLog',id,log:{id:'old-run',at:'2026-10-19T00:30:00Z',text:'舊紀錄'}});
  delete state.tasks[0].logs[0].executorIds;
  const old = structuredClone(state.tasks[0].logs[0]);
  state = applyCommand(state,{type:'editLog',id,logId:old.id,expected:logFingerprint(old),changes:{at:'2026-10-21T01:30:00Z',text:'補正',executorIds:['person-a','person-b']}});
  assert.equal(executionHistory(state,'person-a')[0].logs.length,1);
  assert.equal(executionHistory(state,'person-b')[0].logs.length,1);
  assert.equal(state.tasks[0].logs[0].createdAt,old.createdAt);
  assert.equal(state.tasks[0].logs[0].id,old.id);
  assert.equal(listLogs(state,{date:localDateKey('2026-10-21T01:30:00Z')}).length,1);
  assert.equal(listLogs(state,{person:'unspecified'}).length,0);
  assert.equal(listLogs(state,{person:'person-b',search:'補正'}).length,1);
  assert.equal(listLogs(state,{date:localDateKey(old.at)}).length,0);
  assert.throws(()=>applyCommand(state,{type:'deleteLog',id,logId:old.id,expected:logFingerprint(old)}),/其他裝置/);
  const current = state.tasks[0].logs[0];
  assert.throws(()=>applyCommand(state,{type:'editLog',id,logId:old.id,expected:logFingerprint(current),changes:{id:'new-id'}}));
  assert.throws(()=>applyCommand(state,{type:'editLog',id,logId:old.id,expected:logFingerprint(current),changes:{at:'bad date'}}));
  state = applyCommand(state,{type:'editLog',id,logId:old.id,expected:logFingerprint(current),changes:{executorIds:['person-b']}});
  assert.equal(executionHistory(state,'person-a').length,0);
  assert.equal(executionHistory(state,'person-b').length,1);
  state = applyCommand(state,{type:'deleteLog',id,logId:old.id,expected:logFingerprint(state.tasks[0].logs[0])});
  assert.equal(executionHistory(state,'person-b').length,0);
  assert.equal(listLogs(state).length,0);
  assert.deepEqual(parseBackup(backup(state)),state);
});

test('quick logs use explicit executors and current time and coexist with older entries', () => {
  const base = addPerson(initial());
  const id = base.tasks[0].id;
  const state = applyCommand(base,{type:'addLog',id,log:{id:'quick-run',at:'2026-10-21T04:00:00Z',text:'完成工作',executorIds:['person-a']}});
  const rows = listLogs(state);
  assert.equal(rows[0].taskName,base.tasks[0].name);
  assert.equal(rows[0].log.text,'完成工作');
  assert.equal(executionHistory(state,'person-a')[0].logs.length,1);
  assert.equal(base.tasks[0].logs,undefined);
  assert.equal(logFingerprint({...rows[0].log,executorIds:undefined}),logFingerprint({...rows[0].log,executorIds:[]}));
});

test('actual executors have independent dated counts unaffected by assignment, rename or retirement', () => {
  let state = addPerson(addPerson(initial()), 'person-b', 'B');
  const id = state.tasks[0].id;
  state = edit(state,id,{assigneeId:'person-a'});
  const log = (entryId, at, executorIds) => { state = applyCommand(state,{type:'addLog',id,log:{id:entryId,at,text:'完成',executorIds}}); };
  log('run-old','2026-10-19T10:00:00Z',undefined);
  log('run-both','2026-10-20T10:00:00Z',['person-a','person-b']);
  log('run-b','2026-10-21T10:00:00Z',['person-b']);
  assert.equal(executionHistory(state,'person-a')[0].logs.length,1);
  assert.deepEqual(executionHistory(state,'person-b')[0].logs.map(x=>x.id),['run-b','run-both']);
  state = applyCommand(state,{type:'renamePerson',id:'person-b',name:'新名字'});
  state = applyCommand(state,{type:'personStatus',id:'person-b',active:false,deleted:true,reassignTo:null});
  state = applyCommand(state,{type:'assignTask',id,ids:[],shared:true});
  assert.equal(executionHistory(state,'person-b')[0].logs.length,2);
  assert.deepEqual(executionHistory(parseBackup(backup(state)),'person-b'),executionHistory(state,'person-b'));
  assert.throws(()=>applyCommand(state,{type:'addLog',id,log:{id:'bad-1',at:'2026-10-21',text:'完成',executorIds:['missing']}}));
  assert.throws(()=>applyCommand(state,{type:'addLog',id,log:{id:'bad-2',at:'2026-10-21',text:'完成',executorIds:['person-a','person-a']}}));
  delete state.tasks[0].logs[0].executorIds;
  assert.equal(executionHistory(fromFirebase(state),'person-a')[0].logs.length,1);
});

test('multiple owners, shared assignments and reassignment preserve legacy IDs and records', () => {
  let state = addPerson(addPerson(initial()), 'person-b', 'B');
  const id = state.tasks[0].id;
  state = applyCommand(state, {type:'assignTask', id, ids:['person-a','person-b'], shared:false});
  assert.equal(selectTasks(state, {person:'person-b'}).length, 1);
  assert.equal(statistics(state).assigned, 1);
  assert.deepEqual(statistics(state).workloads.map(p=>p.count), [1,1]);
  state = applyCommand(state, {type:'addLog', id, log:{id:'log-1',at:'2026-10-20T10:00:00Z',text:'完成盤點'}});
  state = applyCommand(state, {type:'personStatus',id:'person-b',active:false,deleted:true,reassignTo:'person-a'});
  assert.deepEqual(state.tasks[0].collaboratorIds, []);
  assert.equal(state.tasks[0].assigneeId, 'person-a');
  assert.equal(state.tasks[0].logs.length, 1);
  state = applyCommand(state, {type:'assignTask',id,ids:[],shared:true});
  assert.equal(selectTasks(state, {person:'shared'}).length, 1);
  assert.equal(selectTasks(state, {unassigned:true}).length, 43);
  assert.equal(statistics(state).workloads[0].count, 0);
  assert.equal(statistics(state).assigned, 1);
  assert.deepEqual(parseBackup(backup(state)),state);
  assert.deepEqual(fromFirebase(JSON.parse(JSON.stringify(state))),state);
  assert.throws(()=>applyCommand(state,{type:'assignTask',id,ids:['person-b'],shared:false}));
  assert.throws(()=>applyCommand(state,{type:'assignTask',id,ids:['person-a'],shared:true}));
});

test('execution logs append independently, survive later edits, and reject invalid entries', () => {
  let state = initial();
  const id = state.tasks[0].id;
  state = applyCommand(state,{type:'addLog',id,log:{id:'entry-1',at:'2026-10-20T02:30:00Z',text:'第一次處理'}});
  state = applyCommand(state,{type:'addLog',id,log:{id:'entry-2',at:'2026-10-21T02:30:00Z',text:'第二次處理'}});
  state = edit(state,id,{name:'更名工作',categoryId:state.categories[1].id});
  assert.equal(state.tasks[0].logs.length,2);
  assert.equal(state.tasks[1].logs,undefined);
  assert.throws(()=>applyCommand(state,{type:'addLog',id,log:{id:'entry-1',at:'2026-10-20',text:'重複 ID'}}));
  assert.throws(()=>applyCommand(state,{type:'addLog',id,log:{id:'entry-3',at:'invalid',text:'不合法日期'}}));
  assert.throws(()=>applyCommand(state,{type:'addLog',id,log:{id:'entry-3',at:'2026-10-20',text:' '}}));
  assert.equal(state.tasks[0].logs.length,2);
});

test('first initialization contains exactly 44 unique unrated and unassigned tasks in seven categories', () => {
  const state = initial();
  assert.equal(state.tasks.length,44); assert.equal(state.categories.length,7);
  assert.equal(new Set(state.tasks.map(t => t.id)).size,44);
  assert.equal(state.staff.length,0);
  assert.ok(state.tasks.every(t => t.difficulty === null && t.assigneeId === null && t.collaboratorIds.length === 0));
  assert.equal(state.tasks.find(t => t.name === '店內備品盤點、叫貨').notes,SUPPLIES_NOTE);
  validateState(state);
});
test('initialization preserves existing edits and deliberately empty task collections', () => {
  const state = edit(initial(),'work-1-1',{name:'已改名稱',difficulty:5});
  assert.deepEqual(initializeIfMissing(state),state);
  state.tasks = [];
  assert.equal(initializeIfMissing(state).tasks.length,0);
  assert.equal(initializeIfMissing(null).tasks.length,44);
});
test('local reload preserves edits without reseeding and isolates two fresh repositories', async () => {
  const storage = fakeStorage();
  const first = createLocalRepository(storage); let snapshot;
  await first.start(data => { snapshot=data; },()=>{});
  await first.commit({type:'editTask',id:'work-1-1',changes:{difficulty:4,notes:'保留'}});
  const second = createLocalRepository(storage);
  await second.start(data => { snapshot=data; },()=>{});
  assert.equal(snapshot.tasks.length,44);
  assert.equal(snapshot.tasks[0].difficulty,4);
  assert.equal(snapshot.tasks[0].notes,'保留');
  for (const task of [...snapshot.tasks]) await second.commit({type:'deleteTask',id:task.id});
  await createLocalRepository(storage).start(data => { snapshot=data; },()=>{});
  assert.equal(snapshot.tasks.length,0);
});
test('two local tabs apply commands to latest stored state', async () => {
  const storage = fakeStorage(), a=createLocalRepository(storage), b=createLocalRepository(storage);
  await a.start(()=>{},()=>{}); await b.start(()=>{},()=>{});
  await a.commit({type:'editTask',id:'work-1-1',changes:{difficulty:4}});
  const saved=await b.commit({type:'editTask',id:'work-1-2',changes:{difficulty:2}});
  assert.equal(saved.tasks[0].difficulty,4); assert.equal(saved.tasks[1].difficulty,2);
});
test('invalid existing local data is never overwritten', async () => {
  const storage=fakeStorage(); storage.setItem('bad','not json');
  await assert.rejects(createLocalRepository(storage,'bad').start(()=>{},()=>{}));
  assert.equal(storage.getItem('bad'),'not json');
});
test('CRUD uses stable IDs, accepts confirmed duplicates and preserves original object', () => {
  const old=initial(); const oldJSON=JSON.stringify(old);
  const command={type:'addTask',task:{id:'custom-work',name:old.tasks[0].name,categoryId:old.categories[0].id,notes:''}};
  assert.throws(()=>applyCommand(old,command),/相似/);
  const added=applyCommand(old,{...command,allowDuplicate:true});
  assert.equal(added.tasks.length,45); assert.equal(added.tasks.at(-1).difficulty,null);
  const renamed=edit(added,'custom-work',{name:'自訂工作',notes:'備註'});
  assert.equal(renamed.tasks.at(-1).id,'custom-work');
  const removed=applyCommand(renamed,{type:'deleteTask',id:'custom-work'});
  assert.equal(removed.tasks.length,44); assert.equal(JSON.stringify(old),oldJSON);
  assert.throws(()=>edit(removed,'missing',{name:'錯誤'}),/刪除/);
});
test('similarity detects exact, punctuation/case variations and related names', () => {
  const tasks=[{id:'a',name:'店內文宣、DM 更新'},{id:'b',name:'每月發票整理'}];
  assert.equal(duplicates(tasks,'店內文宣 DM更新').length,1);
  assert.equal(duplicates(tasks,'每月發票整理').length,1);
  assert.equal(duplicates(tasks,'每月發票整理及核對').length,1);
  assert.equal(duplicates(tasks,'每月發票整理','b').length,0);
  assert.equal(duplicates(tasks,'換冷氣').length,0);
});
test('category edits and transfers preserve ownership, difficulty, notes and task ID', () => {
  let state=addPerson(initial()); state=edit(state,'work-1-1',{difficulty:4,assigneeId:'person-a',notes:'原備註'});
  state=applyCommand(state,{type:'renameCategory',id:'category-1',name:'新分類名稱'});
  assert.throws(()=>applyCommand(state,{type:'deleteCategory',id:'category-1'}),/轉移/);
  state=applyCommand(state,{type:'deleteCategory',id:'category-1',targetId:'category-2'});
  const task=state.tasks[0];
  assert.equal(state.tasks.length,44); assert.equal(task.id,'work-1-1');
  assert.equal(task.categoryId,'category-2'); assert.equal(task.difficulty,4);
  assert.equal(task.assigneeId,'person-a'); assert.equal(task.notes,'原備註');
});
test('rename, disable and soft deletion never destroy staff-linked tasks', () => {
  let state=addPerson(initial()); state=addPerson(state,'person-b','同仁 B');
  state=edit(state,'work-1-1',{assigneeId:'person-a'});
  state=applyCommand(state,{type:'renamePerson',id:'person-a',name:'改名'});
  assert.equal(state.tasks[0].assigneeId,'person-a');
  state=applyCommand(state,{type:'personStatus',id:'person-a',active:false,deleted:false});
  assert.equal(state.tasks[0].assigneeId,'person-a');
  assert.throws(()=>edit(state,'work-1-2',{assigneeId:'person-a'}),/停用/);
  state=applyCommand(state,{type:'personStatus',id:'person-a',active:false,deleted:true,reassignTo:'person-b'});
  assert.equal(state.tasks.length,44); assert.equal(state.tasks[0].assigneeId,'person-b');
  assert.equal(state.staff.find(p=>p.id==='person-a').deleted,true);
});
test('staff may be unassigned or kept as retired with visible workload', () => {
  let state=edit(addPerson(initial()),'work-1-1',{assigneeId:'person-a'});
  state=applyCommand(state,{type:'personStatus',id:'person-a',active:false,deleted:true});
  assert.equal(statistics(state).workloads[0].count,1);
  state=applyCommand(state,{type:'personStatus',id:'person-a',active:false,deleted:true,reassignTo:null});
  assert.equal(state.tasks[0].assigneeId,null);
});
test('stars are independent, null is excluded from averages, reset supported', () => {
  let state=addPerson(initial());
  state=edit(state,'work-1-1',{assigneeId:'person-a',difficulty:5});
  state=edit(state,'work-1-2',{assigneeId:'person-a',difficulty:1});
  state=edit(state,'work-1-3',{assigneeId:'person-a'});
  const stats=statistics(state), person=stats.workloads[0];
  assert.equal(stats.assigned,3); assert.equal(stats.unassigned,41);
  assert.deepEqual([person.count,person.rated,person.stars,person.average,person.unrated],[3,2,6,3,1]);
  state=edit(state,'work-1-1',{difficulty:null});
  assert.equal(state.tasks[1].difficulty,1);
  assert.equal(statistics(state).workloads[0].average,1);
  for(const value of [0,6,-1,2.5,'3']) assert.throws(()=>edit(state,'work-1-1',{difficulty:value}));
});
test('filters and every sort operate on a copy and place unrated work last', () => {
  let state=addPerson(initial());
  state=edit(state,'work-1-1',{assigneeId:'person-a',difficulty:5});
  state=edit(state,'work-1-2',{difficulty:1});
  const before=JSON.stringify(state);
  assert.equal(selectTasks(state,{search:'零用金'}).length,2);
  assert.equal(selectTasks(state,{category:'category-1'}).length,8);
  assert.equal(selectTasks(state,{person:'person-a'}).length,1);
  assert.equal(selectTasks(state,{person:'unassigned'}).length,43);
  assert.equal(selectTasks(state,{unassigned:true,difficulty:'unrated'}).length,42);
  assert.equal(selectTasks(state,{difficulty:'5'})[0].id,'work-1-1');
  assert.equal(selectTasks(state,{sort:'difficulty-desc'})[0].difficulty,5);
  assert.equal(selectTasks(state,{sort:'difficulty-asc'})[0].difficulty,1);
  assert.equal(selectTasks(state,{sort:'person'})[0].assigneeId,'person-a');
  assert.equal(selectTasks(state,{sort:'category'})[0].categoryId,'category-1');
  assert.equal(JSON.stringify(state),before);
});
test('manual task and category orders persist independently', () => {
  const state=initial();
  const moved=applyCommand(state,{type:'move',collection:'tasks',id:'work-1-2',direction:-1});
  assert.equal(selectTasks(moved,{sort:'manual'})[0].id,'work-1-2');
  assert.equal(selectTasks(state,{sort:'manual'})[0].id,'work-1-1');
  const categoryMoved=applyCommand(moved,{type:'move',collection:'categories',id:'category-2',direction:-1});
  assert.equal(selectTasks(categoryMoved,{sort:'category'})[0].categoryId,'category-2');
});
test('complete JSON backup round-trip and atomic revision-checked import', () => {
  const state=edit(addPerson(initial()),'work-1-1',{difficulty:4,assigneeId:'person-a'});
  const restored=parseBackup(backup(state));
  assert.deepEqual(restored,state);
  const imported=applyCommand(initial(),{type:'import',data:restored,expectedRevision:0});
  assert.equal(imported.tasks[0].difficulty,4);
  assert.throws(()=>applyCommand(state,{type:'import',data:restored,expectedRevision:0}),/其他裝置/);
});
test('invalid imports fail for malformed JSON, version, duplicate IDs, missing references and bad fields', () => {
  assert.throws(()=>parseBackup('{')); assert.throws(()=>parseBackup('{}'));
  const mutations=[
    s=>{s.schemaVersion=99;}, s=>{s.tasks[1].id=s.tasks[0].id;},
    s=>{s.tasks[0].categoryId='missing';}, s=>{s.tasks[0].assigneeId='missing';},
    s=>{s.tasks[0].difficulty=6;}, s=>{s.tasks[0].notes=123;},
    s=>{s.tasks[0].collaboratorIds=['missing'];}, s=>{s.categories=[];},
    s=>{delete s.initializedAt;}, s=>{s.tasks[0].id='../bad';},
  ];
  for (const mutate of mutations) {
    const s=initial(); mutate(s);
    assert.throws(()=>parseBackup(JSON.stringify({format:'all-tool/work-assignment',data:s})));
  }
});
test('firebase null/empty-array serialization preserves unassessed values without seeding', () => {
  const raw=initial(); delete raw.staff;
  for (const task of raw.tasks) { delete task.difficulty; delete task.assigneeId; delete task.collaboratorIds; }
  const state=fromFirebase(raw); assert.equal(state.tasks[0].difficulty,null);
  delete raw.tasks; assert.equal(fromFirebase(raw).tasks.length,0);
  assert.throws(()=>fromFirebase(null));
  assert.equal(CLOUD_PATH,'users/single-user/workAssignment');
});
test('failed persistence does not report successful new data', async () => {
  let fail=false;
  const memory=fakeStorage();
  const storage={getItem:memory.getItem,setItem:(key,value)=>{if(fail)throw Error('full');memory.setItem(key,value);}};
  const repository=createLocalRepository(storage); let snapshot;
  await repository.start(data=>{snapshot=data;},()=>{}); fail=true;
  await assert.rejects(repository.commit({type:'deleteTask',id:'work-1-1'}),/full/);
  assert.equal(snapshot.tasks.length,44);
});

function fakeFirebase(value = null) {
  let current=value, writes=0;
  const listeners=[];
  const snapshot=()=>({exists:()=>current!==null,val:()=>structuredClone(current)});
  const notify=()=>listeners.forEach(fn=>fn(snapshot()));
  const sdk={
    ref:(_db,path)=>path,
    get:async()=>snapshot(),
    onValue:(path,fn)=>{ if(path==='.info/connected')fn({val:()=>true}); else {listeners.push(fn);fn(snapshot());} },
    runTransaction:async(path,fn,options)=>{
      assert.equal(path,CLOUD_PATH);assert.equal(options.applyLocally,false);
      const next=fn(structuredClone(current));
      if(next===undefined)return {committed:false,snapshot:snapshot()};
      current=next;writes++;notify();return {committed:true,snapshot:snapshot()};
    },
  };
  return {sdk,get current(){return current;},get writes(){return writes;},replace:value=>{current=value;notify();}};
}
test('Firebase adapter initializes once across two clients and preserves latest independent edits', async () => {
  const fake=fakeFirebase();
  const a=createFirebaseRepository(fake.sdk,{},fakeStorage());
  const b=createFirebaseRepository(fake.sdk,{},fakeStorage());
  await a.start(()=>{},()=>{},error=>{throw error;});
  await b.start(()=>{},()=>{},error=>{throw error;});
  assert.equal(fake.writes,1);assert.equal(fake.current.tasks.length,44);
  await a.commit({type:'editTask',id:'work-1-1',changes:{difficulty:5}});
  await b.commit({type:'editTask',id:'work-1-2',changes:{difficulty:2}});
  assert.equal(fake.current.tasks[0].difficulty,5);assert.equal(fake.current.tasks[1].difficulty,2);
});
test('Firebase adapter refuses reseeding when old local snapshot exists', async () => {
  const fake=fakeFirebase(), cache=fakeStorage();cache.setItem(CACHE_KEY,JSON.stringify(initial()));
  await assert.rejects(createFirebaseRepository(fake.sdk,{},cache).start(()=>{},()=>{},()=>{}),/未重新初始化/);
  assert.equal(fake.writes,0);assert.equal(fake.current,null);
});
test('Firebase invalid commands and unsupported schema cannot replace existing data', async () => {
  const fake=fakeFirebase(initial()), repo=createFirebaseRepository(fake.sdk,{},fakeStorage());
  await repo.start(()=>{},()=>{},()=>{});
  await assert.rejects(repo.commit({type:'editTask',id:'work-1-1',changes:{difficulty:20}}));
  assert.equal(fake.writes,0);assert.equal(fake.current.tasks[0].difficulty,null);
  const unknown={...initial(),schemaVersion:99}; fake.replace(unknown);
  await assert.rejects(repo.commit({type:'deleteTask',id:'work-1-1'}));
  assert.equal(fake.current.tasks.length,44);
});
