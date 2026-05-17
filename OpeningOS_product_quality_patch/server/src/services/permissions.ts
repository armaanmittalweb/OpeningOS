import { query } from '../db.js';

export type Permission = 'owner' | 'coach' | 'student' | 'viewer' | 'editor' | 'admin';

export async function isAdmin(userId: string): Promise<boolean> {
  const r = await query<{ role: string }>('select coalesce(role,\'user\') as role from app_users where id=$1', [userId]);
  return r.rows[0]?.role === 'admin';
}

export async function requireWorkspacePermission(userId: string, workspaceId: string, roles: Permission[]) {
  if (await isAdmin(userId)) return true;
  const r = await query<{ role: Permission }>('select role from workspace_members where user_id=$1 and workspace_id=$2 and revoked_at is null', [userId, workspaceId]);
  if (!r.rows[0] || !roles.includes(r.rows[0].role)) {
    const err: any = new Error('Permission denied');
    err.statusCode = 403;
    throw err;
  }
  return true;
}

export async function canReadShare(userId: string | null, token: string) {
  const r = await query('select * from share_links where token=$1 and revoked_at is null and (expires_at is null or expires_at > now())', [token]);
  const share = r.rows[0] as any;
  if (!share) return null;
  if (share.visibility === 'public' || share.visibility === 'unlisted') return share;
  if (userId && userId === share.user_id) return share;
  return null;
}
