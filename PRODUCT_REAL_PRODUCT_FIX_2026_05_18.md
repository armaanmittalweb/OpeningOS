# OpeningOS real product fix — 2026-05-18

This patch fixes the post-deployment product issues found in the live GitHub Pages + DigitalOcean setup.

## Fixed

### Account/login experience
- Replaced the exposed backend/API first-run form with a polished OpeningOS Cloud account screen.
- Hidden the server URL behind an advanced “Connection settings” disclosure.
- Added friendly password/email validation before calling the backend.
- Translated backend validation and database errors into user-friendly messages.
- Preserved local-only mode as an explicit fallback, not the default first impression.
- Unified auth tokens across the older SaaS, Enterprise API, and new product auth bridge.

### Backend database reliability
- Added DigitalOcean Postgres SSL handling for `sslmode=require` connection strings.
- Defaults to `rejectUnauthorized: false` for managed Postgres certificate chains unless explicitly overridden.
- Added friendlier server-side error responses for validation and TLS/database errors.
- Prevented signup from silently overwriting existing account passwords.

### Game imports
- Signed-in users use the deployed backend import worker first.
- Browser fallback remains available for local/offline users.
- Import polling now accepts `done`, `complete`, and `completed` statuses.
- Lichess NDJSON and PGN bundle result shapes are handled more robustly.
- Chess.com and Lichess import errors are shown as actionable product messages.

### UI polish and overlap fixes
- Added a final responsive shell for the auth experience.
- Hardened the Repertoire layout against board/sidebar/notes overlap.
- Improved line header wrapping, board width limits, move tree overflow, import wizard overflow, and mobile breakpoints.
- Reduced top navigation overflow and made the cloud status pill compact.
- Bumped the service worker cache version so users receive the new frontend after redeploy.

## Required deployment steps

1. Copy this patch into the repository root, not into a nested folder.
2. Run `npm run validate:full`.
3. Commit and push.
4. Let GitHub Pages deploy the frontend.
5. Let DigitalOcean redeploy the backend because `server/src/db.ts` and `server/src/server.ts` changed.
6. Clear the old PWA cache or open the site in an incognito window for the first test.

## Important

If a browser still shows the previous “Create local profile” first-run screen, it is almost always one of these:

- the patch was copied into a nested folder instead of the repo root;
- GitHub Pages has not finished deploying;
- the service worker is serving old cached assets;
- local storage still contains old local-only state.

Use DevTools → Application → Service Workers → Unregister and Storage → Clear site data for a clean test.
