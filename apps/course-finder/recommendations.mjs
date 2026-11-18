import {classify} from './calendar.mjs';

export const HISTORY_KEY = 'course-finder:frequent-queries:v1';
export function completeQuery(filters) {
  if (filters.exact) {
    if (typeof filters.exact !== 'string' || filters.exact.length > 80) return null;
    const parsed = classify(filters.exact);
    if (!parsed.sport) return {name:filters.exact,filters:{sport:'',stage:'',level:'',audience:'',exact:filters.exact}};
    filters = parsed;
  }
  const {sport,stage,level='',audience=''} = filters;
  if (sport === 'training') return {name:'自主訓練',filters:{sport,stage:'',level:'',audience:'',exact:''}};
  if (!['SB','SK'].includes(sport) || !['初','中','高'].includes(stage) || !['','成','兒','幼','全'].includes(audience)) return null;
  if (audience==='幼' && (stage==='高' || sport==='SB' && stage==='中')) return null;
  const allowed = stage === '初' ? ['1','2','3'] : stage === '中' ? ['4','5','6'] : ['7','8'];
  if (audience !== '幼' && !allowed.includes(String(level))) return null;
  const grade = audience === '幼' ? '' : String(level);
  const group = stage === '高' || sport === 'SB' && stage === '中' ? '' : audience;
  return {name:sport+stage+grade+group,filters:{sport,stage,level:grade,audience:group,exact:''}};
}

export function createRecommendations({storage,now=Date.now,schedule=setTimeout,cancel=clearTimeout,onChange=()=>{}}={}) {
  if (!storage) { try { storage=globalThis.localStorage; } catch {} }
  let memory=[],timer,lastKey='';
  function read() {
    try {
      const saved=storage?.getItem(HISTORY_KEY);
      if (saved) memory=JSON.parse(saved);
    } catch {}
    if (!Array.isArray(memory)) memory=[];
    const seen=new Set();
    memory=memory.filter(row=>{
      const query=row && completeQuery(row.filters??{});
      if (!query || query.name!==row.name || seen.has(row.name) || !Number.isSafeInteger(row.count) || row.count<1 || !Number.isFinite(row.lastUsed)) return false;
      seen.add(row.name);return true;
    }).sort((a,b)=>b.count-a.count || b.lastUsed-a.lastUsed || a.name.localeCompare(b.name)).slice(0,50);
    return memory;
  }
  return {
    list:()=>read().slice(0,6),
    track(filters) {
      cancel(timer);
      const query=completeQuery(filters);
      if (!query) { lastKey='';return; }
      if (query.name===lastKey) return;
      timer=schedule(()=>{
        const history=read(),old=history.find(row=>row.name===query.name);
        memory=[...history.filter(row=>row.name!==query.name),{...query,count:Math.min((old?.count??0)+1,1e9),lastUsed:now()}]
          .sort((a,b)=>b.count-a.count || b.lastUsed-a.lastUsed).slice(0,50);
        try { storage?.setItem(HISTORY_KEY,JSON.stringify(memory)); } catch {}
        lastKey=query.name;onChange();
      },1000);
    }
  };
}
