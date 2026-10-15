// Stores the uploaded video in the browser (IndexedDB) so a saved session can
// play it back and jump to the coach's timestamps. Nothing leaves the device.

const DB = "strokesense";
const STORE = "videos";
export const MAX_LOCAL_VIDEO = 400 * 1024 * 1024;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexeddb"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putVideo(id: string, file: Blob): Promise<boolean> {
  try {
    if (file.size > MAX_LOCAL_VIDEO) return false;
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function getVideo(id: string): Promise<Blob | null> {
  try {
    const db = await open();
    return await new Promise<Blob | null>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteVideo(id: string) {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
  } catch {}
}
