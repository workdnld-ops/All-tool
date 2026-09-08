import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  onValue,
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6aZhiruY_wqBfNPElCsybIQvKByld6_8",
  authDomain: "money-card-6bf98.firebaseapp.com",
  databaseURL: "https://money-card-6bf98-default-rtdb.firebaseio.com",
  projectId: "money-card-6bf98",
  storageBucket: "money-card-6bf98.firebasestorage.app",
  messagingSenderId: "245245451690",
  appId: "1:245245451690:web:e939a519af0009b8d1dfd3",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const rootPath = "users/single-user/storeCostSharing";
const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);

function subscribe(path, onChange, onError) {
  if (isLocalPreview) {
    queueMicrotask(() => onChange(null));
    return () => {};
  }
  return onValue(
    ref(database, `${rootPath}/${path}`),
    (snapshot) => onChange(snapshot.val()),
    (error) => {
      console.error(`Store cost sharing ${path} read error:`, error);
      onError?.(error);
    },
  );
}

export function subscribeCostState(onChange, onError) {
  return subscribe("state", onChange, onError);
}

export function saveCostState(state) {
  if (isLocalPreview) return Promise.resolve();
  return set(ref(database, `${rootPath}/state`), {
    stores: state.stores,
    items: state.items,
    updatedAt: Date.now(),
  });
}

export function subscribeAddressBook(onChange, onError) {
  return subscribe("addresses", onChange, onError);
}

export function saveAddressBook(addresses) {
  if (isLocalPreview) return Promise.resolve();
  return set(ref(database, `${rootPath}/addresses`), {
    entries: addresses,
    updatedAt: Date.now(),
  });
}
