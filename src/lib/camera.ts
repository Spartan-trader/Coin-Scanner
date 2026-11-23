/**
 * Camera helpers for close-up ("macro") coin photos.
 *
 * Browsers can't switch on a phone maker's "macro mode" directly. What they can
 * do (when the phone allows it) is:
 *   - choose a specific back lens (macro mode on many phones uses the ultra-wide lens)
 *   - set the focus distance to the closest possible
 *   - zoom, so the phone can be held further back where it can still focus
 *   - turn on the flashlight
 * Anything the phone does not support is simply not offered.
 */

export interface RangeCap {
  min: number;
  max: number;
  step: number;
}

export interface CameraCaps {
  zoom: RangeCap | null;
  focusDistance: RangeCap | null;
  focusModes: string[];
  torch: boolean;
}

export interface CameraSettings {
  deviceId: string | null;
  zoom: number | null;
  closeFocus: boolean;
  focusDistance: number | null;
  torch: boolean;
}

export const DEFAULT_SETTINGS: CameraSettings = {
  deviceId: null,
  zoom: null,
  closeFocus: false,
  focusDistance: null,
  torch: false,
};

const KEY = 'coin-scanner.camera-settings';

export function loadSettings(): CameraSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: CameraSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

// Fields Chrome on Android supports but TypeScript's DOM types don't list.
type ExtCaps = MediaTrackCapabilities & {
  zoom?: { min: number; max: number; step?: number };
  focusDistance?: { min: number; max: number; step?: number };
  focusMode?: string[];
  torch?: boolean;
};

function range(r?: { min: number; max: number; step?: number }): RangeCap | null {
  if (!r || typeof r.min !== 'number' || typeof r.max !== 'number' || r.max <= r.min) return null;
  return { min: r.min, max: r.max, step: r.step && r.step > 0 ? r.step : (r.max - r.min) / 100 };
}

export function readCaps(track: MediaStreamTrack): CameraCaps {
  const c = (track.getCapabilities?.() ?? {}) as ExtCaps;
  return {
    zoom: range(c.zoom),
    focusDistance: range(c.focusDistance),
    focusModes: Array.isArray(c.focusMode) ? c.focusMode : [],
    torch: c.torch === true,
  };
}

export function closeFocusSupported(caps: CameraCaps): boolean {
  return !!caps.focusDistance && caps.focusModes.includes('manual');
}

/** Build the constraint object for the given settings, limited to what the camera supports. */
export function buildAdvanced(caps: CameraCaps, s: CameraSettings): Record<string, unknown> {
  const adv: Record<string, unknown> = {};
  if (caps.zoom && s.zoom !== null) adv.zoom = clamp(s.zoom, caps.zoom);
  if (closeFocusSupported(caps) && s.closeFocus) {
    adv.focusMode = 'manual';
    adv.focusDistance = clamp(s.focusDistance ?? caps.focusDistance!.min, caps.focusDistance!);
  } else if (caps.focusModes.includes('continuous')) {
    adv.focusMode = 'continuous';
  }
  if (caps.torch) adv.torch = s.torch;
  return adv;
}

export async function applySettings(track: MediaStreamTrack, caps: CameraCaps, s: CameraSettings) {
  const adv = buildAdvanced(caps, s);
  if (Object.keys(adv).length === 0) return;
  try {
    await track.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] });
  } catch {
    // Some phones reject combinations; try each setting on its own.
    for (const [k, v] of Object.entries(adv)) {
      try {
        await track.applyConstraints({ advanced: [{ [k]: v } as MediaTrackConstraintSet] });
      } catch {
        /* unsupported on this phone */
      }
    }
  }
}

function clamp(v: number, r: RangeCap) {
  return Math.min(r.max, Math.max(r.min, v));
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

/** Back-facing cameras (labels are only available after permission is granted). */
export async function listCameras(): Promise<CameraDevice[]> {
  const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const back = all.filter((d) => !/front|user|facetime/i.test(d.label));
  const list = back.length ? back : all;
  return list.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export async function openCamera(deviceId: string | null): Promise<MediaStream> {
  const size = { width: { ideal: 3840 }, height: { ideal: 2160 } };
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, ...size }, audio: false });
    } catch {
      /* lens no longer available - fall back to default back camera */
    }
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, ...size }, audio: false });
}

/**
 * Take a full-resolution still photo when the browser supports it (sharper than a
 * video frame). Returns null if unsupported, so the caller can fall back.
 */
export async function takeStill(track: MediaStreamTrack): Promise<Blob | null> {
  const IC = (globalThis as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } })
    .ImageCapture;
  if (!IC) return null;
  try {
    return await new IC(track).takePhoto();
  } catch {
    return null;
  }
}
