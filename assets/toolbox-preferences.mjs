export const PALETTE = [
  ['霧粉紅','#FCEDEE','#914653'],['淡玫瑰','#FBE4E6','#984953'],['珊瑚粉','#FFE1DF','#984B4B'],['蜜桃橘','#FFE6D8','#934A18'],['杏桃橘','#FFF0DC','#92550D'],['奶油黃','#FFF6E1','#805500'],
  ['檸檬黃','#FFFBE2','#78620C'],['米黃','#F9F4D9','#685816'],['嫩芽綠','#F1F9E8','#496837'],['酪梨綠','#EAF6E1','#435E37'],['薄荷綠','#E3F7EF','#28634F'],['湖水綠','#DEF6F3','#20656A'],
  ['青瓷綠','#E1F5F6','#235D65'],['淺水藍','#E3F3FB','#30617F'],['天空藍','#E6F0FF','#356399'],['霧海藍','#DEEAF9','#304F73'],['薰衣草藍','#E4E8FF','#424078'],['藍紫','#EAE4FF','#493D78'],
  ['丁香紫','#F3E9FF','#613877'],['藤花紫','#F6E6FB','#703C7E'],['夢幻紫','#F9E6F9','#7C3D7C'],['櫻花粉','#FFE7F3','#8F3761'],['玫瑰粉','#FFE0EB','#90384F'],['裸杏粉','#FBE7E3','#834B43'],
  ['霧米白','#FCFCF9','#5B5851'],['象牙白','#F7F7F3','#55534E'],['淺灰','#F0F2F5','#51545C'],['灰藍','#E8EDF3','#455970'],['莫蘭灰','#E1E4E8','#44494F'],['深石灰','#D6D8DD','#383C42'],
];
// Resolve old saved colors without resetting order or requiring a database migration.
const LEGACY_COLORS = {
  '#E7B1B1':'#FCEDEE', '#F6A6A6':'#FFE1DF', '#FFB997':'#FFE6D8', '#FFD29A':'#FFF0DC', '#FFE8A8':'#FFF6E1', '#FFF6B6':'#FFFBE2',
  '#E6F39C':'#F1F9E8', '#CDE8B2':'#EAF6E1', '#BFE7D5':'#E3F7EF', '#A6E1DF':'#DEF6F3', '#A9D9E8':'#E1F5F6', '#B7D8F6':'#E6F0FF',
  '#9DBBE6':'#DEEAF9', '#A7B4ED':'#E4E8FF', '#CBB5E8':'#F3E9FF', '#DAB9EF':'#F6E6FB', '#E8B7D6':'#FFE0EB', '#F6C2D9':'#FFE7F3',
};
const currentColor = color => LEGACY_COLORS[color] ?? color;
export const paletteInk = color => PALETTE.find(([,hex]) => hex === currentColor(color))?.[2] ?? null;
export const PREFERENCES_PATH = 'users/single-user/toolboxPreferences';
const CACHE = 'opsToolboxPreferencesV1';
const validId = id => typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id);
export function validatePreferences(value) {
  if (!value || value.version !== 1) throw new Error('工具箱設定版本不相容');
  const order = value.order ?? [], colors = value.colors ?? {};
  if (!Array.isArray(order) || !order.every(validId) || new Set(order).size !== order.length || typeof colors !== 'object' || Array.isArray(colors)) throw new Error('工具箱設定格式錯誤');
  const normalized = {};
  for (const [id,color] of Object.entries(colors)) {
    const resolved = currentColor(color);
    if (!validId(id) || !PALETTE.some(([,hex]) => hex === resolved)) throw new Error('縮圖色票格式錯誤');
    normalized[id] = resolved;
  }
  return {version:1,order:[...order],colors:normalized};
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
