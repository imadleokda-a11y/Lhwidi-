export interface VideoAdMeta {
  exists: boolean;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  updatedAtMs?: number;
  url?: string;
}

const DB_NAME = 'fahem_video_ad_db_v1';
const STORE_NAME = 'video_ads';
const RECORD_KEY = 'current_ad';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveLocalVideoAd(
  blob: Blob,
  meta: { fileName: string; mimeType: string; updatedAtMs: number }
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(
        {
          blob,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
          sizeBytes: blob.size,
          updatedAtMs: meta.updatedAtMs,
        },
        RECORD_KEY
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadLocalVideoAd(): Promise<{
  blobUrl: string;
  meta: VideoAdMeta;
} | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => {
        const rec = req.result as
          | {
              blob?: Blob;
              fileName?: string;
              mimeType?: string;
              sizeBytes?: number;
              updatedAtMs?: number;
            }
          | undefined;
        if (!rec || !(rec.blob instanceof Blob) || rec.blob.size === 0) {
          resolve(null);
          return;
        }
        const blobUrl = URL.createObjectURL(rec.blob);
        resolve({
          blobUrl,
          meta: {
            exists: true,
            fileName: rec.fileName || 'video-ad.mp4',
            mimeType: rec.mimeType || rec.blob.type || 'video/mp4',
            sizeBytes: rec.sizeBytes || rec.blob.size,
            updatedAtMs: rec.updatedAtMs || Date.now(),
            url: blobUrl,
          },
        });
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearLocalVideoAd(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function fetchVideoAdMeta(): Promise<VideoAdMeta> {
  try {
    const res = await fetch('/api/video-ad/meta', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as VideoAdMeta;
      if (data && data.exists && data.url) {
        return data;
      }
    }
  } catch {
    // ignore offline/network error and fall back to local cache
  }
  return { exists: false };
}
