import { applyCommand, createInitialState, fromFirebase, validateState } from './model.mjs?v=1.2.0';

export const CACHE_KEY = 'ops-work-assignment-snapshot-v1';
export const LOCAL_KEY = 'ops-work-assignment-preview-v1';
export const CLOUD_PATH = 'users/single-user/workAssignment';

export function createLocalRepository(storage, key = LOCAL_KEY) {
  let current;
  return {
    async start(onData, onConnection) {
      const saved = storage.getItem(key);
      current = saved === null ? createInitialState() : validateState(JSON.parse(saved));
      storage.setItem(key, JSON.stringify(current));
      this.onData = onData;
      onData(structuredClone(current));
      onConnection(true, '本機測試資料');
    },
    async commit(command) {
      // Re-read before each command so another tab's edits are not replaced.
      current = validateState(JSON.parse(storage.getItem(key)));
      const next = applyCommand(current, command);
      storage.setItem(key, JSON.stringify(next));
      current = next;
      this.onData(structuredClone(next));
      return next;
    },
  };
}

export async function createCloudRepository(onWarning) {
  const [{ initializeApp }, sdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js'),
  ]);
  const app = initializeApp({
    apiKey: 'AIzaSyD6aZhiruY_wqBfNPElCsybIQvKByld6_8',
    authDomain: 'money-card-6bf98.firebaseapp.com',
    databaseURL: 'https://money-card-6bf98-default-rtdb.firebaseio.com',
    projectId: 'money-card-6bf98',
    storageBucket: 'money-card-6bf98.firebasestorage.app',
    messagingSenderId: '245245451690',
    appId: '1:245245451690:web:e939a519af0009b8d1dfd3',
  }, 'work-assignment');
  const db = sdk.getDatabase(app);
  return createFirebaseRepository(sdk, db, localStorage, onWarning);
}

export function createFirebaseRepository(sdk, db, cache, onWarning = () => {}) {
  const root = sdk.ref(db, CLOUD_PATH);
  let connected = false, valid = false;
  return {
    async start(onData, onConnection, onError) {
      sdk.onValue(sdk.ref(db, '.info/connected'), snapshot => {
        connected = snapshot.val() === true;
        onConnection(connected && valid, connected ? (valid ? '資料已同步' : '讀取資料中…') : '連線中斷，僅供查看');
      });
      let initial = await sdk.get(root);
      if (!initial.exists()) {
        if (cache.getItem(CACHE_KEY)) throw new Error('雲端資料不存在，已保留本機快照。請先匯出備份並檢查雲端資料，未重新初始化。');
        const defaults = createInitialState();
        const result = await sdk.runTransaction(root, current => current === null ? defaults : undefined, { applyLocally: false });
        initial = result.snapshot;
      }
      fromFirebase(initial.val());
      sdk.onValue(root, snapshot => {
        try {
          const state = fromFirebase(snapshot.val());
          valid = true;
          try { cache.setItem(CACHE_KEY, JSON.stringify(state)); }
          catch { onWarning('本機快照無法保存，雲端資料不受影響；請匯出備份。'); }
          onData(state);
          onConnection(connected, connected ? '資料已同步' : '連線中斷，僅供查看');
        } catch (error) { valid = false; onConnection(false, '資料驗證失敗'); onError(error); }
      }, error => { valid = false; onConnection(false, '無法連線，僅供查看'); onError(error); });
    },
    async commit(command) {
      if (!connected || !valid) throw new Error('尚未連上雲端，請稍後再試');
      let validationError;
      const result = await sdk.runTransaction(root, raw => {
        // Transactions may retry with a newer server snapshot. Apply only the command.
        validationError = undefined;
        try { return applyCommand(fromFirebase(raw), command); }
        catch (error) { validationError = error; return undefined; }
      }, { applyLocally: false });
      if (!result.committed) throw validationError || new Error('儲存未完成，請重試');
      return fromFirebase(result.snapshot.val());
    },
  };
}
