// Tiny IndexedDB layer. One record holds the entire state object — the
// prototype has a single local profile, and the whole point is that nothing
// leaves the device.

const DB_NAME = 'stretch-proto';
const STORE = 'kv';

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export async function loadState() {
  try {
    const s = await tx('readonly', (st) => st.get('state'));
    return s || null;
  } catch { return null; }
}

export async function saveState(state) {
  await tx('readwrite', (st) => st.put(state, 'state'));
}

export async function clearAll() {
  await tx('readwrite', (st) => st.clear());
}
