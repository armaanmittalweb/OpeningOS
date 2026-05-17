create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  retired boolean not null default false,
  source_refs jsonb not null default '[]'::jsonb,
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
  source_refs jsonb not null default '[]'::jsonb,
  retired boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, from_position_id, san, to_position_id)
);

create table if not exists line_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  repertoire_id uuid references repertoires(id) on delete set null,
  name text not null,
  color text not null check (color in ('w','b')),
  status text not null default 'active',
  branch_of uuid references line_paths(id) on delete set null,
  branch_from_ply integer,
  node_ids uuid[] not null default '{}',
  edge_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  target_kind text not null check (target_kind in ('position','edge','line','game')),
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

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references app_users(id) on delete cascade,
  student_user_id uuid references app_users(id) on delete cascade,
  line_path_id uuid references line_paths(id) on delete set null,
  due_at timestamptz,
  mode text,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists coach_invitations (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references app_users(id) on delete cascade,
  student_email text not null,
  role text not null default 'student',
  token text unique not null,
  accepted_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  scope text not null,
  target_id text not null,
  visibility text not null default 'private',
  token text unique not null default encode(gen_random_bytes(18), 'hex'),
  expires_at timestamptz,
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

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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

create index if not exists idx_positions_user_fen on positions(user_id, fen_key);
create index if not exists idx_edges_user_from on move_edges(user_id, from_position_id);
create index if not exists idx_review_events_user_created on review_events(user_id, created_at desc);
create index if not exists idx_games_user_created on games(user_id, created_at desc);
create index if not exists idx_import_jobs_user_created on import_jobs(user_id, created_at desc);
create index if not exists idx_deviations_user_game on deviations(user_id, game_id);
create index if not exists idx_audit_user_created on audit_events(user_id, created_at desc);

alter table app_users enable row level security;
alter table profiles enable row level security;
alter table repertoires enable row level security;
alter table positions enable row level security;
alter table move_edges enable row level security;
alter table line_paths enable row level security;
alter table practice_cards enable row level security;
alter table annotations enable row level security;
alter table review_events enable row level security;
alter table games enable row level security;
alter table deviations enable row level security;
alter table assignments enable row level security;
alter table share_links enable row level security;
alter table sync_snapshots enable row level security;
alter table audit_events enable row level security;

-- RLS policies are designed for PostgREST/Supabase-style deployments where
-- app.current_user_id is set by the API layer.
do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','repertoires','positions','move_edges','line_paths','practice_cards','annotations','review_events','games','import_jobs','deviations','share_links','sync_snapshots','audit_events'] loop
    execute format('drop policy if exists own_rows on %I', tbl);
    execute format('create policy own_rows on %I using (user_id::text = current_setting(''app.current_user_id'', true)) with check (user_id::text = current_setting(''app.current_user_id'', true))', tbl);
  end loop;
end $$;
