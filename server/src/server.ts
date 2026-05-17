import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { query, withUser, transaction } from './db.js';

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 25 * 1024 * 1024 });
const PORT = Number(process.env.PORT || 8787);
const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TTL_SECONDS || 60 * 30);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true });
await app.register(rateLimit, { max: Number(process.env.RATE_LIMIT_MAX || 240), timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute' });
await app.register(jwt, { secret: JWT_SECRET });

type AuthUser = { id: string; email?: string; role?: string; sessionId?: string };

declare module 'fastify' { interface FastifyInstance { authenticate: (req: any, reply?: any) => Promise<void>; requireAdmin: (req: any, reply?: any) => Promise<void>; } }

app.decorate('authenticate', async function authenticate(req: any, reply: any) {
  try {
    if (!req.headers.authorization && req.query && req.query.token) req.headers.authorization = 'Bearer ' + req.query.token;
    await req.jwtVerify();
  }
  catch { reply.code(401); throw new Error('Sign in required'); }
});
app.decorate('requireAdmin', async function requireAdmin(req: any, reply: any) {
  await app.authenticate(req, reply);
  const user = req.user as AuthUser;
  const rows = await query<{ role: string }>('select role from app_users where id=$1', [user.id]);
  if ((rows.rows[0]?.role || 'user') !== 'admin') { reply.code(403); throw new Error('Admin access required'); }
});

const Email = z.string().email().transform(v => v.toLowerCase());
const SignupSchema = z.object({ email: Email, password: z.string().min(10), name: z.string().trim().min(1).max(120).optional(), displayName: z.string().trim().min(1).max(120).optional() });
const LoginSchema = z.object({ email: Email, password: z.string().min(1) });
const SnapshotSchema = z.object({ profileId: z.string().min(1), version: z.number().int().nonnegative().default(0), payload: z.record(z.any()), clientUpdatedAt: z.number().int().optional() });
const ChangeSchema = z.object({ id: z.string().optional(), kind: z.string().min(1), data: z.record(z.any()).default({}), deleted: z.boolean().default(false), updatedAt: z.number().int().optional(), deviceId: z.string().optional(), version: z.number().int().optional() });

function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); const hash = scryptSync(password, salt, 64).toString('hex'); return `scrypt$${salt}$${hash}`; }
function verifyPassword(password: string, stored?: string | null) { if (!stored) return false; const [kind, salt, hash] = stored.split('$'); if (kind !== 'scrypt' || !salt || !hash) return false; const candidate = scryptSync(password, salt, 64); const original = Buffer.from(hash, 'hex'); return original.length === candidate.length && timingSafeEqual(original, candidate); }
function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
function randomToken(bytes = 32) { return randomBytes(bytes).toString('base64url'); }
function accessToken(user: AuthUser) { return app.jwt.sign({ id: user.id, email: user.email, role: user.role || 'user', sessionId: user.sessionId }, { expiresIn: ACCESS_TTL_SECONDS }); }
async function issueSession(user: { id: string; email: string; role?: string }, req: any) {
  const refreshToken = randomToken(48);
  const refreshHash = tokenHash(refreshToken);
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000);
  await query('insert into sessions(id,user_id,refresh_token_hash,user_agent,ip,expires_at) values($1,$2,$3,$4,$5,$6)', [sessionId, user.id, refreshHash, req.headers['user-agent'] || '', req.ip || '', expiresAt]);
  const token = accessToken({ id: user.id, email: user.email, role: user.role || 'user', sessionId });
  return { token, accessToken: token, refreshToken, expiresAt: Date.now() + ACCESS_TTL_SECONDS * 1000, user: { id: user.id, email: user.email, role: user.role || 'user' } };
}
async function audit(userId: string | null, action: string, details: Record<string, unknown> = {}, req?: any) {
  await query('insert into audit_events(user_id, action, details, ip, user_agent) values($1,$2,$3,$4,$5)', [userId, action, details, req?.ip || null, req?.headers?.['user-agent'] || null]).catch(err => app.log.warn({ err }, 'audit failed'));
}
async function mail(to: string, subject: string, body: string) {
  await query('insert into email_events(to_email, subject, body, status) values($1,$2,$3,$4)', [to, subject, body, process.env.SMTP_URL ? 'queued' : 'dev-queued']);
  app.log.info({ to, subject, preview: body.slice(0, 160) }, 'email queued');
}
function publicUrl(path: string) { return `${FRONTEND_URL}${path}`; }

app.get('/health', async () => ({ ok: true, service: 'openingos-backend', mode: process.env.NODE_ENV || 'development', at: new Date().toISOString() }));

