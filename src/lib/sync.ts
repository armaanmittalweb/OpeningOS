/**
 * Account-free sync. A six-word phrase (BIP-39 English list, 2048 words, so
 * 66 bits) is generated with WebCrypto. From it we derive:
 *   - an id: SHA-256 of a domain-separated string. The server only sees this.
 *   - an AES-GCM key (PBKDF2). The snapshot is encrypted before it leaves the
 *     device, so the server stores an opaque blob.
 * The phrase is never stored anywhere; the device keeps the id and a
 * non-extractable CryptoKey in IndexedDB.
 */
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const WORDS = 6;

export function generatePhrase(rand: (a: Uint16Array<ArrayBuffer>) => Uint16Array<ArrayBuffer> = (a) => crypto.getRandomValues(a)): string {
  // 2048 divides 65536, so masking 11 bits is unbiased.
  return Array.from(rand(new Uint16Array(WORDS)), (n) => wordlist[n & 2047]).join(' ');
}

export function normalizePhrase(input: string): string {
  return input.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).join(' ');
}

export function validatePhrase(input: string): { ok: true; phrase: string } | { ok: false; error: string } {
  const phrase = normalizePhrase(input);
  const words = phrase ? phrase.split(' ') : [];
  if (words.length !== WORDS) return { ok: false, error: `A sync phrase has ${WORDS} words; this has ${words.length}.` };
  const unknown = words.filter((w) => !wordlist.includes(w));
  if (unknown.length) return { ok: false, error: `Not in the word list: ${unknown.join(', ')}.` };
  return { ok: true, phrase };
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveId(phrase: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(`openingos/sync/id/v1:${normalizePhrase(phrase)}`)));
}

export async function deriveKey(phrase: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizePhrase(phrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('openingos/sync/key/v1'), iterations: 200_000 },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface Envelope {
  v: 1;
  iv: string;
  ct: string;
}

const b64 = (u: Uint8Array) => btoa(Array.from(u, (c) => String.fromCharCode(c)).join(''));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function seal(key: CryptoKey, value: unknown): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export async function open<T>(key: CryptoKey, env: Envelope): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export class SyncConflict extends Error {
  constructor(readonly remoteVersion: number) {
    super('Another device has synced since this one last did.');
  }
}

export interface Remote {
  version: number;
  data: Envelope;
  updatedAt: string;
}

export class SyncClient {
  constructor(private readonly base: string, private readonly f: typeof fetch = (...a) => fetch(...a)) {}

  async get(id: string): Promise<Remote | null> {
    const res = await this.f(`${this.base}/sync/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await errorText(res));
    return (await res.json()) as Remote;
  }

  /** Write with optimistic concurrency. `version` is what we last saw (0 = create). */
  async put(id: string, version: number, data: Envelope): Promise<number> {
    const res = await this.f(`${this.base}/sync/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': `"${version}"` },
      body: JSON.stringify({ data }),
    });
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as { version?: number };
      throw new SyncConflict(body.version ?? -1);
    }
    if (!res.ok) throw new Error(await errorText(res));
    return ((await res.json()) as { version: number }).version;
  }

  async remove(id: string): Promise<void> {
    const res = await this.f(`${this.base}/sync/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(await errorText(res));
  }
}

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (res.status === 413) return 'Your data is larger than the 1 MB sync limit.';
  if (res.status === 429) return 'Too many sync requests. Try again in a minute.';
  return body?.error ?? `Sync server answered ${res.status}.`;
}
