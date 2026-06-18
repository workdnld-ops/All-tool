import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  onValue,
  ref,
  remove,
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
const userId = "single-user";
const rootPath = `users/${userId}/cleaningSchedule`;

export const STORE_OPTIONS = [
  { id: "neihu", name: "內湖" },
  { id: "ruiguang", name: "瑞光" },
];

export const DEFAULT_STAFF = [
  { id: "a-lin", name: "A-Lin", order: 0, active: true },
  { id: "baishu", name: "Baishu", order: 1, active: true },
  { id: "jerry", name: "Jerry", order: 2, active: true },
  { id: "oscar", name: "Oscar", order: 3, active: true },
  { id: "yula", name: "Yula", order: 4, active: true },
  { id: "emma", name: "Emma", order: 5, active: true },
  { id: "kang", name: "Kang", order: 6, active: true },
  { id: "q", name: "Q", order: 7, active: true },
];

export const DEFAULT_TASKS = [
  { id: "snow-machine", name: "雪機檢查", order: 0, active: true },
  { id: "ac-filter", name: "清理冷氣濾網", order: 1, active: true },
  { id: "counter-board", name: "擦櫃檯、機上背板", order: 2, active: true },
  { id: "staff-room", name: "清理員工休息區(冰箱、桌面、地板)", order: 3, active: true },
  { id: "ice-machine-water", name: "更換製冰機的水", order: 4, active: true },
  { id: "glass-door", name: "擦玻璃大門", order: 5, active: true },
  { id: "snow-gear", name: "清雪鞋雪板", order: 6, active: true },
  { id: "snacks", name: "買零食", order: 7, active: true },
];

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || `item-${Date.now()}`;
}

function normalizeRecord(item, fallbackId, fallbackName = "未命名") {
  return {
    id: String(item.id || fallbackId),
    name: String(item.name || fallbackName),
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 0,
    active: item.active !== false,
  };
}

function mapFromArray(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function normalizeList(data, defaults) {
  return Object.entries(data || {})
    .map(([id, item]) => {
      const fallback = defaults.find((candidate) => candidate.id === id);
      return normalizeRecord(item, id, fallback?.name);
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-TW"));
}

function subscribeList(path, defaults, onChange, onError) {
  const listRef = ref(database, `${rootPath}/${path}`);
  return onValue(
    listRef,
    async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        await set(listRef, mapFromArray(defaults));
        onChange(defaults);
        return;
      }
      onChange(normalizeList(data, defaults));
    },
    (error) => {
      console.error(`Cleaning ${path} read error:`, error);
      onError?.(error);
    },
  );
}

export function subscribeStaff(onChange, onError) {
  return subscribeList("staff", DEFAULT_STAFF, onChange, onError);
}

export function subscribeTasks(onChange, onError) {
  return subscribeList("tasks", DEFAULT_TASKS, onChange, onError);
}

export async function saveStaffMember(member) {
  const id = member.id || slugify(member.name);
  await set(ref(database, `${rootPath}/staff/${id}`), normalizeRecord({ ...member, id }, id));
}

export async function saveTask(task) {
  const id = task.id || slugify(task.name);
  await set(ref(database, `${rootPath}/tasks/${id}`), normalizeRecord({ ...task, id }, id));
}

export async function deleteStaffMember(id) {
  await remove(ref(database, `${rootPath}/staff/${id}`));
}

export async function deleteTask(id) {
  await remove(ref(database, `${rootPath}/tasks/${id}`));
}
