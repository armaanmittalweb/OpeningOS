# OpeningOS product-alpha build

This zip is a strengthened **local-first product alpha**. It is designed to run as a static web app with private browser-local data, offline-capable assets, backup/restore, and real chess-opening workflows.

## Included in this build

- Manual repertoire line creation with board input, SAN input, PGN paste, validation, save, edit, duplicate, and delete for user-created lines.
- Seed/starter line customization flow so built-in starter material is copied before editing.
- PGN import review with illegal-move handling and optional valid-prefix import.
- Lichess / Chess.com public-game import flows through the import wizard.
- Local game library with unmatched-game handling, match-to-line, create-line-from-game, and persistent deviation repair actions.
- Practice engine with due queues, weak-line mode, learn mode, warmup modes, hints, accepted alternates, transposition-aware correctness, skipped-card SRS updates, review event history, and wrong-move metadata.
- Position notes with markdown preview, tags, note history, debounced saving, and safer markdown rendering.
- Full local backup/restore for profile state, lines, games, SRS, notes, card metadata, assignments, students, settings, and review events.
- PWA shell with local chess.js, CSP, local SVG icons, and service-worker caching for the app shell.
- Backend migration plan with Postgres/Supabase schema and RLS direction for a future cloud/SaaS version.

## Still intentionally local-first

This build does **not** include hosted cloud accounts, billing, server-side sync, real coach-student cross-account sharing, or production deployment infrastructure. Those require an actual backend project, domain, auth provider, database, and environment secrets. The included `BACKEND_MIGRATION.md` gives the implementation plan for that step.

## Suggested next engineering step

Move this codebase to TypeScript + a component framework, keep IndexedDB/local-first behavior, then add a Postgres/Supabase backend using the schema in `BACKEND_MIGRATION.md`.
