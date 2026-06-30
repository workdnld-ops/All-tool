import { useState, useEffect, useCallback } from 'react';
import { ref, set, update, remove, onValue, get, off } from 'firebase/database';
import { database, getUserId } from '@/lib/firebase';
import { List as ListType, Tag, SnackBudgetSettings, DEFAULT_SNACK_BUDGET } from '@/types';
import { toast } from 'sonner';

export function useFirebaseLists() {
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = getUserId();

  // 即時監聽 lists 資料
  useEffect(() => {
    const listsRef = ref(database, `users/${userId}/lists`);
    
    const unsubscribe = onValue(
      listsRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const listsArray = Object.entries(data).map(([id, listData]: [string, any]) => ({
              id,
              name: listData.name || '未命名',
              order: listData.order || 0,
              cards: listData.cards 
                ? Object.entries(listData.cards)
                    .map(([cardId, cardData]: [string, any]) => ({
                      id: cardId,
                      ...cardData,
                      order: cardData.order !== undefined ? cardData.order : 0
                    }))
                    .sort((a, b) => a.order - b.order)
                : []
            }));
            setLists(listsArray.sort((a, b) => a.order - b.order));
          } else {
            // 如果 Firebase 沒有資料，初始化預設欄位
            const defaultList: ListType = {
              id: 'list-1',
              name: '本月支出',
              cards: [],
              order: 0,
            };
            setLists([defaultList]);
            saveLists([defaultList]);
          }
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('Error processing lists:', err);
          setError('資料處理錯誤');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firebase read error:', err);
        setError('無法讀取資料');
        setLoading(false);
      }
    );

    return () => off(listsRef, 'value', unsubscribe);
  }, [userId]);

  // 儲存整個 lists 到 Firebase
  const saveLists = useCallback(async (listsToSave: ListType[]) => {
    try {
      const listsRef = ref(database, `users/${userId}/lists`);
      const listsData: any = {};
      
      listsToSave.forEach(list => {
        const cardsData: any = {};
        list.cards.forEach(card => {
          cardsData[card.id] = {
            status: card.status || 'none',
            date: card.date || '',
            tagId: card.tagId !== undefined ? card.tagId : null,
            content: card.content || '',
            amount: card.amount || 0,
            invoiceType: card.invoiceType || 'none',
            order: card.order !== undefined ? card.order : 0
          };
        });
        
        listsData[list.id] = {
          name: list.name,
          order: list.order,
          cards: cardsData
        };
      });
      
      await set(listsRef, listsData);
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error saving lists:', err);
      console.error('Lists data that failed:', listsToSave);
      toast.error('同步失敗，請檢查網路連線');
      throw err;
    }
  }, [userId]);

  // 更新單一 list
  const updateList = useCallback(async (listId: string, updates: Partial<ListType>) => {
    try {
      const listRef = ref(database, `users/${userId}/lists/${listId}`);
      await update(listRef, {
        name: updates.name,
        order: updates.order
      });
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error updating list:', err);
      toast.error('同步失敗');
      throw err;
    }
  }, [userId]);

  // 刪除 list
  const deleteList = useCallback(async (listId: string) => {
    try {
      const listRef = ref(database, `users/${userId}/lists/${listId}`);
      await remove(listRef);
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error deleting list:', err);
      toast.error('同步失敗');
      throw err;
    }
  }, [userId]);

  // 更新卡片
  const updateCard = useCallback(async (listId: string, cardId: string, cardData: any) => {
    try {
      const cardRef = ref(database, `users/${userId}/lists/${listId}/cards/${cardId}`);
      const normalizedData = {
        status: cardData.status || 'none',
        date: cardData.date || '',
        tagId: cardData.tagId !== undefined ? cardData.tagId : null,
        content: cardData.content || '',
        amount: cardData.amount || 0,
        invoiceType: cardData.invoiceType || 'none',
        order: cardData.order !== undefined ? cardData.order : 0
      };
      await set(cardRef, normalizedData);
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error updating card:', err);
      console.error('Card data that failed:', cardData);
      toast.error('同步失敗');
      throw err;
    }
  }, [userId]);

  // 刪除卡片
  const deleteCard = useCallback(async (listId: string, cardId: string) => {
    try {
      const cardRef = ref(database, `users/${userId}/lists/${listId}/cards/${cardId}`);
      await remove(cardRef);
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error deleting card:', err);
      toast.error('同步失敗');
      throw err;
    }
  }, [userId]);

  return {
    lists,
    loading,
    error,
    saveLists,
    updateList,
    deleteList,
    updateCard,
    deleteCard
  };
}

