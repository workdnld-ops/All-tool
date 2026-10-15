import { getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, onValue, push, ref, remove, set } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { DEFAULT_STAFF, subscribeStaff, subscribeStaffReadonly } from "../cleaning-schedule/cleaning-data.js";

const rootPath = "users/single-user/leaveLottery";
const isLocalPreview = ["localhost", "127.0.0.1"].includes(location.hostname);
const isStandalone = document.querySelector('meta[name="leave-lottery-mode"]')?.content === "standalone";
export const usesLocalRecords = isLocalPreview || isStandalone;
const database = isLocalPreview ? null : getDatabase(getApp());

export function watchStaff(onChange, onError) {
  if (isLocalPreview) {
    queueMicrotask(() => onChange(DEFAULT_STAFF));
    return () => {};
  }
  return isStandalone ? subscribeStaffReadonly(onChange, onError) : subscribeStaff(onChange, onError);
}

export function watchDraft(onChange, onError) {
  if (usesLocalRecords) {
    queueMicrotask(() => onChange(null));
    return () => {};
  }
  return onValue(ref(database, `${rootPath}/draft`), (snapshot) => onChange(snapshot.val()), onError);
}

export function saveDraft(draft) {
  if (usesLocalRecords) return Promise.resolve();
  return set(ref(database, `${rootPath}/draft`), draft);
}

export function watchRecords(onChange, onError) {
  if (usesLocalRecords) {
    queueMicrotask(() => onChange(JSON.parse(localStorage.getItem("leaveLotteryLocalRecords") || "[]")));
    return () => {};
  }
  return onValue(ref(database, `${rootPath}/records`), (snapshot) => {
    const records = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ ...value, id }));
    records.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    onChange(records);
  }, onError);
}

export async function saveRecord(record) {
  if (usesLocalRecords) {
    const current = JSON.parse(localStorage.getItem("leaveLotteryLocalRecords") || "[]");
    const saved = { ...record, id: crypto.randomUUID() };
    localStorage.setItem("leaveLotteryLocalRecords", JSON.stringify([saved, ...current]));
    return saved;
  }
  const recordRef = push(ref(database, `${rootPath}/records`));
  await set(recordRef, record);
  return { ...record, id: recordRef.key };
}

export async function deleteRecord(id) {
  if (usesLocalRecords) {
    const current = JSON.parse(localStorage.getItem("leaveLotteryLocalRecords") || "[]");
    localStorage.setItem("leaveLotteryLocalRecords", JSON.stringify(current.filter((record) => record.id !== id)));
    return;
  }
  await remove(ref(database, `${rootPath}/records/${id}`));
}
