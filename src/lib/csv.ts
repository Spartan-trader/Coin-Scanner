import type { CollectionItem } from '../db/types';
import { CONFIDENCE_LABELS, VALUE_KIND_LABELS, VERIFICATION_LABELS } from '../db/types';

const COLUMNS: [string, (i: CollectionItem) => string | number | null][] = [
  ['Record ID', (i) => i.id],
  ['Date scanned', (i) => i.createdAt],
  ['Country', (i) => i.country],
  ['Denomination', (i) => i.denomination],
  ['Year', (i) => i.year],
  ['Mint mark', (i) => i.mintMark],
  ['Series', (i) => i.series],
  ['Variety', (i) => i.variety],
  ['Composition', (i) => i.composition],
  ['Condition notes', (i) => i.conditionNotes],
  ['ID confidence', (i) => CONFIDENCE_LABELS[i.idConfidence]],
  ['Value low (USD)', (i) => i.value.low],
  ['Value high (USD)', (i) => i.value.high],
  ['Value type', (i) => VALUE_KIND_LABELS[i.value.kind]],
  ['Pricing source', (i) => i.value.source],
  ['Pricing date', (i) => i.value.asOf],
  ['Grade assumption', (i) => i.value.gradeAssumption],
  ['Value notes', (i) => i.value.notes],
  ['Purchase price (USD)', (i) => i.purchasePrice],
  ['Quantity', (i) => i.quantity],
  ['Storage location', (i) => i.storageLocation],
  ['Notes', (i) => i.notes],
  ['Verification status', (i) => VERIFICATION_LABELS[i.verificationStatus]],
];

function cell(v: string | number | null): string {
  // Missing values stay blank - never written as 0.
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Stop spreadsheet apps from treating text as a formula.
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(items: CollectionItem[]): string {
  const lines = [COLUMNS.map(([h]) => cell(h)).join(',')];
  for (const it of items) lines.push(COLUMNS.map(([, f]) => cell(f(it))).join(','));
  return lines.join('\r\n') + '\r\n';
}
