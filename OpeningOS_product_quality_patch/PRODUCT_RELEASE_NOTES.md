# OpeningOS Product-Quality Local-First Build

This package upgrades OpeningOS from a visual prototype toward a real local-first chess opening-preparation product.

## What is now implemented

### Core repertoire workflow
- Manual line creation from board/SAN/PGN-style move text.
- Edit existing lines, update metadata, and change moves.
- Duplicate and delete user-created lines.
- Export individual lines as PGN.
- Practice from the selected ply instead of always drilling the whole line.
- Normalized-FEN transposition lookup is enabled instead of stubbed.

### Practice workflow
- Persistent SRS grading with review-event history.
- Skip now persists as an Again-grade event.
- Accepted alternate moves are saved per practice card.
- Wrong moves, confusing cards, and hint usage are tracked.
- Comparison and quick-note actions are wired to real local state.

### Game-review workflow
- Games can be unmatched without crashing.
- Imported games can be converted into repertoire lines.
- Game-to-line matching can be repaired.
- Deviation repair actions now persist:
  - practice the relevant card,
  - add a user move as an accepted alternate,
  - create an investigate line from an opponent sideline,
  - ignore a deviation for that game,
  - jump to the exact repertoire ply.

### Data safety
- Reliability/Data Safety center for readiness checks, local storage health, full backups, share packs, and coach packages.
- Optional Appwrite Cloud Sync adapter for authenticated snapshot backup/restore using GitHub Student-friendly Appwrite Education.
- Full local backup export now includes profile-local state, lines, games, notes, arrows, SRS, review events, students, assignments, opponent reports, and settings.
- Backup restore is available from Settings.
- A migration blueprint is included in `BACKEND_MIGRATION.md` for SaaS auth/sync/coach sharing.

### Offline/PWA/security hardening
- `chess.min.js` is bundled locally under `vendor/`.
- The service worker caches all critical app scripts, including product completion layers.
- The app shell has a restrictive Content Security Policy meta tag.
- Markdown is rendered through a safer DOM-builder flow with URL scheme checks.
- Internal helper methods no longer preserve raw `innerHTML` for user content.

### UX polish
- Added final responsive polish for mobile bottom navigation, safe-area spacing, tablet stacking, modal overflow, board sizing, stronger focus states, and touch-friendly controls.
- Games empty-state integration buttons now open the real import wizard tabs.
- Settings apply live for theme, contrast, reduced motion, font size, board size, piece style, coordinates, sound, and color-blind status markers.
- Model-game cards are honest reference cards instead of no-op “coming soon” controls.
- Mobile quick actions include line creation.

### Testability
- Added `package.json` with a `npm run check` command.
- Added `tests/smoke.test.js` for syntax and key product-regression checks.

## What still requires deployed infrastructure

This zip is a real local-first product package, but it is not a deployed SaaS service. The following require external infrastructure and cannot be fully completed inside a static zip alone:

- Native OpeningOS accounts and auth. Optional Appwrite account auth is available for cloud snapshots.
- Full production-grade conflict-safe cloud sync across devices. The shipped Appwrite adapter is snapshot backup/restore, not a complete collaborative SaaS sync engine.
- Coach-student collaboration across accounts.
- Server-side PGN import queues.
- Payments/billing.
- Production analytics, logging, and monitoring.
- Hosted database migrations and row-level security.

The implementation path for those items is documented in `BACKEND_MIGRATION.md`.

## 0.5.1 — Responsive UX polish

- Added polished five-item mobile bottom navigation.
- Expanded quick-action bottom sheet so all major features are reachable in two taps.
- Improved modal, toast, board, and action layouts for small screens.
- Added visible focus states and stronger keyboard affordances.
- Added UI assurance checks and CSS-variable regression tests.
- Fixed stale design-token references in launch/readiness cards.
