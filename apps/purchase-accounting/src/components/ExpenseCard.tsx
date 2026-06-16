import { useState } from 'react';
import { X, FileText, Package, PackageCheck, Check, File, Zap, Minus } from 'lucide-react';
import { ExpenseCard as ExpenseCardType, DeliveryStatus, InvoiceType, Tag } from '@/types';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const statusIcons: Record<DeliveryStatus, React.ReactNode> = {
  none: <X className="w-4 h-4 text-red-500" />,
  invoice: <FileText className="w-4 h-4" />,
  package: <Package className="w-4 h-4" />,
  complete: <PackageCheck className="w-4 h-4 text-yellow-300" />,
  check: <Check className="w-4 h-4 text-green-500" />,
  excluded: <Minus className="w-4 h-4 text-muted-foreground" />,
};

const invoiceTypeIcons: Record<InvoiceType, React.ReactNode> = {
  paper: <File className="w-4 h-4" />,
  electronic: <Zap className="w-4 h-4" />,
  none: <Minus className="w-4 h-4" />,
};

const invoiceTypeOrder: InvoiceType[] = ['none', 'electronic', 'paper'];

const statusOrder: DeliveryStatus[] = ['invoice', 'package', 'complete', 'check', 'excluded', 'none'];

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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ 
    id: card.id, 
    disabled: isDeleteMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cycleStatus = () => {
    if (isDeleteMode) return;
    const currentIndex = statusOrder.indexOf(card.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    onUpdate(card.id, { status: statusOrder[nextIndex] });
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!isDeleteMode ? attributes : {})}
      {...(!isDeleteMode ? listeners : {})}
      className={cn(
        "bg-card rounded-lg p-2 shadow-sm border border-border transition-all",
        !isDeleteMode && "cursor-grab active:cursor-grabbing touch-none",
        isDeleteMode && "cursor-pointer hover:bg-destructive/20",
        isSelected && "ring-2 ring-destructive",
        isDragging && "opacity-50 cursor-grabbing"
      )}
      onClick={isDeleteMode ? onSelect : undefined}
    >
      <div className="flex items-center gap-0.5 text-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 p-0"
          onClick={cycleStatus}
          disabled={isDeleteMode}
        >
          {statusIcons[card.status]}
        </Button>

        {isEditingDate ? (
          <Input
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            onBlur={handleDateSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleDateSubmit()}
            onFocus={(e) => e.target.select()}
            className="h-7 w-14 text-xs px-1"
            inputMode="numeric"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !isDeleteMode && setIsEditingDate(true)}
            className="text-xs text-muted-foreground hover:text-foreground min-w-[2rem] text-center"
            disabled={isDeleteMode}
          >
            {card.date || '--/--'}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={isDeleteMode}>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-6 px-1.5 text-[10px] min-w-[2.5rem] flex-shrink-0",
                currentTag && `bg-tag-${currentTag.color} border-tag-${currentTag.color} text-white`
              )}
            >
              {currentTag?.name || '標籤'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
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
            className="h-7 flex-1 min-w-[5rem] text-xs px-2"
            maxLength={10}
            autoFocus
          />
        ) : (
          <button
            onClick={() => !isDeleteMode && setIsEditingContent(true)}
            className="text-xs flex-1 min-w-[5rem] text-left truncate hover:text-foreground"
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
            className="h-7 w-16 text-xs text-right px-1"
            inputMode="numeric"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !isDeleteMode && setIsEditingAmount(true)}
            className="text-xs font-medium min-w-[2.5rem] text-right hover:text-primary flex-shrink-0"
            disabled={isDeleteMode}
          >
            {formatAmount(card.amount)}
          </button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 p-0"
          onClick={cycleInvoiceType}
          disabled={isDeleteMode}
        >
          {invoiceTypeIcons[card.invoiceType]}
        </Button>
      </div>
    </div>
  );
}
