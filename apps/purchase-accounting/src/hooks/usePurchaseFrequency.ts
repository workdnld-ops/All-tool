import { useMemo } from 'react';
import { ExpenseCard } from '@/types';

export interface PurchaseRecord {
  date: Date;
  amount: number;
  listName: string;
}

export interface ItemFrequency {
  itemName: string;
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

export function usePurchaseFrequency(lists: List[]) {
  const itemFrequencies = useMemo(() => {
    const itemMap = new Map<string, PurchaseRecord[]>();

    // 收集所有卡片記錄
    lists.forEach(list => {
      list.cards.forEach(card => {
        const itemName = card.content.trim();
        if (!itemName || !card.date) return;

        // 解析日期 MM/DD 格式
        const [month, day] = card.date.split('/').map(Number);
        if (!month || !day) return;

        const currentYear = new Date().getFullYear();
        const purchaseDate = new Date(currentYear, month - 1, day);

        if (!itemMap.has(itemName)) {
          itemMap.set(itemName, []);
        }

        itemMap.get(itemName)!.push({
          date: purchaseDate,
          amount: card.amount,
          listName: list.name,
        });
      });
    });

    // 計算每個品項的統計資料
    const frequencies: ItemFrequency[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    itemMap.forEach((records, itemName) => {
      if (records.length < 2) {
        // 只有一筆記錄，無法計算頻率
        const record = records[0];
        frequencies.push({
          itemName,
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
      return a.itemName.localeCompare(b.itemName, 'zh-TW');
    });
  }, [lists]);

  return itemFrequencies;
}
