# OpeningOS Production Runbook

This package contains a deployable static frontend plus a production-oriented Fastify/Postgres backend. The app works offline/local-first on GitHub Pages, then upgrades to full SaaS behavior when the backend URL is configured in Settings.

## Frontend deployment

1. Push this repository to GitHub.
2. Enable GitHub Pages with GitHub Actions.
3. The `deploy-pages.yml` workflow runs `npm run validate:deploy` and publishes `dist/`.
4. Configure the backend URL inside OpeningOS Settings after deploying the backend.

## Backend deployment

Recommended student-friendly hosts: Render, Railway, Fly.io, Supabase Postgres + Render API, Neon Postgres + Railway API.

Required environment variables:

```txt
DATABASE_URL=postgres://...
JWT_SECRET=replace-with-long-random-secret
FRONTEND_URL=https://your-github-username.github.io/openingos
CORS_ORIGIN=https://your-github-username.github.io
NODE_ENV=production
ACCESS_TTL_SECONDS=1800
REFRESH_TTL_DAYS=30
```

Optional provider variables:

```txt
STOCKFISH_PATH=/usr/bin/stockfish
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
LICHESS_CLIENT_ID=...
STRIPE_CHECKOUT_URL=https://checkout.stripe.com/...
STRIPE_PORTAL_URL=https://billing.stripe.com/...
SMTP_URL=smtp://...
```

## Database migration

Run the contents of:

```txt
server/migrations/001_init.sql
```

against Postgres. The schema includes users, password auth, sessions, recovery codes, OAuth accounts, passkeys, graph-native chess data, sync changes, coach relationships, assignments, comments, share links, import jobs, engine jobs, billing records, account deletion requests, email events, and audit logs.

## Production feature checklist

- Signup/login/password reset/account recovery: backend routes are implemented.
- OAuth: URL/callback routes are present; configure provider secrets for real OAuth token exchange.
- Passkeys/WebAuthn: browser registration/login flows and credential storage are implemented. For high-stakes production, replace the lightweight verification shim with a full audited WebAuthn verification package.
- Sync: entity-level change queue, snapshot fallback, SSE realtime endpoint, conflict logs, and multi-tab reconciliation are implemented.
- Coach platform: invitations, acceptance, relationships, assignments, assignment progress, comments, and access revocation are implemented.
- Sharing: hosted share URLs, permissions, cloning, revocation, expiration, and access logs are implemented.
- Imports: backend jobs for PGN, Lichess, and Chess.com are implemented.
- Engine: server job queue and Stockfish CLI adapter are implemented. Set `STOCKFISH_PATH` for real engine analysis.
- Billing: checkout/portal/status/webhook storage are implemented. Connect Stripe URLs/webhooks for live money movement.
- Admin: admin overview dashboard endpoint is implemented.
- Compliance: account export and deletion workflows are implemented.

## Operating model

Use GitHub Pages for the frontend and a separate backend domain, for example:

```txt
Frontend: https://username.github.io/openingos
Backend:  https://openingos-api.onrender.com
Database: Neon/Supabase Postgres
```

In OpeningOS Settings, set the backend URL, sign up, and push your first graph snapshot. After that, sync changes and coach workflows can run through the backend.
