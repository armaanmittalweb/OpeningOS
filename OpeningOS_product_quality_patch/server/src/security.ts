import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEY_LEN = 64;

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const key = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored?: string | null): Promise<boolean> {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, key] = stored.split('$');
  const actual = Buffer.from(key, 'base64url');
  const candidate = (await scrypt(password, salt, actual.length)) as Buffer;
  return actual.length === candidate.length && timingSafeEqual(actual, candidate);
}

export function hashToken(token: string): string {
  return sha256(token);
}

export function hmac(value: string, secret = process.env.JWT_SECRET || 'dev-secret-change-me'): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function maskEmail(email: string): string {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

export function assertStrongPassword(password: string): void {
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Password must include letters and numbers.');
}
