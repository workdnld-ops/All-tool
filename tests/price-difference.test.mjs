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

test('package source keeps full precision through all-staff sheet calculations',()=>{
  const result=calculate({srcCourse:'小全套中階',srcPrice:'單堂方案/套裝價',remaining:2,srcDiscount:12,convert:'單堂',dstCourse:'幼幼8堂',dstPrice:'單堂方案/套裝價',dstCount:2});
  assert.equal(result.oldValue,3380.66);
  assert.equal(result.diff,1394.34);
  assert.equal(result.crm,'#轉換單堂_原課程:小全套中階_單堂價值1920.83333333333(折12%)_剩餘2堂_殘餘總值3380.66_目標:幼幼8堂_單堂方案/套裝價2387.5x2堂_總價4775_差價1394.34_需補價差 NT$1,394');
});

test('all-staff formulas agree to cents for other package, plan, negative and fractional cases',()=>{
  const cases=[
    [{srcCourse:'中全套(單/桃雙)高階',srcPrice:'單堂方案/套裝價',remaining:3,srcDiscount:5,convert:'單堂',dstCourse:'中階',dstPrice:'會員',dstCount:3},8162.63,-962.63,7200],
    [{srcCourse:'大全套(雙)初階',srcPrice:'單堂方案/套裝價',remaining:6,srcDiscount:0,convert:'方案',dstCourse:'初階',dstPrice:'',dstCount:0},11081.2,4818.8,15900],
    [{srcCourse:'幼幼24堂',srcPrice:'單堂方案/套裝價',remaining:5,srcDiscount:7.5,convert:'套裝',dstCourse:'中全套(雙)',dstPrice:'',dstCount:0},10271.35,56228.65,66500]
  ];
  for(const [input,oldValue,diff,newValue] of cases){
    const result=calculate(input);
    assert.equal(result.oldValue,oldValue);
    assert.equal(result.newValue,newValue);
    assert.equal(result.diff,diff);
  }
});

test('target discount follows the all-staff worksheet formula and copy text',()=>{
  const result=calculate({srcCourse:'幼幼8堂',srcPrice:'單堂方案/套裝價',remaining:2,srcDiscount:12,convert:'單堂',dstCourse:'中階',dstPrice:'會員',dstCount:2,dstDiscount:5});
  assert.equal(result.newValue,4560);
  assert.equal(result.diff,358);
  assert.equal(result.crm,'#轉換單堂_原課程:幼幼8堂_單堂價值2387.5(折12%)_剩餘2堂_殘餘總值4202_目標:中階_會員2400x2堂(折5%)_總價4560_差價358_需補價差 NT$358');
  assert.equal(result.student,'學員原購買「幼幼8堂」，剩餘 2 堂，殘餘價值 NT$4,202；轉換為「中階」 2 堂（會員 NT$2,400/堂），總價 NT$4,560（已含 5% 優惠）。需補價差 NT$358。');
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
