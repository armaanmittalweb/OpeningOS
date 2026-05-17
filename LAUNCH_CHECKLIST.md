# OpeningOS Launch Checklist

## Before pushing

- [ ] Run `npm test`.
- [ ] Open locally with `npm run serve`.
- [ ] Create a new profile.
- [ ] Create a manual line and practice it.
- [ ] Import a PGN and verify illegal-move handling.
- [ ] Export and restore a full JSON backup.
- [ ] Export a PGN bundle from the reliability/data safety center.
- [ ] Add a coach student, create an assignment, export a coach pack, and import it into another profile.
- [ ] Test on mobile width.
- [ ] Test light/dark mode, board coordinates, and reduced motion.

## Before giving to real users

- [ ] Update `sitemap.xml` to the final URL.
- [ ] Update README screenshots/branding if needed.
- [ ] Add a clear public note that this is local-first and backups matter.
- [ ] Verify GitHub Pages HTTPS.
- [ ] Verify service worker update after a deploy.
- [ ] Test in Chrome, Edge, Firefox, and mobile Safari/Chrome.
- [ ] Keep an export/import backup sample for support.

## Optional cloud sync

- [ ] Create Appwrite project.
- [ ] Add your GitHub Pages domain as a Web platform.
- [ ] Create database/collection described in `APPWRITE_SETUP.md`.
- [ ] Configure Cloud Sync in Settings.
- [ ] Test push and pull with non-sensitive demo data first.

## When to move to SaaS backend

Move beyond static hosting when you need live accounts, cross-device conflict-safe sync, coach-student permissions, billing, server-side imports, or admin moderation.
