import assert from 'node:assert/strict';
import test from 'node:test';
import {calculate,SRC_GROUPS} from '../apps/price-difference/calculator.mjs';

const sample = {srcCourse:'初階',srcPrice:'單堂方案/套裝價',remaining:3,srcDiscount:5,convert:'單堂',dstCourse:'高階(雙)',dstPrice:'會員',dstCount:3};

test('source categories start with general courses and end with young children',()=>{
  assert.deepEqual(SRC_GROUPS,['一般','小全套','中全套','大全套','幼幼']);
});

test('direct percentage input handles fractional discounts and both limits',()=>{
  for(const [srcDiscount,oldValue] of [[0,5962.5],[2.5,5813.43],[100,0]]) {
    assert.equal(calculate({...sample,srcDiscount}).oldValue,oldValue);
  }
});

test('source sheet example preserves source unit precision and both copy formats',()=>{
  const result = calculate(sample);
  assert.equal(result.diff,3335.63);
  assert.equal(result.crm,'#轉換單堂_原課程:初階_單堂價值1987.5(折5%)_剩餘3堂_殘餘總值5664.37_目標:高階(雙)_會員3000x3堂_總價9000_差價3335.63_需補價差 NT$3,336');
  assert.equal(result.student,'學員原購買「初階」，剩餘 3 堂，殘餘價值 NT$5,664；轉換為「高階(雙)」 3 堂（會員 NT$3,000/堂），總價 NT$9,000。需補價差 NT$3,336。');
});

test('all-staff worksheet young-child example matches its CRM output exactly',()=>{
  const result=calculate({srcCourse:'幼幼8堂',srcPrice:'單堂方案/套裝價',remaining:2,srcDiscount:12,convert:'單堂',dstCourse:'中階',dstPrice:'會員',dstCount:2});
  assert.equal(result.unit,2387.5);
  assert.equal(result.oldValue,4202);
  assert.equal(result.diff,598);
  assert.equal(result.crm,'#轉換單堂_原課程:幼幼8堂_單堂價值2387.5(折12%)_剩餘2堂_殘餘總值4202_目標:中階_會員2400x2堂_總價4800_差價598_需補價差 NT$598');
});

test('plan and package conversions use the fixed price and ignore single-lesson count',()=>{
  for(const [convert,dstCourse,price] of [['方案','中階',33200],['套裝','小全套',46100]]) {
    const result=calculate({...sample,convert,dstCourse,dstPrice:'',dstCount:0});
    assert.equal(result.done,true);
    assert.equal(result.newValue,price);
  }
});

test('missing inputs block output and sufficient credit requires no payment',()=>{
  for(const change of [{srcCourse:''},{remaining:''},{dstCount:0},{dstPrice:''}]) {
    assert.equal(calculate({...sample,...change}).done,false);
  }
  const credit=calculate({...sample,remaining:12});
  assert.ok(credit.diff<0);
  assert.match(credit.student,/無需補價差/);
});
