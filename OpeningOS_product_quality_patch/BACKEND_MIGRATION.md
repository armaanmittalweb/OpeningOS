# OpeningOS — Backend Migration Plan

This document is for going from the current **local-first product alpha** to a
**production multi-user product**. It is opinionated but the choices are
swappable.

The current build is a working client-only local-first app. This guide tells you exactly
what to add to make it durable, multi-device, and safe.

---

## Architecture target

```
┌──────────────────────┐        ┌──────────────────────┐
│   Next.js (TS)       │  HTTPS │   Supabase           │
│   - React 18         │ ─────▶ │   - Postgres         │
│   - App Router       │        │   - Auth (email/OAuth│
│   - Server actions   │        │   - Row-Level Sec.   │
│   - PWA (service wkr)│        │   - Storage          │
│   - IndexedDB cache  │        │   - Edge functions   │
└──────────────────────┘        └──────────────────────┘
            │                            │
            └─── chess.js (legality) ────┘
```

Why these choices:

- **Next.js + TypeScript + React** — file-system routing, server actions, RSC,
  static export when you want it. The app is large enough to benefit from
  components and types. `chess.js` is plain JS so types come from
  `@chess-fu/types` or your own declarations.
- **Supabase** — Postgres + auth + RLS + storage in one. You can replace it
  later with custom Node + Postgres without changing the schema.
- **IndexedDB on the client** — keep the local-first behaviour you have today;
  the server is the durable store, the client is the working copy.
- **chess.js stays** — same library, runs in both client and server. Single
  source of truth for legality.

---

## Postgres schema (DDL)

This mirrors the current data model. Drop into `supabase/migrations/0001_init.sql`.

```sql
-- One Supabase auth user can own many profiles (player / coach / student).
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  role          text not null default 'player'
                check (role in ('player','coach','student')),
  color         text not null default '#91b89f',
  initials      text generated always as (upper(substr(name,1,2))) stored,
  created_at    timestamptz not null default now()
);
create index profiles_user_id_idx on profiles (user_id);

-- A repertoire is a top-level folder ("White repertoire", "Black vs 1.e4", …)
create table repertoires (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  name          text not null,
  color         text not null check (color in ('w','b')),
  parent_id     uuid references repertoires(id) on delete cascade,
  position      integer not null default 0
);

-- A line is an ordered sequence of half-moves under a repertoire folder.
create table lines (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  repertoire_id uuid not null references repertoires(id) on delete cascade,
  name          text not null,
  eco           text,
  opening       text,
  color         text not null check (color in ('w','b')),
  tag           text default 'nice-to-know',
  description   text default '',
  source        text default 'manual'
                check (source in ('manual','pgn','lichess','chesscom','library','coach')),
  moves         text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A position is a normalized FEN. Globally shared across users to enable
-- transposition lookup and opening explorer linking.
create table positions (
  id            uuid primary key default gen_random_uuid(),
  fen_norm      text unique not null,             -- piece-placement+side+castle+ep
  ply           integer
);

-- A move-edge is "from this position, this SAN takes you to that position".
create table move_edges (
  from_position uuid not null references positions(id),
  san           text not null,
  to_position   uuid not null references positions(id),
  primary key (from_position, san)
);

-- A practice card pairs a (line, ply) with an SRS state, scoped to a profile.
create table practice_cards (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  line_id         uuid not null references lines(id) on delete cascade,
  ply             integer not null,
  fen_before      text not null,
  fen_norm_before text not null,
  fen_after       text not null,
  san             text not null,
  alternates      text[] not null default '{}',
  confusing       boolean not null default false,
  -- SRS fields (FSRS-compatible)
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  due_at          timestamptz not null default now(),
  last_reviewed   timestamptz,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  miss_rate       double precision not null default 0,
  unique (profile_id, line_id, ply)
);
create index practice_cards_due_idx
  on practice_cards (profile_id, due_at);

-- Every grade event is logged so we can replay or change schedulers.
create table review_events (
  id              uuid primary key default gen_random_uuid(),
  card_id         uuid not null references practice_cards(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  grade           integer not null check (grade between 1 and 4),
  hint_used       boolean not null default false,
  attempted_san   text,
  duration_ms     integer,
  reviewed_at     timestamptz not null default now()
);

-- Free-form notes attached to a card.
create table notes (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references practice_cards(id) on delete cascade,
  type        text not null default 'idea'
              check (type in ('idea','warning','memory','plan','tactical','coach')),
  text        text not null default '',
  tags        text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Note version history.
create table note_versions (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references notes(id) on delete cascade,
  text        text not null,
  type        text,
  created_at  timestamptz not null default now()
);

-- Imported games.
create table games (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  source        text not null check (source in ('lichess','chesscom','pgn','manual')),
  vs            text,
  vs_rating     integer,
  your_color    text not null check (your_color in ('w','b')),
  result        text not null check (result in ('w','l','d','*')),
  time_control  text,
  played_at     timestamptz,
  pgn           text not null,
  matched_line  uuid references lines(id) on delete set null,
  status        text not null default 'unmatched'
                check (status in ('unmatched','matched','ignored')),
  created_at    timestamptz not null default now()
);
create index games_profile_idx on games (profile_id, created_at desc);

-- A deviation is a moment in a game where the user (or opponent) left prep.
create table deviations (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  ply           integer not null,
  side          text not null,
  played_san    text not null,
  expected_san  text,
  is_user       boolean not null,
  fixed_card_id uuid references practice_cards(id)
);

-- Coach <-> Student relationships.
create table coach_students (
  coach_profile   uuid not null references profiles(id) on delete cascade,
  student_profile uuid not null references profiles(id) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending','active','revoked')),
  created_at      timestamptz not null default now(),
  primary key (coach_profile, student_profile)
);

-- Assignments. A coach can target one of their students with a line + due date.
create table assignments (
  id              uuid primary key default gen_random_uuid(),
  coach_profile   uuid not null references profiles(id) on delete cascade,
  student_profile uuid not null references profiles(id) on delete cascade,
  line_id         uuid not null references lines(id) on delete cascade,
  mode            text not null default 'Daily',
  due             text,
  message         text,
  status          text not null default 'pending'
                  check (status in ('pending','done','expired')),
  progress        double precision not null default 0,
  created_at      timestamptz not null default now()
);

-- Saved opponent reports for opponent prep.
create table opponent_reports (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  name          text not null,
  source        text,
  total_games   integer,
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

-- Track import jobs so the UI can show progress.
create table imports (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  source        text not null,
  status        text not null default 'queued'
                check (status in ('queued','running','done','failed')),
  total_games   integer default 0,
  parsed_games  integer default 0,
  error         text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
```

