/* OpeningOS — IndexedDB persistence mirror
 * The app keeps a small synchronous localStorage cache for instant startup, but
 * every durable product object is mirrored into IndexedDB with schema versioning.
 * This gives users quota headroom, restores after localStorage eviction, and is
 * the stepping stone to server sync.
 */
(function (global) {
  'use strict';

  const DB_NAME = 'openingos-product-db';
  const DB_VERSION = 3;
  const STORE_STATE = 'profile_states';
  const STORE_AUDIT = 'audit_events';
  let dbPromise = null;

  function open() {
    if (!('indexedDB' in global)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORE_AUDIT)) {
          const audit = db.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
          audit.createIndex('profileId', 'profileId', { unique: false });
          audit.createIndex('at', 'at', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
    return dbPromise;
  }

  function tx(store, mode) {
    return open().then(db => {
      if (!db) return null;
      return db.transaction(store, mode).objectStore(store);
    });
  }

  async function getState(key) {
    const store = await tx(STORE_STATE, 'readonly');
    if (!store) return null;
    return new Promise(resolve => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  }

  async function putState(key, value) {
    const store = await tx(STORE_STATE, 'readwrite');
    if (!store) return false;
    return new Promise(resolve => {
      const req = store.put({ key, value, updatedAt: Date.now(), schema: 'openingos-state-v4' });
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  async function deleteState(key) {
    const store = await tx(STORE_STATE, 'readwrite');
    if (!store) return false;
    return new Promise(resolve => {
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  async function appendAudit(event) {
    const store = await tx(STORE_AUDIT, 'readwrite');
    if (!store) return false;
    const ev = Object.assign({ id: 'aud_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8), at: Date.now() }, event || {});
    return new Promise(resolve => {
      const req = store.put(ev);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  async function listAudit(profileId, limit) {
    const store = await tx(STORE_AUDIT, 'readonly');
    if (!store) return [];
    return new Promise(resolve => {
      const out = [];
      const req = store.index('at').openCursor(null, 'prev');
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || out.length >= (limit || 100)) return resolve(out);
        const val = cursor.value;
        if (!profileId || val.profileId === profileId) out.push(val);
        cursor.continue();
      };
      req.onerror = () => resolve(out);
    });
  }

  function estimateStorage() {
    if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
    return Promise.resolve({ usage: 0, quota: 0 });
  }

  global.OOSStore = { open, getState, putState, deleteState, appendAudit, listAudit, estimateStorage, name: DB_NAME, version: DB_VERSION };
})(window);
