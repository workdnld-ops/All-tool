import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, initializeIfMissing, validateState, fromFirebase, applyCommand, selectTasks, statistics, duplicates, backup, parseBackup, SUPPLIES_NOTE } from '../apps/work-assignment/model.mjs';
import { createLocalRepository, createFirebaseRepository, CLOUD_PATH, CACHE_KEY } from '../apps/work-assignment/storage.mjs';
const initial = () => createInitialState('2026-10-19T00:00:00.000Z');
const addPerson = (state, id = 'person-a', name = '同仁 A') => applyCommand(state, {type:'addPerson',id,name});
const edit = (state, id, changes) => applyCommand(state, {type:'editTask',id,changes});
const fakeStorage = () => {
  const map = new Map();
  return { getItem:key => map.has(key) ? map.get(key) : null, setItem:(key,value) => map.set(key,value) };
};

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
