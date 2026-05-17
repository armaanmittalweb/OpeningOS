# GitHub Student Deployment Guide for OpeningOS

This package is optimized for a student-friendly deployment path: GitHub repository + GitHub Actions + GitHub Pages.

## Recommended path

Use **GitHub Pages** for the current static local-first release. It is free, simple, HTTPS-capable, and does not require backend secrets. If you want account-based cloud backups while staying student-budget friendly, add the optional Appwrite setup after Pages is working.

## Step-by-step

### 1. Create a repository

Create a repository named either:

- `openingos`, which publishes at `https://YOUR_USERNAME.github.io/openingos/`, or
- `YOUR_USERNAME.github.io`, which publishes at `https://YOUR_USERNAME.github.io/`.

### 2. Upload the project

From this folder:

```bash
git init
git add .
git commit -m "Deploy OpeningOS"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/openingos.git
git push -u origin main
```

### 3. Enable Pages via Actions

In GitHub:

```text
Repository → Settings → Pages → Build and deployment → Source: GitHub Actions
```

### 4. Deploy

The workflow `.github/workflows/pages.yml` runs on every push to `main`.

You can also run it manually:

```text
Repository → Actions → Deploy OpeningOS to GitHub Pages → Run workflow
```

### 5. Update production URL metadata

Replace the placeholder URL inside:

```text
sitemap.xml
```

With your final GitHub Pages or custom domain URL.

### 6. Optional custom domain

With GitHub Student benefits, you may have access to partner domain offers. After you own a domain:

1. Add the domain in **Settings → Pages → Custom domain**.
2. Add the DNS records requested by GitHub.
3. Enable/enforce HTTPS.
4. Update `sitemap.xml`.

## Optional Appwrite cloud backup with Student benefits

After GitHub Pages is live, you can enable optional cloud snapshots using Appwrite:

1. Activate your GitHub Student Developer Pack.
2. Create an Appwrite Education project.
3. Follow `APPWRITE_SETUP.md`.
4. In OpeningOS, go to **Settings → Cloud Sync** and configure endpoint/project/database/collection IDs.

Keep local backup/export enabled even if cloud sync is configured.

## When to move beyond GitHub Pages

GitHub Pages is correct for this release because OpeningOS is local-first.

Move to a backend when you need:

- user accounts,
- cloud sync,
- coach-student live collaboration,
- teams,
- billing,
- server-side imports,
- database-backed sharing,
- admin moderation.

Use `BACKEND_MIGRATION.md` for that next stage.
