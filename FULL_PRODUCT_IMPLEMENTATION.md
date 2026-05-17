# OpeningOS full-product implementation notes

This build adds the production SaaS and chess-core layers needed to move from a local-first alpha to a deployable full-stack product.

## Implemented layers

### Backend / SaaS infrastructure

The `server/` package now includes production-oriented Fastify/Postgres APIs for:

- email/password signup and login
- refresh-token sessions
- logout and session revocation
- password reset request/confirm
- account recovery codes
- OAuth provider start/callback hooks
- passkey/WebAuthn registration/login hooks
- coach invitation creation and acceptance
- live workspace membership and revocation
- assignments, comment threads, notifications hooks
- graph-native positions, move edges, line paths, annotations, practice events
- change-log sync with conflict reporting
- snapshot compatibility sync
- server-side import jobs for PGN, Lichess, Chess.com
- Stockfish-compatible engine analysis endpoint
- analysis jobs and engine cache schema
- hosted share links, clone workflow, access logs, expiry/revocation fields
- billing checkout/portal/webhook adapters
- admin dashboard metrics
- client-error observability endpoint
- audit logging
- account deletion workflow

Run migrations:

```bash
psql "$DATABASE_URL" -f server/migrations/001_init.sql
psql "$DATABASE_URL" -f server/migrations/002_production_saas.sql
```

### Real sync and multi-device reliability

The app now has two sync layers:

1. snapshot backup compatibility for existing local-first users
2. change-log sync for multi-device object reconciliation

Frontend connector: `js/saas_client.js`

Backend endpoints:

- `POST /sync/changes`
- `GET /sync/changes`
- `GET /sync/objects`
- `GET /sync/events`

Conflict behavior is deterministic: server conflicts are returned to the client, local conflicts are stored in the profile's `cloudConflicts` list, and supported objects are merged by object type.

### Graph-native chess data model

Frontend graph-native store: `js/graph_native.js`

Backend graph tables:

- `positions`
- `move_edges`
- `line_paths`
- `practice_cards`
- `annotations`
- `review_events`
- `games`
- `deviations`

Graph paths are stored by edge IDs, with lifecycle states and transposition metadata. The legacy SAN-array UI is preserved for compatibility, while the graph layer becomes the sync and backend source of truth.

### Engine and database analysis

Frontend engine adapter: `js/stockfish_client.js`
Backend engine adapter: `server/src/services/engine.ts`

Supported modes:

- server Stockfish through `STOCKFISH_CMD`
- backend rate-limited analysis jobs
- local material fallback when no engine is configured
- alternate-move validation flow
- opening explorer hook for server providers

### Coach-student collaboration

Backend workspace model:

- workspaces
- workspace_members
- coach_invitations
- assignments
- comment_threads
- notifications

Frontend calls are exposed through `OOSSaaS`.

### Sharing system

Backend sharing supports:

- public/private/unlisted/team scopes
- permission levels: read, clone, edit
- expiration
- revocation
- access logs
- clone workflow

### Billing

Billing adapters are implemented with stable endpoint shapes:

- `POST /billing/checkout`
- `POST /billing/portal`
- `POST /billing/webhook`

Wire a payment provider in `server/src/services/billing.ts`.

### Testing / engineering

This package includes:

- static smoke checks
- static lint
- build script
- Playwright E2E suite scaffold with real workflows
- TypeScript domain models
- backend TypeScript package
- Docker Compose for local Postgres/backend
- GitHub Actions static validation and pages deployment

## External services required for complete production operation

These are implemented as adapters but need real credentials in deployment:

- SMTP or transactional email service
- OAuth provider client IDs/secrets
- WebAuthn verifier hardening
- Stripe or another billing provider
- Stockfish binary or managed analysis worker
- hosted backend runtime and Postgres
- domain, TLS, backup policy, monitoring, and secrets manager

The code paths and API contracts are present. The deployment operator must provide provider credentials and run the backend.
