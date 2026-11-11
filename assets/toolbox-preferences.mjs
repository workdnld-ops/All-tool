export const PALETTE = [
  ['柔霧紅','#E7B1B1','#7B3030'],['珊瑚粉','#F6A6A6','#842D32'],['蜜桃橘','#FFB997','#87401F'],['杏桃橘','#FFD29A','#805015'],['奶油黃','#FFE8A8','#805500'],['檸檬黃','#FFF6B6','#71600C'],
  ['嫩芽綠','#E6F39C','#506418'],['酪梨綠','#CDE8B2','#426230'],['薄荷綠','#BFE7D5','#28634C'],['湖水綠','#A6E1DF','#236161'],['青瓷藍','#A9D9E8','#275F72'],['天空藍','#B7D8F6','#285B86'],
  ['霧海藍','#9DBBE6','#234675'],['薰衣草藍','#A7B4ED','#343C78'],['丁香紫','#CBB5E8','#593873'],['藤花紫','#DAB9EF','#6C3D83'],['藕粉紫','#E8B7D6','#7C365F'],['櫻花粉','#F6C2D9','#87385D'],
];
export const paletteInk = color => PALETTE.find(([,hex]) => hex === color)?.[2] ?? null;
export const PREFERENCES_PATH = 'users/single-user/toolboxPreferences';
const CACHE = 'opsToolboxPreferencesV1';
const validId = id => typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id);
export function validatePreferences(value) {
  if (!value || value.version !== 1) throw new Error('工具箱設定版本不相容');
  const order = value.order ?? [], colors = value.colors ?? {};
  if (!Array.isArray(order) || !order.every(validId) || new Set(order).size !== order.length || typeof colors !== 'object' || Array.isArray(colors)) throw new Error('工具箱設定格式錯誤');
  for (const [id,color] of Object.entries(colors)) if (!validId(id) || !PALETTE.some(([,hex]) => hex === color)) throw new Error('縮圖色票格式錯誤');
  return {version:1,order:[...order],colors:{...colors}};
}
export function changePreferences(state, command) {
  const next=validatePreferences(state);
  if (command.type === 'order') next.order=[...command.order];
  else if (command.type === 'color' && validId(command.id)) {
    if (command.color === null) delete next.colors[command.id];
    else next.colors[command.id]=command.color;
  } else throw new Error('未知的工具箱設定操作');
  return validatePreferences(next);
}
export function orderedIds(ids, saved) {
  return [...saved.filter(id => ids.includes(id)), ...ids.filter(id => !saved.includes(id))];
}
export function readPreferences(storage) {
  try {
    const cached=storage.getItem(CACHE);
    if (cached) return validatePreferences(JSON.parse(cached));
    const order=JSON.parse(storage.getItem('opsToolboxToolOrder') || '[]');
    return validatePreferences({version:1,order,colors:{}});
  } catch { return {version:1,order:[],colors:{}}; }
}

export function firebasePreferences(sdk, db, storage, onData, onStatus) {
  let ready=false, connected=false;
  const root=sdk.ref(db,PREFERENCES_PATH);
  const emit = value => {
    const data=validatePreferences(value);
    try { storage.setItem(CACHE,JSON.stringify(data)); } catch { /* Cloud remains authoritative. */ }
    onData(data);
  };
  const status = () => onStatus(ready && connected, connected && ready ? '排序與顏色已同步' : '雲端連線中，暫停編輯');
  return {
    async start() {
      const initial=readPreferences(storage);
      emit(initial);
      sdk.onValue(sdk.ref(db,'.info/connected'), snapshot => { connected=snapshot.val() === true; status(); });
      const snapshot=await sdk.get(root);
      if (!snapshot.exists()) {
        await sdk.runTransaction(root, current => current === null ? initial : undefined, {applyLocally:false});
      }
      sdk.onValue(root, snapshot => {
        try {
          if (!snapshot.exists()) throw new Error('雲端設定不存在，請重新整理');
          emit(snapshot.val()); ready=true; status();
        } catch (error) { ready=false; onStatus(false,error.message); }
      }, () => { ready=false; onStatus(false,'同步失敗，請重新整理後重試'); });
    },
    async commit(command) {
      if (!ready || !connected) throw new Error('尚未連上雲端，請稍後重試');
      const result=await sdk.runTransaction(root, current => changePreferences(current,command), {applyLocally:false});
      if (!result.committed) throw new Error('未儲存，請重試');
      emit(result.snapshot.val());
    },
  };
}

export async function connectPreferences(onData,onStatus) {
  const storage=localStorage;
  onData(readPreferences(storage));
  if (['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
    onStatus(true,'本機預覽設定');
    return {async commit(command) {
      const data=changePreferences(readPreferences(storage),command);
      storage.setItem(CACHE,JSON.stringify(data)); onData(data);
    }};
  }
  onStatus(false,'正在同步排序與顏色…');
  const {initializeApp}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const sdk=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
  const app=initializeApp({
    apiKey:'AIzaSyD6aZhiruY_wqBfNPElCsybIQvKByld6_8',
    authDomain:'money-card-6bf98.firebaseapp.com',
    databaseURL:'https://money-card-6bf98-default-rtdb.firebaseio.com',
    projectId:'money-card-6bf98',
    appId:'1:245245451690:web:e939a519af0009b8d1dfd3',
  },'toolbox-preferences');
  const repo=firebasePreferences(sdk,sdk.getDatabase(app),storage,onData,onStatus);
  // Return immediately; offline startup remains read-only until the first cloud snapshot.
  repo.start().catch(() => onStatus(false,'同步失敗，請重新整理後重試'));
  return repo;
}
