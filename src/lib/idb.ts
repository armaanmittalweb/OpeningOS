/**
 * A tiny promise wrapper over one IndexedDB object store used as a key/value
 * store. Falls back to memory when IndexedDB is unavailable (some private
 * windows), so the app still runs, it just forgets on reload.
 */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  readonly persistent: boolean;
}

const STORE = 'kv';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function openKV(name = 'openingos'): Promise<KV> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    const db = await req(open);
    const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
    return {
      persistent: true,
      get: <T,>(key: string) => req(tx('readonly').get(key)) as Promise<T | undefined>,
      set: async (key, value) => void (await req(tx('readwrite').put(value, key))),
      del: async (key) => void (await req(tx('readwrite').delete(key))),
    };
  } catch {
    const mem = new Map<string, unknown>();
    return {
      persistent: false,
      get: async <T,>(key: string) => mem.get(key) as T | undefined,
      set: async (key, value) => void mem.set(key, structuredClone(value)),
      del: async (key) => void mem.delete(key),
    };
  }
}