---

## Row Level Security

Apply this to **every** table that stores user data:

```sql
alter table profiles enable row level security;
alter table repertoires enable row level security;
alter table lines enable row level security;
alter table practice_cards enable row level security;
alter table review_events enable row level security;
alter table notes enable row level security;
alter table note_versions enable row level security;
alter table games enable row level security;
alter table deviations enable row level security;
alter table coach_students enable row level security;
alter table assignments enable row level security;
alter table opponent_reports enable row level security;
alter table imports enable row level security;

-- Helper: which profile_ids does the current auth user own?
create or replace function user_profile_ids() returns setof uuid
language sql stable security definer as $$
  select id from profiles where user_id = auth.uid()
$$;

-- Profile-scoped policies
create policy "own profiles, full"  on profiles
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own data, full"      on lines
  using (profile_id in (select user_profile_ids()))
  with check (profile_id in (select user_profile_ids()));

-- Repeat the same pattern for every table whose row references profile_id.

-- Coach can read their student's lines + cards (read-only).
create policy "coach can read student lines" on lines for select using (
  profile_id in (
    select student_profile from coach_students
    where coach_profile in (select user_profile_ids())
      and status = 'active'
  )
);
```

This protects private repertoires at the database layer. Even a buggy
client query cannot read another user's data because Postgres rejects it.

---

## TypeScript domain layer

Mirror the JS data model with strict types. Drop into `lib/types.ts`:

