# OpeningOS full-stack package

This zip contains a static GitHub Pages-ready frontend and a production-oriented Fastify/Postgres backend. The frontend works offline/local-first. Connecting the backend unlocks accounts, live sync, coach workspaces, sharing links, backend imports, engine analysis jobs, billing hooks, and admin dashboards.

## Static frontend

```bash
npm install
npm run validate:deploy
npm run dev
```

Deploy `dist/` or use the included GitHub Pages workflow.

## Backend

```bash
cd server
npm install
npm run build
npm start
```

Run database migrations first:

```bash
psql "$DATABASE_URL" -f server/migrations/001_init.sql
psql "$DATABASE_URL" -f server/migrations/002_production_saas.sql
```

## Local full-stack development

```bash
docker compose up
npm run dev
```

Then open the app, go to Settings/SaaS, use `http://localhost:8787` as Backend URL, and create or dev-login to an account.
