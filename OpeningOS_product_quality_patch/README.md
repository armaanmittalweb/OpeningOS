# OpeningOS Complete SaaS Product Platform

OpeningOS is a chess opening-preparation platform for serious players, coaches, teams, and improving club players. This package contains both:

1. a deployable local-first PWA frontend, and
2. a SaaS-ready Fastify/Postgres backend with auth, sync, permissions, coach workspaces, sharing, imports, analysis hooks, billing surfaces, audit logs, and admin routes.

The product helps users:

- build graph-native opening repertoires with branches, side variations, transpositions, lifecycle states, and edge-level annotations;
- practice positions with an FSRS-compatible scheduler, session resume, timing, guessed/hinted-answer handling, and review forecasting;
- import PGNs and queue Lichess/Chess.com backend import jobs;
- review games against the full repertoire graph with multiple candidate lines, confidence scoring, deviations, repeated mistakes, and ranked repair recommendations;
- replay and drill model games;
- manage coach-student workspaces, assignments, comments, progress, permissions, and invitations;
- share repertoires with public/private/unlisted links, clone flows, access logs, expiration, and revocation;
- use optional engine-backed analysis through frontend Stockfish/WASM or backend Stockfish routes;
- export/restore backups and sync profile/graph data across devices through the backend.

## Validation

The package was validated with:

```bash
npm run validate:full
```

This runs smoke tests, static lint, frontend build, and frontend TypeScript checks.

For browser automation after dependencies are installed:

```bash
npm install
npx playwright install --with-deps
npm run test:e2e
```

For backend compilation and local backend development:

```bash
cd server
npm install
npm run build
npm run dev
```

## Frontend local development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:4173
```

Avoid `file://` loading because service workers, PWA installability, and some browser APIs need a web origin.

## Static frontend deployment

### GitHub Pages

1. Create a GitHub repository.
2. Push this folder.
3. In GitHub, go to **Settings -> Pages**.
4. Set Source to **GitHub Actions**.
5. Push to `main`; the included workflow validates and deploys.

### Vercel / Netlify

Use the included `vercel.json` or `netlify.toml`. The static frontend can run without the backend, but SaaS features need `OOS_BACKEND_URL` configured in the app settings or environment injection.

## Backend deployment

The backend is in `server/`.

Required production services:

- Postgres database
- secure `JWT_SECRET`
- HTTPS domain for frontend and backend
- email/SMTP provider
- OAuth app credentials if OAuth is enabled
- Stripe or equivalent billing credentials if billing is enabled
- optional Stockfish binary/WASM path for engine analysis jobs

Read:

- `server/README.md`
- `BACKEND_PRODUCTION_DEPLOYMENT.md`
- `SAAS_PRODUCTION_RUNBOOK.md`
- `FULL_SAAS_IMPLEMENTATION_REPORT.md`

## Database migrations

Core migrations are included in:

```text
server/migrations/001_init.sql
server/migrations/002_saas_complete.sql
```

Run after setting `DATABASE_URL`:

```bash
npm run db:migrate
```

or from `server/`:

```bash
npm run migrate
```

## Important deployment-time integrations

The codebase implements the product surfaces and backend route structure, but provider-backed features require credentials and hosting configuration:

- OAuth login needs provider client IDs/secrets.
- Passkeys need a stable HTTPS RP ID/domain.
- Password reset and notifications need an email provider.
- Billing/subscription management needs payment-provider keys and webhooks.
- Server-side engine analysis needs Stockfish or an analysis provider.
- Lichess/Chess.com backend imports need network access and import-job workers.
- Real team/coach collaboration needs the backend deployed and the frontend pointed at that backend.

## Product documentation

- `FULL_SAAS_IMPLEMENTATION_REPORT.md` — implementation map by requested feature area.
- `PRODUCT_COMPLETION_MATRIX.md` — product capability matrix.
- `DEVICE_QA_MATRIX.md` — real-device QA plan.
- `SECURITY_PRODUCTION_REVIEW.md` and `SECURITY_COMPLIANCE_PLAN.md` — security/compliance checklist.
- `UI_QUALITY_CHECKLIST.md` — manual UX and accessibility QA.

## Data safety

The frontend remains local-first for offline use. When the backend is configured, users can sync snapshots, graph bundles, changes, shares, coach workspaces, comments, assignments, and audit events through the server.

For serious players and coaches, enable backend sync and regular backup exports before using the product for tournament-critical preparation.
