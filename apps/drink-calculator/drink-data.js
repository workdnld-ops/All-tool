import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
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
const rootPath = `users/${userId}/drinkCalculator`;

export const DEFAULT_ITEMS = [
  { id: "fin", name: "FIN", pricePerCase: 350, bottlesPerCase: 24, order: 0, active: true },
  { id: "tree-top-apple", name: "樹頂蘋果汁", pricePerCase: 480, bottlesPerCase: 24, order: 1, active: true },
  { id: "cola", name: "可樂", pricePerCase: 345, bottlesPerCase: 24, order: 2, active: true },
  { id: "apple-soda", name: "蘋果西打", pricePerCase: 365, bottlesPerCase: 24, order: 3, active: true },
  { id: "oolong-tea", name: "烏龍茶", pricePerCase: 340, bottlesPerCase: 24, order: 4, active: true },
];

function normalizeItem(item, fallbackId) {
  return {
    id: String(item.id || fallbackId),
    name: String(item.name || "未命名品項"),
    pricePerCase: Math.max(0, Number(item.pricePerCase) || 0),
    bottlesPerCase: Math.max(1, Number(item.bottlesPerCase) || 1),
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 0,
    active: item.active !== false,
  };
}

function itemMapFromArray(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function normalizeItems(data) {
  return Object.entries(data || {})
    .map(([id, item]) => normalizeItem(item, id))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-TW"));
}

function normalizeOrders(data) {
  return Object.entries(data || {})
    .map(([id, order]) => ({
      id,
      date: order.date || "",
      createdAt: order.createdAt || "",
      items: order.items || {},
      totalBoxes: Number(order.totalBoxes) || 0,
      totalPrice: Number(order.totalPrice) || 0,
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function formatCurrency(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString("zh-TW")}`;
}

export function parseNonNegativeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function subscribeItems(onChange, onError) {
  const itemsRef = ref(database, `${rootPath}/items`);
  return onValue(
    itemsRef,
    async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        await set(itemsRef, itemMapFromArray(DEFAULT_ITEMS));
        onChange(DEFAULT_ITEMS);
        return;
      }
      onChange(normalizeItems(data));
    },
    (error) => {
      console.error("Drink items read error:", error);
      onError?.(error);
    },
  );
}

export function subscribeOrders(onChange, onError) {
  const ordersRef = ref(database, `${rootPath}/orders`);
  return onValue(
    ordersRef,
    (snapshot) => onChange(normalizeOrders(snapshot.val()).slice(0, 20)),
    (error) => {
      console.error("Drink orders read error:", error);
      onError?.(error);
    },
  );
}

export async function saveItem(item) {
  const normalized = normalizeItem(item, item.id);
  await set(ref(database, `${rootPath}/items/${normalized.id}`), normalized);
}

export async function addItem(item) {
  const id = `drink-${Date.now()}`;
  await saveItem({ id, active: true, ...item });
}

export async function updateItem(id, updates) {
  await update(ref(database, `${rootPath}/items/${id}`), updates);
}

export async function deleteItem(id) {
  await remove(ref(database, `${rootPath}/items/${id}`));
}

export async function saveOrder(order) {
  const orderRef = push(ref(database, `${rootPath}/orders`));
  await set(orderRef, order);
}

export async function deleteOrder(id) {
  await remove(ref(database, `${rootPath}/orders/${id}`));
}
