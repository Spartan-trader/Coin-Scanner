import { useEffect, useState } from 'react';
import { ItemForm } from '../components/ItemForm';
import { useStoredPhoto } from '../components/usePhotoUrl';
import { deleteItem, getItem, updateItem } from '../db/db';
import { itemTitle, type CollectionItem } from '../db/types';
import { formatRange } from '../lib/stats';

interface Props {
  id: string;
  onClose: () => void;
}

export function ItemDetail({ id, onClose }: Props) {
  const [item, setItem] = useState<CollectionItem | null | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const front = useStoredPhoto(item?.frontPhotoId ?? null, 'image');
  const back = useStoredPhoto(item?.backPhotoId ?? null, 'image');

  useEffect(() => {
    getItem(id).then((i) => setItem(i ?? null));
  }, [id]);

  if (item === undefined) return <div className="screen"><p className="center muted">Loading…</p></div>;
  if (item === null)
    return (
      <div className="screen">
        <p className="center">This coin no longer exists.</p>
        <button className="btn secondary" onClick={onClose}>Back to collection</button>
      </div>
    );

  async function save() {
    if (!item) return;
    const saved = await updateItem(item);
    setItem(saved);
    setDirty(false);
    setMsg('Saved');
    setTimeout(() => setMsg(''), 2000);
  }

  async function remove() {
    if (!item) return;
    if (!confirm(`Delete ${itemTitle(item)} and its photos? This cannot be undone.`)) return;
    await deleteItem(item.id);
    onClose();
  }

  return (
    <div className="screen detail">
      <header className="bar">
        <button
          className="link"
          onClick={() => {
            if (!dirty || confirm('Discard unsaved changes?')) onClose();
          }}
        >
          ‹ Collection
        </button>
        <h1>Coin details</h1>
        <span />
      </header>
      <div className="pair large">
        {front ? <img src={front} alt="Front" /> : <span className="empty">No front photo</span>}
        {back ? <img src={back} alt="Back" /> : <span className="empty">No back photo</span>}
      </div>
      <h2 className="center">{itemTitle(item)}</h2>
      <p className="center">{formatRange(item)}</p>
      <p className="muted small center">
        Scanned {new Date(item.createdAt).toLocaleString()} · ID {item.id.slice(0, 8)}
      </p>
      <ItemForm
        key={item.id}
        item={item}
        onChange={(i) => {
          setItem(i);
          setDirty(true);
        }}
      />
      <div className="actions sticky">
        <button className="btn primary big" disabled={!dirty} onClick={save}>
          {msg || (dirty ? 'Save changes' : 'No changes')}
        </button>
        <button className="btn danger" onClick={remove}>
          Delete coin
        </button>
      </div>
    </div>
  );
}
