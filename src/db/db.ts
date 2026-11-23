import Dexie, { type Table } from 'dexie';
import type { CollectionItem, MetaEntry, Photo, PhotoSide } from './types';

/**
 * Local database (IndexedDB, via Dexie). Everything stays on this device.
 * Photos live in their own table so the collection list loads quickly.
 */
export class CoinDB extends Dexie {
  items!: Table<CollectionItem, string>;
  photos!: Table<Photo, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'coin-scanner') {
    super(name);
    this.version(1).stores({
      items: 'id, itemType, createdAt, updatedAt, denomination, year, mintMark, series, verificationStatus',
      photos: 'id, itemId, side',
      meta: 'key',
    });
  }
}

export const db = new CoinDB();

export interface NewPhoto {
  side: PhotoSide;
  image: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export function photoId(itemId: string, side: PhotoSide): string {
  return `${itemId}-${side}`;
}

/**
 * Save a coin and its photos in one transaction.
 * Photo ids are derived from the item id, so saving the same draft twice
 * (e.g. a double-tap on "Save") overwrites instead of creating duplicates.
 */
export async function saveItemWithPhotos(
  item: CollectionItem,
  photos: NewPhoto[],
  database: CoinDB = db,
): Promise<CollectionItem> {
  const now = new Date().toISOString();
  const saved: CollectionItem = { ...item, updatedAt: now };
  const rows: Photo[] = photos.map((p) => ({
    id: photoId(item.id, p.side),
    itemId: item.id,
    side: p.side,
    image: p.image,
    thumb: p.thumb,
    width: p.width,
    height: p.height,
    createdAt: now,
  }));
  for (const r of rows) {
    if (r.side === 'front') saved.frontPhotoId = r.id;
    else saved.backPhotoId = r.id;
  }
  await database.transaction('rw', database.items, database.photos, async () => {
    await database.photos.bulkPut(rows);
    await database.items.put(saved);
  });
  return saved;
}

export async function updateItem(item: CollectionItem, database: CoinDB = db): Promise<CollectionItem> {
  const saved = { ...item, updatedAt: new Date().toISOString() };
  await database.items.put(saved);
  return saved;
}

export async function deleteItem(id: string, database: CoinDB = db): Promise<void> {
  await database.transaction('rw', database.items, database.photos, async () => {
    await database.photos.where('itemId').equals(id).delete();
    await database.items.delete(id);
  });
}

/** All items, newest first. */
export async function listItems(database: CoinDB = db): Promise<CollectionItem[]> {
  return database.items.orderBy('createdAt').reverse().toArray();
}

export async function getItem(id: string, database: CoinDB = db) {
  return database.items.get(id);
}

export async function getPhoto(id: string, database: CoinDB = db) {
  return database.photos.get(id);
}

export async function getMeta(key: string, database: CoinDB = db): Promise<string | undefined> {
  return (await database.meta.get(key))?.value;
}

export async function setMeta(key: string, value: string, database: CoinDB = db): Promise<void> {
  await database.meta.put({ key, value });
}

/** Ask the browser not to clear our storage when the device is low on space. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* not supported */
  }
  return false;
}
