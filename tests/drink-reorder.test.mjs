import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderDraft} from '../apps/drink-calculator/reorder.mjs';

const stores = [{id:'neihu'}, {id:'ruiguang'}];
const items = [{id:'fin',name:'Fin'}, {id:'cola',name:'可樂'}];
test('reorder uses saved store and decimal quantity with inventory based on current limits', () => {
  const order = {storeId:'ruiguang',items:{fin:{boxes:7.5},cola:{boxes:2}}};
  const before = structuredClone(order);
  const draft = createOrderDraft(order,items,stores,(store,item)=>item.id==='fin' ? 14 : 9);
  assert.equal(draft.storeId,'ruiguang');
  assert.deepEqual(draft.quantities,{fin:'7.5',cola:'2'});
  assert.deepEqual(draft.inventory,{fin:'6.5',cola:'7'});
  assert.deepEqual(order,before);
});
test('reorder respects updated limits and reports unavailable or invalid items', () => {
  const draft = createOrderDraft({storeId:'neihu',items:{fin:{boxes:15},missing:{name:'舊品項',boxes:2},cola:{boxes:-1}}},items,stores,()=>10);
  assert.deepEqual(draft.quantities,{fin:'10'});
  assert.deepEqual(draft.inventory,{fin:'0'});
  assert.deepEqual(draft.clamped,['Fin']);
  assert.equal(draft.skipped.length,2);
  assert.throws(()=>createOrderDraft({storeId:'unknown',items:{}},items,stores,()=>10));
  assert.throws(()=>createOrderDraft({storeId:'neihu',items:{missing:{boxes:2}}},items,stores,()=>10));
});
test('unlimited and zero order quantities are restored without saving inventory in the source', () => {
  const draft = createOrderDraft({storeId:'neihu',items:{fin:{boxes:0},cola:{boxes:1.5}}},items,stores,()=>Infinity);
  assert.deepEqual(draft.quantities,{fin:'0',cola:'1.5'});
  assert.deepEqual(draft.inventory,{});
});