```ts
export type Color = 'w' | 'b';
export type CardKind = 'correct' | 'correct-alt' | 'correct-transposition' | 'wrong';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  role: 'player' | 'coach' | 'student';
  color: string;
  initials: string;
}

export interface Line {
  id: string;
  profile_id: string;
  repertoire_id: string;
  name: string;
  eco: string | null;
  color: Color;
  tag: 'must-know' | 'nice-to-know' | 'surprise' | 'avoid' | 'investigate' | 'coach' | 'tournament';
  moves: string[];
  source: 'manual' | 'pgn' | 'lichess' | 'chesscom' | 'library' | 'coach';
}

export interface PracticeCard {
  id: string;
  line_id: string;
  ply: number;
  fen_before: string;
  fen_norm_before: string;
  fen_after: string;
  san: string;
  alternates: string[];
  confusing: boolean;
  stability: number;
  difficulty: number;
  due_at: string;
  reps: number;
  lapses: number;
}

export interface ReviewEvent {
  card_id: string;
  grade: 1 | 2 | 3 | 4;
  hint_used: boolean;
  attempted_san: string | null;
  duration_ms: number | null;
}
```

Generate the rest with `supabase gen types typescript > lib/database.types.ts`.

---

## Sync strategy: local-first, server-of-record

Keep the existing local UX. Add a sync layer.

```ts
// lib/sync.ts
import { createClient } from '@supabase/supabase-js';
import { db } from './idb';   // dexie / idb-keyval for IndexedDB

const supabase = createClient(URL, ANON_KEY);

// Outbound: any local mutation is queued and flushed.
export async function pushMutation(table: string, op: 'insert'|'update'|'delete', row: any) {
  await db.outbox.add({ table, op, row, attempt: 0, queuedAt: Date.now() });
  flushOutbox(); // best-effort, also runs on visibility change
}

async function flushOutbox() {
  const batch = await db.outbox.where('attempt').below(5).limit(50).toArray();
  for (const m of batch) {
    try {
      if (m.op === 'insert') await supabase.from(m.table).upsert(m.row);
      else if (m.op === 'update') await supabase.from(m.table).update(m.row).eq('id', m.row.id);
      else if (m.op === 'delete') await supabase.from(m.table).delete().eq('id', m.row.id);
      await db.outbox.delete(m.id);
    } catch (e) {
      await db.outbox.update(m.id, { attempt: m.attempt + 1, lastError: String(e) });
    }
  }
}

// Inbound: subscribe to changes the user makes elsewhere.
supabase.channel('user-data')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_cards' }, payload => {
    db.cards.put(payload.new);
  })
  .subscribe();
```

Conflict policy:

- **Notes** — last-write-wins on `text`. Every save writes `note_versions` so
  nothing is lost.
- **Cards** — server is authoritative for `due_at`, `stability`, `lapses`.
  The client computes optimistic updates and lets the server reconcile.
- **Repertoire structure** — server-authoritative. Local edits show "Saving…"
  until echoed back.

---

## Auth + privacy

Supabase Auth handles email magic-links, OAuth, and passkeys. Wire the session:

```ts
// app/layout.tsx
import { createServerClient } from '@supabase/ssr';
const supabase = createServerClient(/* … */);
const { data: { user } } = await supabase.auth.getUser();
```

Server actions for auth-required mutations:

```ts
'use server';
export async function createLine(input: NewLine) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('lines').insert(input).select().single();
  if (error) throw error;
  return data;
}
```

CSP header (set in `next.config.js`):

```js
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
  "font-src 'self' fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://lichess.org https://api.chess.com https://explorer.lichess.ovh",
  "frame-ancestors 'none'",
].join('; ');
```

---

## File-by-file migration map

This is what you actually convert from the current build:

