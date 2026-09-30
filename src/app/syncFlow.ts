import { deriveId, deriveKey, open, seal, SyncClient, SyncConflict, type Remote } from '../lib/sync';
import { store, type AppData } from '../lib/store';

/** Stored per device in IndexedDB. The CryptoKey is non-extractable. */
export interface SyncMeta {
  id: string;
  key: CryptoKey;
  version: number;
  syncedAt: number;
  /** data.updatedAt at the last successful sync. */
  dataAt: number;
}

export const SYNC_URL: string = (import.meta.env.VITE_SYNC_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const client = () => new SyncClient(SYNC_URL);

export async function loadMeta(): Promise<SyncMeta | null> {
  return (await store.kv()?.get<SyncMeta>('sync')) ?? null;
}

async function saveMeta(m: SyncMeta | null) {
  const kv = store.kv();
  if (!kv) return;
  if (m) await kv.set('sync', m);
  else await kv.del('sync');
}

export async function link(phrase: string): Promise<{ meta: SyncMeta; remote: Remote | null }> {
  const [id, key] = await Promise.all([deriveId(phrase), deriveKey(phrase)]);
  const remote = await client().get(id);
  const meta: SyncMeta = { id, key, version: 0, syncedAt: 0, dataAt: 0 };
  return { meta, remote };
}

export type SyncOutcome = { kind: 'pushed' | 'pulled' | 'up-to-date'; meta: SyncMeta } | { kind: 'conflict'; meta: SyncMeta; remote: Remote };

async function push(meta: SyncMeta, baseVersion: number): Promise<SyncMeta> {
  const data = store.get().data;
  const version = await client().put(meta.id, baseVersion, await seal(meta.key, data));
  const next = { ...meta, version, syncedAt: Date.now(), dataAt: data.updatedAt };
  await saveMeta(next);
  return next;
}

async function pull(meta: SyncMeta, remote: Remote): Promise<SyncMeta> {
  const data = await open<AppData>(meta.key, remote.data);
  if (data?.v !== 1) throw new Error('The synced copy is in a format this version does not understand.');
  store.replaceData(data);
  const next = { ...meta, version: remote.version, syncedAt: Date.now(), dataAt: data.updatedAt };
  await saveMeta(next);
  return next;
}

export async function syncNow(meta: SyncMeta): Promise<SyncOutcome> {
  const remote = await client().get(meta.id);
  const localChanged = store.get().data.updatedAt > meta.dataAt;
  try {
    if (!remote) return { kind: 'pushed', meta: await push(meta, 0) };
    if (remote.version === meta.version) {
      return localChanged ? { kind: 'pushed', meta: await push(meta, meta.version) } : { kind: 'up-to-date', meta };
    }
    if (!localChanged) return { kind: 'pulled', meta: await pull(meta, remote) };
    return { kind: 'conflict', meta, remote };
  } catch (e) {
    if (e instanceof SyncConflict) {
      const fresh = await client().get(meta.id);
      if (fresh) return { kind: 'conflict', meta, remote: fresh };
    }
    throw e;
  }
}

export const resolve = {
  keepThisDevice: (meta: SyncMeta, remote: Remote) => push(meta, remote.version),
  useOtherDevice: (meta: SyncMeta, remote: Remote) => pull(meta, remote),
};

export async function unlink(deleteRemote: boolean, meta: SyncMeta) {
  if (deleteRemote) await client().remove(meta.id);
  await saveMeta(null);
}

export { saveMeta };
