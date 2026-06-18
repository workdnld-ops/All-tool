import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  get,
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
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
const DEFAULT_VERSION = "cleaning-defaults-20260618-v2";

export const STORE_OPTIONS = [
  { id: "neihu", name: "內湖" },
  { id: "ruiguang", name: "瑞光" },
];

const staffNames = [
  "百數",
  "Jerry",
  "Oscar",
  "Addy",
  "Abao",
  "Jacob",
  "Andrew",
  "Chichi",
  "A-lin",
  "Betsy",
  "阿康",
  "Jason",
  "小Q",
  "Brian",
  "Stephen",
  "Jazzy",
  "Eric",
  "Otton",
  "Yula",
  "Luke",
  "SuSu",
  "Emma",
  "Ryan",
  "Justin",
  "Debbi",
];

const taskNames = [
  "雪機檢查",
  "吸塵+清理吸塵器內部",
  "雪機甩水後上矽油",
  "單板清潔",
  "雙板清潔",
  "擦機上背板",
  "擦玻璃門口裡外",
  "擦拭前後檯面跟櫃子",
  "檢查機下積水",
  "檢查並清理手機容量",
  "打掃員工休息區（含冰箱）",
  "清潔製冰機",
  "清理除濕機濾網",
  "打掃機下(地面清潔、物品整理)",
];

export const DEFAULT_STAFF = staffNames.map((name, order) => ({
  id: `staff-${order + 1}`,
  name,
  order,
  active: true,
}));

export const DEFAULT_TASKS = taskNames.map((name, order) => ({
  id: `task-${order + 1}`,
  name,
  order,
  active: true,
}));

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

function normalizeCleaningRecords(data) {
  return Object.entries(data || {})
    .map(([id, record]) => ({
      id,
      date: record.date || "",
      createdAt: record.createdAt || "",
      startTime: record.startTime || "",
      endTime: record.endTime || "",
      stores: record.stores || {},
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function ensureDefaults(path, defaults) {
  const versionRef = ref(database, `${rootPath}/defaultVersions/${path}`);
  const versionSnapshot = await get(versionRef);
  if (versionSnapshot.val() === DEFAULT_VERSION) return;
  await update(ref(database, `${rootPath}/${path}`), mapFromArray(defaults));
  await set(versionRef, DEFAULT_VERSION);
}

function subscribeList(path, defaults, onChange, onError) {
  const listRef = ref(database, `${rootPath}/${path}`);
  return onValue(
    listRef,
    async (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          await set(listRef, mapFromArray(defaults));
          await set(ref(database, `${rootPath}/defaultVersions/${path}`), DEFAULT_VERSION);
          onChange(defaults);
          return;
        }
        await ensureDefaults(path, defaults);
        const updatedSnapshot = await get(listRef);
        onChange(normalizeList(updatedSnapshot.val() || data, defaults));
      } catch (error) {
        console.error(`Cleaning ${path} sync error:`, error);
        onError?.(error);
      }
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

export function subscribeCleaningRecords(onChange, onError) {
  const recordsRef = ref(database, `${rootPath}/records`);
  return onValue(
    recordsRef,
    (snapshot) => onChange(normalizeCleaningRecords(snapshot.val())),
    (error) => {
      console.error("Cleaning records read error:", error);
      onError?.(error);
    },
  );
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

export async function saveCleaningRecord(record) {
  const recordRef = push(ref(database, `${rootPath}/records`));
  await set(recordRef, record);
}

export async function deleteCleaningRecord(id) {
  await remove(ref(database, `${rootPath}/records/${id}`));
}
