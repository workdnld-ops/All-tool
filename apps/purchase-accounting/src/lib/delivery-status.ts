import type { DeliveryStatus } from '@/types';

export const GOODS_LABELS = ['未到貨', '已取貨', '已驗收'] as const;
export const RECEIPT_LABELS = ['無發票', '有發票', '已報帳'] as const;
export const STATUS_TONES = ['red', 'amber', 'green'] as const;
export const STATUS_GRID: DeliveryStatus[][] = [
  ['none', 'invoice', 'reimbursed'],
  ['complete', 'collectedInvoice', 'collectedReimbursed'],
  ['accepted', 'acceptedInvoice', 'check'],
];

// Read legacy values without rewriting saved cards.
export function statusParts(status: DeliveryStatus) {
  const normalized = status === 'package' || status === 'noInvoice' ? 'none' : status;
  for (let goods = 0; goods < 3; goods++) {
    const receipt = STATUS_GRID[goods].indexOf(normalized);
    if (receipt !== -1) return { goods, receipt };
  }
  return { goods: 0, receipt: 0 };
}

export function statusLabel(status: DeliveryStatus) {
  if (status === 'excluded') return '不計算';
  const { goods, receipt } = statusParts(status);
  return `${GOODS_LABELS[goods]}、${RECEIPT_LABELS[receipt]}`;
}

export function statusRank(status: DeliveryStatus) {
  if (status === 'excluded') return 9;
  const { goods, receipt } = statusParts(status);
  return goods * 3 + receipt;
}
