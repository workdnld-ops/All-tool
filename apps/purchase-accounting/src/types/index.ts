export type DeliveryStatus = 'none' | 'invoice' | 'package' | 'complete' | 'check' | 'excluded';

export interface SnackBudgetSettings {
  neihu: number;
  ruiguang: number;
}

export const DEFAULT_SNACK_BUDGET: SnackBudgetSettings = {
  neihu: 1300,
  ruiguang: 1800,
};

export type InvoiceType = 'paper' | 'electronic' | 'none';

export interface Tag {
  id: string;
  name: string;
  color: string;
  order?: number;
}

export interface ExpenseCard {
  id: string;
  status: DeliveryStatus;
  date: string; // MM/DD format
  tagId: string | null;
  content: string;
  amount: number;
  invoiceType: InvoiceType;
  order: number;
}

export interface List {
  id: string;
  name: string;
  cards: ExpenseCard[];
  order: number;
}

export const DEFAULT_TAGS: Tag[] = [
  { id: 'tag-1', name: '食物', color: 'sky', order: 0 },
  { id: 'tag-2', name: '交通', color: 'emerald', order: 1 },
  { id: 'tag-3', name: '娛樂', color: 'purple', order: 2 },
  { id: 'tag-4', name: '其他', color: 'pink', order: 3 },
];

export const TAG_COLORS = [
  { value: 'sky', label: '天藍', class: 'bg-tag-sky' },
  { value: 'emerald', label: '翡翠', class: 'bg-tag-emerald' },
  { value: 'purple', label: '紫色', class: 'bg-tag-purple' },
  { value: 'pink', label: '粉紅', class: 'bg-tag-pink' },
  { value: 'rose', label: '玫瑰', class: 'bg-tag-rose' },
  { value: 'orange', label: '橘色', class: 'bg-tag-orange' },
  { value: 'red', label: '紅色', class: 'bg-tag-red' },
  { value: 'violet', label: '紫羅蘭', class: 'bg-tag-violet' },
  { value: 'yellow', label: '黃色', class: 'bg-tag-yellow' },
  { value: 'stone', label: '石灰', class: 'bg-tag-stone' },
];
