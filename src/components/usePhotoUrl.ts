import { useEffect, useState } from 'react';
import { getPhoto } from '../db/db';

/** Turn a Blob into a temporary URL for <img>, and clean it up afterwards. */
export function usePhotoUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Load a stored photo (full image or thumbnail) by id. */
export function useStoredPhoto(photoId: string | null, kind: 'image' | 'thumb'): string | null {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let alive = true;
    if (!photoId) {
      setBlob(null);
      return;
    }
    getPhoto(photoId).then((p) => alive && setBlob(p ? p[kind] : null));
    return () => {
      alive = false;
    };
  }, [photoId, kind]);
  return usePhotoUrl(blob);
}
