# OpeningOS sync

The server behind OpeningOS's device sync, at `openingos-sync.amittal.dev`. It is one Cloudflare Worker (free plan) on a Neon Postgres database (free plan). It stores one encrypted snapshot per sync phrase and cannot read any of them: the app encrypts on the device and sends only an id derived from the phrase.

## API

| Request | Response |
| --- | --- |
| `GET /sync/:id` | `200 { version, data, updatedAt }`, or `404` |
| `PUT /sync/:id` with `If-Match: "<version>"` and body `{ "data": { "v": 1, "iv": "…", "ct": "…" } }` | `200 { version }`. `If-Match: "0"` creates. `409 { version }` if another device wrote first. |
| `DELETE /sync/:id` | `204`, or `404` |
| `GET /health` | `200 { ok: true }` |

The `:id` is 64 lowercase hex characters (SHA-256).

Errors are `{ error }`:

| Code | Meaning |
| --- | --- |
| `400` | Malformed id or body. |
| `413` | The body is over 1 MB. |
| `428` | `If-Match` is missing. |
| `429` | Over 30 requests a minute from one IP. |
| `507` | The database is near its size cap, so new phrases are paused; existing phrases keep working. |

A write is a single conditional statement, which is why two devices writing at once cannot both win:
- Update: `UPDATE … WHERE id = $1 AND version = $3`.
- Create: `INSERT … ON CONFLICT DO NOTHING`.

A daily cron deletes snapshots nobody has written for 365 days.

## Code

- `src/app.ts`: routes, validation, CORS, rate limiting, prune.
- `src/db.ts`: Neon over HTTP (single statements, so no WebSocket).
- `src/index.ts`: the Worker entry and cron.
- `db/schema.sql`: the one table.
- `test/`: vitest against PGlite (Postgres compiled to WASM, in-process). It includes a round trip through the app's own `SyncClient` and crypto.

```sh
npm install
npm test
npm run typecheck
npm run dev:local     # Node + in-memory PGlite on http://localhost:8788
```

## Deploy (needs the Cloudflare and Neon accounts)

1. **Neon.**
   - Create a project (free plan) and a database called `openingos`.
   - Run `db/schema.sql` in the SQL editor.
   - Copy the **pooled** connection string.
2. **Worker.**

   ```sh
   npm approve-scripts workerd esbuild   # npm 11 blocks their install scripts by default
   npx wrangler login
   npx wrangler secret put DATABASE_URL  # paste the Neon connection string
   npx wrangler deploy
   ```

3. **Domain.**
   - Once `amittal.dev` is on Cloudflare, uncomment the `routes` entry in `wrangler.jsonc` and deploy again.
   - In Vercel, set `VITE_SYNC_URL=https://openingos-sync.amittal.dev` on the OpeningOS project and redeploy it.

For `npm run dev` (wrangler against real Neon), copy `.dev.vars.example` to `.dev.vars`.

## Free-tier headroom

| Service | Limit | How this fits |
| --- | --- | --- |
| Workers | 100k requests a day | A sync is 1 to 3 requests. |
| Neon | 0.5 GB storage | New phrases are refused at 400 MB (`MAX_TABLE_BYTES`). A typical snapshot is tens of KB. |
| Neon compute | Scales to zero when idle | The first request after a quiet spell takes about a second longer. |
