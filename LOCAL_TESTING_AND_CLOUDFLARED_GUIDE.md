# OpeningOS Local Testing and Cloudflare Tunnel Guide

This guide is for testing the packaged OpeningOS build locally before final deployment.

## 1. Frontend-only local test

```bash
npm install
npm run validate:full
npm run dev
```

Open:

```text
http://localhost:4173
```

This tests the local-first PWA frontend, repertoire editor, practice engine, game review flows, backup/restore, model-game trainer, settings, and local data storage.

## 2. Frontend through Cloudflare Quick Tunnel

In terminal 1:

```bash
npm run dev
```

In terminal 2:

```bash
cloudflared tunnel --url http://localhost:4173
```

Cloudflared will print a temporary `trycloudflare.com` HTTPS URL. Use that URL to test the app on mobile devices and other browsers.

Quick tunnels are meant for development/testing only, not final production hosting.

## 3. Backend local test with Postgres

Start Postgres using your preferred local setup. Example with Docker:

```bash
docker run --name openingos-postgres \
  -e POSTGRES_PASSWORD=openingos_dev \
  -e POSTGRES_USER=openingos \
  -e POSTGRES_DB=openingos \
  -p 5432:5432 \
  -d postgres:16
```

Create `server/.env`:

```bash
cp server/.env.example server/.env
```

Set at least:

```text
DATABASE_URL=postgres://openingos:openingos_dev@localhost:5432/openingos
JWT_SECRET=replace-with-a-long-random-local-secret
FRONTEND_URL=http://localhost:4173
CORS_ORIGIN=http://localhost:4173
PORT=8787
NODE_ENV=development
```

Install and migrate:

```bash
cd server
npm install
npm run migrate
npm run build
npm run dev
```

Backend health check:

```text
http://localhost:8787/health
```

## 4. Frontend + backend local test

Run backend on port 8787 and frontend on 4173. In the app, set the backend URL to:

```text
http://localhost:8787
```

Then test signup/login, sync, sharing, coach invitations, assignments, import jobs, and account flows.

## 5. Cloudflare tunnel for both frontend and backend

For a simple frontend demo:

```bash
cloudflared tunnel --url http://localhost:4173
```

For backend API testing from a phone, you may also expose the backend separately:

```bash
cloudflared tunnel --url http://localhost:8787
```

If using the backend tunnel, update CORS and frontend backend URL to the generated HTTPS backend tunnel URL. For passkeys/WebAuthn, use stable HTTPS hostnames in production.

## 6. Recommended pre-deployment QA checklist

- Create a new account locally.
- Create a repertoire line.
- Insert and remove a move.
- Add a side variation.
- Mark a position critical.
- Add idea/plan/hook/source annotations.
- Start a practice session.
- Answer correct, wrong, hinted, and guessed.
- Reload mid-session and resume.
- Import a PGN game.
- Repair a deviation.
- Export a backup.
- Restore backup in a fresh browser profile.
- Test mobile layout through Cloudflare Quick Tunnel.
- Test offline reload after one successful app load.
- Run Playwright E2E if dependencies are installed.

