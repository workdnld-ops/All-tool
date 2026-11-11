import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,parseDay,stockForecast,dayKey} from '../apps/credit-card-slip-stats/model.mjs';
import {textareaHeight} from '../assets/auto-textarea.mjs';
import {PALETTE,paletteInk,changePreferences,validatePreferences,readPreferences,orderedIds,firebasePreferences,PREFERENCES_PATH} from '../assets/toolbox-preferences.mjs';
import {createInitialState,applyCommand,selectTasks,backup,parseBackup} from '../apps/work-assignment/model.mjs';
const memory=() => {const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};

test('all toolbox swatches have matching dark ink with readable text contrast',()=>{
  const luminance=hex=>hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  for (const [name,color,ink] of PALETTE) {
    assert.equal(paletteInk(color),ink);
    for (const background of [color,'#FFFFFF']) assert.ok((luminance(background)+.05)/(luminance(ink)+.05)>=4.5,`${name} text contrast on ${background}`);
    const saved=changePreferences({version:1,order:[],colors:{}},{type:'color',id:'todo-board',color});
    assert.deepEqual(saved.colors,{'todo-board':color});
    assert.deepEqual(changePreferences(saved,{type:'color',id:'todo-board',color:null}).colors,{});
  }
  assert.equal(paletteInk('#FFE8A8'),'#805500');
  assert.equal(paletteInk('unknown'),null);
});

