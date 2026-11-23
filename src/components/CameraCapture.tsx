import { useEffect, useRef, useState } from 'react';
import {
  applySettings,
  closeFocusSupported,
  listCameras,
  loadSettings,
  openCamera,
  readCaps,
  saveSettings,
  takeStill,
  type CameraCaps,
  type CameraDevice,
  type CameraSettings,
} from '../lib/camera';
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

const STILL_KEY = 'coin-scanner.full-res-still';
function loadStillPref(): boolean {
  try {
    return localStorage.getItem(STILL_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * One side of a coin: live camera preview with a circular guide and close-up
 * controls (lens, close focus, zoom, light), plus "Phone camera" (the phone's
 * own camera app, which has the maker's macro mode) and "Upload" fallbacks.
 */
export function CameraCapture({ title, hint, photo, onPhoto, onContinue, onBack, continueLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<CamState>('starting');
  const [camError, setCamError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<CameraSettings>(loadSettings);
  const [caps, setCaps] = useState<CameraCaps | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [fullRes, setFullRes] = useState(loadStillPref);
  const [resolution, setResolution] = useState('');
  const previewUrl = usePhotoUrl(photo?.image ?? null);

  // Start the live camera while no photo is taken for this side (restart when the lens changes).
  useEffect(() => {
    if (photo) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setCam('starting');
    setCaps(null);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam('unavailable');
        setCamError('Live camera is not available in this browser. Use “Phone camera” or “Upload”.');
        return;
      }
      try {
        stream = await openCamera(settings.deviceId);
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        const c = readCaps(track);
        setCaps(c);
        await applySettings(track, c, settings);
        setActiveDevice(track.getSettings().deviceId ?? null);
        const ts = track.getSettings();
        setResolution(ts.width && ts.height ? `${ts.width}×${ts.height}` : '');
        setDevices(await listCameras().catch(() => []));
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
      trackRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // Settings other than the lens are applied live below, without restarting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, settings.deviceId]);

  function update(patch: Partial<CameraSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    if (trackRef.current && caps && !('deviceId' in patch)) applySettings(trackRef.current, caps, next);
  }

  function nextLens() {
    if (devices.length < 2) return;
    const i = devices.findIndex((d) => d.deviceId === activeDevice);
    update({ deviceId: devices[(i + 1) % devices.length].deviceId });
  }

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

  async function capture() {
    const v = videoRef.current;
    const t = trackRef.current;
    if (!v) return;
    await run(async () => {
      if (fullRes && t) {
        const still = await takeStill(t);
        // Some phones reset focus/light after a still photo; put the settings back.
        if (caps) applySettings(t, caps, settings);
        if (still) return processFile(still, true);
      }
      return captureVideoFrame(v);
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) run(() => processFile(f));
  }

  const lensIndex = devices.findIndex((d) => d.deviceId === activeDevice);
  const canCloseFocus = !!caps && closeFocusSupported(caps);

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

      {!photo && cam === 'live' && caps && (
        <div className="cam-controls" data-testid="cam-controls">
          <div className="chips">
            {devices.length > 1 && (
              <button className="chip" onClick={nextLens} data-testid="lens-btn">
                🔄 Lens {lensIndex + 1}/{devices.length}
              </button>
            )}
            {canCloseFocus && (
              <button
                className={`chip ${settings.closeFocus ? 'on' : ''}`}
                aria-pressed={settings.closeFocus}
                onClick={() => update({ closeFocus: !settings.closeFocus })}
                data-testid="macro-btn"
              >
                🔬 Close focus {settings.closeFocus ? 'ON' : 'OFF'}
              </button>
            )}
            {caps.torch && (
              <button
                className={`chip ${settings.torch ? 'on' : ''}`}
                aria-pressed={settings.torch}
                onClick={() => update({ torch: !settings.torch })}
              >
                💡 Light {settings.torch ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
          {caps.zoom && (
            <label className="slider">
              <span>Zoom {(settings.zoom ?? caps.zoom.min).toFixed(1)}×</span>
              <input
                type="range"
                aria-label="Zoom"
                min={caps.zoom.min}
                max={caps.zoom.max}
                step={caps.zoom.step}
                value={settings.zoom ?? caps.zoom.min}
                onChange={(e) => update({ zoom: Number(e.target.value) })}
              />
            </label>
          )}
          {canCloseFocus && settings.closeFocus && caps.focusDistance && (
            <label className="slider">
              <span>Focus (left = closest)</span>
              <input
                type="range"
                aria-label="Focus distance"
                min={caps.focusDistance.min}
                max={caps.focusDistance.max}
                step={caps.focusDistance.step}
                value={settings.focusDistance ?? caps.focusDistance.min}
                onChange={(e) => update({ focusDistance: Number(e.target.value) })}
              />
            </label>
          )}
          {!canCloseFocus && (
            <p className="hint">
              {devices.length > 1
                ? 'This lens doesn’t allow focus control from the app. Try another lens, or use “Phone camera” for your phone’s macro mode.'
                : 'Your phone doesn’t allow focus control from the app. For very close shots use “Phone camera” (your phone’s macro mode), or zoom in and hold the phone further back.'}
            </p>
          )}
        </div>
      )}

      <p className="hint">{photo ? 'Check the date and mint mark are sharp. Retake if blurry.' : hint}</p>
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
            <button className="btn primary big" disabled={cam !== 'live' || busy} onClick={capture}>
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

      {!photo && cam === 'live' && caps && (
        <details className="cam-info">
          <summary>Camera info</summary>
          <label className="check">
            <input
              type="checkbox"
              checked={fullRes}
              onChange={(e) => {
                setFullRes(e.target.checked);
                try {
                  localStorage.setItem(STILL_KEY, String(e.target.checked));
                } catch {
                  /* ignore */
                }
              }}
            />
            Full-resolution photo (turn off if photos don’t match the preview)
          </label>
          <ul className="small muted" data-testid="cam-info">
            <li>Lens: {devices[lensIndex]?.label ?? 'default'} ({devices.length} back camera{devices.length === 1 ? '' : 's'} found)</li>
            <li>Preview: {resolution || 'unknown'}</li>
            <li>Zoom: {caps.zoom ? `${caps.zoom.min}–${caps.zoom.max}×` : 'not available'}</li>
            <li>
              Focus control: {caps.focusDistance ? `yes (${caps.focusDistance.min}–${caps.focusDistance.max})` : 'no'}; modes:{' '}
              {caps.focusModes.join(', ') || 'none reported'}
            </li>
            <li>Light: {caps.torch ? 'yes' : 'no'}</li>
            <li>Full-resolution capture: {'ImageCapture' in globalThis ? 'supported' : 'not supported'}</li>
          </ul>
        </details>
      )}
    </div>
  );
}
