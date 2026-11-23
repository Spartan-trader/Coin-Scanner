import { useRef, useState } from 'react';
import { CameraCapture } from '../components/CameraCapture';
import { ItemForm } from '../components/ItemForm';
import { usePhotoUrl } from '../components/usePhotoUrl';
import { saveItemWithPhotos, type NewPhoto } from '../db/db';
import { newItem, type CollectionItem } from '../db/types';
import type { ProcessedPhoto } from '../lib/image';
import { newId } from '../lib/util';

type Step = 'front' | 'back' | 'details';

interface Props {
  onViewCollection: () => void;
}

function freshDraft(prev?: CollectionItem): CollectionItem {
  const d = newItem(newId());
  // Only carry over where the coins are being stored - never the identification.
  if (prev) d.storageLocation = prev.storageLocation;
  return d;
}

export function ScanFlow({ onViewCollection }: Props) {
  const [step, setStep] = useState<Step>('front');
  const [draft, setDraft] = useState<CollectionItem>(() => freshDraft());
  const [front, setFront] = useState<ProcessedPhoto | null>(null);
  const [back, setBack] = useState<ProcessedPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [toast, setToast] = useState('');
  const savingRef = useRef(false);

  async function save(then: 'next' | 'collection') {
    if (savingRef.current) return; // ignore double taps
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const photos: NewPhoto[] = [];
      if (front) photos.push({ side: 'front', ...front });
      if (back) photos.push({ side: 'back', ...back });
      const saved = await saveItemWithPhotos(draft, photos);
      setSessionCount((n) => n + 1);
      setDraft(freshDraft(saved));
      setFront(null);
      setBack(null);
      setStep('front');
      if (then === 'collection') onViewCollection();
      else {
        setToast(`Saved coin #${sessionCount + 1}. Ready for the next one.`);
        setTimeout(() => setToast(''), 2500);
      }
    } catch (e) {
      setError(`Could not save: ${(e as Error).message}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (step === 'front')
    return (
      <>
        {toast && <div className="toast" role="status">{toast}</div>}
        <CameraCapture
          title="Front (heads)"
          hint="Fill the circle with the coin. Avoid glare; light from the side shows the date best."
          photo={front}
          onPhoto={setFront}
          onContinue={() => setStep(back ? 'details' : 'back')}
        />
        {sessionCount > 0 && <p className="session-count">{sessionCount} saved this session</p>}
      </>
    );

  if (step === 'back')
    return (
      <>
        <CameraCapture
          title="Back (tails)"
          hint="Turn the same coin over and photograph the back."
          photo={back}
          onPhoto={setBack}
          onBack={() => setStep('front')}
          onContinue={() => setStep('details')}
        />
        {!back && (
          <p className="center">
            <button className="link" onClick={() => setStep('details')}>
              Skip back photo
            </button>
          </p>
        )}
      </>
    );

  return (
    <div className="screen details">
      <header className="bar">
        <button className="link" onClick={() => setStep('back')}>
          ‹ Back
        </button>
        <h1>Identify coin</h1>
        <span />
      </header>
      <div className="pair">
        <PhotoSlot label="Front" photo={front} onRetake={() => setStep('front')} />
        <PhotoSlot label="Back" photo={back} onRetake={() => setStep('back')} />
      </div>
      <p className="muted small center">
        Automatic identification arrives in Phase 2. For now, fill in what you can see — leave the rest blank.
      </p>
      <ItemForm key={draft.id} item={draft} onChange={setDraft} />
      {error && <p className="error">{error}</p>}
      <div className="actions sticky">
        <button className="btn primary big" disabled={saving} onClick={() => save('next')}>
          {saving ? 'Saving…' : 'Save & Next Coin'}
        </button>
        <div className="row">
          <button className="btn secondary" disabled={saving} onClick={() => save('collection')}>
            Save & View Collection
          </button>
          <button
            className="btn secondary"
            disabled={saving}
            onClick={() => {
              setFront(null);
              setBack(null);
              setStep('front');
            }}
          >
            Retake Photos
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoSlot({ label, photo, onRetake }: { label: string; photo: ProcessedPhoto | null; onRetake: () => void }) {
  const url = usePhotoUrl(photo?.thumb ?? null);
  return (
    <button className="slot" onClick={onRetake} aria-label={`Retake ${label.toLowerCase()} photo`}>
      {url ? <img src={url} alt={`${label} photo`} /> : <span className="empty">No photo</span>}
      <span className="slot-label">{label} · retake</span>
    </button>
  );
}
