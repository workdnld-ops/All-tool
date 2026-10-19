import { useRef, useState } from 'react';
import { X, File, Zap, Minus, GripVertical, Package, FileText, FileCheck2, Check } from 'lucide-react';
import { ExpenseCard as ExpenseCardType, InvoiceType, Tag } from '@/types';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { GOODS_LABELS, RECEIPT_LABELS, STATUS_TONES, STATUS_GRID, statusParts, statusLabel } from '@/lib/delivery-status';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ExpenseCardProps {
  card: ExpenseCardType;
  tags: Tag[];
  onUpdate: (id: string, updates: Partial<ExpenseCardType>) => void;
  isDeleteMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  isDragging?: boolean;
}

const invoiceTypeIcons: Record<InvoiceType, React.ReactNode> = {
  paper: <File className="w-4 h-4" />,
  electronic: <Zap className="w-4 h-4" />,
  none: <Minus className="w-4 h-4" />,
};

const invoiceTypeOrder: InvoiceType[] = ['none', 'electronic', 'paper'];

export function ExpenseCard({ 
  card, 
  tags, 
  onUpdate, 
  isDeleteMode, 
  isSelected, 
  onSelect,
  isDragging
}: ExpenseCardProps) {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [tempDate, setTempDate] = useState(card.date);
  const [tempContent, setTempContent] = useState(card.content);
  const [tempAmount, setTempAmount] = useState(card.amount.toString());
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const pointerStateRef = useRef({ x: 0, y: 0, moved: false });
  const tagPointerTypeRef = useRef<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ 
    id: card.id, 
    disabled: isDeleteMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'auto',
  };

  const handlePointerDownCapture = (event: React.PointerEvent) => {
    pointerStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };

  const handlePointerMoveCapture = (event: React.PointerEvent) => {
    const dx = Math.abs(event.clientX - pointerStateRef.current.x);
    const dy = Math.abs(event.clientY - pointerStateRef.current.y);
    if (dx > 8 || dy > 8) {
      pointerStateRef.current.moved = true;
    }
  };

  const stopClickAfterGesture = (event: React.MouseEvent) => {
    if (!pointerStateRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    pointerStateRef.current.moved = false;
  };

  const cycleInvoiceType = () => {
    if (isDeleteMode) return;
    const currentIndex = invoiceTypeOrder.indexOf(card.invoiceType);
    const nextIndex = (currentIndex + 1) % invoiceTypeOrder.length;
    onUpdate(card.id, { invoiceType: invoiceTypeOrder[nextIndex] });
  };

  const handleDateSubmit = () => {
    const cleaned = tempDate.replace(/\D/g, '');
    if (cleaned.length === 4) {
      const formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
      onUpdate(card.id, { date: formatted });
      setTempDate(formatted);
    }
    setIsEditingDate(false);
  };

  const handleContentSubmit = () => {
    onUpdate(card.id, { content: tempContent });
    setIsEditingContent(false);
  };

  const handleAmountSubmit = () => {
    const amount = parseInt(tempAmount) || 0;
    onUpdate(card.id, { amount });
    setTempAmount(amount.toString());
    setIsEditingAmount(false);
  };

  const formatAmount = (amount: number) => {
    return `$${amount.toLocaleString('zh-TW')}`;
  };

  const currentTag = tags.find(t => t.id === card.tagId);
  const isSnack = card.content.includes('零食');
  const { goods, receipt } = statusParts(card.status);
  const label = statusLabel(card.status);
  const ReceiptIcon = receipt === 2 ? FileCheck2 : FileText;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "expense-card rounded-lg border border-border transition-colors",
        isSnack && currentTag?.name === '瑞光' && 'expense-card-snack-ruiguang',
        isSnack && currentTag?.name === '內湖' && 'expense-card-snack-neihu',
        isDeleteMode && "cursor-pointer hover:bg-destructive/20",
        isSelected && "ring-2 ring-destructive",
        isDragging && "opacity-50"
      )}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerCancel={() => { pointerStateRef.current.moved = true; }}
      onClickCapture={stopClickAfterGesture}
      onClick={isDeleteMode ? onSelect : undefined}
    >
      <div className="expense-card-row">
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon"
          type="button"
          aria-label="拖曳排序"
          className="h-9 w-4 flex-shrink-0 cursor-grab touch-none p-0 text-muted-foreground active:cursor-grabbing"
          disabled={isDeleteMode}
          {...(!isDeleteMode ? attributes : {})}
          {...(!isDeleteMode ? listeners : {})}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </Button>

        <Popover open={isStatusMenuOpen && !isDeleteMode} onOpenChange={setIsStatusMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="status-trigger h-9 w-8 shrink-0 p-0"
              aria-label={`貨物狀態：${label}`}
              title={label}
              onClick={(event) => {
                // Only a completed tap opens the picker; a swipe is handled by the card guard.
                event.stopPropagation();
                setIsTagMenuOpen(false);
              }}
              disabled={isDeleteMode}
            >
              <span className="status-composite" aria-hidden="true">
                {card.status === 'excluded' ? <Minus className="status-gray" />
                  : goods === 0 && receipt === 0 ? <X className="status-red" />
                  : goods === 2 && receipt === 2 ? <Check className="status-green" />
                  : <><Package className={`status-${STATUS_TONES[goods]}`} />
                    {receipt > 0 && <ReceiptIcon className={`status-badge status-${STATUS_TONES[receipt]}`} />}</>}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            aria-label="選擇貨物狀態"
            className="status-picker w-[276px] max-w-[calc(100vw-24px)] p-3"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button type="button" aria-label="關閉狀態選單" className="h-8 w-8 flex items-center justify-center" onClick={() => setIsStatusMenuOpen(false)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="貨物與發票進度">
              {[GOODS_LABELS, RECEIPT_LABELS].flatMap((labels, row) => labels.map((name, index) => {
                const Icon = row === 0 ? Package : index === 2 ? FileCheck2 : FileText;
                return (
                  <button
                    key={name}
                    type="button"
                    className={cn('status-option', `status-${STATUS_TONES[index]}`)}
                    aria-label={name}
                    aria-pressed={card.status !== 'excluded' && (row === 0 ? goods : receipt) === index}
                    title={name}
                    onClick={() => {
                      const status = row === 0 ? STATUS_GRID[index][receipt] : STATUS_GRID[goods][index];
                      if (card.status !== status) onUpdate(card.id, { status });
                    }}
                  >
                    <Icon className="h-6 w-6" />
                    <span>{name}</span>
                  </button>
                );
              }))}
            </div>
            <button type="button" className="status-option status-gray mt-2 w-full" aria-pressed={card.status === 'excluded'} onClick={() => {
              onUpdate(card.id, { status: 'excluded' });
              setIsStatusMenuOpen(false);
            }}><Minus size={24} /><span>不計算</span></button>
          </PopoverContent>
        </Popover>

        {isEditingDate ? (
          <Input
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            onBlur={handleDateSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleDateSubmit()}
            onFocus={(e) => e.target.select()}
            className="h-8 w-12 text-xs px-1"
            inputMode="numeric"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !isDeleteMode && setIsEditingDate(true)}
            className="h-9 w-10 shrink-0 text-xs tabular-nums text-muted-foreground hover:text-foreground text-center"
            disabled={isDeleteMode}
          >
            {card.date || '--/--'}
          </button>
        )}

        <DropdownMenu open={isTagMenuOpen} onOpenChange={setIsTagMenuOpen}>
          <DropdownMenuTrigger asChild disabled={isDeleteMode}>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onPointerDownCapture={(event) => {
                tagPointerTypeRef.current = event.pointerType;
                if (event.pointerType === 'touch') {
                  event.preventDefault();
                }
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== 'touch') return;
                event.preventDefault();
                event.stopPropagation();
                if (pointerStateRef.current.moved) {
                  pointerStateRef.current.moved = false;
                  return;
                }
                setIsTagMenuOpen((open) => !open);
              }}
              onClick={(event) => {
                if (pointerStateRef.current.moved) {
                  event.preventDefault();
                  event.stopPropagation();
                  pointerStateRef.current.moved = false;
                  return;
                }
                if (tagPointerTypeRef.current === 'touch') {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              className={cn(
                "expense-tag h-7 px-1.5 text-[11px] min-w-[2.5rem] max-w-[4rem] flex-shrink-0 truncate",
                currentTag && `bg-tag-${currentTag.color} border-tag-${currentTag.color} text-white`
              )}
            >
              {currentTag?.name || '標籤'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => onUpdate(card.id, { tagId: null })}
              disabled={!card.tagId}
              className="mb-1 text-muted-foreground"
            >
              <X className="w-3.5 h-3.5 mr-2" />
              重置標籤
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {tags.map(tag => (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => onUpdate(card.id, { tagId: tag.id })}
                className={cn(`bg-tag-${tag.color} text-white mb-1`)}
              >
                {tag.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {isEditingContent ? (
          <Input
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            onBlur={handleContentSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleContentSubmit()}
            className="h-8 flex-1 min-w-0 text-xs px-1"
            maxLength={10}
            autoFocus
          />
        ) : (
          <button
            onClick={() => !isDeleteMode && setIsEditingContent(true)}
            className="h-9 text-xs font-medium flex-1 min-w-0 text-left truncate hover:text-foreground"
            disabled={isDeleteMode}
          >
            {card.content ? (card.content.length > 20 ? card.content.slice(0, 20) + '…' : card.content) : '內容'}
          </button>
        )}

        {isEditingAmount ? (
          <Input
            value={tempAmount}
            onChange={(e) => setTempAmount(e.target.value)}
            onBlur={handleAmountSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleAmountSubmit()}
            onFocus={(e) => e.target.select()}
            className="h-8 w-16 text-xs text-right px-1"
            inputMode="numeric"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !isDeleteMode && setIsEditingAmount(true)}
            className="h-9 text-xs font-bold tabular-nums min-w-[2.5rem] text-right hover:text-primary flex-shrink-0"
            disabled={isDeleteMode}
          >
            {formatAmount(card.amount)}
          </button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-6 flex-shrink-0 p-0"
          aria-label={`發票類型：${card.invoiceType === 'paper' ? '紙本' : card.invoiceType === 'electronic' ? '電子' : '無'}`}
          onClick={cycleInvoiceType}
          disabled={isDeleteMode}
        >
          {invoiceTypeIcons[card.invoiceType]}
        </Button>
      </div>
    </div>
  );
}
