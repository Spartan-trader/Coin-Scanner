import { beforeEach, describe, expect, it } from 'vitest';
import { CoinDB, deleteItem, listItems, saveItemWithPhotos, updateItem, type NewPhoto } from '../src/db/db';
import { newItem } from '../src/db/types';
import { createBackup, restoreBackup } from '../src/lib/backup';
import { toCsv } from '../src/lib/csv';
import { computeStats, formatRange } from '../src/lib/stats';

let n = 0;
let db: CoinDB;
beforeEach(async () => {
  db = new CoinDB(`test-${++n}`);
  await db.open();
});

const jpeg = (tag: string) => new Blob([`fake-jpeg-${tag}`], { type: 'image/jpeg' });
const photos = (tag: string): NewPhoto[] => [
  { side: 'front', image: jpeg(`${tag}-F`), thumb: jpeg(`${tag}-f`), width: 1600, height: 1600 },
  { side: 'back', image: jpeg(`${tag}-B`), thumb: jpeg(`${tag}-b`), width: 1600, height: 1600 },
];
const text = (b: Blob) => b.text();

describe('front/back pairing and saving', () => {
  it('stores both photos linked to one coin record', async () => {
    const item = { ...newItem('coin-1'), year: '1943', mintMark: 'S', denomination: 'Cent' };
    const saved = await saveItemWithPhotos(item, photos('a'), db);
    expect(saved.frontPhotoId).toBe('coin-1-front');
    expect(saved.backPhotoId).toBe('coin-1-back');
    const stored = await db.photos.where('itemId').equals('coin-1').toArray();
    expect(stored.map((p) => p.side).sort()).toEqual(['back', 'front']);
    expect(await text((await db.photos.get('coin-1-front'))!.image)).toBe('fake-jpeg-a-F');
    expect(await text((await db.photos.get('coin-1-back'))!.image)).toBe('fake-jpeg-a-B');
  });

  it('saving the same draft twice (double tap) does not create duplicates', async () => {
    const item = newItem('coin-x');
    await saveItemWithPhotos(item, photos('x'), db);
    await saveItemWithPhotos(item, photos('x'), db);
    expect(await db.items.count()).toBe(1);
    expect(await db.photos.count()).toBe(2);
  });

  it('allows a coin with only a front photo', async () => {
    const saved = await saveItemWithPhotos(newItem('one'), photos('o').slice(0, 1), db);
    expect(saved.frontPhotoId).toBe('one-front');
    expect(saved.backPhotoId).toBeNull();
  });
});

describe('repeated scanning', () => {
  it('saves 20 coins in a row and lists them all, newest first', async () => {
    for (let i = 0; i < 20; i++) {
      const item = newItem(`c${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, i)));
      await saveItemWithPhotos({ ...item, year: String(1900 + i) }, photos(`c${i}`), db);
    }
    const all = await listItems(db);
    expect(all).toHaveLength(20);
    expect(all[0].id).toBe('c19');
    expect(await db.photos.count()).toBe(40);
    // each coin's photos really are its own
    expect(await text((await db.photos.get('c7-back'))!.image)).toBe('fake-jpeg-c7-B');
  });

  it('data survives closing and reopening the database', async () => {
    await saveItemWithPhotos(newItem('persist'), photos('p'), db);
    const name = db.name;
    db.close();
    const reopened = new CoinDB(name);
    expect(await reopened.items.get('persist')).toBeTruthy();
    expect(await reopened.photos.count()).toBe(2);
  });
});

describe('editing and deleting', () => {
  it('updates fields and removes photos on delete', async () => {
    const saved = await saveItemWithPhotos(newItem('e'), photos('e'), db);
    await updateItem({ ...saved, year: '1909', mintMark: 'S', series: 'Lincoln Wheat' }, db);
    expect((await db.items.get('e'))!.year).toBe('1909');
    await deleteItem('e', db);
    expect(await db.items.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
  });
});

describe('missing pricing data', () => {
  it('is never counted as zero', () => {
    const a = newItem('a');
    const b = { ...newItem('b'), value: { ...newItem('b').value, low: 2, high: 5 } };
    const s = computeStats([a, b]);
    expect(s.valuedRecords).toBe(1);
    expect(s.unvaluedRecords).toBe(1);
    expect(s.valueLow).toBe(2);
    expect(s.valueHigh).toBe(5);
    expect(formatRange(a)).toBe('Value not yet verified');
    expect(computeStats([a]).valueLow).toBeNull();
  });

  it('multiplies by quantity', () => {
    const b = { ...newItem('b'), quantity: 3, value: { ...newItem('b').value, low: 1, high: 2 } };
    expect(computeStats([b])).toMatchObject({ totalCoins: 3, valueLow: 3, valueHigh: 6 });
  });

  it('CSV leaves missing values blank, not 0', () => {
    const csv = toCsv([{ ...newItem('z'), notes: 'has "quotes", commas' }]);
    const [header, row] = csv.trim().split('\r\n');
    const cols = header.split(',');
    const lowIdx = cols.indexOf('Value low (USD)');
    expect(lowIdx).toBeGreaterThan(-1);
    expect(row).toContain('"has ""quotes"", commas"');
    expect(row).not.toMatch(/,0,/);
  });

  it('CSV neutralises spreadsheet formulas', () => {
    const csv = toCsv([{ ...newItem('f'), notes: '=HYPERLINK("x")' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('backup and restore', () => {
  it('round-trips records and photos into an empty database', async () => {
    for (let i = 0; i < 5; i++) await saveItemWithPhotos({ ...newItem(`b${i}`), year: `19${i}0` }, photos(`b${i}`), db);
    const zip = await createBackup(db);
    const target = new CoinDB(`restore-${n}`);
    const buf = await zip.arrayBuffer();
    const r = await restoreBackup(buf, target);
    expect(r).toEqual({ items: 5, photos: 10, missingPhotos: 0 });
    expect((await target.items.get('b3'))!.year).toBe('1930');
    expect(await text((await target.photos.get('b3-back'))!.image)).toBe('fake-jpeg-b3-B');
  });

  it('merges without wiping other coins', async () => {
    await saveItemWithPhotos(newItem('keep'), photos('k'), db);
    const other = new CoinDB(`other-${n}`);
    await saveItemWithPhotos(newItem('incoming'), photos('i'), other);
    await restoreBackup(await (await createBackup(other)).arrayBuffer(), db);
    expect((await db.items.toArray()).map((i) => i.id).sort()).toEqual(['incoming', 'keep']);
  });

  it('rejects files that are not backups', async () => {
    const JSZip = (await import('jszip')).default;
    const z = new JSZip();
    z.file('hello.txt', 'hi');
    await expect(restoreBackup(await z.generateAsync({ type: 'arraybuffer' }), db)).rejects.toThrow(/not a Coin Scanner backup/);
  });
});

describe('large collection performance', () => {
  it('saves and lists 2,000 records with stats quickly', async () => {
    const items = Array.from({ length: 2000 }, (_, i) => ({
      ...newItem(`L${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i))),
      year: String(1900 + (i % 120)),
      value: { ...newItem('v').value, low: i % 3 ? 1 : null, high: i % 3 ? 3 : null },
    }));
    await db.items.bulkPut(items);
    const t0 = performance.now();
    const all = await listItems(db);
    const stats = computeStats(all);
    const ms = performance.now() - t0;
    expect(all).toHaveLength(2000);
    expect(stats.valuedRecords).toBe(1333);
    console.log(`list+stats for 2000 records: ${ms.toFixed(0)} ms (fake-indexeddb in Node)`);
    expect(ms).toBeLessThan(5000);
  });
});
