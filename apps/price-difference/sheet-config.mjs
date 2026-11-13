export const SHEET_ID = '1_EZBxqaQWrHpwCDNTTGyWWMzEMZsUQxw2NGQjFKo7_s';
export const TABLES = {
 '課程價目':['課程名稱','方案堂數','方案總價','非會員單堂價','會員單堂價','方案單堂價'],
 '套裝價目':['套裝名稱','原價','售價'],
 '計算設定':['設定項目','設定值','說明'],
 '換算規則':['原課程名稱','分類','單堂換算價']
};

export function parseGviz(text, name) {
 const match = text.match(/^\s*\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
 if (!match) throw new Error(`${name}：無法讀取，請確認試算表允許知道連結的人檢視`);
 const data = JSON.parse(match[1]);
 if (data.status !== 'ok' || !Array.isArray(data.table?.rows)) throw new Error(`${name}：試算表回傳錯誤`);
 const {cols, rows} = data.table;
 const aliases={'原價':'方案原價','售價':'套裝價'};
 if (!TABLES[name].every((label,i)=>cols[i]?.label === label || (aliases[label] && cols[i]?.label === aliases[label]))) throw new Error(`${name}：欄位標題不符`);
 return rows.map(row=>TABLES[name].map((_,i)=>row.c?.[i]?.v ?? null));
}

function number(value, label, positive=false) {
 if ((typeof value !== 'number' && typeof value !== 'string') || value === null || String(value).trim() === '') throw new Error(`${label}：缺少數值或公式有誤`);
 const n=Number(value);
 if (!Number.isFinite(n) || n<0 || n>1e9 || (positive && n===0)) throw new Error(`${label}：數值無效`);
 return n;
}
function name(value,label) {
 if(typeof value!=='string'||!value.trim()||value.length>120||value.startsWith('#'))throw new Error(`${label}：名稱無效`);
 return value.trim();
}
function unique(items,label) {
 if(new Set(items.map(x=>x.name)).size!==items.length)throw new Error(`${label}：名稱重複`);
}
export function roundingRule(value) {
 const match=String(value).match(/^(四捨五入|截斷)至(整數|小數([1-6])位)$/);
 if(!match)throw new Error(`不支援的捨入規則：${value}`);
 return {mode:match[1],places:match[2]==='整數'?0:Number(match[3])};
}
export function roundValue(n,rule) {
 const scale=10**rule.places, sign=n<0?-1:1;
 return sign*(rule.mode==='截斷'?Math.floor(Math.abs(n)*scale+1e-8):Math.floor(Math.abs(n)*scale+0.5+1e-10))/scale;
}
export function parseTables(tables) {
 for(const key of Object.keys(TABLES)) {
  if(!Array.isArray(tables[key]))throw new Error(`缺少分頁：${key}`);
  tables={...tables,[key]:tables[key].filter(row=>row.some(v=>v!==null&&v!==''))};
  if(!tables[key].length||tables[key].length>200)throw new Error(`${key}：需有 1 至 200 筆資料`);
 }
 // The user's sheet also lists package reference units below basic courses.
 // Only explicitly named conversion rows with empty B:E are reference rows.
 const conversionNames=new Set(tables['換算規則'].map(r=>r[0]));
 const references=tables['課程價目'].filter(r=>conversionNames.has(r[0])&&r.slice(1,5).every(v=>v===null||v===''));
 for(const row of references)number(row[5],`${row[0]}參考單堂價`);
 const base=tables['課程價目'].filter(r=>!references.includes(r)).map(r=>({name:name(r[0],'課程'),count:number(r[1],`${r[0]}堂數`,true),plan:number(r[2],`${r[0]}方案總價`),nonmember:number(r[3],`${r[0]}非會員價`),member:number(r[4],`${r[0]}會員價`),unit:number(r[5],`${r[0]}方案單堂價`)}));
 if(!base.length)throw new Error('課程價目：缺少基本課程');
 unique(tables['課程價目'].map(r=>({name:name(r[0],'課程')})),'課程價目');
 if(base.some(x=>!Number.isInteger(x.count)))throw new Error('方案堂數須為整數');
 const packs=tables['套裝價目'].map(r=>({name:name(r[0],'套裝'),original:number(r[1],`${r[0]}原價`,true),price:number(r[2],`${r[0]}售價`)}));
 const conversions=tables['換算規則'].map(r=>({name:name(r[0],'換算課程'),group:name(r[1],'分類'),unit:number(r[2],`${r[0]}換算價`)}));
 unique([...base,...conversions],'原課程');unique(packs,'套裝');
 const settings=Object.create(null);
 for(const row of tables['計算設定']) {
  const key=name(row[0],'設定項目');
  if(Object.hasOwn(settings,key))throw new Error(`設定重複：${key}`);
  settings[key]=row[1];
 }
 const min=number(settings['折扣最小百分比'],'折扣最小百分比');
 const max=number(settings['折扣最大百分比'],'折扣最大百分比');
 const initial=number(settings['預設額外折扣百分比'],'預設額外折扣百分比');
 const step=number(settings['折扣按鈕增減幅度'],'折扣按鈕增減幅度',true);
 if(max>100||min>max||initial<min||initial>max||step>100)throw new Error('折扣設定必須介於 0 至 100，且預設值須在上下限內');
 number(settings['小全套分攤堂數'],'小全套分攤堂數',true);
 const rounding={};
 for(const key of ['原課程單堂價','套裝換算單堂價','剩餘價值','目標總價','差額','顯示金額'])rounding[key]=roundingRule(settings[key]);
 const supported={'差額小於或等於0':'無需補價差','全套原課程價格類型':'單堂方案/套裝價','目標單堂數量為0':'不計算'};
 for(const [key,value] of Object.entries(supported))if(settings[key]!==value)throw new Error(`${key}：目前支援「${value}」`);
 const compatibility=String(settings['CRM浮點尾點相容']).toUpperCase();
 if(!['TRUE','FALSE'].includes(compatibility))throw new Error('CRM浮點尾點相容須為 TRUE 或 FALSE');
 const expected=new Set(['小全套分攤堂數','預設額外折扣百分比','折扣最小百分比','折扣最大百分比','折扣按鈕增減幅度',...Object.keys(rounding),...Object.keys(supported),'CRM浮點尾點相容']);
 for(const key of Object.keys(settings))if(!expected.has(key))throw new Error(`未知設定項目：${key}`);
 const options=[...base.map(x=>({name:x.name,group:x.name.startsWith('幼幼')?'幼幼':'一般'})),...conversions];
 const groups=[...new Set(['一般',...conversions.map(x=>x.group).filter(x=>x!=='幼幼'),'幼幼'])];
 return {base,packs,conversions,options,groups,discount:{min,max,initial,step},rounding,compatibility:compatibility==='TRUE'};
}
