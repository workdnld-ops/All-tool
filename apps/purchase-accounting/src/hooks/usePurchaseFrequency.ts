import { useMemo } from 'react';
import { ExpenseCard, Tag } from '@/types';

export const PURCHASE_STORE_NAMES = ['內湖', '瑞光'] as const;

export interface PurchaseRecord {
  date: Date;
  amount: number;
  listName: string;
  tagId: string;
}

export interface ItemFrequency {
  itemName: string;
  tagId: string;
  tagName: string;
  tagColor: string;
  records: PurchaseRecord[];
  averageDaysBetween: number;
  lastPurchaseDate: Date;
  nextPurchaseDate: Date;
  status: 'suggest_restock' | 'need_soon' | 'normal';
  totalSpent: number;
}

interface List {
  id: string;
  name: string;
  cards: ExpenseCard[];
}

export function normalizeItemName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function parseMonthListName(name: string) {
  const match = name.trim().match(/^(\d{4})\s*\/\s*(\d{1,2})\s*月$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year, month };
}

export function usePurchaseItemNames(lists: List[]) {
  return useMemo(() => {
    const itemNames = new Set<string>();

    lists.forEach(list => {
      if (!parseMonthListName(list.name)) return;

      list.cards.forEach(card => {
        if (card.status === 'excluded') return;

        const itemName = normalizeItemName(card.content);
        if (itemName) {
          itemNames.add(itemName);
        }
      });
    });

    return Array.from(itemNames).sort((a, b) => a.localeCompare(b, 'zh-TW'));
  }, [lists]);
}

function parsePurchaseDate(value: string, listName: string) {
  const [month, day] = value.split('/').map(Number);
  const listMonth = parseMonthListName(listName);
  if (!listMonth || !month || month < 1 || month > 12 || !day || day < 1 || day > 31) return null;

  const purchaseDate = new Date(listMonth.year, month - 1, day);
  purchaseDate.setHours(0, 0, 0, 0);

  if (
    Number.isNaN(purchaseDate.getTime())
    || purchaseDate.getMonth() !== month - 1
    || purchaseDate.getDate() !== day
  ) {
    return null;
  }

  return purchaseDate;
}

export function usePurchaseFrequency(lists: List[], trackedItemNames: string[] = [], tags: Tag[] = []) {
  const itemFrequencies = useMemo(() => {
    const itemMap = new Map<string, {
      itemName: string;
      tag: Tag;
      records: PurchaseRecord[];
    }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trackedNames = new Set(trackedItemNames.map(normalizeItemName).filter(Boolean));
    const tagMap = new Map(tags.map(tag => [tag.id, tag]));
    const storeNames = new Set<string>(PURCHASE_STORE_NAMES);

    // 收集所有卡片記錄
    lists.forEach(list => {
      if (!parseMonthListName(list.name)) return;

      list.cards.forEach(card => {
        if (card.status === 'excluded') return;

        const tag = card.tagId ? tagMap.get(card.tagId) : undefined;
        if (!tag || !storeNames.has(tag.name.trim())) return;

        const itemName = normalizeItemName(card.content);
        if (!itemName || !card.date) return;
        if (trackedNames.size > 0 && !trackedNames.has(itemName)) return;

        const purchaseDate = parsePurchaseDate(card.date, list.name);
        if (!purchaseDate) return;

        const itemKey = `${tag.id}\u0000${itemName}`;
        if (!itemMap.has(itemKey)) {
          itemMap.set(itemKey, { itemName, tag, records: [] });
        }

        itemMap.get(itemKey)!.records.push({
          date: purchaseDate,
          amount: card.amount,
          listName: list.name,
          tagId: tag.id,
        });
      });
    });

    // 計算每個品項的統計資料
    const frequencies: ItemFrequency[] = [];

    itemMap.forEach(({ records, itemName, tag }) => {
      if (records.length < 2) {
        // 只有一筆記錄，無法計算頻率
        const record = records[0];
        frequencies.push({
          itemName,
          tagId: tag.id,
          tagName: tag.name.trim(),
          tagColor: tag.color,
          records,
          averageDaysBetween: 0,
          lastPurchaseDate: record.date,
          nextPurchaseDate: record.date,
          status: 'normal',
          totalSpent: records.reduce((sum, r) => sum + r.amount, 0),
        });
        return;
      }

      // 按日期排序
      const sortedRecords = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // 計算間隔天數
      const intervals: number[] = [];
      for (let i = 1; i < sortedRecords.length; i++) {
        const daysDiff = Math.floor(
          (sortedRecords[i].date.getTime() - sortedRecords[i - 1].date.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 0) {
          intervals.push(daysDiff);
        }
      }

      // 計算平均間隔
      const averageDaysBetween = intervals.length > 0
        ? Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length)
        : 0;

      const lastPurchaseDate = sortedRecords[sortedRecords.length - 1].date;
      const nextPurchaseDate = new Date(lastPurchaseDate);
      nextPurchaseDate.setDate(nextPurchaseDate.getDate() + averageDaysBetween);

      // 判斷狀態
      let status: 'suggest_restock' | 'need_soon' | 'normal' = 'normal';
      const daysUntilNext = Math.floor((nextPurchaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (today > nextPurchaseDate) {
        status = 'suggest_restock';
      } else if (daysUntilNext <= 3) {
        status = 'need_soon';
      }

      frequencies.push({
        itemName,
        tagId: tag.id,
        tagName: tag.name.trim(),
        tagColor: tag.color,
        records: sortedRecords,
        averageDaysBetween,
        lastPurchaseDate,
        nextPurchaseDate,
        status,
        totalSpent: records.reduce((sum, r) => sum + r.amount, 0),
      });
    });

    // 按狀態和品項名稱排序
    return frequencies.sort((a, b) => {
      const statusOrder = { suggest_restock: 0, need_soon: 1, normal: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      const storeDiff = PURCHASE_STORE_NAMES.indexOf(a.tagName as typeof PURCHASE_STORE_NAMES[number])
        - PURCHASE_STORE_NAMES.indexOf(b.tagName as typeof PURCHASE_STORE_NAMES[number]);
      if (storeDiff !== 0) return storeDiff;
      return a.itemName.localeCompare(b.itemName, 'zh-TW');
    });
  }, [lists, trackedItemNames, tags]);

  return itemFrequencies;
}
