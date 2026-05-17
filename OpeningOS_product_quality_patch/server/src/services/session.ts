import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { env } from '../config.js';
import { query } from '../db.js';
import { sha256, token } from '../security/password.js';

export type AuthUser = { id: string; email: string; role?: string; sessionId?: string };

export async function issueSession(app: FastifyInstance, user: { id: string; email: string; role?: string }, userAgent?: string, ip?: string) {
  const sessionId = randomUUID();
  const refresh = token(48);
  const refreshHash = sha256(refresh);
  await query(
    `insert into user_sessions(id, user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     values($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval)`,
    [sessionId, user.id, refreshHash, userAgent || '', ip || '', env.REFRESH_TTL_DAYS]
  );
  const accessToken = app.jwt.sign({ id: user.id, email: user.email, role: user.role || 'user', sessionId }, { expiresIn: `${env.SESSION_TTL_DAYS}d` });
  return { accessToken, refreshToken: refresh, sessionId, user };
}

export async function rotateSession(app: FastifyInstance, refreshToken: string) {
  const refreshHash = sha256(refreshToken);
  const found = await query<{ id: string; user_id: string; email: string; role: string }>(
    `select s.id, s.user_id, u.email, coalesce(u.role,'user') as role
     from user_sessions s join app_users u on u.id=s.user_id
     where s.refresh_token_hash=$1 and s.revoked_at is null and s.expires_at > now()`, [refreshHash]
  );
  const row = found.rows[0];
  if (!row) return null;
  const nextRefresh = token(48);
  await query('update user_sessions set refresh_token_hash=$1, last_seen_at=now() where id=$2', [sha256(nextRefresh), row.id]);
  const accessToken = app.jwt.sign({ id: row.user_id, email: row.email, role: row.role, sessionId: row.id }, { expiresIn: `${env.SESSION_TTL_DAYS}d` });
  return { accessToken, refreshToken: nextRefresh, sessionId: row.id, user: { id: row.user_id, email: row.email, role: row.role } };
}

export async function revokeSession(sessionId: string) {
  await query('update user_sessions set revoked_at=now() where id=$1', [sessionId]);
}
