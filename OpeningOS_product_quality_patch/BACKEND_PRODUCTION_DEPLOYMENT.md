# OpeningOS backend production deployment

## Recommended GitHub Student-friendly stack

- Frontend: GitHub Pages
- Backend: Render, Railway, Fly.io, or a VPS
- Database: Postgres from Supabase, Neon, Railway, Render, or Fly Postgres
- Email: Resend, Postmark, Brevo, SendGrid, or SMTP
- Billing: Stripe
- Engine: Stockfish installed on backend host or a separate analysis worker

## Environment variables

```bash
NODE_ENV=production
PORT=8787
DATABASE_URL=postgres://...
JWT_SECRET=<long-random-secret>
APP_URL=https://your-github-pages-url
API_URL=https://api.yourdomain.com
CORS_ORIGIN=https://your-github-pages-url
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="OpeningOS <no-reply@yourdomain.com>"
ADMIN_EMAILS=you@example.com
STOCKFISH_CMD=/usr/games/stockfish
LICHESS_TOKEN=optional
CHESSCOM_USER_AGENT="OpeningOS/1.0 contact@yourdomain.com"
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Database

```bash
psql "$DATABASE_URL" -f server/migrations/001_init.sql
psql "$DATABASE_URL" -f server/migrations/002_production_saas.sql
```

## Local backend run

```bash
cd server
npm install
npm run build
npm start
```

## Frontend configuration

Open OpeningOS → Settings → SaaS / Sync, set Backend URL to your deployed API URL, create an account, then use Push + Pull.

## Production checklist

- Use a strong `JWT_SECRET`.
- Restrict `CORS_ORIGIN` to your frontend domains.
- Enable Postgres automated backups.
- Configure SMTP and test password reset.
- Configure Stockfish or disable engine features in plan limits.
- Configure Stripe webhooks before accepting payments.
- Add a real privacy policy and terms for your jurisdiction.
- Run Playwright E2E tests against the deployed frontend/backend.