test('paper records are strict, unique, selected-year counts with seasonal forecasts',()=>{
  const result=analyze({2024:'1/1, 1/11, 1/11 2/30 invalid 2/29 7/1',2023:'12/22',bad:{}},2024);
  assert.equal(result.periods.find(p=>p.key==='year').recorded,4);
  assert.equal(result.periods.find(p=>p.key==='q1').recorded,3);
  assert.equal(result.periods.find(p=>p.key==='peak').recorded,3);
  assert.equal(result.intervals.length,4);
  assert.equal(parseDay('2023-02-29'),null);
  assert.notEqual(parseDay('2024-02-29'),null);
  assert.equal(dayKey(new Date('2026-11-10T16:00:00Z')),'2026-11-11');
  assert.ok(result.periods.every(p=>p.estimate>0));
});
test('paper forecasts respect leap years, no-data and fallback rates',()=>{
  const result=analyze({2024:'1/1,1/11'},2024);
  assert.equal(result.rates.peak,.1);assert.equal(result.rates.off,.1);
  assert.ok(Math.abs(result.periods.find(p=>p.key==='year').estimate-36.6)<.0001);
  assert.ok(analyze({2026:'1/1'}).periods.every(p=>p.estimate===null));
  assert.equal(analyze({},2026).stats.full.count,0);
});
test('stock forecast subtracts elapsed use and crosses season boundary',()=>{
  const rates={peak:1,off:.5};
  assert.deepEqual(stockForecast({date:'2026-01-30',quantity:5},rates,'2026-01-31'),{remaining:4,days:7,end:'2026-02-07'});
  assert.equal(stockForecast({date:'2026-01-01',quantity:1},rates,'2026-01-11').remaining,0);
  assert.equal(stockForecast({date:'2026-01-01',quantity:0},rates,'2026-01-01').days,0);
  assert.equal(stockForecast({date:'2026-01-02',quantity:1},rates,'2026-01-01'),null);
  assert.equal(stockForecast({date:'2026-01-01',quantity:1.5},rates,'2026-01-01'),null);
  assert.equal(stockForecast({date:'2026-01-01',quantity:1},{peak:null,off:null},'2026-01-01'),null);
  assert.equal(stockForecast({date:'2026-01-01',quantity:10},{peak:.1,off:.1},'2026-01-01').days,100);
  assert.equal(stockForecast({date:'2026-01-01',quantity:1},{peak:.1,off:.1},'2026-01-11').remaining,0);
});
test('category-local ordering preserves other groups and all work settings',()=>{
  const base=createInitialState(), id='work-2-2', original=structuredClone(base);
  const next=applyCommand(base,{type:'move',collection:'tasks',id,direction:-1});
  assert.equal(selectTasks(next,{category:'category-2',sort:'manual'})[0].id,id);
  assert.deepEqual(next.tasks.filter(t=>t.categoryId==='category-1'),base.tasks.filter(t=>t.categoryId==='category-1'));
  assert.deepEqual(base,original);
  const sorted=selectTasks(next,{sort:'manual'});
  assert.equal(sorted[8].id,id);
  const grouped=applyCommand(next,{type:'move',collection:'categories',id:'category-2',direction:-1});
  assert.equal(selectTasks(grouped,{sort:'manual'})[0].id,id);
  assert.deepEqual(parseBackup(backup(grouped)),grouped);
  const boundary=applyCommand(next,{type:'move',collection:'tasks',id,direction:-1});
  assert.equal(selectTasks(boundary,{category:'category-2'})[0].id,id);
});
test('notes height grows, shrinks and stays within the keyboard viewport',()=>{
  assert.equal(textareaHeight(30,800),76);
  assert.equal(textareaHeight(300,800),300);
  assert.equal(textareaHeight(1200,800),700);
  assert.equal(textareaHeight(1200,340),240);
});
test('toolbox migration, palette validation and independent order/color edits',()=>{
  const storage=memory();storage.setItem('opsToolboxToolOrder','["todo-board","drink-calculator"]');
  const state=readPreferences(storage);
  assert.equal(PALETTE.length,18);
  assert.deepEqual(orderedIds(['new-tool','drink-calculator','todo-board'],state.order),['todo-board','drink-calculator','new-tool']);
  const colored=changePreferences(state,{type:'color',id:'todo-board',color:'#E7B1B1'});
  const ordered=changePreferences(colored,{type:'order',order:['drink-calculator','todo-board']});
  assert.equal(ordered.colors['todo-board'],'#E7B1B1');
  assert.deepEqual(changePreferences(ordered,{type:'color',id:'todo-board',color:null}).colors,{});
  assert.throws(()=>changePreferences(state,{type:'color',id:'todo-board',color:'red'}));
  assert.throws(()=>validatePreferences({version:1,order:['x','x']}));
  assert.throws(()=>validatePreferences({version:2}));
  assert.deepEqual(validatePreferences({version:1}),{version:1,order:[],colors:{}});
});
test('toolbox two-device cloud sync keeps first migration and merges separate fields',async()=>{
  let cloud=null, connected=true;
  const watchers=[];
  const snapshot=value=>({exists:()=>value!==null,val:()=>structuredClone(value)});
  const sdk={
    ref:(_,path)=>path,
    get:async()=>snapshot(cloud),
    onValue:(path,callback)=>{watchers.push([path,callback]);callback(snapshot(path==='.info/connected'?connected:cloud));},
    runTransaction:async(_,update)=>{
      const next=update(structuredClone(cloud));
      if(next===undefined)return {committed:false,snapshot:snapshot(cloud)};
      cloud=next;for(const [path,fn] of watchers)if(path===PREFERENCES_PATH)fn(snapshot(cloud));
      return {committed:true,snapshot:snapshot(cloud)};
    },
  };
  const aStore=memory(),bStore=memory();aStore.setItem('opsToolboxToolOrder','["todo-board","drink-calculator"]');
  let aData,bData;
  const a=firebasePreferences(sdk,{},aStore,value=>aData=value,()=>{});
  const b=firebasePreferences(sdk,{},bStore,value=>bData=value,()=>{});
  await a.start();await b.start();
  assert.deepEqual(bData.order,['todo-board','drink-calculator']);
  await a.commit({type:'color',id:'todo-board',color:'#BFE7D5'});
  await b.commit({type:'order',order:['drink-calculator','todo-board']});
  assert.deepEqual(aData,bData);
  assert.equal(aData.colors['todo-board'],'#BFE7D5');
  assert.deepEqual(readPreferences(aStore),bData);
  connected=false;for(const [path,fn]of watchers)if(path==='.info/connected')fn(snapshot(false));
  await assert.rejects(a.commit({type:'color',id:'todo-board',color:null}),/雲端/);
});
