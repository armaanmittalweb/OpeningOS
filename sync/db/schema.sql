-- One row per sync phrase. The server never sees the phrase or the key:
-- id is SHA-256("openingos/sync/id/v1:" + phrase) and data is an AES-GCM
-- envelope {v, iv, ct} sealed on the device.
create table if not exists snapshots (
  id         char(64)    primary key check (id ~ '^[0-9a-f]{64}$'),
  version    integer     not null check (version > 0),
  data       text        not null,
  updated_at timestamptz not null default now()
);

-- The daily prune deletes snapshots nobody has written for a year.
create index if not exists snapshots_updated_at on snapshots (updated_at);
