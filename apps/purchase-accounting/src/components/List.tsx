import { useEffect, useState } from 'react';
import { Plus, Trash2, MoreVertical, Undo, Archive as ArchiveIcon, ArrowUpDown, Camera } from 'lucide-react';
import { List as ListType, ExpenseCard as ExpenseCardType, Tag, SnackBudgetSettings, DEFAULT_SNACK_BUDGET } from '@/types';
import { ExpenseCard } from './ExpenseCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ListProps {
  list: ListType;
  tags: Tag[];
  snackBudget: SnackBudgetSettings;
  purchaseSuggestions?: PurchaseSuggestion[];
  onUpdateList: (id: string, updates: Partial<ListType>) => void;
  onAddCard: () => void;
  onAddSuggestedCard?: (suggestion: PurchaseSuggestion) => void;
  onUpdateCard: (cardId: string, updates: Partial<ExpenseCardType>) => void;
  onDeleteCards: (cardIds: string[]) => void;
  onRestoreCard: () => void;
  canRestoreCard: boolean;
  dragHandleProps?: any;
  onArchive?: () => void;
}

export interface PurchaseSuggestion {
  itemName: string;
  lastAmount: number;
  nextPurchaseDate: Date;
  averageDaysBetween: number;
}

export function List({ 
  list, 
  tags, 
  snackBudget,
  purchaseSuggestions = [],
  onUpdateList, 
  onAddCard,
  onAddSuggestedCard,
  onUpdateCard,
  onDeleteCards,
  onRestoreCard,
  canRestoreCard,
  dragHandleProps,
  onArchive
}: ListProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(list.name);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const suggestionStorageKey = `purchase-suggestions-open:${list.id}`;
  const [areSuggestionsOpen, setAreSuggestionsOpen] = useState(false);

  const { setNodeRef } = useDroppable({
    id: list.id,
  });

  useEffect(() => {
    const savedState = window.localStorage.getItem(suggestionStorageKey);
    setAreSuggestionsOpen(savedState === 'open');
  }, [suggestionStorageKey]);

  // 排除 excluded 狀態的卡片計算總額
  const totalAmount = list.cards
    .filter(card => card.status !== 'excluded')
    .reduce((sum, card) => sum + card.amount, 0);

  const snackCards = list.cards.filter(card => card.content.includes('零食'));
  
  const neihuSnackTotal = snackCards
    .filter(card => {
      const tag = tags.find(t => t.id === card.tagId);
      return tag?.name === '內湖';
    })
    .reduce((sum, card) => sum + card.amount, 0);

  const ruiguangSnackTotal = snackCards
    .filter(card => {
      const tag = tags.find(t => t.id === card.tagId);
      return tag?.name === '瑞光';
    })
    .reduce((sum, card) => sum + card.amount, 0);

  const neihuRemaining = snackBudget.neihu - neihuSnackTotal;
  const ruiguangRemaining = snackBudget.ruiguang - ruiguangSnackTotal;

  const handleNameSubmit = () => {
    onUpdateList(list.id, { name: tempName });
    setIsEditingName(false);
  };

  const handleDeleteSelected = () => {
    onDeleteCards(Array.from(selectedCards));
    setSelectedCards(new Set());
    setIsDeleteMode(false);
  };

  const toggleCardSelection = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const handleSortCards = () => {
    const statusOrder: Record<ExpenseCardType['status'], number> = {
      none: 0,
      invoice: 1,
      package: 2,
      complete: 3,
      check: 4,
      excluded: 5,
    };
    const sortedCards = list.cards
      .map((card, originalIndex) => ({ card, originalIndex }))
      .sort((a, b) => {
        const rankDiff = statusOrder[a.card.status] - statusOrder[b.card.status];
        return rankDiff || a.originalIndex - b.originalIndex;
      })
      .map(({ card }, index) => ({ ...card, order: index }));
    onUpdateList(list.id, { cards: sortedCards });
  };

  const handleToggleSuggestions = () => {
    setAreSuggestionsOpen((current) => {
      const next = !current;
      window.localStorage.setItem(suggestionStorageKey, next ? 'open' : 'closed');
      return next;
    });
  };

  const handleScreenshot = async () => {
    try {
      const screenshotCards = list.cards.filter(card => card.status !== 'excluded');

      // 高DPI縮放比例 (提高清晰度)
      const SCALE = 3; // 3倍解析度，確保文字清晰
      
      // 創建canvas - iPhone 15 Pro寬度375px
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { 
        alpha: false, // 不透明背景，PNG更小
        desynchronized: true // 提高性能
      });

      if (!ctx) {
        throw new Error('Canvas not supported');
      }

      // 多列佈局參數 (邏輯尺寸)
      const CARDS_PER_COLUMN = 10;  // 每列最多10張卡片
      const CARD_HEIGHT = 30;       // 每張卡片高度
      const HEADER_HEIGHT = 80;     // 標題區高度
      const PADDING = 15;           // 邊距
      const COLUMN_GAP = 5;         // 列間距
      const CARD_PADDING = 8;       // 卡片內邊距
      const MAX_CONTENT_CHARS = 9;  // 內容文字最多顯示9個中文字元

      // 設置字體以計算寬度
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      
      // 計算單張卡片的寬度
      // 日期寬度（假設最長為 "12/31"）
      const sampleDate = '12/31';
      const dateWidth = ctx.measureText(sampleDate).width;
      
      // 9個中文字元的寬度
      const sampleChinese = '中';
      const chineseCharWidth = ctx.measureText(sampleChinese).width;
      const contentWidth = chineseCharWidth * MAX_CONTENT_CHARS;
      
      // 金額寬度（假設最長為 "$999,999"）
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      const sampleAmount = '$999,999';
      const amountWidth = ctx.measureText(sampleAmount).width;
      
      // 單張卡片寬度 = 左邊距 + 日期 + 間距 + 內容(9字) + 間距 + 金額 + 右邊距
      const singleCardWidth = CARD_PADDING + dateWidth + 8 + contentWidth + 8 + amountWidth + CARD_PADDING;

      // 計算列數
      const totalColumns = Math.max(1, Math.ceil(screenshotCards.length / CARDS_PER_COLUMN));
      
      // 動態計算圖片寬度 = 左邊距 + (單列寬度 × 列數) + (列間距 × (列數-1)) + 右邊距
      const imageWidth = PADDING + (singleCardWidth * totalColumns) + (COLUMN_GAP * (totalColumns - 1)) + PADDING;
      
      // 確保最小寬度為375px（iPhone寬度）
      const finalImageWidth = Math.max(imageWidth, 375);

      // 圖片高度固定 (標題 + 10行卡片 + 邊距)
      const imageHeight = HEADER_HEIGHT + (CARDS_PER_COLUMN * CARD_HEIGHT) + (PADDING * 2);

      // 設置canvas實際尺寸 (高DPI)
      canvas.width = finalImageWidth * SCALE;
      canvas.height = imageHeight * SCALE;

      // 縮放繪圖上下文
      ctx.scale(SCALE, SCALE);

      // 啟用文字平滑
      ctx.textBaseline = 'middle';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 設置背景色 (深色主題)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, finalImageWidth, imageHeight);

      // 繪製標題區域
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(list.name, PADDING, 35);

      ctx.fillStyle = '#eb9834';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`總金額: $${totalAmount.toLocaleString('zh-TW')}`, PADDING, 65);

      // 繪製分隔線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, HEADER_HEIGHT);
      ctx.lineTo(finalImageWidth - PADDING, HEADER_HEIGHT);
      ctx.stroke();

      // 繪製多列卡片
      for (let col = 0; col < totalColumns; col++) {
        const columnStartX = PADDING + (col * (singleCardWidth + COLUMN_GAP));
        const columnCards = screenshotCards.slice(col * CARDS_PER_COLUMN, (col + 1) * CARDS_PER_COLUMN);

        columnCards.forEach((card, rowIndex) => {
          const yOffset = HEADER_HEIGHT + PADDING + (rowIndex * CARD_HEIGHT);
          const cardCenterY = yOffset + CARD_HEIGHT / 2;

          // 卡片背景 (極淺色)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.fillRect(columnStartX, yOffset, singleCardWidth, CARD_HEIGHT - 2);

          // 準備文字內容
          const dateText = card.date || '--/--';
          const contentText = card.content || '未命名項目';
          const amountText = `$${card.amount.toLocaleString('zh-TW')}`;

          // 設置字體
          ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
          
          // 計算各部分的寬度
          const actualDateWidth = ctx.measureText(dateText).width;
          ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
          const actualAmountWidth = ctx.measureText(amountText).width;

          // 繪製日期 (藍色, 靠左)
          ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#60a5fa'; // 藍色
          ctx.textAlign = 'left';
          ctx.fillText(dateText, columnStartX + CARD_PADDING, cardCenterY);

          // 繪製內容 (白色, 靠左對齊，緊接在日期後面)
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          
          // 限制內容文字最多顯示9個中文字元
          let displayContent = contentText;
          if (contentText.length > MAX_CONTENT_CHARS) {
            displayContent = contentText.substring(0, MAX_CONTENT_CHARS) + '...';
          }

          // 內容位置：緊接在日期後面，靠左對齊
          const contentX = columnStartX + CARD_PADDING + actualDateWidth + 8; // 日期位置 + 日期寬度 + 間距
          if (displayContent) {
            ctx.fillText(displayContent, contentX, cardCenterY);
          }

          // 繪製金額 (橘色, 靠右)
          ctx.fillStyle = '#eb9834'; // 橘色
          ctx.textAlign = 'right';
          ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(amountText, columnStartX + singleCardWidth - CARD_PADDING, cardCenterY);

          // 重置文字對齊
          ctx.textAlign = 'left';
        });
      }

      // 轉換為PNG (無損壓縮，更清晰)
      const imageDataUrl = canvas.toDataURL('image/png');

      // 保存到相簿 (iOS)
      if (navigator.share && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        const blob = await fetch(imageDataUrl).then(res => res.blob());
        const file = new File([blob], `${list.name}_記帳明細.png`, { type: 'image/png' });

        try {
          await navigator.share({
            files: [file],
            title: `${list.name} 記帳明細`,
            text: `${list.name} 總金額: $${totalAmount.toLocaleString('zh-TW')}`,
          });
        } catch (error) {
          console.log('分享取消或失敗，使用下載方式');
          const link = document.createElement('a');
          link.href = imageDataUrl;
          link.download = `${list.name}_記帳明細.png`;
          link.click();
        }
      } else {
        const link = document.createElement('a');
        link.href = imageDataUrl;
        link.download = `${list.name}_記帳明細.png`;
        link.click();
      }

    } catch (error) {
      console.error('截圖失敗:', error);
      alert('截圖失敗，請稍後再試。錯誤：' + error.message);
    }
  };

  return (
    <div data-list-id={list.id} className="flex-shrink-0 w-full h-full min-h-0 bg-card rounded-2xl shadow-lg border border-border flex flex-col">
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {isEditingName ? (
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                className="h-9 font-semibold"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="font-semibold text-lg hover:text-primary transition-colors"
              >
                {list.name}
              </button>
            )}
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddCard}
              className="h-8 w-8"
            >
              <Plus className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onRestoreCard}
              disabled={!canRestoreCard}
              className="h-8 w-8"
            >
              <Undo className="w-4 h-4" />
            </Button>

            <Button
              variant={isDeleteMode ? "destructive" : "ghost"}
              size="icon"
              onClick={() => {
                if (isDeleteMode && selectedCards.size > 0) {
                  handleDeleteSelected();
                } else {
                  setIsDeleteMode(!isDeleteMode);
                  setSelectedCards(new Set());
                }
              }}
              className="h-8 w-8"
            >
              <Trash2 className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSortCards}>
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  排序卡片
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleScreenshot}>
                  <Camera className="w-4 h-4 mr-2" />
                  輸出截圖
                </DropdownMenuItem>
                {onArchive && (
                  <DropdownMenuItem onClick={onArchive}>
                    <ArchiveIcon className="w-4 h-4 mr-2" />
                    封存欄位
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-primary">
            ${totalAmount.toLocaleString('zh-TW')}
          </div>
          <div className="flex text-xs" style={{ marginRight: '2.5ch' }}>
            <div className="flex flex-col text-white shrink-0">
              <span>內湖：</span>
              <span>瑞光：</span>
            </div>
            <div className="flex flex-col">
              <span className={neihuRemaining < 0 ? 'text-red-500' : ''}>
                ${neihuRemaining.toLocaleString('zh-TW')}
              </span>
              <span className={ruiguangRemaining < 0 ? 'text-red-500' : ''}>
                ${ruiguangRemaining.toLocaleString('zh-TW')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {purchaseSuggestions.length > 0 && (
        <div className="mx-4 mt-3 flex-shrink-0 rounded-lg border border-primary/30 bg-primary/5 p-2">
          <button
            type="button"
            onClick={handleToggleSuggestions}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="text-xs font-bold text-primary">本月建議採購</div>
            <div className="text-[10px] text-muted-foreground">
              {purchaseSuggestions.length} 項 · {areSuggestionsOpen ? '收起' : '展開'}
            </div>
          </button>
          {areSuggestionsOpen && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {purchaseSuggestions.map((suggestion) => (
                <button
                  key={suggestion.itemName}
                  type="button"
                  onClick={() => onAddSuggestedCard?.(suggestion)}
                  className="max-w-full rounded-md border border-primary/30 bg-background px-2 py-1 text-left text-xs font-semibold text-foreground shadow-sm active:scale-[0.99]"
                  title={`預估 ${suggestion.nextPurchaseDate.getMonth() + 1}/${suggestion.nextPurchaseDate.getDate()}，平均 ${suggestion.averageDaysBetween} 天`}
                >
                  <span className="block truncate">+ {suggestion.itemName}</span>
                  <span className="block text-[10px] font-medium text-muted-foreground">
                    預估 {suggestion.nextPurchaseDate.getMonth() + 1}/{suggestion.nextPurchaseDate.getDate()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={setNodeRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-2 touch-pan-y">
        <SortableContext items={list.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) => (
            <ExpenseCard
              key={card.id}
              card={card}
              tags={tags}
              onUpdate={onUpdateCard}
              isDeleteMode={isDeleteMode}
              isSelected={selectedCards.has(card.id)}
              onSelect={() => toggleCardSelection(card.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