// --- Auth, account recovery, OAuth and passkeys ------------------------
app.post('/auth/signup', async (req, reply) => {
  const body = SignupSchema.parse(req.body);
  const user = await transaction(async client => {
    const u = await client.query<{ id: string; email: string; role: string }>(`insert into app_users(email, display_name, role) values($1,$2,'user') on conflict(email) do update set updated_at=now() returning id,email,role`, [body.email, body.displayName || body.name || body.email.split('@')[0]]);
    await client.query(`insert into user_passwords(user_id,password_hash) values($1,$2) on conflict(user_id) do update set password_hash=excluded.password_hash, updated_at=now()`, [u.rows[0].id, hashPassword(body.password)]);
    await client.query(`insert into profiles(user_id,name,role) values($1,$2,'player') on conflict do nothing`, [u.rows[0].id, body.displayName || body.name || 'Player']);
    return u.rows[0];
  });
  await audit(user.id, 'auth.signup', { email: user.email }, req);
  return reply.send(await issueSession(user, req));
});
app.post('/auth/login', async (req, reply) => {
  const body = LoginSchema.parse(req.body);
  const result = await query<{ id: string; email: string; role: string; password_hash: string }>(`select u.id,u.email,u.role,p.password_hash from app_users u join user_passwords p on p.user_id=u.id where u.email=$1`, [body.email]);
  const user = result.rows[0];
  if (!user || !verifyPassword(body.password, user.password_hash)) { await audit(user?.id || null, 'auth.login.failed', { email: body.email }, req); return reply.code(401).send({ error: 'Invalid email or password' }); }
  await audit(user.id, 'auth.login', {}, req);
  return reply.send(await issueSession(user, req));
});
app.post('/auth/dev-login', async (req, reply) => {
  if (process.env.NODE_ENV === 'production') return reply.code(404).send({ error: 'Not found' });
  const body = z.object({ email: Email }).parse(req.body);
  const user = await query<{ id: string; email: string; role: string }>(`insert into app_users(email, role) values($1,'admin') on conflict(email) do update set email=excluded.email returning id,email,role`, [body.email]);
  return reply.send(await issueSession(user.rows[0], req));
});
app.post('/auth/refresh', async (req, reply) => {
  const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
  const h = tokenHash(body.refreshToken);
  const row = await query<{ id: string; user_id: string; email: string; role: string }>(`select s.id,u.id as user_id,u.email,u.role from sessions s join app_users u on u.id=s.user_id where s.refresh_token_hash=$1 and s.revoked_at is null and s.expires_at>now()`, [h]);
  const s = row.rows[0]; if (!s) return reply.code(401).send({ error: 'Invalid refresh token' });
  await audit(s.user_id, 'auth.refresh', { sessionId: s.id }, req);
  const token = accessToken({ id: s.user_id, email: s.email, role: s.role, sessionId: s.id });
  return { token, accessToken: token, refreshToken: body.refreshToken, expiresAt: Date.now() + ACCESS_TTL_SECONDS * 1000, user: { id: s.user_id, email: s.email, role: s.role } };
});
app.post('/auth/logout', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; await query('update sessions set revoked_at=now() where id=$1 and user_id=$2', [u.sessionId, u.id]); await audit(u.id, 'auth.logout', {}, req); return { ok: true }; });
app.post('/auth/password-reset/request', async (req) => {
  const body = z.object({ email: Email }).parse(req.body);
  const user = await query<{ id: string; email: string }>('select id,email from app_users where email=$1', [body.email]);
  const token = randomToken(32);
  if (user.rows[0]) { await query('insert into password_reset_tokens(user_id, token_hash, expires_at) values($1,$2,now()+interval \'1 hour\')', [user.rows[0].id, tokenHash(token)]); await mail(body.email, 'Reset your OpeningOS password', `Reset link: ${publicUrl('/#settings?reset=' + token)}`); await audit(user.rows[0].id, 'auth.password_reset.request', {}, req); }
  return { ok: true, devToken: process.env.NODE_ENV === 'production' ? undefined : token };
});
app.post('/auth/password-reset/confirm', async (req) => {
  const body = z.object({ token: z.string().min(20), password: z.string().min(10) }).parse(req.body);
  const row = await query<{ user_id: string }>('select user_id from password_reset_tokens where token_hash=$1 and used_at is null and expires_at>now()', [tokenHash(body.token)]);
  if (!row.rows[0]) throw new Error('Invalid or expired reset token');
  await query('update user_passwords set password_hash=$1, updated_at=now() where user_id=$2', [hashPassword(body.password), row.rows[0].user_id]);
  await query('update password_reset_tokens set used_at=now() where token_hash=$1', [tokenHash(body.token)]);
  await query('update sessions set revoked_at=now() where user_id=$1', [row.rows[0].user_id]);
  await audit(row.rows[0].user_id, 'auth.password_reset.confirmed', {}, req);
  return { ok: true };
});
app.post('/auth/recovery/start', async (req) => { const body = z.object({ email: Email }).parse(req.body); await mail(body.email, 'OpeningOS account recovery', 'Use your saved recovery code in the app to recover your account.'); return { ok: true }; });
app.post('/auth/recover-account', async (req, reply) => {
  const body = z.object({ email: Email, code: z.string().min(8) }).parse(req.body);
  const h = tokenHash(body.code.replace(/\s+/g, ''));
  const row = await query<{ id: string; email: string; role: string; code_id: string }>(`select u.id,u.email,u.role, r.id as code_id from app_users u join recovery_codes r on r.user_id=u.id where u.email=$1 and r.code_hash=$2 and r.used_at is null`, [body.email, h]);
  if (!row.rows[0]) return reply.code(401).send({ error: 'Invalid recovery code' });
  await query('update recovery_codes set used_at=now() where id=$1', [row.rows[0].code_id]);
  await audit(row.rows[0].id, 'auth.account_recovered', {}, req);
  return reply.send(await issueSession(row.rows[0], req));
});
app.post('/auth/recovery-codes/regenerate', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser; const codes = Array.from({ length: 10 }, () => randomToken(10));
  await transaction(async client => { await client.query('delete from recovery_codes where user_id=$1', [u.id]); for (const code of codes) await client.query('insert into recovery_codes(user_id, code_hash) values($1,$2)', [u.id, tokenHash(code)]); });
  await audit(u.id, 'auth.recovery_codes.regenerated', {}, req); return { codes };
});
app.get('/auth/oauth/:provider/start', async (req: any) => {
  const provider = String(req.params.provider); const state = randomToken(16);
  const base = provider === 'github' ? 'https://github.com/login/oauth/authorize' : provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://lichess.org/oauth';
  const clientId = process.env[provider.toUpperCase() + '_CLIENT_ID'] || 'configure-client-id';
  const redirect = process.env.OAUTH_REDIRECT_URI || `${FRONTEND_URL}/api/oauth/callback`;
  return { provider, state, url: `${base}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(provider === 'github' ? 'user:email' : 'openid email profile')}&state=${state}` };
});
app.post('/auth/oauth/:provider/callback', async (req, reply) => {
  const provider = String((req.params as any).provider); const body = z.object({ code: z.string(), state: z.string().optional(), email: Email.optional(), displayName: z.string().optional() }).parse(req.body);
  // Production deployments should exchange code with provider using provider secrets.
  const email = body.email || `${provider}-${body.code.slice(0,8)}@oauth.openingos.local`;
  const user = await query<{ id: string; email: string; role: string }>(`insert into app_users(email,display_name,role) values($1,$2,'user') on conflict(email) do update set updated_at=now() returning id,email,role`, [email, body.displayName || provider + ' user']);
  await query(`insert into oauth_accounts(user_id,provider,provider_subject,metadata) values($1,$2,$3,$4) on conflict(provider,provider_subject) do update set metadata=excluded.metadata`, [user.rows[0].id, provider, body.code.slice(0,24), { state: body.state }]);
  await audit(user.rows[0].id, 'auth.oauth.login', { provider }, req);
  return reply.send(await issueSession(user.rows[0], req));
});
app.post('/auth/webauthn/register/options', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser; const challenge = randomToken(32);
  await query('insert into webauthn_challenges(user_id,challenge,purpose,expires_at) values($1,$2,$3,now()+interval \'5 minutes\')', [u.id, challenge, 'register']);
  return { publicKey: { challenge, rp: { name: 'OpeningOS' }, user: { id: Buffer.from(u.id).toString('base64url'), name: u.email, displayName: u.email }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }, timeout: 60000, attestation: 'none' } };
});
app.post('/auth/webauthn/register/verify', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser; const body = z.object({ credential: z.record(z.any()), label: z.string().optional() }).parse(req.body);
  await query('insert into webauthn_credentials(user_id,credential_id,public_key,counter,label) values($1,$2,$3,$4,$5) on conflict(user_id,credential_id) do update set label=excluded.label', [u.id, body.credential.id, JSON.stringify(body.credential), 0, body.label || 'Passkey']);
  await audit(u.id, 'auth.passkey.registered', { credentialId: body.credential.id }, req); return { ok: true };
});
app.post('/auth/webauthn/login/options', async (req) => { const body = z.object({ email: Email.optional() }).parse(req.body || {}); const challenge = randomToken(32); return { publicKey: { challenge, timeout: 60000, userVerification: 'preferred', allowCredentials: [] }, email: body.email }; });
app.post('/auth/webauthn/login/verify', async (req, reply) => {
  const body = z.object({ email: Email.optional(), credential: z.record(z.any()) }).parse(req.body);
  const row = await query<{ id: string; email: string; role: string }>(`select u.id,u.email,u.role from app_users u join webauthn_credentials c on c.user_id=u.id where c.credential_id=$1 ${body.email ? 'and u.email=$2' : ''} limit 1`, body.email ? [body.credential.id, body.email] : [body.credential.id]);
  if (!row.rows[0]) return reply.code(401).send({ error: 'Passkey not recognized' });
  await audit(row.rows[0].id, 'auth.passkey.login', {}, req); return reply.send(await issueSession(row.rows[0], req));
});


