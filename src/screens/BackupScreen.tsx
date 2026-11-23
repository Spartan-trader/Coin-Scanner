import { useEffect, useRef, useState } from 'react';
import { db, getMeta, listItems, requestPersistentStorage, setMeta } from '../db/db';
import { createBackup, restoreBackup } from '../lib/backup';
import { toCsv } from '../lib/csv';
import { downloadBlob, todayStamp } from '../lib/util';

export function BackupScreen() {
  const [count, setCount] = useState<number | null>(null);
  const [lastBackup, setLastBackup] = useState<string | undefined>();
  const [usage, setUsage] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setCount(await db.items.count());
    setLastBackup(await getMeta('lastBackupAt'));
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.usage !== undefined)
        setUsage(`${(est.usage / 1024 / 1024).toFixed(1)} MB used${est.quota ? ` of ~${Math.round(est.quota / 1024 / 1024 / 1024)} GB available` : ''}`);
      setPersisted((await navigator.storage?.persisted?.()) ?? null);
    } catch {
      /* not supported */
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function backup() {
    setBusy('Creating backup…');
    setMsg('');
    try {
      const blob = await createBackup();
      downloadBlob(blob, `coin-backup-${todayStamp()}.zip`);
      await setMeta('lastBackupAt', new Date().toISOString());
      setMsg(`Backup created (${(blob.size / 1024 / 1024).toFixed(1)} MB). Keep it somewhere safe, e.g. Google Drive or your PC.`);
    } catch (e) {
      setMsg(`Backup failed: ${(e as Error).message}`);
    } finally {
      setBusy('');
      refresh();
    }
  }

  async function csv() {
    const items = await listItems();
    downloadBlob(new Blob([toCsv(items)], { type: 'text/csv' }), `coin-collection-${todayStamp()}.csv`);
  }

  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!confirm('Restore this backup? Coins in the backup will replace matching coins on this device. Other coins are kept.'))
      return;
    setBusy('Restoring…');
    setMsg('');
    try {
      const r = await restoreBackup(f);
      setMsg(
        `Restored ${r.items} coins and ${r.photos} photos.` +
          (r.missingPhotos ? ` ${r.missingPhotos} photos were missing from the file.` : ''),
      );
    } catch (err) {
      setMsg(`Restore failed: ${(err as Error).message}`);
    } finally {
      setBusy('');
      refresh();
    }
  }

  return (
    <div className="screen backup">
      <header className="bar">
        <span />
        <h1>Backup & Export</h1>
        <span />
      </header>

      <div className="panel">
        <p>
          <strong>{count ?? '…'}</strong> coin records on this device.
        </p>
        <p className="small">
          Last backup: {lastBackup ? new Date(lastBackup).toLocaleString() : <strong className="warn">never</strong>}
        </p>
        {usage && <p className="small muted">Storage: {usage}</p>}
        {persisted === false && (
          <p className="small warn">
            The browser may clear this app's data if your phone runs low on space.{' '}
            <button className="link" onClick={async () => setPersisted(await requestPersistentStorage())}>
              Ask to keep data permanently
            </button>
          </p>
        )}
        {persisted && <p className="small muted">✓ Browser has agreed to keep this app's data.</p>}
      </div>

      <div className="actions">
        <button className="btn primary big" disabled={!!busy} onClick={backup}>
          Download full backup (.zip with photos)
        </button>
        <button className="btn secondary" disabled={!!busy} onClick={csv}>
          Export spreadsheet (.csv)
        </button>
        <button className="btn secondary" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          Restore from backup…
        </button>
        <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={restore} data-testid="restore-input" />
      </div>
      {busy && <p className="center">{busy}</p>}
      {msg && <p className="center" role="status">{msg}</p>}

      <p className="muted small">
        Your collection lives only in this browser on this device. To move it to your Windows PC, download a backup here and
        restore it there.
      </p>
    </div>
  );
}
