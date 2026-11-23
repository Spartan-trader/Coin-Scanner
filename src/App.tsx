import { useEffect, useState } from 'react';
import { requestPersistentStorage } from './db/db';
import { BackupScreen } from './screens/BackupScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { ItemDetail } from './screens/ItemDetail';
import { ScanFlow } from './screens/ScanFlow';

type Tab = 'scan' | 'collection' | 'backup';

export default function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [openId, setOpenId] = useState<string | null>(null);
  const [collectionKey, setCollectionKey] = useState(0);

  useEffect(() => {
    // Ask the browser not to evict our data under storage pressure.
    requestPersistentStorage();
  }, []);

  const go = (t: Tab) => {
    setOpenId(null);
    setTab(t);
    if (t === 'collection') setCollectionKey((k) => k + 1);
  };

  return (
    <div className="app">
      <main>
        {openId ? (
          <ItemDetail
            id={openId}
            onClose={() => {
              setOpenId(null);
              setCollectionKey((k) => k + 1);
            }}
          />
        ) : tab === 'scan' ? (
          <ScanFlow onViewCollection={() => go('collection')} />
        ) : tab === 'collection' ? (
          <CollectionScreen key={collectionKey} onOpen={setOpenId} />
        ) : (
          <BackupScreen />
        )}
      </main>
      <nav className="tabs">
        <button className={tab === 'scan' && !openId ? 'active' : ''} onClick={() => go('scan')}>
          <span aria-hidden>📷</span> Scan
        </button>
        <button className={tab === 'collection' || openId ? 'active' : ''} onClick={() => go('collection')}>
          <span aria-hidden>🪙</span> Collection
        </button>
        <button className={tab === 'backup' && !openId ? 'active' : ''} onClick={() => go('backup')}>
          <span aria-hidden>💾</span> Backup
        </button>
      </nav>
    </div>
  );
}
