import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {BASE,PACKS,OPTIONS,calculate,createCalculator,PRICE_TYPES,TYPES,byName,digits} from '../apps/price-difference/calculator.mjs';
import {TABLES,parseGviz,parseTables,roundValue,roundingRule} from '../apps/price-difference/sheet-config.mjs';
import {readPriceConfig,createPriceConfigHandler} from '../server/price-difference-config.mjs';

const sample={srcCourse:'初階',srcPrice:'單堂方案/套裝價',remaining:3,srcDiscount:5,convert:'單堂',dstCourse:'高階(雙)',dstPrice:'會員',dstCount:3};
function fixture(){
 return {
  '課程價目':BASE.map(x=>[x.name,x.count,x.plan,x.nonmember,x.member,x.plan/x.count]),
  '套裝價目':PACKS.map(x=>[x.name,x.original,x.price]),
  '換算規則':OPTIONS.filter(x=>!BASE.some(b=>b.name===x.name)).map(x=>[x.name,x.group,calculate({...sample,srcCourse:x.name}).unit]),
  '計算設定':[
   ['小全套分攤堂數',24],['預設額外折扣百分比',0],['折扣最小百分比',0],['折扣最大百分比',60],['折扣按鈕增減幅度',1],
   ['原課程單堂價','四捨五入至整數'],['套裝換算單堂價','四捨五入至整數'],['剩餘價值','截斷至小數2位'],['目標總價','四捨五入至整數'],['差額','截斷至小數2位'],['顯示金額','四捨五入至整數'],
   ['差額小於或等於0','無需補價差'],['全套原課程價格類型','單堂方案/套裝價'],['目標單堂數量為0','不計算'],['CRM浮點尾點相容','TRUE']
  ]
 };
}
function setSetting(tables,key,value){tables['計算設定'].find(r=>r[0]===key)[1]=value;}
function gviz(name,rows,headers=TABLES[name]){return '/*O_o*/\ngoogle.visualization.Query.setResponse('+JSON.stringify({status:'ok',table:{cols:headers.map(label=>({label})),rows:rows.map(r=>({c:r.map(v=>v===null?null:{v})}))}})+');';}
function mockFetch(tables){return async url=>{const name=new URL(url).searchParams.get('sheet');return new Response(gviz(name,tables[name]));};}