| Current file         | New location (Next.js)                               | Notes                                                              |
|----------------------|------------------------------------------------------|--------------------------------------------------------------------|
| `js/profile.js`      | `lib/profiles.ts` + Supabase auth                    | Replace localStorage namespace with `profile_id`                   |
| `js/data.js`         | `lib/db/index.ts`                                    | `OOSData` becomes typed query functions; SRS becomes a worker      |
| `js/pgn.js`          | `lib/pgn/parser.ts`                                  | Same algorithm, add types and tests                                |
| `js/api.js`          | `lib/integrations/{lichess,chesscom}.ts`             | Move calls to server actions to avoid CORS exhaustion              |
| `js/markdown.js`     | `lib/markdown.ts`                                    | Or replace with `react-markdown` + `rehype-sanitize`               |
| `js/audio.js`        | `lib/audio.ts`                                       | Wrap in `useAudio()` hook                                          |
| `js/board.js`        | `components/Board.tsx`                               | SVG output unchanged; props instead of constructor opts            |
| `js/practice.js`     | `lib/practice/session.ts` + `components/Practice.tsx`| FSRS scheduler runs server-side too                                |
| `js/views.js`        | `app/(today)/page.tsx`, `app/repertoire/page.tsx`, … | One file per route                                                 |
| `js/app.js`          | `app/layout.tsx` + `lib/router.ts`                   | Hash routing replaced by App Router                                |
| `index.html`         | `app/layout.tsx`                                     | Head metadata, scripts, manifest                                   |
| `styles.css`         | `app/globals.css` + Tailwind tokens or CSS Modules   | Same design tokens, organized by component                         |
| `manifest.json`      | `app/manifest.ts`                                    | Generated at build time                                            |
| `sw.js`              | `next-pwa` plugin or workbox                         | Don't hand-roll service worker once you have a build step          |

---

## Phased rollout

**Phase 0 — Repo move (1 day)**
- Create Next.js + TypeScript repo.
- Copy `vendor/chess.min.js` and add `@types/chess.js` declarations.
- Set up Tailwind or CSS Modules from existing `styles.css`.
- Port `Board.tsx` from `js/board.js`. Keep the same SVG output.

**Phase 1 — Local parity (3-5 days)**
- Port `data.js`/`profile.js` to typed `lib/db/local.ts` backed by IndexedDB.
- Port `views.js` route by route to App Router pages.
- Run `playwright` tests covering: create profile, create line, practice a card,
  import PGN, import Lichess.
- Ship as a static export. No server yet.

**Phase 2 — Auth + cloud (3-5 days)**
- Supabase project, run migrations above.
- Magic-link login.
- Replace local-only mutations with `pushMutation` (still writing to IndexedDB
  first for instant UX, then flushing).
- Realtime subscription for multi-device sync.

**Phase 3 — Coach mode v2 (2-3 days)**
- `coach_students` linking flow: coach sends invite, student accepts.
- Real assignments: server enforces that only the coach can assign and only
  the student can complete.
- Realtime "student is reviewing now" indicator.

**Phase 4 — Imports as jobs (2-3 days)**
- Move Lichess + Chess.com fetches to a server-side worker (avoids CORS limits
  and lets large imports run in the background).
- The `imports` table tracks status. UI shows a progress card on Today.

**Phase 5 — Engine sanity (2 days)**
- `stockfish.wasm` worker on the client.
- Optional server endpoint that runs Stockfish for trusted (paid) tier so phones
  stay cool.

**Phase 6 — Observability + analytics (1-2 days)**
- Sentry for errors.
- PostHog (self-hosted) for product analytics.
- Funnels: profile-created → first-line → first-practice → first-import.

---

## What you can keep verbatim

- `js/practice.js` evaluation logic (string + FEN match + alternates)
- `js/pgn.js` parser
- `js/markdown.js` renderer (or replace with `rehype-sanitize`)
- The seed library content (`SEED_LIBRARY`, `SEED_MODEL_GAMES`)
- All the design tokens in `styles.css`
- The board SVG approach — it's already framework-agnostic

---

## What you should rewrite

- **State storage** — replace `OOSData.state` with typed Zustand/Redux store +
  Supabase queries.
- **Routing** — replace hash router with Next.js App Router.
- **Component splitting** — `views.js` is one giant module; cut it by route.
- **Service worker** — let `next-pwa` / `workbox` generate it. Hand-rolling is
  a maintenance liability once you have a build pipeline.
- **CSS scoping** — current global CSS is fine for one page; consider CSS
  Modules or Tailwind once you have many routes.

---

## Cost estimate

Supabase free tier covers:
- Up to 50 000 monthly active users
- 500 MB Postgres
- 1 GB storage
- 2 GB bandwidth

Realistic for the first ~500 paying users. Move to Pro ($25/mo) when you cross.

A serious implementation is **~3 weeks of focused work** for one engineer
familiar with the stack. Most of the time goes into auth flows, RLS testing,
and the import worker. The chess logic itself ports in days.
