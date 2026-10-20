export function createOrderDraft(order, items, stores, limitFor) {
  if (!stores.some(store => store.id === order.storeId)) throw new Error('這筆訂單沒有有效的分店資訊，無法套用');
  const quantities = {}, inventory = {}, skipped = [], clamped = [];
  for (const [id, entry] of Object.entries(order.items ?? {})) {
    const item = items.find(item => item.id === id);
    const boxes = Number(entry?.boxes);
    if (!item || !Number.isFinite(boxes) || boxes < 0) {
      skipped.push(entry?.name || id);
      continue;
    }
    const limit = Number(limitFor(order.storeId, item));
    const fixed = Number.isFinite(limit);
    const quantity = fixed ? Math.min(boxes, Math.max(0,limit)) : boxes;
    quantities[id] = String(quantity);
    if (fixed) inventory[id] = String(Math.round(Math.max(0,limit - quantity) * 1000) / 1000);
    if (quantity !== boxes) clamped.push(item.name);
  }
  if (!Object.keys(quantities).length) throw new Error('此訂單沒有目前可使用的品項，請先確認品項設定');
  return { storeId:order.storeId, quantities, inventory, skipped, clamped };
}
