import { query } from './db.js';

export type WorkspaceRole = 'owner' | 'coach' | 'assistant' | 'student' | 'viewer';
const roleRank: Record<WorkspaceRole, number> = { owner: 5, coach: 4, assistant: 3, student: 2, viewer: 1 };

export async function requireWorkspaceRole(userId: string, workspaceId: string, minRole: WorkspaceRole): Promise<void> {
  const res = await query<{ role: WorkspaceRole }>('select role from coach_workspace_members where workspace_id=$1 and user_id=$2 and revoked_at is null', [workspaceId, userId]);
  const role = res.rows[0]?.role;
  if (!role || roleRank[role] < roleRank[minRole]) throw new Error('Workspace permission denied');
}

export async function canReadShare(token: string): Promise<boolean> {
  const res = await query('select id from share_links where token=$1 and revoked_at is null and (expires_at is null or expires_at > now())', [token]);
  return !!res.rows[0];
}
