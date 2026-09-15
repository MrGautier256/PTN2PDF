// Persistance de session 100 % locale via IndexedDB.
// Rien ne quitte la machine : les octets des fichiers et l'agencement des pages
// sont stockés dans la base du navigateur (ou du dossier de données Electron).

const DB_NAME = 'ptn2pdf';
const DB_VERSION = 1;
const STORE = 'session';
const KEY = 'current';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/**
 * Sauvegarde la session.
 * @param {{sources: Array, pages: Array, filename: string}} session
 */
export async function saveSession(session) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...session, savedAt: Date.now() }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
    });
    return true;
  } catch (err) {
    console.warn('Sauvegarde de session impossible :', err);
    return false;
  }
}

export async function loadSession() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Lecture de session impossible :', err);
    return null;
  }
}

export async function clearSession() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (err) {
    console.warn('Effacement de session impossible :', err);
    return false;
  }
}
