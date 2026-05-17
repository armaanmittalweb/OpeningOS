# Deployment Guide

OpeningOS is a static local-first product. It can deploy to GitHub Pages, Vercel, Netlify, Cloudflare Pages, DigitalOcean App Platform, or any static web server.

## Pre-deployment check

```bash
npm test
```

This verifies syntax, bundled chess engine, service worker cache entries, deployment files, coach-pack exchange, backup/restore, and the core repertoire/practice/game loop.

## GitHub Pages

The repo contains:

```text
.github/workflows/ci.yml
.github/workflows/pages.yml
.github/workflows/deploy-pages.yml
.nojekyll
404.html
```

Steps:

1. Push to GitHub.
2. In repository settings, set Pages source to GitHub Actions.
3. Push to `main`.
4. Wait for the Pages workflow.
5. Open the generated Pages URL.
6. Update `sitemap.xml` with the final production URL.

## Vercel

The repo contains `vercel.json`.

Recommended settings:

```text
Framework preset: Other
Build command: npm test
Output directory: .
Install command: npm install
```

## Netlify

The repo contains `netlify.toml`.

Recommended settings:

```text
Build command: npm test
Publish directory: .
```

## Docker/static server

The included `Dockerfile` serves the static app with Nginx.

```bash
docker build -t openingos .
docker run -p 8080:80 openingos
```

## Optional cloud sync

After deployment, configure Appwrite in **Settings -> Cloud Sync** and follow `APPWRITE_SETUP.md`.

## Production caution

This package is now deployable and much more reliable, but it remains local-first. For a paid SaaS, build the backend architecture in `BACKEND_MIGRATION.md` so user accounts, coach-student permissions, large imports, and conflict-aware sync are handled server-side.
