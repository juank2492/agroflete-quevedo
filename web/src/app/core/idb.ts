/** Almacén IndexedDB para la cola offline, con fallback en memoria. */
const DB = 'agroflete';
const VERSION = 1;

function abrir(store: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function conStore<T>(
  store: string,
  modo: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await abrir(store);
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const idb = {
  async todos<T>(store: string): Promise<T[]> {
    try {
      return (await conStore<T[]>(store, 'readonly', (s) => s.getAll())) ?? [];
    } catch {
      return [];
    }
  },
  async guardar<T extends { id: string }>(store: string, valor: T): Promise<void> {
    try {
      await conStore(store, 'readwrite', (s) => s.put(valor));
    } catch {
      /* La cola sigue funcionando solo en memoria. */
    }
  },
  async quitar(store: string, id: string): Promise<void> {
    try {
      await conStore(store, 'readwrite', (s) => s.delete(id));
    } catch {
    }
  },
};
