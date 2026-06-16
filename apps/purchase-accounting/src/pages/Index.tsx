import { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/Header';
import { List } from '@/components/List';
import { List as ListType, ExpenseCard, Tag, DEFAULT_TAGS, DEFAULT_SNACK_BUDGET } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useFirebaseLists, useFirebaseTags, useFirebaseArchivedLists, useFirebaseSnackBudget } from '@/hooks/useFirebase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { arrayMove } from '@dnd-kit/sortable';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

const Index = () => {
  // Firebase hooks
  const { lists: firebaseLists, loading: listsLoading, saveLists } = useFirebaseLists();
  const { tags: firebaseTags, loading: tagsLoading, saveTags } = useFirebaseTags();
  const { archivedLists: firebaseArchivedLists, loading: archivedLoading, saveArchivedLists } = useFirebaseArchivedLists();
  const { snackBudget, loading: budgetLoading } = useFirebaseSnackBudget();
  
  // Local state
  const [lists, setLists] = useState<ListType[]>([]);
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [archivedLists, setArchivedLists] = useState<ListType[]>([]);
  const [deletedLists, setDeletedLists] = useState<ListType[]>([]);
  const [deletedCards, setDeletedCards] = useState<{ [listId: string]: ExpenseCard[] }>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedListsToDelete, setSelectedListsToDelete] = useState<Set<string>>(new Set());
  const swiperRef = useRef<SwiperType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 同步 Firebase 資料到本地 state
  useEffect(() => {
    if (!listsLoading && firebaseLists.length > 0) {
      setLists(firebaseLists);
    }
  }, [firebaseLists, listsLoading]);

  useEffect(() => {
    if (!tagsLoading && firebaseTags.length > 0) {
      setTags(firebaseTags);
    } else if (!tagsLoading && firebaseTags.length === 0) {
      // 如果 Firebase 沒有 tags，寫入預設值
      saveTags(DEFAULT_TAGS);
      setTags(DEFAULT_TAGS);
    }
  }, [firebaseTags, tagsLoading, saveTags]);

  useEffect(() => {
    if (!archivedLoading) {
      setArchivedLists(firebaseArchivedLists);
    }
  }, [firebaseArchivedLists, archivedLoading]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    })
  );

  const handleAddList = async () => {
    const newList: ListType = {
      id: `list-${Date.now()}`,
      name: '新欄位',
      cards: [],
      order: 0,
    };
    const updatedLists = [newList, ...lists.map(l => ({ ...l, order: l.order + 1 }))];
    setLists(updatedLists);
    await saveLists(updatedLists);
    setTimeout(() => {
      swiperRef.current?.slideTo(0);
    }, 100);
  };

  const handleDeleteSelectedLists = async () => {
    const listsToDelete = lists.filter(l => selectedListsToDelete.has(l.id));
    
    if (listsToDelete.length > 0) {
      setDeletedLists([...listsToDelete, ...deletedLists]);
      const updatedLists = lists.filter(l => !selectedListsToDelete.has(l.id));
      setLists(updatedLists);
      await saveLists(updatedLists);
      setSelectedListsToDelete(new Set());
      setShowDeleteDialog(false);
    }
  };

  const toggleListSelection = (listId: string) => {
    const newSelected = new Set(selectedListsToDelete);
    if (newSelected.has(listId)) {
      newSelected.delete(listId);
    } else {
      newSelected.add(listId);
    }
    setSelectedListsToDelete(newSelected);
  };

  const handleRestoreList = async () => {
    if (deletedLists.length > 0) {
      const [lastDeleted, ...rest] = deletedLists;
      const updatedLists = [...lists, lastDeleted];
      setLists(updatedLists);
      await saveLists(updatedLists);
      setDeletedLists(rest);
    }
  };

  const handleArchiveList = async (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (list) {
      const updatedArchivedLists = [...archivedLists, list];
      setArchivedLists(updatedArchivedLists);
      await saveArchivedLists(updatedArchivedLists);
      
      const updatedLists = lists.filter(l => l.id !== listId);
      setLists(updatedLists);
      await saveLists(updatedLists);
    }
  };

  const handleUpdateList = async (id: string, updates: Partial<ListType>) => {
    const updatedLists = lists.map(list => list.id === id ? { ...list, ...updates } : list);
    setLists(updatedLists);
    await saveLists(updatedLists);
  };

  const handleAddCard = async (listId: string) => {
    const newCard: ExpenseCard = {
      id: `card-${Date.now()}`,
      status: 'none',
      date: '',
      tagId: null,
      content: '',
      amount: 0,
      invoiceType: 'none',
      order: 0,
    };

    const updatedLists = lists.map(list =>
      list.id === listId
        ? { 
            ...list, 
            cards: [newCard, ...list.cards.map(c => ({ ...c, order: c.order + 1 }))]
          }
        : list
    );
    setLists(updatedLists);
    await saveLists(updatedLists);
  };

  const handleUpdateCard = async (listId: string, cardId: string, updates: Partial<ExpenseCard>) => {
    const updatedLists = lists.map(list =>
      list.id === listId
        ? {
            ...list,
            cards: list.cards.map(card =>
              card.id === cardId ? { ...card, ...updates } : card
            ),
          }
        : list
    );
    setLists(updatedLists);
    await saveLists(updatedLists);
  };

  const handleDeleteCards = async (listId: string, cardIds: string[]) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const cardsToDelete = list.cards.filter(c => cardIds.includes(c.id));
    const existingDeleted = deletedCards[listId] || [];
    const newDeleted = [...cardsToDelete, ...existingDeleted].slice(0, 10);

    setDeletedCards({ ...deletedCards, [listId]: newDeleted });
    const updatedLists = lists.map(l =>
      l.id === listId
        ? { 
            ...l, 
            cards: l.cards
              .filter(c => !cardIds.includes(c.id))
              .map((card, index) => ({ ...card, order: index }))
          }
        : l
    );
    setLists(updatedLists);
    await saveLists(updatedLists);
  };

  const handleRestoreCard = async (listId: string) => {
    const deleted = deletedCards[listId];
    if (!deleted || deleted.length === 0) return;

    const [lastDeleted, ...rest] = deleted;
    setDeletedCards({ ...deletedCards, [listId]: rest });
    const updatedLists = lists.map(list =>
      list.id === listId
        ? { 
            ...list, 
            cards: [{ ...lastDeleted, order: 0 }, ...list.cards.map(c => ({ ...c, order: c.order + 1 }))]
          }
        : list
    );
    setLists(updatedLists);
    await saveLists(updatedLists);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which lists contain the cards
    const activeListId = lists.find(list =>
      list.cards.some(card => card.id === activeId)
    )?.id;

    const overListId = lists.find(list =>
      list.cards.some(card => card.id === overId) || list.id === overId
    )?.id;

    if (!activeListId) return;

    let updatedLists = lists;

    // Moving within the same list
    if (activeListId === overListId) {
      updatedLists = lists.map(list => {
        if (list.id === activeListId) {
          const oldIndex = list.cards.findIndex(c => c.id === activeId);
          const newIndex = list.cards.findIndex(c => c.id === overId);
          const reorderedCards = arrayMove(list.cards, oldIndex, newIndex);
          // 重新計算所有 card 的 order
          const cardsWithNewOrder = reorderedCards.map((card, index) => ({
            ...card,
            order: index
          }));
          return {
            ...list,
            cards: cardsWithNewOrder,
          };
        }
        return list;
      });
      setLists(updatedLists);
      await saveLists(updatedLists);
    }
    // Moving to a different list
    else if (overListId && activeListId !== overListId) {
      const activeList = lists.find(l => l.id === activeListId);
      const overList = lists.find(l => l.id === overListId);

      if (activeList && overList) {
        const activeCard = activeList.cards.find(c => c.id === activeId);
        if (activeCard) {
          updatedLists = lists.map(list => {
            if (list.id === activeListId) {
              // 從源列表移除並重新計算 order
              const remainingCards = list.cards
                .filter(c => c.id !== activeId)
                .map((card, index) => ({ ...card, order: index }));
              return {
                ...list,
                cards: remainingCards,
              };
            }
            if (list.id === overListId) {
              // 添加到目標列表並重新計算 order
              const newCards = [{ ...activeCard, order: 0 }, ...list.cards]
                .map((card, index) => ({ ...card, order: index }));
              return {
                ...list,
                cards: newCards,
              };
            }
            return list;
          });
          setLists(updatedLists);
          await saveLists(updatedLists);
        }
      }
    }
  };

  const handleExport = () => {
    try {
      const exportData = {
        lists,
        tags,
        archivedLists,
        exportDate: new Date().toISOString(),
        version: '1.1.1',
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `記帳本-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('資料匯出成功');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗，請重試');
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);
        
        if (!importData.lists || !Array.isArray(importData.lists)) {
          toast.error('檔案格式不正確');
          return;
        }

        // 同步 lists
        setLists(importData.lists);
        await saveLists(importData.lists);
        
        // 同步 tags
        if (importData.tags && Array.isArray(importData.tags)) {
          setTags(importData.tags);
          await saveTags(importData.tags);
        }
        
        // 同步 archivedLists
        if (importData.archivedLists && Array.isArray(importData.archivedLists)) {
          setArchivedLists(importData.archivedLists);
          await saveArchivedLists(importData.archivedLists);
        }
        
        toast.success('資料匯入成功並已同步到 Firebase');
      } catch (error) {
        console.error('Import error:', error);
        toast.error('匯入失敗，檔案可能損壞');
      }
    };
    
    reader.readAsText(file);
    event.target.value = '';
  };

  const activeCard = activeId
    ? lists.flatMap(l => l.cards).find(c => c.id === activeId)
    : null;

  // 顯示 loading 狀態
  if (listsLoading || tagsLoading || archivedLoading || budgetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col bg-background overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="hidden"
      />
      <Header
        onAddList={handleAddList}
        onDeleteList={() => setShowDeleteDialog(true)}
        onRestoreList={handleRestoreList}
        canRestoreList={deletedLists.length > 0}
        canDeleteList={lists.length > 0}
        onExport={handleExport}
        onImport={handleImport}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setSelectedListsToDelete(new Set());
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>選擇要刪除的欄位</AlertDialogTitle>
            <AlertDialogDescription>
              可多選欄位後確認刪除
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {lists
              .sort((a, b) => a.order - b.order)
              .map((list) => (
                <button
                  key={list.id}
                  onClick={() => toggleListSelection(list.id)}
                  className={cn(
                    "w-full p-3 text-left rounded-lg border transition-colors",
                    selectedListsToDelete.has(list.id)
                      ? "border-destructive bg-destructive/10"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <div className="font-medium">{list.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {list.cards.length} 項記錄
                  </div>
                </button>
              ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelectedLists}
              disabled={selectedListsToDelete.size === 0}
            >
              刪除 ({selectedListsToDelete.size})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 min-h-0 overflow-hidden pt-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Swiper
            spaceBetween={16}
            slidesPerView={1}
            centeredSlides={false}
            onSwiper={(swiper) => (swiperRef.current = swiper)}
            onSlideChange={(swiper) => setCurrentSlideIndex(swiper.activeIndex)}
            className="h-full min-h-0 px-4 py-2"
            threshold={12}
            resistanceRatio={0.35}
            touchStartPreventDefault={false}
            touchMoveStopPropagation={false}
            slideToClickedSlide={false}
            breakpoints={{
              320: {
                slidesPerView: 1,
                centeredSlides: false,
              },
              768: {
                slidesPerView: 2,
                centeredSlides: false,
              },
              1280: {
                slidesPerView: 3,
                centeredSlides: false,
              },
              1536: {
                slidesPerView: 4,
                centeredSlides: false,
              },
              1920: {
                slidesPerView: 6,
                centeredSlides: false,
              },
            }}
          >
            {lists
              .sort((a, b) => a.order - b.order)
              .map((list) => (
                <SwiperSlide key={list.id} className="h-full min-h-0">
                  <List
                    list={list}
                    tags={tags}
                    snackBudget={snackBudget}
                    onUpdateList={handleUpdateList}
                    onAddCard={() => handleAddCard(list.id)}
                    onUpdateCard={(cardId, updates) =>
                      handleUpdateCard(list.id, cardId, updates)
                    }
                    onDeleteCards={(cardIds) => handleDeleteCards(list.id, cardIds)}
                    onRestoreCard={() => handleRestoreCard(list.id)}
                    canRestoreCard={(deletedCards[list.id] || []).length > 0}
                    onArchive={() => handleArchiveList(list.id)}
                  />
                </SwiperSlide>
              ))}
          </Swiper>

          <DragOverlay>
            {activeCard && (
              <div className="bg-card rounded-lg p-3 shadow-lg border border-border opacity-90">
                <div className="text-sm">{activeCard.content || '內容'}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default Index;
