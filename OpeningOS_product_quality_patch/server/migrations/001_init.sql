create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_passwords (
  user_id uuid primary key references app_users(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  refresh_token_hash text not null unique,
  user_agent text,
  ip text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists recovery_codes (
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
  provider_subject text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_subject)
);
create table if not exists webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  challenge text not null,
  purpose text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  credential_id text not null,
  public_key text not null,
  counter integer not null default 0,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique(user_id, credential_id)
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  role text not null default 'player',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists repertoires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  name text not null,
  color text not null check (color in ('w','b')),
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  fen_key text not null,
  fen text not null,
  side_to_move text not null check (side_to_move in ('w','b')),
  critical boolean not null default false,
  lifecycle text not null default 'active',
  source_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, fen_key)
);
create table if not exists move_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  from_position_id uuid not null references positions(id) on delete cascade,
  to_position_id uuid not null references positions(id) on delete cascade,
  san text not null,
  uci text,
  comment text,
  lifecycle text not null default 'active',
  source_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, from_position_id, uci, to_position_id)
);
create table if not exists line_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  repertoire_id uuid references repertoires(id) on delete set null,
  name text not null,
  color text not null check (color in ('w','b')),
  lifecycle text not null default 'active',
  branch_of uuid references line_paths(id) on delete set null,
  branch_from_ply integer,
  node_ids uuid[] not null default '{}',
  edge_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists graph_snapshots (
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  version integer not null default 1,
  graph jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(user_id, profile_id)
);
create table if not exists practice_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  line_path_id uuid references line_paths(id) on delete cascade,
  position_id uuid not null references positions(id) on delete cascade,
  expected_edge_id uuid references move_edges(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  srs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, line_path_id, position_id, expected_edge_id)
);
create table if not exists annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  target_kind text not null check (target_kind in ('position','edge','line','game','assignment','share')),
  target_id text not null,
  kind text not null default 'note',
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  practice_card_id uuid,
  line_path_id uuid,
  grade integer not null check (grade between 1 and 4),
  duration_ms integer not null default 0,
  guessed boolean not null default false,
  hinted boolean not null default false,
  outcome text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  source text not null default 'pgn',
  pgn text not null,
  headers jsonb not null default '{}'::jsonb,
  matched_line_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists deviations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  line_path_id uuid references line_paths(id) on delete set null,
  ply integer not null,
  kind text not null,
  played text,
  expected text,
  fen_before text,
  relevance text,
  ignored boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists sync_snapshots (
  user_id uuid not null references app_users(id) on delete cascade,
  profile_id text not null,
  version integer not null default 1,
  payload jsonb not null,
  client_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id, profile_id)
);
create table if not exists sync_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  entity_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  client_updated_at timestamptz,
  device_id text,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists coach_invitations (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references app_users(id) on delete cascade,
  student_email text not null,
  role text not null default 'student',
  token text unique not null,
  accepted_by uuid references app_users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create table if not exists coach_relationships (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references app_users(id) on delete cascade,
  student_user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'student',
  status text not null default 'active',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(coach_user_id, student_user_id)
);
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references app_users(id) on delete cascade,
  student_user_id uuid references app_users(id) on delete cascade,
  line_path_id uuid references line_paths(id) on delete set null,
  due_at timestamptz,
  mode text,
  message text,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists assignment_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  progress numeric not null default 0,
  status text not null default 'in-progress',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists position_comments (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references app_users(id) on delete cascade,
  student_user_id uuid references app_users(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  body text not null,
  visibility text not null default 'coach-student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  scope text not null,
  target_id text not null,
  visibility text not null default 'private',
  permission text not null default 'read',
  title text,
  token text unique not null default encode(gen_random_bytes(18), 'hex'),
  expires_at timestamptz,
  revoked_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists share_access_logs (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references share_links(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create table if not exists team_libraries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  visibility text not null default 'team',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_library_id uuid not null references team_libraries(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(team_library_id, user_id)
);

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  source text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null default 'position',
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_customers (
  user_id uuid primary key references app_users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  plan text not null default 'free',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  reason text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued',
  provider_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_positions_user_fen on positions(user_id, fen_key);
create index if not exists idx_edges_user_from on move_edges(user_id, from_position_id);
create index if not exists idx_line_paths_user on line_paths(user_id, updated_at desc);
create index if not exists idx_review_events_user_created on review_events(user_id, created_at desc);
create index if not exists idx_games_user_created on games(user_id, created_at desc);
create index if not exists idx_import_jobs_user_created on import_jobs(user_id, created_at desc);
create index if not exists idx_analysis_jobs_user_created on analysis_jobs(user_id, created_at desc);
create index if not exists idx_deviations_user_game on deviations(user_id, game_id);
create index if not exists idx_audit_user_created on audit_events(user_id, created_at desc);
create index if not exists idx_sync_changes_user_created on sync_changes(user_id, created_at asc);

alter table app_users enable row level security;
alter table profiles enable row level security;
alter table repertoires enable row level security;
alter table positions enable row level security;
alter table move_edges enable row level security;
alter table line_paths enable row level security;
alter table graph_snapshots enable row level security;
alter table practice_cards enable row level security;
alter table annotations enable row level security;
alter table review_events enable row level security;
alter table games enable row level security;
alter table deviations enable row level security;
alter table sync_snapshots enable row level security;
alter table sync_changes enable row level security;
alter table coach_invitations enable row level security;
alter table coach_relationships enable row level security;
alter table assignments enable row level security;
alter table assignment_progress enable row level security;
alter table position_comments enable row level security;
alter table share_links enable row level security;
alter table share_access_logs enable row level security;
alter table team_libraries enable row level security;
alter table team_members enable row level security;
alter table import_jobs enable row level security;
alter table analysis_jobs enable row level security;
alter table billing_customers enable row level security;
alter table account_deletion_requests enable row level security;
alter table audit_events enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','repertoires','positions','move_edges','line_paths','graph_snapshots','practice_cards','annotations','review_events','games','import_jobs','analysis_jobs','deviations','share_links','sync_snapshots','sync_changes','audit_events','billing_customers','account_deletion_requests'] loop
    execute format('drop policy if exists own_rows on %I', tbl);
    execute format('create policy own_rows on %I using (user_id::text = current_setting(''app.current_user_id'', true)) with check (user_id::text = current_setting(''app.current_user_id'', true))', tbl);
  end loop;
end $$;
