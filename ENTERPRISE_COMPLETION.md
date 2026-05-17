# OpeningOS Enterprise Completion Notes

This package implements the major blocker list as a static deployable local-first product plus a SaaS backend scaffold.

## Implemented in the app

- Graph-backed repertoire materialization with positions, move edges, and line paths.
- Branch operations: insert, remove, split, side variation, opponent reply, retire/restore, transposition merge metadata.
- Structured idea cards with idea, plan, hook, mistake, model game, source, and trust fields.
- Per-position critical flags.
- FSRS-style scheduler, complete review events, timing, guessed metadata, session resume, and mistake tracking.
- Deep game review against multiple repertoire lines with transposition detection and relevance scoring.
- Model-game replay and drill trainer.
- Applied settings for notation, default practice mode, reveal-on-wrong, board settings, and screen-reader move announcements.
- IndexedDB durable local store with localStorage compatibility cache.
- Full active-profile backup/restore and multi-profile export metadata.
- Audit trail and local observability layer.
- PWA cache update handling and static build pipeline.
- TypeScript domain models, static lint, build script, smoke tests, Playwright E2E scaffold, GitHub Actions deployment.

## Implemented as backend scaffold

- Account/sync API skeleton.
- Postgres schema for users, profiles, graph objects, games, deviations, review events, assignments, shares, audit, and billing customers.
- Coach invitation endpoint.
- Snapshot conflict response.
- RLS-ready database migration.

## Operational note

The frontend is immediately deployable to GitHub Pages. Full SaaS operations—real password reset/passkeys, production email, payment webhooks, managed Postgres, backups, monitoring, and real-time collaboration—require deploying and configuring the `server/` backend or an equivalent managed platform.
