# OpeningOS Product Beta Implementation — 2026-05-18

This release focuses on product quality now that the deployed backend and database are working.

## Implemented

### Product shell
- Added a clean workspace shell with top bar, sidebar navigation, search, sync trust indicator, account entry point, and feedback button.
- Hidden deployment/backend terminology from normal product screens.
- Added consistent workspace navigation: Today, Repertoire, Practice, Games, Insights, Library, Coach, Settings.

### Repertoire workspace
- Added premium Repertoire header and contextual position action bar.
- Added position action menu with: Practice from here, Add opponent reply, Add side variation, Mark critical, Add idea, Split line, Retire branch, Show transpositions.
- Added full idea-card editor for idea, plan, memory hook, common mistake, and source.
- Renamed developer wording such as "Graph editor" to player-facing wording such as "Position tools".
- Added overlap-resistant responsive CSS for board, move list, folders, and idea panels.

### Account/workspace model
- Normal users see Account, Workspace, Repertoire, and Cloud sync language.
- Connection/server details are hidden behind advanced connection controls.
- Offline study remains available but is presented as a secondary fallback.

### Today dashboard
- Added command-center cards: next best action, weakest line, game repair, and repertoire safety.
- Added direct actions for daily review, weak-line drill, import games, and sync.

### Sync trust
- Added visible save/sync status: saved on device, cloud synced, last cloud sync time, conflict warning, and retry sync.
- Patched local persistence to update the trust indicator when repertoire data changes.

### Game imports
- Rebuilt import wizard around progress states: Connecting, Fetching games, Parsing games, Matching games, Finding deviations, Ready.
- Added cloud import when signed in and browser public API fallback when offline.
- Handles Chess.com, Lichess, and pasted PGN.
- Detects unmatched games, matched games, deviations, and repair cards.

### Game review
- Added a player-focused opening repair report above the raw PGN.
- Added repair-set practice CTA when deviations map to trainable cards.
- Reworded graph matching into player-facing repertoire matching.

### Security/trust
- Added Settings trust panel with sync status, export data, account deletion request, privacy and security links.
- Added stricter server-side import endpoint rate limits.
- Added DigitalOcean app environment variables for import rate limiting and email sender identity.

### Testing and repository hygiene
- Added `.gitattributes` for LF line endings and YAML hygiene.
- Added cross-platform Node dev server (`tools/serve.mjs`) instead of relying on Python.
- Updated CI to run frontend validation, backend build, and Playwright E2E product flows.
- Expanded Playwright coverage for product shell, repertoire actions, graph edit APIs, practice resume, game review, settings trust, offline reload, and mobile navigation.
- Added smoke-test checks for product shell, sync trust, import rate limits, and product experience layer.

## Deployment notes

After copying this patch into the repository root:

```powershell
npm run validate:full
git add -A
git commit -m "Implement beta product shell repertoire workspace sync trust and import UX"
git push origin main
```

The frontend will deploy to GitHub Pages. The backend will redeploy to DigitalOcean only if server or `.do/app.yaml` changes are included.

## Operational reminders

- Rotate the DigitalOcean database password if old credentials were exposed.
- Update both GitHub Actions `DATABASE_URL` and DigitalOcean App Platform `DATABASE_URL` after rotation.
- Add SMTP credentials before relying on password reset emails.
- Review E2E run time in CI; Playwright now runs full product flows.
