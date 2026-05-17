# OpeningOS Backend

Fastify/Postgres backend for OpeningOS SaaS mode.

## Features

- Signup, login, refresh sessions, logout
- Password reset and recovery code account recovery
- OAuth provider start/callback routes for GitHub, Google and Lichess
- Passkey/WebAuthn route aliases for registration and login
- Graph-native chess snapshots and entity sync changes
- SSE realtime endpoint for collaborative invalidation/heartbeat
- Coach invitations, acceptance, relationships, assignments, progress, comments and revocation
- Hosted share URLs, public/unlisted/private permissions, clone workflow, revocation and access logs
- PGN, Lichess and Chess.com import jobs
- Stockfish-backed or heuristic server analysis jobs
- Billing status, checkout, portal and webhook storage hooks
- Account export and deletion requests
- Admin overview and audit logging

## Environment

```txt
DATABASE_URL=postgres://...
JWT_SECRET=replace-with-long-random-secret
FRONTEND_URL=http://localhost:4173
CORS_ORIGIN=http://localhost:4173
NODE_ENV=development
STOCKFISH_PATH=/usr/bin/stockfish
STRIPE_CHECKOUT_URL=
STRIPE_PORTAL_URL=
```

## Setup

```bash
npm install
psql "$DATABASE_URL" -f migrations/001_init.sql
npm run dev
```

## Production notes

Use a managed Postgres service and run behind HTTPS. Set strong secrets, configure CORS to the frontend domain, attach SMTP/Stripe/OAuth providers, and set `STOCKFISH_PATH` if engine analysis should be real instead of heuristic.
