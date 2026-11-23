import JSZip from 'jszip';
import { db as defaultDb, type CoinDB } from '../db/db';
import type { CollectionItem, Photo } from '../db/types';

/**
 * Backup format: a .zip containing
 *   backup.json          - format version, export date, all records, photo metadata
 *   photos/<photoId>.jpg - full-size photo
 *   thumbs/<photoId>.jpg - gallery thumbnail
 */
export const BACKUP_FORMAT = 'coin-scanner-backup';
export const BACKUP_VERSION = 1;

interface BackupJson {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  items: CollectionItem[];
  photos: Omit<Photo, 'image' | 'thumb'>[];
}

export async function createBackup(database: CoinDB = defaultDb): Promise<Blob> {
  const zip = new JSZip();
  const items = await database.items.toArray();
  const photos = await database.photos.toArray();
  const json: BackupJson = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    photos: photos.map(({ image: _i, thumb: _t, ...meta }) => meta),
  };
  zip.file('backup.json', JSON.stringify(json, null, 2));
  for (const p of photos) {
    zip.file(`photos/${p.id}.jpg`, await p.image.arrayBuffer());
    zip.file(`thumbs/${p.id}.jpg`, await p.thumb.arrayBuffer());
  }
  // Photos are already JPEG-compressed; STORE avoids wasting time re-compressing.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

export interface RestoreResult {
  items: number;
  photos: number;
  missingPhotos: number;
}

/**
 * Restore a backup. Records are merged: a record in the backup replaces the
 * record with the same ID on this device; other records are left alone.
 */
export async function restoreBackup(
  file: Blob | ArrayBuffer,
  database: CoinDB = defaultDb,
): Promise<RestoreResult> {
  const zip = await JSZip.loadAsync(file);
  const jsonFile = zip.file('backup.json');
  if (!jsonFile) throw new Error('This file is not a Coin Scanner backup (backup.json missing).');
  const json = JSON.parse(await jsonFile.async('string')) as BackupJson;
  if (json.format !== BACKUP_FORMAT) throw new Error('This file is not a Coin Scanner backup.');
  if (json.version > BACKUP_VERSION)
    throw new Error('This backup was made by a newer version of the app. Update the app first.');

  const photos: Photo[] = [];
  let missing = 0;
  for (const meta of json.photos) {
    const img = zip.file(`photos/${meta.id}.jpg`);
    const th = zip.file(`thumbs/${meta.id}.jpg`);
    if (!img) {
      missing++;
      continue;
    }
    const image = new Blob([await img.async('arraybuffer')], { type: 'image/jpeg' });
    const thumb = th ? new Blob([await th.async('arraybuffer')], { type: 'image/jpeg' }) : image;
    photos.push({ ...meta, image, thumb });
  }

  await database.transaction('rw', database.items, database.photos, async () => {
    await database.photos.bulkPut(photos);
    await database.items.bulkPut(json.items);
  });
  return { items: json.items.length, photos: photos.length, missingPhotos: missing };
}
