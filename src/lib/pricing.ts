import type { CollectionItem, ValueKind } from '../db/types';

/**
 * "Find Price" research links. These open public web pages already searched
 * for this coin - the app does not fetch or copy any prices itself. The owner
 * reads the price and types it in, so every value has a real source and date.
 */
export interface ResearchLink {
  id: string;
  label: string;
  description: string;
  url: string;
  /** Saved as the pricing source when a price is entered after using this link. */
  sourceName: string;
  /** What kind of number this source gives. */
  kind: ValueKind;
}

/** e.g. "1943 S Lincoln Wheat Cent". Unknown parts are left out, never guessed. */
export function coinQuery(item: CollectionItem): string {
  const mint = item.mintMark && item.mintMark !== 'none' ? item.mintMark : '';
  return [item.year.trim(), mint, item.series.trim(), item.denomination, item.variety.trim()]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
}

/** Need at least a denomination or series for a useful search. */
export function canResearch(item: CollectionItem): boolean {
  return !!(item.denomination || item.series.trim());
}

const enc = encodeURIComponent;
const google = (q: string) => `https://www.google.com/search?q=${enc(q)}`;

export function researchLinks(item: CollectionItem): ResearchLink[] {
  const q = coinQuery(item);
  return [
    {
      id: 'ebay-sold',
      label: 'eBay sold prices',
      description: 'What coins like this actually sold for (completed sales, not asking prices).',
      url: `https://www.ebay.com/sch/i.html?_nkw=${enc(q)}&LH_Sold=1&LH_Complete=1`,
      sourceName: 'eBay sold listings',
      kind: 'completed_sales',
    },
    {
      id: 'pcgs',
      label: 'PCGS Price Guide',
      description: 'Professional price guide values by grade.',
      url: google(`site:pcgs.com ${q} price`),
      sourceName: 'PCGS Price Guide',
      kind: 'collector_estimate',
    },
    {
      id: 'ngc',
      label: 'NGC Price Guide',
      description: 'Second professional price guide to compare with PCGS.',
      url: google(`site:ngccoin.com ${q} price guide`),
      sourceName: 'NGC Price Guide',
      kind: 'collector_estimate',
    },
    {
      id: 'heritage',
      label: 'Heritage auction results',
      description: 'Past auction sales - best for rare or high-value coins.',
      url: google(`site:ha.com ${q}`),
      sourceName: 'Heritage Auctions archive',
      kind: 'completed_sales',
    },
    {
      id: 'melt',
      label: 'Metal (melt) value',
      description: 'Value of the silver/copper content - matters for older silver coins.',
      url: google(`${q} melt value`),
      sourceName: 'Melt value calculator',
      kind: 'metal_value',
    },
    {
      id: 'web',
      label: 'General web search',
      description: 'Anything else: varieties, errors, articles.',
      url: google(`${q} coin value`),
      sourceName: 'Web search',
      kind: 'collector_estimate',
    },
  ];
}
