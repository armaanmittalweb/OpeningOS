# OpeningOS product-quality fix report

This build fixes the post-deployment product issues found after connecting GitHub Pages + DigitalOcean.

## Fixed

### 1. Account-first product flow
- First launch now presents **OpeningOS Cloud signup/login** instead of only a local profile prompt.
- Local-only mode is still available, but it is clearly labelled as offline/private mode.
- The deployed backend URL is prefilled from `js/env.js` and the `openingos-api-url` meta tag.
- Signup/login tokens are written into the older SaaS clients too, so auth, sync, imports and sharing use the same session.
- The top navigation now has a cloud account pill.

### 2. Backend imports for Chess.com and Lichess
- Remote imports now prefer signed-in backend jobs.
- The backend fetches real PGN payloads for both Lichess and Chess.com.
- The browser UI polls import jobs and parses the returned PGNs into the existing import review flow.
- Browser public-API fallback remains available for users who choose local-only mode.
- Added a synchronous `/imports/fetch-games` backend endpoint for direct import testing.

### 3. UI/repertoire quality
- Added a final overlap-proof CSS layer for the Repertoire workspace.
- Constrained the board, move tree, line header, idea card, surgery rows and side panels so they cannot overflow each other on common laptop/tablet/mobile widths.
- Account modals and auth forms now have production-style responsive layouts.
- Service worker cache version was bumped so deployed users receive the new assets.

### 4. Deployment stability
- Root `Dockerfile` was renamed to `Dockerfile.frontend`, so DigitalOcean does not accidentally deploy the frontend Docker image for the backend API.
- DigitalOcean App Platform config remains pointed at `source_dir: server` with Node build/run commands.
- GitHub Actions npm-cache dependency on lockfiles was removed from this package, so the workflows do not fail if lockfiles are not present.

## Validated locally

```bash
npm test
npm run validate:deploy
npm run typecheck
```

Results:

- OpeningOS product smoke checks passed
- Static lint passed
- Static frontend built into `dist/`
- Frontend TypeScript typecheck passed

## After pushing this build

1. Confirm GitHub Actions pass.
2. Confirm backend `/health` remains live.
3. Open GitHub Pages frontend in a private browser tab.
4. Confirm first screen is OpeningOS Cloud signup/login.
5. Create an account or log in.
6. Test Chess.com import with a public username.
7. Test Lichess import with a public username.
8. Test Repertoire page at desktop, tablet and phone widths.

## Security reminder

A database password and GitHub token were pasted during setup. Rotate any exposed credentials after this build is deployed and verified.
