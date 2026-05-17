-- OpeningOS SaaS completion migration. Run after 001_init.sql.
create extension if not exists pgcrypto;

alter table app_users add column if not exists password_hash text;
alter table app_users add column if not exists deleted_at timestamptz;
alter table app_users add column if not exists last_login_at timestamptz;

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  refresh_token_hash text not null unique,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
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
  state text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  label text,
  sign_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  challenge text not null unique,
  purpose text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  client_version integer not null,
  server_version integer not null,
  client_payload jsonb not null default '{}'::jsonb,
  server_payload jsonb not null default '{}'::jsonb,
  merged_payload jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sync_change_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  client_id text not null,
  base_version integer not null,
  server_version integer not null,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists graph_snapshots (
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  version integer not null default 1,
  graph jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(user_id, profile_id)
);

alter table assignments add column if not exists payload jsonb not null default '{}'::jsonb;
alter table assignments add column if not exists progress integer not null default 0;
alter table assignments add column if not exists updated_at timestamptz not null default now();

create table if not exists coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references app_users(id) on delete cascade,
  student_user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'student',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(coach_user_id, student_user_id)
);

create table if not exists position_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  body text not null,
  visibility text not null default 'coach-student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table share_links add column if not exists payload jsonb not null default '{}'::jsonb;
alter table share_links add column if not exists permissions jsonb not null default '{"read":true,"clone":true,"edit":false}'::jsonb;
alter table share_links add column if not exists title text;
alter table share_links add column if not exists revoked_at timestamptz;

create table if not exists share_access_logs (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references share_links(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  ip_address text,
  user_agent text,
  action text not null default 'view',
  created_at timestamptz not null default now()
);

create table if not exists shared_clones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  share_id uuid references share_links(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists team_libraries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  visibility text not null default 'team',
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_library_id uuid not null references team_libraries(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(team_library_id, user_id)
);

create table if not exists analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null default 'position',
  payload jsonb not null default '{}'::jsonb,
  depth integer not null default 12,
  status text not null default 'queued',
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  text_body text not null,
  kind text not null default 'transactional',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists professional_courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  author text not null,
  reviewer text,
  level text not null default 'club',
  source_attribution text,
  version integer not null default 1,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  graph jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references professional_courses(id) on delete cascade,
  version integer not null,
  changelog text,
  graph jsonb not null default '{}'::jsonb,
  qa_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique(course_id, version)
);

create index if not exists idx_sessions_user on user_sessions(user_id, expires_at desc);
create index if not exists idx_reset_tokens_hash on password_reset_tokens(token_hash);
create index if not exists idx_sync_conflicts_user on sync_conflicts(user_id, created_at desc);
create index if not exists idx_sync_batches_user_profile on sync_change_batches(user_id, profile_id, created_at desc);
create index if not exists idx_graph_snapshots_user_profile on graph_snapshots(user_id, profile_id);
create index if not exists idx_coach_links_coach on coach_links(coach_user_id, status);
create index if not exists idx_coach_links_student on coach_links(student_user_id, status);
create index if not exists idx_comments_target on position_comments(target_kind, target_id, created_at desc);
create index if not exists idx_notifications_user on notifications(user_id, created_at desc);
create index if not exists idx_share_logs_share on share_access_logs(share_id, created_at desc);
create index if not exists idx_analysis_jobs_user_status on analysis_jobs(user_id, status, created_at desc);
create index if not exists idx_email_outbox_status on email_outbox(status, created_at);

alter table user_sessions enable row level security;
alter table password_reset_tokens enable row level security;
alter table recovery_codes enable row level security;
alter table oauth_accounts enable row level security;
alter table passkeys enable row level security;
alter table sync_conflicts enable row level security;
alter table sync_change_batches enable row level security;
alter table graph_snapshots enable row level security;
alter table coach_links enable row level security;
alter table position_comments enable row level security;
alter table notifications enable row level security;
alter table share_access_logs enable row level security;
alter table shared_clones enable row level security;
alter table team_libraries enable row level security;
alter table team_memberships enable row level security;
alter table analysis_jobs enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['user_sessions','password_reset_tokens','recovery_codes','oauth_accounts','passkeys','sync_conflicts','sync_change_batches','graph_snapshots','position_comments','notifications','shared_clones','analysis_jobs'] loop
    execute format('drop policy if exists own_rows on %I', tbl);
    execute format('create policy own_rows on %I using (user_id::text = current_setting(''app.current_user_id'', true)) with check (user_id::text = current_setting(''app.current_user_id'', true))', tbl);
  end loop;
end $$;

-- Coach links, shares, teams and public share access are enforced in API code
-- because access depends on relationship or token rather than simple ownership.
