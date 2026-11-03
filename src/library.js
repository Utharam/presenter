const DB_NAME = 'html-presenter';
const DB_VERSION = 1;
const STORE = 'decks';

const memory = new Map();
let memoryMode = typeof indexedDB === 'undefined';
let dbPromise = null;

function openDb() {
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  dbPromise.catch(() => {});
  return dbPromise;
}

function enterFallback() {
  memoryMode = true;
  dbPromise = null;
}

async function db() {
  if (memoryMode) return null;
  try {
    return await openDb();
  } catch {
    enterFallback();
    return null;
  }
}

function withStore(handle, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = handle.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? new Error('transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

export async function listDecks() {
  const handle = await db();
  if (!handle) return [...memory.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  const list = await withStore(handle, 'readonly', (store) => store.getAll());
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDeck(id) {
  const handle = await db();
  if (!handle) {
    const found = memory.get(id);
    return found ? { ...found } : undefined;
  }
  const found = await withStore(handle, 'readonly', (store) => store.get(id));
  return found === undefined ? undefined : found;
}

export async function putDeck(deck) {
  const handle = await db();
  if (!handle) {
    memory.set(deck.id, { ...deck });
    return;
  }
  await withStore(handle, 'readwrite', (store) => store.put(deck));
}

export async function deleteDeck(id) {
  const handle = await db();
  if (!handle) {
    memory.delete(id);
    return;
  }
  await withStore(handle, 'readwrite', (store) => store.delete(id));
}

export async function exportDecks() {
  const decks = await listDecks();
  return JSON.stringify({
    app: 'html-presenter',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks,
  });
}

function validEntry(e) {
  return (
    e &&
    typeof e === 'object' &&
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.title === 'string' &&
    typeof e.html === 'string' &&
    typeof e.createdAt === 'number' &&
    typeof e.updatedAt === 'number'
  );
}

export async function importDecks(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return { imported: 0, skipped: 0 };
  }
  if (!data || data.version !== 1 || !Array.isArray(data.decks)) {
    return { imported: 0, skipped: 0 };
  }
  const existing = new Set((await listDecks()).map((d) => d.id));
  let imported = 0;
  let skipped = 0;
  for (const e of data.decks) {
    if (!validEntry(e) || existing.has(e.id)) {
      skipped++;
      continue;
    }
    existing.add(e.id);
    await putDeck({ id: e.id, title: e.title, html: e.html, createdAt: e.createdAt, updatedAt: e.updatedAt });
    imported++;
  }
  return { imported, skipped };
}

export function isPersistent() {
  return !memoryMode;
}
