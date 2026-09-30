/**
 * postMessage protocol between /embed and the portfolio page that frames it.
 * Both directions are origin-checked: messages are only accepted from, and
 * only posted to, the allowed parent origins.
 *
 * In:  { type: 'theme', tokens: { paper: '#fff', ... , scheme?: 'light'|'dark' } }
 *      { type: 'command', name: 'drill' | 'transpose' | 'reset' }
 * Out: { type: 'ready' }
 *      { type: 'height', px }
 *      { type: 'stage', i, name, ms, ok }
 */
export const ALLOWED_ORIGINS = ['https://www.amittal.dev', 'http://localhost:5173'] as const;

export const STAGES = ['Line input', 'Move replay', 'Position graph', 'Practice cards', 'FSRS scheduler', 'Game review'] as const;
export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type Command = 'drill' | 'transpose' | 'reset';
export type Inbound = { type: 'theme'; tokens: Record<string, string> } | { type: 'command'; name: Command };
export type Outbound = { type: 'ready' } | { type: 'height'; px: number } | { type: 'stage'; i: StageIndex; name: string; ms: number; ok: boolean };

export function isAllowedOrigin(origin: string | null | undefined, allowed: readonly string[] = ALLOWED_ORIGINS): origin is string {
  return !!origin && allowed.includes(origin);
}

/** The parent's origin, if it is one we may talk to. */
export function parentOrigin(referrer: string, ancestorOrigins?: ArrayLike<string>, allowed: readonly string[] = ALLOWED_ORIGINS): string | null {
  const fromAncestors = ancestorOrigins && ancestorOrigins.length ? ancestorOrigins[0] : undefined;
  if (isAllowedOrigin(fromAncestors, allowed)) return fromAncestors;
  try {
    const o = new URL(referrer).origin;
    return isAllowedOrigin(o, allowed) ? o : null;
  } catch {
    return null;
  }
}

export function parseInbound(data: unknown): Inbound | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.type === 'command' && (d.name === 'drill' || d.name === 'transpose' || d.name === 'reset')) return { type: 'command', name: d.name };
  if (d.type === 'theme' && d.tokens && typeof d.tokens === 'object') return { type: 'theme', tokens: d.tokens as Record<string, string> };
  return null;
}

/** Token names the parent may set, mapped to CSS custom properties. */
const TOKEN_VARS = ['bone', 'sage', 'ink', 'due', 'paper', 'paper-sunk', 'text', 'text-2', 'text-3', 'rule', 'rule-strong', 'focus', 'due-text', 'on-due'] as const;
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9a-z.,%\s/+-]{1,60}\))$/i;

/**
 * Keep only known tokens whose values are plain colours, so a parent cannot
 * inject arbitrary CSS. Accepts "paper", "--paper" or camelCase "paperSunk".
 */
export function sanitizeTokens(tokens: Record<string, unknown>): { vars: Record<string, string>; scheme: 'light' | 'dark' | null } {
  const vars: Record<string, string> = {};
  let scheme: 'light' | 'dark' | null = null;
  for (const [rawKey, value] of Object.entries(tokens)) {
    if (rawKey === 'scheme' && (value === 'light' || value === 'dark')) {
      scheme = value;
      continue;
    }
    if (typeof value !== 'string') continue;
    const key = rawKey.replace(/^--/, '').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/([a-z])(\d)/g, '$1-$2');
    if ((TOKEN_VARS as readonly string[]).includes(key) && COLOR.test(value.trim())) vars[`--${key}`] = value.trim();
  }
  return { vars, scheme };
}
