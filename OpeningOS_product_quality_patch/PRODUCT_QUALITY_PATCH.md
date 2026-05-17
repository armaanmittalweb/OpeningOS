# OpeningOS Product Quality Patch

This build addresses the issues found after deploying the backend to DigitalOcean and the frontend to GitHub Pages.

## Fixed

### Account and onboarding
- First-run now shows a real cloud-account flow instead of only asking for a local profile.
- The deployed backend defaults to `https://monkfish-app-yxidj.ondigitalocean.app` through `js/deployment_config.js`.
- The account gateway now supports signup, login, local-only fallback, status pill, sync, and server import authentication.
- SaaS client compatibility aliases were added so the product-facing account UI and lower-level API clients use the same token/session state.

### Chess.com and Lichess imports
- The import wizard now tries the backend import worker first for signed-in users.
- Browser direct public API fallback remains available for offline/local users.
- Backend routes include `/imports/fetch-games` and queued `/imports/jobs` flows.
- Chess.com archives are expanded into real PGNs instead of only returning archive URLs.
- Lichess PGN import returns parseable game PGNs.

### UI and responsive quality
- Removed double app initialization that could create overlapping/duplicated UI.
- Added a final product hardening CSS layer for the Repertoire workspace.
- Repertoire now constrains sidebars, board, move tree, actions, idea cards, and notes to prevent overflow/overlap.
- Mobile and tablet layouts stack cleanly and hide crowded desktop navigation.
- Added account/status styling and polished account modals.

### Deployment safety
- Root Dockerfile is renamed to `Dockerfile.frontend` so DigitalOcean backend deploy does not accidentally build the frontend Nginx image.
- `.do/app.yaml` deploys the `server` directory as a Node web service.
- GitHub Pages deploy continues to build the static frontend from `dist/`.

## Validation

Run before pushing:

```bash
npm run validate:full
```

Expected:

```text
OpeningOS product smoke checks passed
Static lint passed
Built static app into dist/
tsc --noEmit -p tsconfig.json passed
```

## After deploying this patch

1. Open the GitHub Pages frontend.
2. Clear old local app data or use an incognito window for first-run testing.
3. Confirm the first screen shows OpeningOS Cloud signup/login.
4. Create a test account.
5. Import games from Chess.com and Lichess while signed in.
6. Check that the import wizard reports imported games and the Games page shows them.
7. Test the Repertoire page at desktop, tablet, and mobile widths.

## Security reminder

The previous database password was exposed during setup. After confirming the patched deployment works, rotate the DigitalOcean database password and update `DATABASE_URL` in GitHub Secrets and DigitalOcean App Platform environment variables.
