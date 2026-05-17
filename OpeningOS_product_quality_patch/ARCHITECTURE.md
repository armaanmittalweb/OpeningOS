# OpeningOS Architecture

OpeningOS is now structured as a graph-based, local-first chess opening preparation product.

## Frontend runtime

The deployable app remains a static GitHub Pages-compatible PWA. Critical chess logic is bundled locally in `vendor/chess.min.js`; no CDN is required for the app shell. The runtime uses plain browser JavaScript for direct static hosting, with TypeScript domain models in `src/domain` documenting and type-checking the core architecture.

## Data model

The app materializes user repertoires into a canonical graph:

- `positions`: normalized-FEN nodes.
- `move_edges`: SAN/position transitions.
- `line_paths`: repertoire paths through graph edges.
- `practice_cards`: trainable positions generated from line paths.
- `annotations`: notes, idea fields, comments, source references.
- `review_events`: complete history of practice grades, timing, guesses, and outcomes.
- `games`: imported PGNs and metadata.
- `deviations`: detected review moments from game matching.

The browser state is persisted as a localStorage cache and mirrored into IndexedDB through `js/idb_store.js`. IndexedDB is the durable local store; localStorage keeps the synchronous app boot fast and compatible with GitHub Pages.

## Editing model

The Repertoire workspace supports:

- line metadata editing,
- arbitrary insert/remove move operations,
- side-variation branch creation,
- opponent reply branches from the current position,
- line splitting,
- retired/restored branches,
- transposition-aware merge metadata,
- edge comments,
- critical position flags,
- structured idea cards.

## Practice model

`js/fsrs.js` provides a dependency-free FSRS-style scheduler with difficulty, stability, retrievability, interval scheduling, lapses, and miss-rate tracking. Practice sessions are resumable, persist per-card duration, track guessed answers, and distinguish correct, alternate, transposition, outside-prep, known-position, illegal, skipped, and timeout outcomes.

## Game review model

The review engine matches imported games against all active repertoire lines and the position graph. It finds multiple candidate lines, detects transposition hits, records multiple review moments, rates sideline relevance, detects previously trained forgotten cards, tracks repeated opening mistakes, and adds local strategic-quality warnings through the heuristic analysis layer.

## Backend scaffold

The `server/` folder contains an optional SaaS backend scaffold with Fastify, Postgres migrations, sync snapshots, audit events, coach invitations, share links, and billing customer tables. Deploying this backend is optional for GitHub Pages use but required for true multi-user SaaS accounts, live coach-student permissions, account recovery, and hosted billing.
