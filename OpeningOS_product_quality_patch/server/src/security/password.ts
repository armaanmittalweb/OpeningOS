import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored?: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const known = Buffer.from(hash, 'hex');
  return known.length === derived.length && timingSafeEqual(known, derived);
}

export function token(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function recoveryCode(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase().match(/.{1,5}/g)?.join('-') || token(6);
}
