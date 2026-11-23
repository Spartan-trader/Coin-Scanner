import { useEffect, useRef, useState } from 'react';
import { captureVideoFrame, processFile, type ProcessedPhoto } from '../lib/image';
import { usePhotoUrl } from './usePhotoUrl';

interface Props {
  title: string;
  hint: string;
  photo: ProcessedPhoto | null;
  onPhoto: (p: ProcessedPhoto | null) => void;
  onContinue: () => void;
  onBack?: () => void;
  continueLabel?: string;
}

type CamState = 'starting' | 'live' | 'unavailable';

/**
 * One side of a coin: live camera preview with a circular guide, plus
 * "Phone camera" (native camera app - best focus) and "Upload" fallbacks.
 */
export function CameraCapture({ title, hint, photo, onPhoto, onContinue, onBack, continueLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<CamState>('starting');
  const [camError, setCamError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previewUrl = usePhotoUrl(photo?.image ?? null);

  // Start the live camera only while no photo is taken for this side.
  useEffect(() => {
    if (photo) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setCam('starting');
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam('unavailable');
        setCamError('Live camera is not available in this browser. Use “Phone camera” or “Upload”.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setCam('live');
      } catch (e) {
        setCam('unavailable');
        const name = (e as DOMException)?.name;
        setCamError(
          name === 'NotAllowedError'
            ? 'Camera permission was refused. Allow camera access in your browser settings, or use “Phone camera” / “Upload”.'
            : 'Could not start the live camera. Use “Phone camera” or “Upload”.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [photo]);

  async function run(fn: () => Promise<ProcessedPhoto>) {
    setBusy(true);
    setError('');
    try {
      onPhoto(await fn());
    } catch (e) {
      setError((e as Error).message || 'Could not read that photo.');
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) run(() => processFile(f));
  }

  return (
    <div className="screen capture">
      <header className="bar">
        {onBack ? (
          <button className="link" onClick={onBack}>
            ‹ Back
          </button>
        ) : (
          <span />
        )}
        <h1>{title}</h1>
        <span />
      </header>

      <div className="viewfinder">
        {photo && previewUrl ? (
          <img src={previewUrl} alt={`${title} preview`} data-testid="captured-preview" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay data-testid="live-video" />
            {cam !== 'live' && <div className="vf-message">{cam === 'starting' ? 'Starting camera…' : camError}</div>}
          </>
        )}
        <div className="guide" aria-hidden />
      </div>
      <p className="hint">{photo ? 'Check the photo is sharp. Retake if the date is blurry.' : hint}</p>
      {error && <p className="error">{error}</p>}

      <input ref={nativeRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onFile} data-testid="upload-input" />

      <div className="actions">
        {photo ? (
          <>
            <button className="btn secondary" onClick={() => onPhoto(null)}>
              Retake
            </button>
            <button className="btn primary big" onClick={onContinue}>
              {continueLabel ?? 'Continue'}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn primary big"
              disabled={cam !== 'live' || busy}
              onClick={() => videoRef.current && run(() => captureVideoFrame(videoRef.current!))}
            >
              {busy ? 'Processing…' : 'Take Photo'}
            </button>
            <div className="row">
              <button className="btn secondary" disabled={busy} onClick={() => nativeRef.current?.click()}>
                Phone camera
              </button>
              <button className="btn secondary" disabled={busy} onClick={() => uploadRef.current?.click()}>
                Upload Photo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
