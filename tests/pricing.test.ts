import { describe, expect, it } from 'vitest';
import { newItem } from '../src/db/types';
import { canResearch, coinQuery, researchLinks } from '../src/lib/pricing';

const coin = { ...newItem('p'), year: '1943', mintMark: 'S', series: 'Lincoln Wheat', denomination: 'Cent' };

describe('Find Price links', () => {
  it('builds the search text from known fields only', () => {
    expect(coinQuery(coin)).toBe('1943 S Lincoln Wheat Cent');
    expect(coinQuery({ ...coin, mintMark: 'none', year: '' })).toBe('Lincoln Wheat Cent');
  });
  it('requires a denomination or series', () => {
    expect(canResearch(newItem('x'))).toBe(false);
    expect(canResearch({ ...newItem('x'), denomination: 'Dime' })).toBe(true);
  });
  it('eBay link is limited to sold, completed listings', () => {
    const ebay = researchLinks(coin).find((l) => l.id === 'ebay-sold')!;
    const u = new URL(ebay.url);
    expect(u.hostname).toBe('www.ebay.com');
    expect(u.searchParams.get('_nkw')).toBe('1943 S Lincoln Wheat Cent');
    expect(u.searchParams.get('LH_Sold')).toBe('1');
    expect(u.searchParams.get('LH_Complete')).toBe('1');
    expect(ebay.kind).toBe('completed_sales');
  });
  it('price guide links search only that site', () => {
    const pcgs = researchLinks(coin).find((l) => l.id === 'pcgs')!;
    expect(new URL(pcgs.url).searchParams.get('q')).toBe('site:pcgs.com 1943 S Lincoln Wheat Cent price');
  });
  it('encodes unusual characters safely', () => {
    const odd = { ...coin, variety: 'DDO & "RPM"' };
    for (const l of researchLinks(odd)) expect(() => new URL(l.url)).not.toThrow();
  });
});
