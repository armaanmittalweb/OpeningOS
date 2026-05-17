-- OpeningOS complete SaaS extension migration.
-- Run after 001_init.sql. This migration adds production auth, real-time sync,
-- coach workspaces, share links, imports, engine jobs, billing, notifications,
-- and professional content tables.

create extension if not exists pgcrypto;

alter table app_users add column if not exists password_hash text;
alter table app_users add column if not exists email_verified_at timestamptz;
alter table app_users add column if not exists recovery_email text;
alter table app_users add column if not exists disabled_at timestamptz;
alter table app_users add column if not exists roles text[] not null default '{}';
alter table app_users add column if not exists locale text not null default 'en';
alter table app_users add column if not exists last_login_at timestamptz;

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  refresh_token_hash text not null unique,
  user_agent text,
  ip inet,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists auth_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth_oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text,
  access_token_enc text,
  refresh_token_enc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_user_id)
);

create table if not exists auth_oauth_states (
  state text primary key,
  provider text not null,
  code_verifier text,
  redirect_to text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists auth_passkeys (
  id text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists auth_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  email text,
  kind text not null check(kind in ('registration','authentication')),
  challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists sync_ops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  client_id text not null,
  op_id text not null,
  base_version integer not null default 0,
  entity_type text not null,
  entity_id text not null,
  op_type text not null,
  patch jsonb not null default '{}'::jsonb,
  lamport integer not null default 0,
  server_version integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, profile_id, client_id, op_id)
);

create table if not exists sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  entity_type text not null,
  entity_id text not null,
  local_patch jsonb not null,
  server_value jsonb not null,
  resolution text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists coach_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists coach_workspace_members (
  workspace_id uuid not null references coach_workspaces(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null check(role in ('owner','coach','assistant','student','viewer')),
  permissions jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(workspace_id, user_id)
);

alter table coach_invitations add column if not exists workspace_id uuid references coach_workspaces(id) on delete cascade;
alter table coach_invitations add column if not exists expires_at timestamptz;

create table if not exists position_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references coach_workspaces(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  created_by uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists position_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references position_threads(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  body text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assignment_progress (
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_user_id uuid not null references app_users(id) on delete cascade,
  completed_cards integer not null default 0,
  total_cards integer not null default 0,
  accuracy numeric not null default 0,
  last_review_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  primary key(assignment_id, student_user_id)
);

alter table share_links add column if not exists permission text not null default 'read';
alter table share_links add column if not exists revoked_at timestamptz;
alter table share_links add column if not exists password_hash text;
alter table share_links add column if not exists payload jsonb not null default '{}'::jsonb;

create table if not exists share_access_logs (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid references share_links(id) on delete cascade,
  actor_user_id uuid references app_users(id) on delete set null,
  action text not null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists team_libraries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references coach_workspaces(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'workspace',
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists team_library_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references team_libraries(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table import_jobs add column if not exists priority integer not null default 5;
alter table import_jobs add column if not exists locked_at timestamptz;
alter table import_jobs add column if not exists locked_by text;
alter table import_jobs add column if not exists attempts integer not null default 0;

create table if not exists analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null check(kind in ('engine','opening-explorer','novelty','repertoire-quality')),
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  priority integer not null default 5,
  attempts integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists professional_courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  author text not null,
  reviewer text,
  status text not null default 'draft',
  version integer not null default 1,
  source_attribution text,
  metadata jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references professional_courses(id) on delete cascade,
  version integer not null,
  changelog text,
  payload jsonb not null default '{}'::jsonb,
  qa_status text not null default 'pending',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(course_id, version)
);

create table if not exists course_qa_checks (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references course_versions(id) on delete cascade,
  check_name text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  channel text not null default 'in_app',
  template text not null,
  subject text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_subscription_id text unique,
  price_id text,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references app_users(id) on delete set null,
  action text not null,
  target_kind text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user on auth_sessions(user_id, expires_at desc);
create index if not exists idx_sync_ops_user_profile_version on sync_ops(user_id, profile_id, server_version desc);
create index if not exists idx_workspace_members_user on coach_workspace_members(user_id, revoked_at);
create index if not exists idx_position_comments_thread on position_comments(thread_id, created_at);
create index if not exists idx_share_links_token on share_links(token) where revoked_at is null;
create index if not exists idx_analysis_jobs_status on analysis_jobs(status, priority, created_at);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_billing_subscriptions_user on billing_subscriptions(user_id, status);

alter table auth_sessions enable row level security;
alter table auth_password_resets enable row level security;
alter table auth_recovery_codes enable row level security;
alter table auth_oauth_accounts enable row level security;
alter table auth_passkeys enable row level security;
alter table sync_ops enable row level security;
alter table sync_conflicts enable row level security;
alter table coach_workspaces enable row level security;
alter table coach_workspace_members enable row level security;
alter table position_threads enable row level security;
alter table position_comments enable row level security;
alter table assignment_progress enable row level security;
alter table share_access_logs enable row level security;
alter table team_libraries enable row level security;
alter table team_library_items enable row level security;
alter table analysis_jobs enable row level security;
alter table notifications enable row level security;
alter table billing_subscriptions enable row level security;

-- Owner policies for tables with user_id. Workspace permissions are enforced by API.
do $$
declare tbl text;
begin
  foreach tbl in array array['auth_sessions','auth_password_resets','auth_recovery_codes','auth_oauth_accounts','auth_passkeys','sync_ops','sync_conflicts','analysis_jobs','notifications','billing_subscriptions'] loop
    execute format('drop policy if exists own_rows on %I', tbl);
    execute format('create policy own_rows on %I using (user_id::text = current_setting(''app.current_user_id'', true)) with check (user_id::text = current_setting(''app.current_user_id'', true))', tbl);
  end loop;
end $$;
