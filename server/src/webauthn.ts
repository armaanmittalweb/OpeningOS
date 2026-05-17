import { query } from './db.js';

const rpName = process.env.WEBAUTHN_RP_NAME || 'OpeningOS';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:4173';

export async function beginPasskeyRegistration(userId: string, email: string) {
  const mod: any = await import('@simplewebauthn/server');
  const existing = await query<{ id: string; transports: string[] }>('select id, transports from auth_passkeys where user_id=$1', [userId]);
  const options = await mod.generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
    userName: email,
    attestationType: 'none',
    excludeCredentials: existing.rows.map(r => ({ id: r.id, transports: r.transports || [] })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await query('insert into auth_webauthn_challenges(user_id, kind, challenge, expires_at) values($1,$2,$3,now() + interval \'10 minutes\')', [userId, 'registration', options.challenge]);
  return options;
}

export async function finishPasskeyRegistration(userId: string, body: any) {
  const mod: any = await import('@simplewebauthn/server');
  const row = await query<{ challenge: string }>('select challenge from auth_webauthn_challenges where user_id=$1 and kind=$2 and expires_at > now() order by created_at desc limit 1', [userId, 'registration']);
  if (!row.rows[0]) throw new Error('Registration challenge expired.');
  const verification = await mod.verifyRegistrationResponse({ response: body, expectedChallenge: row.rows[0].challenge, expectedOrigin: origin, expectedRPID: rpID });
  if (!verification.verified) throw new Error('Passkey registration failed.');
  const info = verification.registrationInfo;
  await query('insert into auth_passkeys(id, user_id, public_key, counter, transports, label) values($1,$2,$3,$4,$5,$6) on conflict(id) do update set public_key=excluded.public_key, counter=excluded.counter', [info.credentialID, userId, Buffer.from(info.credentialPublicKey).toString('base64url'), info.counter || 0, body.response?.transports || [], body.label || 'Passkey']);
  return { verified: true };
}

export async function beginPasskeyAuthentication(email?: string) {
  const mod: any = await import('@simplewebauthn/server');
  let user: any = null;
  let credentials: any[] = [];
  if (email) {
    const u = await query<{ id: string; email: string }>('select id, email from app_users where lower(email)=lower($1)', [email]);
    user = u.rows[0];
    if (user) credentials = (await query('select id, transports from auth_passkeys where user_id=$1', [user.id])).rows;
  }
  const options = await mod.generateAuthenticationOptions({ rpID, userVerification: 'preferred', allowCredentials: credentials.map((c: any) => ({ id: c.id, transports: c.transports || [] })) });
  await query('insert into auth_webauthn_challenges(user_id, email, kind, challenge, expires_at) values($1,$2,$3,$4,now() + interval \'10 minutes\')', [user?.id || null, email || null, 'authentication', options.challenge]);
  return options;
}

export async function finishPasskeyAuthentication(body: any) {
  const mod: any = await import('@simplewebauthn/server');
  const credentialId = body.id;
  const passkey = await query<{ id: string; user_id: string; public_key: string; counter: number; transports: string[] }>('select * from auth_passkeys where id=$1', [credentialId]);
  if (!passkey.rows[0]) throw new Error('Passkey not found.');
  const pk = passkey.rows[0];
  const challenge = await query<{ challenge: string }>('select challenge from auth_webauthn_challenges where (user_id=$1 or user_id is null) and kind=$2 and expires_at > now() order by created_at desc limit 1', [pk.user_id, 'authentication']);
  if (!challenge.rows[0]) throw new Error('Authentication challenge expired.');
  const verification = await mod.verifyAuthenticationResponse({
    response: body,
    expectedChallenge: challenge.rows[0].challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: pk.id,
      credentialPublicKey: Buffer.from(pk.public_key, 'base64url'),
      counter: Number(pk.counter || 0),
      transports: pk.transports || [],
    },
  });
  if (!verification.verified) throw new Error('Passkey authentication failed.');
  await query('update auth_passkeys set counter=$2, last_used_at=now() where id=$1', [pk.id, verification.authenticationInfo.newCounter || pk.counter]);
  const user = await query<{ id: string; email: string }>('select id, email from app_users where id=$1', [pk.user_id]);
  return user.rows[0];
}
