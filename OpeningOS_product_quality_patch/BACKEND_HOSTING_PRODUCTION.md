# Backend Hosting Production Guide

## Local development

```bash
cd server
npm install
cp .env.example .env
# edit DATABASE_URL and JWT_SECRET
npm run migrate
npm run dev
```

Run the worker in a second terminal:

```bash
cd server
npm run worker
```

## Render/Railway/Fly.io deployment

Use two services:

1. Web service
   - Build: `cd server && npm install && npm run build`
   - Start: `cd server && npm run start`

2. Worker service
   - Build: `cd server && npm install && npm run build`
   - Start: `cd server && npm run start:worker`

Add Postgres and set `DATABASE_URL`.

## Required environment variables

See `server/.env.example`. At minimum:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `PUBLIC_APP_URL`
- `API_BASE_URL`

For complete SaaS behavior, also configure:

- SMTP variables
- GitHub OAuth variables
- Google OAuth variables
- WebAuthn RP variables
- Stripe variables
- Lichess token if importing many games
- Stockfish path for server analysis

## Database migrations

```bash
cd server
psql "$DATABASE_URL" -f migrations/001_init.sql
psql "$DATABASE_URL" -f migrations/002_complete_saas.sql
```

## Connecting the frontend

1. Deploy frontend to GitHub Pages.
2. Open OpeningOS → Settings → SaaS Center.
3. Enter backend URL, for example `https://api.yourdomain.com`.
4. Sign up or log in.
5. Push snapshot and graph.

## Production checklist

- Rotate `JWT_SECRET` before launch.
- Use HTTPS only.
- Configure CORS to your frontend domains only.
- Verify OAuth callback URLs.
- Verify Stripe webhooks.
- Verify password reset emails.
- Verify worker job processing.
- Run Playwright E2E tests against the deployed URL.