test('sheet calculator preserves legacy output and all source choices with default rules',()=>{
 const engine=createCalculator(parseTables(fixture()));
 assert.deepEqual(engine.calculate(sample),calculate(sample));
 for(const option of OPTIONS)assert.deepEqual(engine.calculate({...sample,srcCourse:option.name}),calculate({...sample,srcCourse:option.name}));
 assert.deepEqual(engine.SRC_GROUPS,['一般','小全套','中全套','大全套','幼幼']);
});
test('live prices, conversion formulas, discounts and target packages are configurable',()=>{
 const tables=fixture();
 tables['課程價目'].find(r=>r[0]==='初階')[5]=2100.2;
 tables['課程價目'].find(r=>r[0]==='高階(雙)')[4]=4000;
 tables['套裝價目'][0][2]=50000;
 tables['換算規則'][0][2]=1234;
 setSetting(tables,'預設額外折扣百分比',2.5);
 setSetting(tables,'折扣按鈕增減幅度',0.5);
 const config=parseTables(tables),engine=createCalculator(config);
 const result=engine.calculate(sample);
 assert.equal(result.unit,2100);assert.equal(result.price,4000);assert.equal(result.diff,6015);
 assert.equal(engine.calculate({...sample,convert:'套裝',dstCourse:'小全套'}).newValue,50000);
 assert.equal(engine.calculate({...sample,srcCourse:tables['換算規則'][0][0]}).unit,1234);
 assert.equal(engine.calculate({...sample,srcDiscount:61}).done,false);
 assert.deepEqual(config.discount,{min:0,max:60,initial:2.5,step:0.5});
});
test('reference package rows do not duplicate options or become target plans',()=>{
 const tables=fixture();tables['課程價目'].push(['小全套初階',null,null,null,null,1920.833]);
 const config=parseTables(tables);
 assert.equal(config.base.length,7);assert.equal(config.options.length,19);
 const parsed=parseGviz(gviz('套裝價目',tables['套裝價目'],['套裝名稱','方案原價','套裝價']),'套裝價目');
 assert.deepEqual(parsed,tables['套裝價目']);
});
test('rounding and CRM compatibility options are honored',()=>{
 const tables=fixture();setSetting(tables,'CRM浮點尾點相容','FALSE');
 setSetting(tables,'顯示金額','四捨五入至小數2位');
 const engine=createCalculator(parseTables(tables));
 const result=engine.calculate(sample);
 assert.match(result.crm,/單堂價值1988\(折5%\)/);
 assert.equal(result.c23,'需補價差 NT$3,334.2');
 assert.equal(roundValue(-1.235,roundingRule('四捨五入至小數2位')),-1.24);
 assert.equal(roundValue(-1.239,roundingRule('截斷至小數2位')),-1.23);
});
test('invalid or incomplete sheets fail atomically',()=>{
 const mutations=[
  t=>delete t['換算規則'],
  t=>t['課程價目'].push(t['課程價目'][0]),
  t=>t['套裝價目'].push(t['套裝價目'][0]),
  t=>t['課程價目'][0][5]=null,
  t=>t['換算規則'][0][2]='#REF!',
  t=>t['課程價目'][0][1]=0,
  t=>setSetting(t,'折扣最大百分比',101),
  t=>setSetting(t,'折扣最小百分比',70),
  t=>setSetting(t,'預設額外折扣百分比',61),
  t=>setSetting(t,'折扣按鈕增減幅度',0),
  t=>setSetting(t,'差額','自訂任意程式'),
  t=>setSetting(t,'目標單堂數量為0','計算'),
  t=>setSetting(t,'CRM浮點尾點相容','maybe'),
  t=>t['計算設定'].push(['未知設定',1]),
  t=>t['計算設定'].push(t['計算設定'][0])
 ];
 for(const mutation of mutations){const tables=fixture();mutation(tables);assert.throws(()=>parseTables(tables));}
 assert.throws(()=>parseGviz('<html>login required</html>','課程價目'));
 assert.throws(()=>parseGviz(gviz('課程價目',[],['wrong']),'課程價目'));
});
test('server reads four bounded known tabs, returns raw validated tables, never caches errors',async()=>{
 const tables=fixture(),calls=[];
 const handler=createPriceConfigHandler({fetchImpl:async(url,options)=>{
  calls.push([new URL(url),options]);return mockFetch(tables)(url);
 }});
 const response=await handler(new Request('https://tool.example/api/price-difference-config'));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 const payload=await response.json();assert.equal(parseTables(payload.tables).base.length,7);
 assert.ok(Number.isFinite(Date.parse(payload.fetchedAt)));assert.equal(calls.length,4);
 for(const [url,options] of calls){assert.equal(url.host,'docs.google.com');assert.equal(url.searchParams.get('range'),'A1:F202');assert.equal(options.cache,'no-store');}
 assert.equal((await handler(new Request('https://tool.example/',{method:'POST'}))).status,405);
 const denied=createPriceConfigHandler({fetchImpl:async()=>new Response('denied',{status:403})});
 const failure=await denied(new Request('https://tool.example/'));assert.equal(failure.status,503);
 assert.match((await failure.json()).error,/403/);
});
test('timeouts include stalled response bodies and formula failure blocks the whole response',async()=>{
 await assert.rejects(readPriceConfig({timeoutMs:10,fetchImpl:async()=>({ok:true,text:()=>new Promise(()=>{})})}),/逾時/);
 const tables=fixture();tables['換算規則'][0][2]=null;
 await assert.rejects(readPriceConfig({fetchImpl:mockFetch(tables)}),/缺少數值/);
});

test('page loads sheet values, refreshes existing selections and blocks copy after a failed refresh',async()=>{
 const html=await readFile(new URL('../apps/price-difference/index.html',import.meta.url),'utf8');
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?$/gm,'');
 const nodes=new Map();
 const makeNode=()=>({children:[],dataset:{},style:{},scrollLeft:0,textContent:'',classList:{toggle(){},add(){},remove(){}},addEventListener(){},setAttribute(){},append(x){this.children.push(x)},replaceChildren(){this.children=[]}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);};
 let tables=fixture(),fail=false;
 const context=vm.createContext({
  createCalculator,PRICE_TYPES,TYPES,byName,digits,parseTables,
  setTimeout,clearTimeout,AbortController,requestAnimationFrame(){},
  document:{getElementById:node,createElement:makeNode,querySelector:node,querySelectorAll(){return[];},addEventListener(){}},
  window:{addEventListener(){}},
  fetch:async()=>new Response(JSON.stringify(fail?{error:'讀取失敗'}:{tables,fetchedAt:new Date().toISOString()}),{status:fail?503:200,headers:{'Content-Type':'application/json'}})
 });
 await vm.runInContext(script,context);
 assert.equal(node('srcDiscount').max,60);
 assert.equal(node('.forms').inert,false);
 assert.match(node('configStatus').textContent,/已同步/);
 context.sample=sample;
 vm.runInContext('s={...s,...sample};renderAll()',context);
 assert.equal(vm.runInContext('currentResult.diff',context),3334.2);
 tables['課程價目'].find(r=>r[0]==='高階(雙)')[4]=4000;
 await vm.runInContext('loadPrices()',context);
 assert.equal(vm.runInContext('s.srcCourse',context),'初階');
 assert.equal(vm.runInContext('currentResult.diff',context),6334.2);
 fail=true;await vm.runInContext('loadPrices()',context);
 assert.equal(vm.runInContext('currentResult.done',context),false);
 assert.equal(node('.forms').inert,true);
 assert.match(node('configStatus').textContent,/暫停計算/);
 fail=false;await vm.runInContext('loadPrices()',context);
 assert.equal(vm.runInContext('currentResult.done',context),true);
});