// Passkey route aliases kept for frontend compatibility.
app.post('/auth/passkeys/register/options', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser; const challenge = randomToken(32);
  await query("insert into webauthn_challenges(user_id,challenge,purpose,expires_at) values($1,$2,$3,now()+interval '5 minutes')", [u.id, challenge, 'register']);
  return { publicKey: { challenge, rp: { name: 'OpeningOS' }, user: { id: Buffer.from(u.id).toString('base64url'), name: u.email, displayName: u.email }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], timeout: 60000, attestation: 'none' } };
});
app.post('/auth/passkeys/register/verify', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser; const body = z.object({ credential: z.record(z.any()), label: z.string().optional() }).parse(req.body);
  await query('insert into webauthn_credentials(user_id,credential_id,public_key,counter,label) values($1,$2,$3,$4,$5) on conflict(user_id,credential_id) do update set label=excluded.label', [u.id, body.credential.id, JSON.stringify(body.credential), 0, body.label || 'Passkey']);
  await audit(u.id, 'auth.passkey.registered', { credentialId: body.credential.id }, req); return { ok: true };
});
app.post('/auth/passkeys/login/options', async (req) => { const body = z.object({ email: Email.optional() }).parse(req.body || {}); const challenge = randomToken(32); return { publicKey: { challenge, timeout: 60000, userVerification: 'preferred', allowCredentials: [] }, email: body.email }; });
app.post('/auth/passkeys/login/verify', async (req, reply) => {
  const body = z.object({ email: Email.optional(), credential: z.record(z.any()) }).parse(req.body);
  const row = await query<{ id: string; email: string; role: string }>(`select u.id,u.email,u.role from app_users u join webauthn_credentials c on c.user_id=u.id where c.credential_id=$1 ${body.email ? 'and u.email=$2' : ''} limit 1`, body.email ? [body.credential.id, body.email] : [body.credential.id]);
  if (!row.rows[0]) return reply.code(401).send({ error: 'Passkey not recognized' });
  await audit(row.rows[0].id, 'auth.passkey.login', {}, req); return reply.send(await issueSession(row.rows[0], req));
});

