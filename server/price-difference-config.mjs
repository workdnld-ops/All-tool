import {SHEET_ID,TABLES,parseGviz,parseTables} from '../apps/price-difference/sheet-config.mjs';

export async function readPriceConfig({fetchImpl=fetch,timeoutMs=10000}={}) {
 const controller=new AbortController();
 let timer;
 try {
  return await Promise.race([
   (async()=>{
    const tables={};
    await Promise.all(Object.keys(TABLES).map(async name=>{
     const url=new URL(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`);
     url.search=new URLSearchParams({tqx:'out:json',sheet:name,range:'A1:F202',headers:'1',t:String(Date.now())});
     const response=await fetchImpl(url,{signal:controller.signal,cache:'no-store'});
     if(!response.ok)throw new Error(`${name}：讀取失敗 (${response.status})`);
     const text=await response.text();
     if(text.length>300000)throw new Error(`${name}：資料過大`);
     tables[name]=parseGviz(text,name);
    }));
    return {tables,config:parseTables(tables),fetchedAt:new Date().toISOString()};
   })(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('讀取試算表逾時，請重試'));},timeoutMs);})
  ]);
 } finally {clearTimeout(timer);controller.abort();}
}
export function createPriceConfigHandler(options={}) {
 return async request=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'};
  if(request.method!=='GET')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...headers,Allow:'GET'}});
  try {
   const {tables,fetchedAt}=await readPriceConfig(options);
   return new Response(JSON.stringify({tables,fetchedAt}),{headers});
  } catch(error) {
   return new Response(JSON.stringify({error:error instanceof Error?error.message:'無法讀取價目'}),{status:503,headers});
  }
 };
}
