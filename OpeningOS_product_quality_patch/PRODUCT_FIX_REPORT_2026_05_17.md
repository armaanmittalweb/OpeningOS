# OpeningOS product-quality fix pass — 2026-05-17

This build fixes the deployed-product issues found after the GitHub Pages + DigitalOcean deployment.

## Main fixes

### 1. Real account flow is now the product default

- First run now opens an **OpeningOS Cloud** signup/login gate against `https://monkfish-app-yxidj.ondigitalocean.app`.
- The local-only profile option is still available, but it is clearly labelled as offline/local-only.
- Tokens are now written to the storage keys used by the older SaaS clients, the enterprise client, and the newer product auth bridge so the entire app sees the same signed-in state.
- The account pill in the top navigation reflects the real cloud account state.
- Existing local users get a cloud-account nudge instead of silently staying local forever.

### 2. Backend game imports are connected consistently

- Chess.com and Lichess imports now prefer the signed-in DigitalOcean backend import worker.
- Local/offline users still get the browser public-API fallback.
- The import layer now reads auth state from the unified account bridge, SaaS client, or enterprise client.
- Import job polling accepts `done`, `complete`, and `completed` statuses.
- Import result parsing accepts `games`, `pgns`, `pgn`, `pgnBundle`, and Lichess NDJSON-style payloads.

### 3. Repertoire and layout overlap cleanup

- Repertoire workspace grids now collapse before overlapping.
- The board, move tree, line header, graph editor, line-surgery tools, notes/idea cards, and action rows now wrap safely.
- The right-side Repertoire panel moves underneath the board on narrower screens instead of crushing the center workspace.
- Mobile line picker and account modals are optimized for small screens and touch targets.
- The top navigation has overflow protection so product/account controls do not collide with nav items.

### 4. Deployment and cache safety

- Backend URL defaults are centralized through `js/env.js` and `js/deployment_config.js`.
- The root Dockerfile remains renamed to `Dockerfile.frontend` so DigitalOcean does not accidentally build the frontend Docker image for the API.
- Service worker cache version was bumped so deployed browsers pick up the account/import/UI patch.

## Validation run for this package

```bash
npm run validate:full
```

Result:

```text
OpeningOS product smoke checks passed
Static lint passed
Built static app into dist/
tsc --noEmit -p tsconfig.json passed
```

Browser/device QA should still be done after deployment, especially on mobile Safari and Android Chrome.

## After pushing

1. Commit this package to `main`.
2. Let GitHub Pages deploy the frontend.
3. Let the DigitalOcean backend workflow deploy the API.
4. Open `https://armaanmittalweb.github.io/OpeningOS/` in a private/incognito browser window.
5. Confirm the first screen is OpeningOS Cloud signup/login, not only local profile creation.
6. Sign up or sign in.
7. Create a repertoire line.
8. Open Games → Import and test a Chess.com username and a Lichess username.
9. Test sync, refresh the browser, then sign in again and pull/sync data.

## Security reminder

Rotate the DigitalOcean database password that was pasted during setup, then update both GitHub `DATABASE_URL` and DigitalOcean App Platform `DATABASE_URL`.
