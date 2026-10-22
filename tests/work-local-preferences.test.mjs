import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutorPreference, DEFAULT_EXECUTOR_KEY } from '../apps/work-assignment/local-preferences.mjs';
import { createInitialState, applyCommand, executionHistory } from '../apps/work-assignment/model.mjs';

const storage = () => {
  const data = new Map();
  return {getItem:key=>data.get(key) ?? null, setItem:(key,value)=>data.set(key,value), removeItem:key=>data.delete(key)};
};
const staff = [{id:'a',name:'A',active:true,deleted:false},{id:'b',name:'B',active:true,deleted:false}];

test('default executor persists by ID across reloads and renames, without changing another device', () => {
  const device = storage(), other = storage();
  const preference = createExecutorPreference(()=>device);
  assert.deepEqual(preference.resolve(staff),[]);
  assert.equal(preference.set('a'),true);
  assert.equal(device.getItem(DEFAULT_EXECUTOR_KEY),'a');
  const reopened = createExecutorPreference(()=>device);
  assert.deepEqual(reopened.resolve(staff.map(person=>({...person,name:'Renamed'}))),['a']);
  assert.deepEqual(createExecutorPreference(()=>other).resolve(staff),[]);
  assert.equal(reopened.set(''),true);
  assert.equal(device.getItem(DEFAULT_EXECUTOR_KEY),null);
  assert.deepEqual(createExecutorPreference(()=>device).resolve(staff),[]);
});

test('temporary multi-person and empty overrides do not replace the saved default', () => {
  const device = storage(), preference = createExecutorPreference(()=>device);
  preference.set('a');
  assert.deepEqual(preference.resolve(staff,['b','a','b']),['b','a']);
  assert.deepEqual(preference.resolve(staff,[]),[]);
  assert.deepEqual(createExecutorPreference(()=>device).resolve(staff),['a']);
  preference.set('b');
  assert.deepEqual(preference.resolve(staff),['b']);
});

test('unavailable defaults never select someone else or erase preference during partial loading', () => {
  const preference = createExecutorPreference(()=>storage());
  preference.set('a');
  assert.deepEqual(preference.resolve([]),[]);
  assert.equal(preference.id,'a');
  for (const changes of [{active:false},{deleted:true}]) {
    assert.deepEqual(preference.resolve([{...staff[0],...changes},staff[1]]),[]);
  }
  assert.deepEqual(preference.resolve(staff),['a']);
});

test('denied storage is safe and reports failed persistence while supporting this session', () => {
  const preference = createExecutorPreference(()=>{throw new Error('SecurityError');});
  assert.equal(preference.id,'');
  assert.equal(preference.set('b'),false);
  assert.deepEqual(preference.resolve(staff),['b']);
  assert.equal(preference.set(''),false);
  assert.deepEqual(preference.resolve(staff),[]);
});

test('quick default is recorded as actual executor without altering task owners or old logs', () => {
  let state = createInitialState('2026-10-22T00:00:00Z');
  state = applyCommand(state,{type:'addPerson',id:'a',name:'A'});
  const id = state.tasks[0].id;
  state = applyCommand(state,{type:'addLog',id,log:{id:'legacy',at:'2026-10-20T01:00:00Z',text:'Old',executorIds:[]}});
  const preference = createExecutorPreference(()=>storage());
  preference.set('a');
  state = applyCommand(state,{type:'addLog',id,log:{id:'quick',at:'2026-10-22T01:00:00Z',text:'完成工作',executorIds:preference.resolve(state.staff)}});
  assert.equal(state.tasks[0].assigneeId,null);
  assert.deepEqual(state.tasks[0].logs[0].executorIds,[]);
  assert.equal(executionHistory(state,'a')[0].logs.length,1);
  assert.equal(executionHistory(state,'a')[0].logs[0].id,'quick');
});