app.get('/me', { preHandler: app.authenticate }, async (req: any) => ({ user: req.user as AuthUser }));

// --- Sync, graph, collaboration ----------------------------------------
app.post('/sync/snapshot', { preHandler: app.authenticate }, async (req: any) => {
  const user = req.user as AuthUser; const body = SnapshotSchema.parse(req.body);
  return withUser(user.id, async () => {
    const current = await query<{ version: number; payload: unknown }>('select version,payload from sync_snapshots where user_id=$1 and profile_id=$2', [user.id, body.profileId]);
    if (current.rows[0] && current.rows[0].version > body.version) return { status: 'conflict', server: current.rows[0] };
    const nextVersion = Math.max(body.version, (current.rows[0]?.version || 0) + 1);
    await query(`insert into sync_snapshots(user_id,profile_id,version,payload,client_updated_at) values($1,$2,$3,$4,to_timestamp($5/1000.0)) on conflict(user_id,profile_id) do update set version=excluded.version,payload=excluded.payload,client_updated_at=excluded.client_updated_at,updated_at=now()`, [user.id, body.profileId, nextVersion, body.payload, body.clientUpdatedAt || Date.now()]);
    await audit(user.id, 'sync.snapshot.saved', { profileId: body.profileId, version: nextVersion }, req); return { status: 'saved', version: nextVersion };
  });
});
app.get('/sync/snapshot/:profileId', { preHandler: app.authenticate }, async (req: any) => withUser((req.user as AuthUser).id, async () => { const r = await query('select profile_id,version,payload,updated_at from sync_snapshots where user_id=$1 and profile_id=$2', [(req.user as AuthUser).id, String(req.params.profileId)]); return r.rows[0] || null; }));
app.post('/sync/changes', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser; const body = z.object({ changes: z.array(ChangeSchema).default([]) }).parse(req.body);
  const serverTime = Date.now();
  await transaction(async client => { for (const c of body.changes) { await client.query(`insert into sync_changes(user_id,entity_id,kind,payload,deleted,client_updated_at,device_id,version) values($1,$2,$3,$4,$5,to_timestamp($6/1000.0),$7,$8)`, [u.id, c.id || randomUUID(), c.kind, c.data, c.deleted, c.updatedAt || Date.now(), c.deviceId || '', c.version || 1]); } });
  await audit(u.id, 'sync.changes.pushed', { count: body.changes.length }, req); return { ok: true, serverTime };
});
app.get('/sync/changes', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser; const since = Number((req.query as any).since || 0);
  const r = await query('select entity_id as id, kind, payload as data, deleted, extract(epoch from created_at)*1000 as "updatedAt", device_id as "deviceId", version from sync_changes where user_id=$1 and extract(epoch from created_at)*1000>$2 order by created_at asc limit 500', [u.id, since]);
  return { changes: r.rows, serverTime: Date.now() };
});
app.get('/sync/events', { preHandler: app.authenticate }, async (req: any, reply) => {
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const interval = setInterval(() => reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`), 15000);
  req.raw.on('close', () => clearInterval(interval));
});
app.put('/graph/snapshot', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ profileId: z.string(), graph: z.record(z.any()), version: z.number().default(1) }).parse(req.body); await query('insert into graph_snapshots(user_id,profile_id,version,graph) values($1,$2,$3,$4) on conflict(user_id,profile_id) do update set version=excluded.version,graph=excluded.graph,updated_at=now()', [u.id,b.profileId,b.version,b.graph]); return { ok: true, version: b.version }; });
app.get('/graph/snapshot/:profileId', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const r = await query('select profile_id,version,graph,updated_at from graph_snapshots where user_id=$1 and profile_id=$2', [u.id, String(req.params.profileId)]); return r.rows[0] || null; });

// --- Coach/student platform --------------------------------------------
app.post('/coach/invitations', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ studentEmail: Email, role: z.enum(['student','assistant']).default('student') }).parse(req.body); const token = randomToken(24); await query('insert into coach_invitations(coach_user_id,student_email,role,token,expires_at) values($1,$2,$3,$4,now()+interval \'14 days\')', [u.id,b.studentEmail,b.role,token]); await mail(b.studentEmail,'OpeningOS coach invitation',`Accept invitation: ${publicUrl('/#settings?coachInvite=' + token)}`); await audit(u.id,'coach.invitation.created',{ studentEmail: b.studentEmail },req); return { token, url: publicUrl('/#settings?coachInvite=' + token) }; });
app.post('/coach/invitations/accept', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ token: z.string() }).parse(req.body); const inv = await query<{ id:string; coach_user_id:string; role:string }>('select id,coach_user_id,role from coach_invitations where token=$1 and accepted_at is null and (expires_at is null or expires_at>now())', [b.token]); if (!inv.rows[0]) throw new Error('Invalid invitation'); await query('update coach_invitations set accepted_by=$1,accepted_at=now() where id=$2', [u.id, inv.rows[0].id]); await query('insert into coach_relationships(coach_user_id,student_user_id,role,status) values($1,$2,$3,\'active\') on conflict(coach_user_id,student_user_id) do update set status=\'active\',role=excluded.role', [inv.rows[0].coach_user_id,u.id,inv.rows[0].role]); await audit(u.id,'coach.invitation.accepted',{ coachId: inv.rows[0].coach_user_id },req); return { ok: true }; });
app.get('/coach/workspace', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const students = await query('select r.student_user_id,u.email,r.role,r.status from coach_relationships r join app_users u on u.id=r.student_user_id where r.coach_user_id=$1 and r.status=\'active\'', [u.id]); const assignments = await query('select * from assignments where coach_user_id=$1 order by created_at desc limit 200', [u.id]); const comments = await query('select * from position_comments where coach_user_id=$1 order by created_at desc limit 200', [u.id]); return { students: students.rows, assignments: assignments.rows, comments: comments.rows }; });
app.post('/coach/assignments', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ studentUserId: z.string().uuid().optional(), studentEmail: Email.optional(), linePathId: z.string().optional(), mode: z.string().optional(), dueAt: z.string().optional(), message: z.string().optional(), payload: z.record(z.any()).default({}) }).parse(req.body); let studentId = b.studentUserId || null; if (!studentId && b.studentEmail) { const r = await query<{ id:string }>('select id from app_users where email=$1', [b.studentEmail]); studentId = r.rows[0]?.id || null; } const out = await query<{ id:string }>('insert into assignments(coach_user_id,student_user_id,line_path_id,mode,due_at,message,payload) values($1,$2,$3,$4,$5,$6,$7) returning id', [u.id,studentId,b.linePathId,b.mode,b.dueAt || null,b.message,b.payload]); await audit(u.id,'coach.assignment.created',{ assignmentId: out.rows[0].id },req); return { id: out.rows[0].id, status: 'pending' }; });
app.post('/coach/assignments/:id/progress', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ progress: z.number().min(0).max(100).default(0), status: z.string().default('in-progress'), payload: z.record(z.any()).default({}) }).parse(req.body); await query('insert into assignment_progress(assignment_id,user_id,progress,status,payload) values($1,$2,$3,$4,$5)', [String(req.params.id),u.id,b.progress,b.status,b.payload]); await audit(u.id,'coach.assignment.progress',{ assignmentId: String(req.params.id), progress: b.progress },req); return { ok: true }; });
app.post('/coach/students/:id/revoke', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; await query('update coach_relationships set status=\'revoked\', revoked_at=now() where coach_user_id=$1 and student_user_id=$2', [u.id,String(req.params.id)]); await audit(u.id,'coach.student.revoked',{ studentId: String(req.params.id) },req); return { ok: true }; });
app.post('/coach/comments', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ studentUserId: z.string().uuid().optional(), targetKind: z.string(), targetId: z.string(), body: z.string().min(1), visibility: z.string().default('coach-student') }).parse(req.body); const r = await query<{ id:string }>('insert into position_comments(coach_user_id,student_user_id,target_kind,target_id,body,visibility) values($1,$2,$3,$4,$5,$6) returning id', [u.id,b.studentUserId || null,b.targetKind,b.targetId,b.body,b.visibility]); return { id: r.rows[0].id }; });

// --- Sharing -------------------------------------------------------------
app.post('/shares', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ scope: z.string(), targetId: z.string(), visibility: z.enum(['private','unlisted','public']).default('unlisted'), permission: z.enum(['read','clone','edit']).default('read'), title: z.string().optional(), expiresAt: z.string().optional(), payload: z.record(z.any()).default({}) }).parse(req.body); const token = randomToken(18); const r = await query<{ id:string }>('insert into share_links(user_id,scope,target_id,visibility,permission,title,token,expires_at,payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id', [u.id,b.scope,b.targetId,b.visibility,b.permission,b.title || '',token,b.expiresAt || null,b.payload]); await audit(u.id,'share.created',{ shareId: r.rows[0].id, scope: b.scope },req); return { id: r.rows[0].id, token, url: publicUrl('/#share=' + token) }; });
app.get('/shares/:token', async (req: any) => { const token = String(req.params.token); const r = await query('select id,scope,target_id,visibility,permission,title,payload,expires_at from share_links where token=$1 and revoked_at is null and (expires_at is null or expires_at>now())', [token]); const share = r.rows[0]; if (!share) throw new Error('Share not found'); await query('insert into share_access_logs(share_id,ip,user_agent) values($1,$2,$3)', [(share as any).id, req.ip, req.headers['user-agent'] || '']); return share; });
app.post('/shares/:token/clone', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const token = String(req.params.token); const r = await query<any>('select * from share_links where token=$1 and revoked_at is null', [token]); if (!r.rows[0]) throw new Error('Share not found'); await audit(u.id,'share.cloned',{ shareId: r.rows[0].id },req); return { ok: true, payload: r.rows[0].payload }; });
app.delete('/shares/:id', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; await query('update share_links set revoked_at=now() where id=$1 and user_id=$2', [String(req.params.id),u.id]); await audit(u.id,'share.revoked',{ shareId: String(req.params.id) },req); return { ok: true }; });
app.get('/teams/libraries', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const r = await query('select * from team_libraries where owner_user_id=$1 or id in (select team_library_id from team_members where user_id=$1)', [u.id]); return { libraries: r.rows }; });

// --- Import jobs and chess analysis -------------------------------------
type ImportedGame = { pgn: string; headers?: Record<string, any>; source?: string; sourceId?: string; url?: string; endTime?: number | null };
const ImportSourceSchema = z.object({ source: z.enum(['lichess','chesscom']), username: z.string().trim().min(1).max(80), max: z.number().int().min(1).max(100).default(25) });

app.post('/imports/fetch-games', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser;
  const b = ImportSourceSchema.parse(req.body);
  const result = await fetchRemoteGames(b.source, b.username, b.max);
  await audit(u.id, 'import.remote.fetch', { source: b.source, username: b.username, count: result.games.length }, req);
  return result;
});

app.post('/imports/jobs', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser;
  const b = z.object({ source: z.enum(['pgn','lichess','chesscom','study','file']), payload: z.record(z.any()).default({}) }).parse(req.body);
  const r = await query<{ id:string }>('insert into import_jobs(user_id,source,payload,status) values($1,$2,$3,\'queued\') returning id', [u.id,b.source,b.payload]);
  await audit(u.id,'import.job.queued',{ jobId: r.rows[0].id, source: b.source },req);
  processImportJob(r.rows[0].id).catch(err => app.log.error({ err }, 'import worker failed'));
  return { id: r.rows[0].id, status: 'queued' };
});
app.get('/imports/jobs/:id', { preHandler: app.authenticate }, async (req: any) => {
  const u = req.user as AuthUser;
  const r = await query('select id,source,status,result,error,created_at,updated_at from import_jobs where user_id=$1 and id=$2', [u.id,String(req.params.id)]);
  return r.rows[0] || null;
});


app.post('/imports/fetch', { preHandler: app.authenticate }, async (req: any) => {
  const body = z.object({ source: z.enum(['lichess','chesscom','pgn']), username: z.string().trim().optional(), max: z.number().int().min(1).max(100).default(20), pgn: z.string().optional() }).parse(req.body || {});
  if (body.source === 'pgn') return { source: 'pgn', count: body.pgn ? splitPgnBundle(body.pgn).length : 0, games: splitPgnBundle(body.pgn || '').map(pgn => ({ pgn, headers: {} })) };
  if (!body.username) throw new Error('Username is required.');
  return fetchRemoteGames(body.source, body.username, body.max);
});

async function processImportJob(id: string) {
  const r = await query<any>('select * from import_jobs where id=$1', [id]);
  const job = r.rows[0];
  if (!job) return;
  await query('update import_jobs set status=\'running\',updated_at=now() where id=$1', [id]);
  try {
    let result: any;
    const max = Number(job.payload?.max || job.payload?.limit || 25);
    if (job.source === 'lichess' && job.payload.username) result = await fetchRemoteGames('lichess', String(job.payload.username), max);
    else if (job.source === 'chesscom' && job.payload.username) result = await fetchRemoteGames('chesscom', String(job.payload.username), max);
    else if (job.source === 'pgn') {
      const pgn = String(job.payload?.pgn || '');
      const games = splitPgnBundle(pgn).map(g => ({ pgn: g, headers: {} }));
      result = { source: 'pgn', count: games.length, games, importedAt: new Date().toISOString() };
    }
    else result = { source: job.source, count: 0, games: [], warning: 'Unsupported import payload.' };
    await query('update import_jobs set status=\'done\',result=$2,updated_at=now() where id=$1', [id,result]);
  } catch (err: any) {
    await query('update import_jobs set status=\'failed\',error=$2,updated_at=now() where id=$1', [id,err.message || String(err)]);
  }
}

async function fetchRemoteGames(source: 'lichess' | 'chesscom', username: string, max = 20) {
  const safeMax = Math.max(1, Math.min(Number(max || 20), 100));
  if (source === 'lichess') return fetchLichessGames(username, safeMax);
  return fetchChesscomGames(username, safeMax);
}

async function fetchLichessGames(username: string, max: number) {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&moves=true&tags=true&clocks=false&evals=false&opening=true`;
  const res = await fetch(url, { headers: { Accept: 'application/x-chess-pgn', 'User-Agent': 'OpeningOS/1.0 (+https://github.com/armaanmittalweb/OpeningOS)' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Lichess import failed (${res.status}): ${text.slice(0, 180) || res.statusText}`);
  const games = splitPgnBundle(text).slice(0, max).map(pgn => ({ pgn, headers: { Site: 'Lichess' } }));
  return { source: 'lichess', username, count: games.length, games, pgnBundle: text.slice(0, 1_500_000), importedAt: new Date().toISOString() };
}

async function fetchChesscomGames(username: string, max: number) {
  const user = username.trim().toLowerCase();
  const headers = { Accept: 'application/json', 'User-Agent': 'OpeningOS/1.0 (+https://github.com/armaanmittalweb/OpeningOS)' };
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`, { headers });
  const archivesText = await archivesRes.text();
  if (!archivesRes.ok) throw new Error(`Chess.com archives failed (${archivesRes.status}): ${archivesText.slice(0, 180) || archivesRes.statusText}`);
  let archives: string[] = [];
  try { archives = (JSON.parse(archivesText).archives || []) as string[]; } catch { throw new Error('Chess.com archives response was not JSON.'); }
  const games: any[] = [];
  const warnings: string[] = [];
  for (const archiveUrl of archives.slice().reverse()) {
    if (games.length >= max) break;
    try {
      const ar = await fetch(archiveUrl, { headers });
      const bodyText = await ar.text();
      if (!ar.ok) { warnings.push(`Skipped ${archiveUrl}: ${ar.status}`); continue; }
      const body = JSON.parse(bodyText);
      const monthGames = Array.isArray(body.games) ? body.games.slice().reverse() : [];
      for (const g of monthGames) {
        if (games.length >= max) break;
        if (g && g.pgn) games.push({ pgn: g.pgn, headers: { Site: 'Chess.com', URL: g.url || '', UUID: g.uuid || '', TimeControl: g.time_control || g.time_class || '' }, uuid: g.uuid || '', url: g.url || '', endTime: g.end_time || null, timeClass: g.time_class || '' });
      }
    } catch (err: any) {
      warnings.push(`Skipped ${archiveUrl}: ${err.message || String(err)}`);
    }
  }
  return { source: 'chesscom', username: user, count: games.length, games, archivesChecked: archives.length, warnings, importedAt: new Date().toISOString() };
}

function splitPgnBundle(text: string) {
  const trimmed = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) return [];
  return trimmed.split(/\n\n(?=\[)/).map(s => s.trim()).filter(Boolean);
}
app.post('/analysis/quick', { preHandler: app.authenticate }, async (req) => { const b = z.object({ fen: z.string(), depth: z.number().int().min(1).max(20).default(12) }).parse(req.body); return { result: await runEngine(b.fen, b.depth) }; });
app.post('/analysis/jobs', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ kind: z.string().default('position'), fen: z.string().optional(), options: z.record(z.any()).default({}), snapshot: z.any().optional() }).parse(req.body); const r = await query<{ id:string }>('insert into analysis_jobs(user_id,kind,payload,status) values($1,$2,$3,\'queued\') returning id', [u.id,b.kind,b]); processAnalysisJob(r.rows[0].id).catch(err => app.log.error({ err }, 'analysis worker failed')); return { id: r.rows[0].id, status: 'queued' }; });
app.get('/analysis/jobs/:id', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const r = await query('select id,kind,status,result,error,created_at,updated_at from analysis_jobs where user_id=$1 and id=$2', [u.id,String(req.params.id)]); return r.rows[0] || null; });
async function processAnalysisJob(id: string) { const r = await query<any>('select * from analysis_jobs where id=$1', [id]); const job = r.rows[0]; if (!job) return; await query('update analysis_jobs set status=\'running\',updated_at=now() where id=$1', [id]); try { const result = job.payload?.fen ? await runEngine(job.payload.fen, job.payload.options?.depth || 12) : { summary: 'Snapshot accepted for background analysis.', warnings: [] }; await query('update analysis_jobs set status=\'done\',result=$2,updated_at=now() where id=$1', [id,result]); } catch (err: any) { await query('update analysis_jobs set status=\'failed\',error=$2,updated_at=now() where id=$1', [id,err.message || String(err)]); } }
function runEngine(fen: string, depth: number): Promise<any> { const engine = process.env.STOCKFISH_PATH; if (!engine) return Promise.resolve({ source: 'server-heuristic', fen, depth, scoreCp: 0, bestmove: '', pv: [], warning: 'Set STOCKFISH_PATH for real Stockfish analysis.' }); return new Promise((resolve, reject) => { const p = spawn(engine); let lines: string[] = []; let done = false; const finish = (out: any) => { if (done) return; done = true; p.kill(); resolve(out); }; p.stdout.on('data', d => { const chunk = String(d); lines.push(...chunk.split(/\r?\n/).filter(Boolean)); const best = lines.find(x => x.startsWith('bestmove')); if (best) finish({ source: 'stockfish', fen, depth, bestmove: best.split(/\s+/)[1], raw: lines.slice(-30) }); }); p.on('error', reject); p.stdin.write('uci\n'); p.stdin.write('ucinewgame\n'); p.stdin.write('position fen ' + fen + '\n'); p.stdin.write('go depth ' + depth + '\n'); setTimeout(() => finish({ source: 'stockfish-timeout', fen, depth, raw: lines.slice(-30) }), 20000); }); }

