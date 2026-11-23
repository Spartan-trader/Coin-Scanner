/**
 * Data model for the collection.
 *
 * Every item has an `itemType` so paper money ("banknote") can be added later
 * without changing the storage layout.
 */

export type ItemType = 'coin' | 'banknote';

/** How sure we are about the identification as a whole. */
export type IdConfidence = 'confirmed' | 'probable' | 'uncertain' | 'unknown';

export type VerificationStatus =
  | 'unverified' // just scanned, nobody has checked it
  | 'needs_closeup' // photos not good enough to read date / mint mark
  | 'needs_research' // identified but value or variety still to research
  | 'expert_review' // possibly valuable or suspicious - show to a professional
  | 'verified'; // owner has checked the identification

/** What kind of number a value estimate represents. Asking prices are not sales. */
export type ValueKind =
  | 'collector_estimate'
  | 'completed_sales'
  | 'retail_asking'
  | 'dealer_buy'
  | 'metal_value'
  | 'face_value_only';

export interface ValueEstimate {
  /** null means "not yet verified" - never treated as zero. */
  low: number | null;
  high: number | null;
  kind: ValueKind;
  /** Where the number came from (price guide name, auction site, etc.). */
  source: string;
  /** Date the pricing evidence is from (YYYY-MM-DD). */
  asOf: string;
  /** Grade / condition the estimate assumes. */
  gradeAssumption: string;
  notes: string;
}

export interface CollectionItem {
  id: string;
  itemType: ItemType;
  createdAt: string; // ISO timestamp (date scanned)
  updatedAt: string;

  frontPhotoId: string | null;
  backPhotoId: string | null;

  // Identification - every field may be blank ("unknown").
  country: string;
  denomination: string;
  year: string; // text so "1909?" or "" are allowed
  mintMark: string; // "P", "D", "S", "none" or "" for unknown
  series: string;
  variety: string;
  composition: string;
  conditionNotes: string;
  idConfidence: IdConfidence;

  value: ValueEstimate;

  purchasePrice: number | null;
  quantity: number;
  storageLocation: string;
  notes: string;
  verificationStatus: VerificationStatus;
}

export type PhotoSide = 'front' | 'back';

export interface Photo {
  id: string;
  itemId: string;
  side: PhotoSide;
  image: Blob; // full size (max ~1600px JPEG)
  thumb: Blob; // small preview for the gallery
  width: number;
  height: number;
  createdAt: string;
}

export interface MetaEntry {
  key: string;
  value: string;
}

export const DENOMINATIONS = [
  'Half Cent',
  'Cent',
  'Two Cents',
  'Three Cents',
  'Nickel',
  'Half Dime',
  'Dime',
  'Twenty Cents',
  'Quarter',
  'Half Dollar',
  'Dollar',
  'Other',
] as const;

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: 'Unverified',
  needs_closeup: 'Needs close-up',
  needs_research: 'Needs research',
  expert_review: 'Expert review',
  verified: 'Verified',
};

export const CONFIDENCE_LABELS: Record<IdConfidence, string> = {
  confirmed: 'Confirmed',
  probable: 'Probable',
  uncertain: 'Uncertain',
  unknown: 'Unknown',
};

export const VALUE_KIND_LABELS: Record<ValueKind, string> = {
  collector_estimate: 'Collector value estimate',
  completed_sales: 'Completed-sale evidence',
  retail_asking: 'Retail asking price',
  dealer_buy: 'Dealer purchase estimate',
  metal_value: 'Metal value',
  face_value_only: 'Face value only',
};

export function emptyValue(): ValueEstimate {
  return {
    low: null,
    high: null,
    kind: 'collector_estimate',
    source: '',
    asOf: '',
    gradeAssumption: '',
    notes: '',
  };
}

export function newItem(id: string, now = new Date()): CollectionItem {
  const ts = now.toISOString();
  return {
    id,
    itemType: 'coin',
    createdAt: ts,
    updatedAt: ts,
    frontPhotoId: null,
    backPhotoId: null,
    country: 'United States',
    denomination: '',
    year: '',
    mintMark: '',
    series: '',
    variety: '',
    composition: '',
    conditionNotes: '',
    idConfidence: 'unknown',
    value: emptyValue(),
    purchasePrice: null,
    quantity: 1,
    storageLocation: '',
    notes: '',
    verificationStatus: 'unverified',
  };
}

/** Short human label, e.g. "1943-S Cent (Lincoln Wheat)". */
export function itemTitle(item: CollectionItem): string {
  const yearMint = [item.year || '????', item.mintMark && item.mintMark !== 'none' ? item.mintMark : '']
    .filter(Boolean)
    .join('-');
  const denom = item.denomination || 'Unidentified coin';
  return `${yearMint} ${denom}${item.series ? ` (${item.series})` : ''}`;
}