export function useFirebaseTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getUserId();

  useEffect(() => {
    const tagsRef = ref(database, `users/${userId}/tags`);
    
    const unsubscribe = onValue(
      tagsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const tagsArray = Object.entries(data).map(([id, tagData]: [string, any]) => ({
            id,
            ...tagData
          }));
          setTags(tagsArray);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firebase tags read error:', err);
        setLoading(false);
      }
    );

    return () => off(tagsRef, 'value', unsubscribe);
  }, [userId]);

  const saveTags = useCallback(async (tagsToSave: Tag[]) => {
    try {
      const tagsRef = ref(database, `users/${userId}/tags`);
      const tagsData: any = {};
      
      tagsToSave.forEach(tag => {
        tagsData[tag.id] = {
          name: tag.name,
          color: tag.color
        };
      });
      
      await set(tagsRef, tagsData);
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error saving tags:', err);
      toast.error('標籤同步失敗');
      throw err;
    }
  }, [userId]);

  return { tags, loading, saveTags };
}

export function useFirebaseArchivedLists() {
  const [archivedLists, setArchivedLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getUserId();

  useEffect(() => {
    const archivedRef = ref(database, `users/${userId}/archivedLists`);
    
    const unsubscribe = onValue(
      archivedRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const archivedArray = Object.entries(data).map(([id, listData]: [string, any]) => ({
              id,
              name: listData.name || '未命名',
              order: listData.order || 0,
              cards: listData.cards 
                ? Object.entries(listData.cards)
                    .map(([cardId, cardData]: [string, any]) => ({
                      id: cardId,
                      ...cardData,
                      order: cardData.order !== undefined ? cardData.order : 0
                    }))
                    .sort((a, b) => a.order - b.order)
                : []
            }));
            setArchivedLists(archivedArray.sort((a, b) => a.order - b.order));
          } else {
            setArchivedLists([]);
          }
          setLoading(false);
        } catch (err) {
          console.error('Error processing archived lists:', err);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firebase archived lists read error:', err);
        setLoading(false);
      }
    );

    return () => off(archivedRef, 'value', unsubscribe);
  }, [userId]);

  const saveArchivedLists = useCallback(async (listsToSave: ListType[]) => {
    try {
      const archivedRef = ref(database, `users/${userId}/archivedLists`);
      const archivedData: any = {};
      
      listsToSave.forEach(list => {
        const cardsData: any = {};
        list.cards.forEach(card => {
          cardsData[card.id] = {
            status: card.status || 'none',
            date: card.date || '',
            tagId: card.tagId !== undefined ? card.tagId : null,
            content: card.content || '',
            amount: card.amount || 0,
            invoiceType: card.invoiceType || 'none',
            order: card.order !== undefined ? card.order : 0
          };
        });
        
        archivedData[list.id] = {
          name: list.name,
          order: list.order,
          cards: cardsData
        };
      });
      
      await set(archivedRef, archivedData);
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error saving archived lists:', err);
      toast.error('封存列表同步失敗');
      throw err;
    }
  }, [userId]);

  return { archivedLists, loading, saveArchivedLists };
}

export function useFirebaseSnackBudget() {
  const [snackBudget, setSnackBudget] = useState<SnackBudgetSettings>(DEFAULT_SNACK_BUDGET);
  const [loading, setLoading] = useState(true);
  const userId = getUserId();

  useEffect(() => {
    const budgetRef = ref(database, `users/${userId}/snackBudget`);
    
    const unsubscribe = onValue(
      budgetRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setSnackBudget({
            neihu: data.neihu ?? DEFAULT_SNACK_BUDGET.neihu,
            ruiguang: data.ruiguang ?? DEFAULT_SNACK_BUDGET.ruiguang,
          });
        } else {
          setSnackBudget(DEFAULT_SNACK_BUDGET);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firebase snack budget read error:', err);
        setLoading(false);
      }
    );

    return () => off(budgetRef, 'value', unsubscribe);
  }, [userId]);

  const saveSnackBudget = useCallback(async (budget: SnackBudgetSettings) => {
    try {
      const budgetRef = ref(database, `users/${userId}/snackBudget`);
      await set(budgetRef, budget);
      toast.success('✓ 已同步 Firebase');
    } catch (err) {
      console.error('Error saving snack budget:', err);
      toast.error('預算同步失敗');
      throw err;
    }
  }, [userId]);

  return { snackBudget, loading, saveSnackBudget };
}

export function useFirebaseTrackedPurchaseItems() {
  const [trackedItems, setTrackedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getUserId();

  useEffect(() => {
    const trackedRef = ref(database, `users/${userId}/trackedPurchaseItems`);

    const unsubscribe = onValue(
      trackedRef,
      (snapshot) => {
        const data = snapshot.val();
        setTrackedItems(Array.isArray(data) ? data.filter(Boolean) : []);
        setLoading(false);
      },
      (err) => {
        console.error('Firebase tracked purchase items read error:', err);
        setLoading(false);
      }
    );

    return () => off(trackedRef, 'value', unsubscribe);
  }, [userId]);

  const saveTrackedItems = useCallback(async (items: string[]) => {
    try {
      const trackedRef = ref(database, `users/${userId}/trackedPurchaseItems`);
      const normalized = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
      await set(trackedRef, normalized);
      toast.success('統計品項已儲存');
    } catch (err) {
      console.error('Error saving tracked purchase items:', err);
      toast.error('統計品項儲存失敗');
      throw err;
    }
  }, [userId]);

  return { trackedItems, loading, saveTrackedItems };
}
