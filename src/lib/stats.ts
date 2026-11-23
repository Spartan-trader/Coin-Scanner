import type { CollectionItem } from '../db/types';

export interface CollectionStats {
  records: number;
  totalCoins: number; // sum of quantities
  valuedRecords: number;
  unvaluedRecords: number;
  /** Totals only include coins that have a value. null when none do. */
  valueLow: number | null;
  valueHigh: number | null;
  needsResearch: number;
  potentiallyValuable: number;
}

/** A coin counts as "has a value" only if someone entered at least one number. */
export function hasValue(item: CollectionItem): boolean {
  return item.value.low !== null || item.value.high !== null;
}

export function valueRange(item: CollectionItem): { low: number; high: number } | null {
  const { low, high } = item.value;
  if (low === null && high === null) return null;
  return { low: low ?? (high as number), high: high ?? (low as number) };
}

export const VALUABLE_THRESHOLD = 25; // dollars, per coin (high estimate)

export function computeStats(items: CollectionItem[]): CollectionStats {
  let totalCoins = 0;
  let valued = 0;
  let low = 0;
  let high = 0;
  let needsResearch = 0;
  let valuable = 0;
  for (const it of items) {
    const qty = Math.max(1, it.quantity || 1);
    totalCoins += qty;
    const r = valueRange(it);
    if (r) {
      valued++;
      low += r.low * qty;
      high += r.high * qty;
      if (r.high >= VALUABLE_THRESHOLD) valuable++;
    }
    if (it.verificationStatus !== 'verified') needsResearch++;
    if (it.verificationStatus === 'expert_review' && !(r && r.high >= VALUABLE_THRESHOLD)) valuable++;
  }
  return {
    records: items.length,
    totalCoins,
    valuedRecords: valued,
    unvaluedRecords: items.length - valued,
    valueLow: valued ? round2(low) : null,
    valueHigh: valued ? round2(high) : null,
    needsResearch,
    potentiallyValuable: valuable,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatRange(item: CollectionItem): string {
  const r = valueRange(item);
  if (!r) return 'Value not yet verified';
  return r.low === r.high ? formatMoney(r.low) : `${formatMoney(r.low)} – ${formatMoney(r.high)}`;
}
