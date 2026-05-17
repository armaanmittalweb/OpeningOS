export type Env = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string[];
  APP_URL: string;
  API_URL: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STOCKFISH_CMD?: string;
  LICHESS_TOKEN?: string;
  CHESSCOM_USER_AGENT: string;
  ADMIN_EMAILS: string[];
  SESSION_TTL_DAYS: number;
  REFRESH_TTL_DAYS: number;
};

function splitCsv(v?: string): string[] {
  return String(v || '').split(',').map(x => x.trim()).filter(Boolean);
}

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 8787),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  CORS_ORIGIN: splitCsv(process.env.CORS_ORIGIN || process.env.APP_URL || '*'),
  APP_URL: process.env.APP_URL || 'http://localhost:4173',
  API_URL: process.env.API_URL || 'http://localhost:8787',
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'OpeningOS <no-reply@openingos.local>',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STOCKFISH_CMD: process.env.STOCKFISH_CMD,
  LICHESS_TOKEN: process.env.LICHESS_TOKEN,
  CHESSCOM_USER_AGENT: process.env.CHESSCOM_USER_AGENT || 'OpeningOS/1.0 contact@example.com',
  ADMIN_EMAILS: splitCsv(process.env.ADMIN_EMAILS),
  SESSION_TTL_DAYS: Number(process.env.SESSION_TTL_DAYS || 1),
  REFRESH_TTL_DAYS: Number(process.env.REFRESH_TTL_DAYS || 30),
};

export function requireProductionSecrets() {
  if (env.NODE_ENV === 'production') {
    const missing = [] as string[];
    if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
    if (!process.env.JWT_SECRET || env.JWT_SECRET === 'dev-secret-change-me') missing.push('JWT_SECRET');
    if (missing.length) throw new Error('Missing production secrets: ' + missing.join(', '));
  }
}
