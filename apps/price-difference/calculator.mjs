/*
  價目來源：「換算價格表 by Jack」A1:K20，2026-11-08 讀取快照。
  輸出文字來源：「補價差計算機(全體同仁)」B27 / B30 原始 Google Sheets 公式。
  注意：來源 C9 = 1/(1/1988) 實際有效數值 1987.9999999999998，
  試算表在 CRM 串接文字時會輸出「1988.」(末尾句點)，此版保留該已觀察的行為。
*/
import {roundValue} from './sheet-config.mjs';
const BASE = [
 {name:'幼幼8堂',count:8,plan:19100,nonmember:3100,member:2650},
 {name:'幼幼16堂',count:16,plan:37400,nonmember:3100,member:2650},
 {name:'幼幼24堂',count:24,plan:53300,nonmember:3100,member:2650},
 {name:'初階',count:8,plan:15900,nonmember:2500,member:2200},
 {name:'中階',count:16,plan:33200,nonmember:2800,member:2400},
 {name:'高階(單/桃雙)',count:14,plan:43500,nonmember:3900,member:3500},
 {name:'高階(雙)',count:14,plan:38300,nonmember:3400,member:3000}
];
const PACKS = [
 {name:'小全套',original:49100,price:46100},
 {name:'中全套(單/桃雙)',original:76700,price:70700},
 {name:'中全套(雙)',original:71500,price:66500},
 {name:'大全套(單/桃雙)',original:92600,price:83100},
 {name:'大全套(雙)',original:87400,price:78900}
];
const OPTIONS = [
 {name:'幼幼8堂',group:'幼幼'}, {name:'幼幼16堂',group:'幼幼'}, {name:'幼幼24堂',group:'幼幼'},
 {name:'初階',group:'一般'}, {name:'中階',group:'一般'}, {name:'高階(單/桃雙)',group:'一般'}, {name:'高階(雙)',group:'一般'},
 {name:'小全套初階',group:'小全套'}, {name:'小全套中階',group:'小全套'},
 {name:'中全套(單/桃雙)中階',group:'中全套'}, {name:'中全套(單/桃雙)高階',group:'中全套'},
 {name:'中全套(雙)中階',group:'中全套'}, {name:'中全套(雙)高階',group:'中全套'},
 {name:'大全套(單/桃雙)初階',group:'大全套'}, {name:'大全套(單/桃雙)中階',group:'大全套'},
 {name:'大全套(單/桃雙)高階',group:'大全套'}, {name:'大全套(雙)初階',group:'大全套'},
 {name:'大全套(雙)中階',group:'大全套'}, {name:'大全套(雙)高階',group:'大全套'}
];
const SRC_GROUPS=['一般','小全套','中全套','大全套','幼幼'];
const PRICE_TYPES=['非會員','會員','單堂方案/套裝價'];
const TYPES=['單堂','方案','套裝'];
const fmt=n=>roundSheet(n).toLocaleString('en-US'); // 模擬 Sheets TEXT(number,"#,##0") 四捨五入
function roundSheet(n){return n>=0 ? Math.floor(n+0.5) : Math.ceil(n-0.5)}
function textNum(n){if(!Number.isFinite(n))return '';return String(Math.round(n*1e10)/1e10)}
function implicitReciprocalText(n){const rec=1/(1/n);return rec!==n?textNum(n)+'.':textNum(n)} // 保留原表 1/(1/單價) 造成的浮點轉文字現象
function roundDown2(n){return Math.trunc((n+(n>=0?1:-1)*1e-8)*100)/100}
function digits(v){return Number.isFinite(+v)&&v!==''?+v:0}
function byName(arr,name){return arr.find(x=>x.name===name)}
const DEFAULTS={BASE,PACKS,OPTIONS,SRC_GROUPS};
export function createCalculator(config=null){
 const BASE=config?.base??DEFAULTS.BASE,PACKS=config?.packs??DEFAULTS.PACKS;
 const rounding=(key,value,fallback)=>config?roundValue(value,config.rounding[key]):fallback(value);
 const fmt=n=>config?roundValue(n,config.rounding['顯示金額']).toLocaleString('en-US',{maximumFractionDigits:config.rounding['顯示金額'].places}):roundSheet(n).toLocaleString('en-US');
 const implicitReciprocalText=n=>config&&!config.compatibility?textNum(n):((1/(1/n))!==n?textNum(n)+'.':textNum(n));
function srcUnit(name,type){
 const basic=byName(BASE,name);
 if(basic){return type==='非會員'?basic.nonmember:type==='會員'?basic.member:rounding('原課程單堂價',basic.unit??basic.plan/basic.count,roundSheet)}
 if(type!=='單堂方案/套裝價')return null;
 if(config){const rule=byName(config.conversions,name);return rule?rounding('套裝換算單堂價',rule.unit,roundSheet):null;}
 const plan=byName(BASE,'中階'), highSingle=byName(BASE,'高階(單/桃雙)'), highDouble=byName(BASE,'高階(雙)');
 const midBase=roundSheet(plan.plan/plan.count),singleBase=roundSheet(highSingle.plan/highSingle.count),doubleBase=roundSheet(highDouble.plan/highDouble.count);
 if(name.startsWith('小全套'))return roundSheet(46100/24);
 if(name.startsWith('中全套(單/桃雙)'))return roundSheet((name.endsWith('高階')?singleBase:midBase)*(70700/76700));
 if(name.startsWith('中全套(雙)'))return roundSheet((name.endsWith('高階')?doubleBase:midBase)*(66500/71500));
 if(name.startsWith('大全套(單/桃雙)'))return roundSheet((name.endsWith('高階')?singleBase:49100/24)*(83100/92600));
 if(name.startsWith('大全套(雙)'))return roundSheet((name.endsWith('高階')?doubleBase:49100/24)*(78900/87400));
 return null;
}
function dstUnit(type,name,priceType){
 if(type==='套裝')return byName(PACKS,name)?.price ?? null;
 const base=byName(BASE,name);if(!base)return null;
 if(type==='方案')return base.plan;
 return srcUnit(name,priceType);
}
function calculate(s){
 if(config&&(!Number.isFinite(Number(s.srcDiscount))||Number(s.srcDiscount)<config.discount.min||Number(s.srcDiscount)>config.discount.max))return {done:false,check:'折扣超出試算表設定範圍'};
 let unit=s.srcCourse&&s.srcPrice?srcUnit(s.srcCourse,s.srcPrice):null;
 let oldValue=unit==null?null:rounding('剩餘價值',unit*(100-digits(s.srcDiscount))/100*digits(s.remaining),roundDown2);
 let price=s.dstCourse?dstUnit(s.convert,s.dstCourse,s.dstPrice):null;
 let count=s.convert==='單堂'?s.dstCount:s.convert==='方案'?byName(BASE,s.dstCourse)?.count:null;
 let newValue=price==null?null:rounding('目標總價',price*(s.convert==='單堂'?digits(count):1),roundSheet);
 // 原表「單堂」堂數為 0 時不提供目標總價
 if(s.convert==='單堂'&&digits(s.dstCount)===0)newValue=null;
 const check=!s.srcCourse?'① 請選擇原課程級別':!s.srcPrice?'① 請選擇原課程價格類型':s.remaining===''?'① 請填寫剩餘堂數':unit==null?'① 這個課程沒有此價格類型（全套請選「單堂方案/套裝價」）':!s.convert?'② 請選擇轉換類型':!s.dstCourse?'② 請選擇目標課程':s.convert==='單堂'&&!s.dstPrice?'② 請選擇單堂價格類型':s.convert==='單堂'&&!digits(s.dstCount)?'② 請填寫目標堂數':price==null?'② 目標課程與轉換類型不符（套裝請選全套、單堂/方案請選一般課程）':null;
 if(check||oldValue==null||newValue==null)return{done:false,unit,oldValue,price,newValue,check:check||'請檢查填寫欄位'};
 const diff=rounding('差額',newValue-oldValue,roundDown2),c23=diff>0?'需補價差 NT$'+fmt(diff):'無需補價差'+(diff<0?'（殘值多 NT$'+fmt(-diff)+'）':'');
 // 來源試算表：因 C9=1/(1/1988) 得到 1987.9999999999998，CRM 隱式數字文字化為「1988.」。
 const rawSrcUnit=implicitReciprocalText(unit);
 const discountSrc=digits(s.srcDiscount)>0?'(折'+textNum(s.srcDiscount)+'%)':'';
 const toDescription=s.convert==='單堂'?(s.dstPrice+implicitReciprocalText(price)+'x'+textNum(s.dstCount)+'堂'):s.convert==='方案'?('方案價'+implicitReciprocalText(price)+'('+count+'堂)'):('套裝價'+implicitReciprocalText(price));
 // 完全保留 B27 TEXTJOIN("_", TRUE, ...) 原公式順序、標點、大小寫與空格
 const crm=[s.convert==='單堂'?'#轉換單堂':s.convert==='方案'?'#轉換方案':'#轉換套裝方案',
  '原課程:'+s.srcCourse,'單堂價值'+rawSrcUnit+discountSrc,'剩餘'+textNum(s.remaining)+'堂','殘餘總值'+textNum(oldValue),'目標:'+s.dstCourse,
  toDescription,'總價'+textNum(newValue),'差價'+textNum(diff),c23].join('_');
 // 完全保留 B30 公式的句型、全形標點與 TEXT(...,"#,##0") 顯示
 const courseClause=s.convert==='單堂'?(' '+textNum(s.dstCount)+' 堂（'+s.dstPrice+' NT$'+fmt(price)+'/堂）'):s.convert==='方案'?('方案（'+count+' 堂）'):'套裝';
 const student='學員原購買「'+s.srcCourse+'」，剩餘 '+textNum(s.remaining)+' 堂，殘餘價值 NT$'+fmt(oldValue)+'；轉換為「'+s.dstCourse+'」'+courseClause+'，總價 NT$'+fmt(newValue)+'。'+(diff>0?'需補價差 NT$'+fmt(diff)+'。':'殘餘價值已足夠，無需補價差。');
 return{done:true,unit,oldValue,price,newValue,diff,c23,crm,student,check:'✔ 完成，可複製下方文字'};
}
 return {calculate,fmt,BASE,PACKS,OPTIONS:config?.options??DEFAULTS.OPTIONS,SRC_GROUPS:config?.groups??DEFAULTS.SRC_GROUPS};
}
const defaultCalculator=createCalculator();
const calculate=s=>defaultCalculator.calculate(s);

export { BASE, PACKS, OPTIONS, SRC_GROUPS, PRICE_TYPES, TYPES, byName, digits, fmt, calculate };