// --- Billing, account, admin, AI/content --------------------------------
app.get('/billing/subscription', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const r = await query('select * from billing_customers where user_id=$1', [u.id]); return r.rows[0] || { plan: 'free', status: 'active' }; });
app.post('/billing/checkout', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ plan: z.enum(['pro','coach','team']).default('pro') }).parse(req.body); await query('insert into billing_customers(user_id,plan,status,metadata) values($1,$2,\'checkout_pending\',$3) on conflict(user_id) do update set plan=excluded.plan,status=excluded.status,metadata=excluded.metadata,updated_at=now()', [u.id,b.plan,{ requestedAt: new Date().toISOString() }]); return { url: process.env.STRIPE_CHECKOUT_URL || '', status: process.env.STRIPE_CHECKOUT_URL ? 'redirect' : 'configure-stripe', plan: b.plan }; });
app.post('/billing/portal', { preHandler: app.authenticate }, async () => ({ url: process.env.STRIPE_PORTAL_URL || '', status: process.env.STRIPE_PORTAL_URL ? 'redirect' : 'configure-stripe' }));
app.post('/billing/webhook', async (req) => { await query('insert into billing_webhook_events(payload) values($1)', [req.body || {}]); return { received: true }; });
app.post('/account/export', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const snapshot = await query('select * from sync_snapshots where user_id=$1', [u.id]); const graph = await query('select * from graph_snapshots where user_id=$1', [u.id]); await audit(u.id,'account.export.requested',{},req); return { exportedAt: new Date().toISOString(), snapshots: snapshot.rows, graphs: graph.rows }; });
app.post('/account/delete', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ reason: z.string().optional() }).parse(req.body || {}); await query('insert into account_deletion_requests(user_id,reason,status) values($1,$2,\'queued\')', [u.id,b.reason || '']); await audit(u.id,'account.delete.requested',{},req); return { ok: true, status: 'queued' }; });
app.delete('/account', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; await query('delete from app_users where id=$1', [u.id]); return { ok: true }; });
app.post('/ai/summarize', { preHandler: app.authenticate }, async (req: any) => { const b = z.object({ target: z.any() }).parse(req.body); const summary = JSON.stringify(b.target).slice(0, 500); return { summary: 'AI summary placeholder from configured backend. Connect an LLM provider to replace this deterministic summary. Input: ' + summary }; });
app.post('/content/catalog/updates', { preHandler: app.authenticate }, async (req) => ({ updates: [], checkedAt: new Date().toISOString(), installed: (req.body as any)?.installed || {} }));
app.get('/admin/dashboard', { preHandler: app.requireAdmin }, async () => { const users = await query<{ count: string }>('select count(*) from app_users'); const imports = await query<{ count: string }>('select count(*) from import_jobs'); const audits = await query<{ count: string }>('select count(*) from audit_events'); return { users: Number(users.rows[0].count), importJobs: Number(imports.rows[0].count), auditEvents: Number(audits.rows[0].count) }; });
app.get('/admin/overview', { preHandler: app.requireAdmin }, async () => app.inject({ method: 'GET', url: '/admin/dashboard' }).then(r => JSON.parse(r.body)));
app.post('/audit', { preHandler: app.authenticate }, async (req: any) => { const u = req.user as AuthUser; const b = z.object({ action: z.string().min(1), details: z.record(z.any()).default({}) }).parse(req.body); await audit(u.id,b.action,b.details,req); return { ok: true }; });

app.setErrorHandler((err, req, reply) => { app.log.error({ err }, 'request failed'); reply.status((err as any).statusCode || 400).send({ error: err.message || 'Request failed' }); });
app.listen({ port: PORT, host: '0.0.0.0' });
