-- OpeningOS production SaaS extension: auth, sync, workspaces, shares, jobs,
-- billing, professional content, audit, observability. Safe to run after 001_init.sql.
create extension if not exists pgcrypto;

alter table app_users add column if not exists password_hash text;
alter table app_users add column if not exists role text not null default 'user';
alter table app_users add column if not exists email_verified_at timestamptz;
alter table app_users add column if not exists deleted_at timestamptz;

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  refresh_token_hash text not null,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_sessions_user on user_sessions(user_id, revoked_at, expires_at);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_reset_hash on password_reset_tokens(token_hash);

create table if not exists account_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, code_hash)
);

create table if not exists oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_user_id)
);
create table if not exists oauth_states (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  state text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  credential_id text unique not null,
  public_key text not null,
  sign_count bigint not null default 0,
  transports text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table if not exists webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  challenge text not null,
  kind text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  kind text not null default 'coach',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null check(role in ('owner','coach','assistant','student','viewer','editor','admin')),
  privacy jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(workspace_id, user_id)
);
create index if not exists idx_workspace_members_user on workspace_members(user_id, revoked_at);

alter table coach_invitations add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table coach_invitations add column if not exists expires_at timestamptz;
alter table assignments add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table assignments add column if not exists title text not null default 'Opening assignment';

create table if not exists comment_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  body text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_comments_target on comment_threads(workspace_id, target_kind, target_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sync_objects (
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  object_type text not null,
  object_id text not null,
  payload jsonb not null default '{}'::jsonb,
  server_revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(user_id, profile_id, object_type, object_id)
);
create table if not exists sync_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  object_type text not null,
  object_id text not null,
  op text not null check(op in ('put','patch','delete')),
  payload jsonb not null default '{}'::jsonb,
  server_revision bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sync_changes_user_rev on sync_changes(user_id, profile_id, server_revision);

create table if not exists analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null,
  status text not null default 'queued',
  priority integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_analysis_jobs_status on analysis_jobs(status, priority, created_at);

create table if not exists engine_cache (
  fen_key text primary key,
  depth integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  source text not null default 'stockfish',
  updated_at timestamptz not null default now()
);

alter table share_links add column if not exists permission text not null default 'read';
alter table share_links add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table share_links add column if not exists revoked_at timestamptz;
create table if not exists share_access_logs (
  id uuid primary key default gen_random_uuid(),
  share_id uuid references share_links(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  ip_address text,
  user_agent text,
  accessed_at timestamptz not null default now()
);

create table if not exists course_libraries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references app_users(id) on delete set null,
  title text not null,
  visibility text not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references course_libraries(id) on delete cascade,
  version text not null,
  pgn text,
  graph_payload jsonb not null default '{}'::jsonb,
  source_attribution jsonb not null default '[]'::jsonb,
  reviewer text,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(course_id, version)
);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table audit_events add column if not exists ip_address text;
alter table audit_events add column if not exists user_agent text;

-- RLS/permission tables
alter table user_sessions enable row level security;
alter table password_reset_tokens enable row level security;
alter table account_recovery_codes enable row level security;
alter table oauth_accounts enable row level security;
alter table passkeys enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table comment_threads enable row level security;
alter table notifications enable row level security;
alter table sync_objects enable row level security;
alter table sync_changes enable row level security;
alter table analysis_jobs enable row level security;
alter table course_libraries enable row level security;
alter table course_versions enable row level security;
alter table share_access_logs enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['user_sessions','password_reset_tokens','account_recovery_codes','oauth_accounts','passkeys','notifications','sync_objects','sync_changes','analysis_jobs'] loop
    execute format('drop policy if exists own_rows on %I', tbl);
    execute format('create policy own_rows on %I using (user_id::text = current_setting(''app.current_user_id'', true)) with check (user_id::text = current_setting(''app.current_user_id'', true))', tbl);
  end loop;
end $$;
