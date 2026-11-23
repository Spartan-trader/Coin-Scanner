/** Image helpers: shrink photos so a large collection still fits on the phone. */

export const FULL_MAX = 1600; // px on the longest side - enough to read dates
export const THUMB_MAX = 320;
const JPEG_QUALITY = 0.85;

export interface ProcessedPhoto {
  image: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

type Source = CanvasImageSource & { width: number; height: number };

function canvasToBlob(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  );
}

function draw(src: Source, sx: number, sy: number, sw: number, sh: number, max: number) {
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  return canvas;
}

async function fromSource(src: Source, crop?: { x: number; y: number; w: number; h: number }) {
  const c = crop ?? { x: 0, y: 0, w: src.width, h: src.height };
  const full = draw(src, c.x, c.y, c.w, c.h, FULL_MAX);
  const thumb = draw(full, 0, 0, full.width, full.height, THUMB_MAX);
  return {
    image: await canvasToBlob(full),
    thumb: await canvasToBlob(thumb, 0.8),
    width: full.width,
    height: full.height,
  };
}

function centreSquare(w: number, h: number) {
  const side = Math.min(w, h);
  return { x: (w - side) / 2, y: (h - side) / 2, w: side, h: side };
}

/**
 * Process a photo chosen from the gallery or taken by the phone's camera app.
 * `squareCrop` keeps only the centred square (where the circular guide is).
 */
export async function processFile(file: Blob, squareCrop = false): Promise<ProcessedPhoto> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await fromSource(bmp, squareCrop ? centreSquare(bmp.width, bmp.height) : undefined);
  } finally {
    bmp.close();
  }
}

/**
 * Grab a frame from the live camera preview, cropped to the centred square
 * that the circular guide sits in.
 */
export async function captureVideoFrame(video: HTMLVideoElement): Promise<ProcessedPhoto> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('Camera is not ready yet');
  // HTMLVideoElement.width is the layout width, so copy the frame to a canvas first.
  const frame = document.createElement('canvas');
  frame.width = vw;
  frame.height = vh;
  frame.getContext('2d')!.drawImage(video, 0, 0, vw, vh);
  return fromSource(frame, centreSquare(vw, vh));
}
