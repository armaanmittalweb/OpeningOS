# OpeningOS

A local-first chess opening trainer. You build a repertoire by playing moves, drill it with spaced repetition, and check your real games against it. Everything lives in your browser; there is no account.

Live at **https://openingos.amittal.dev**.

## What it does

- **Repertoire.** Play or type moves to build lines for White or Black. Positions are keyed by a normalized FEN, so two move orders that reach the same position share one node, and the app tells you when a line transposes into prep you already have.
- **Graph.** The whole repertoire drawn as a position graph, transpositions included.
- **Drill.** Each of your moves is a card. You play it on the board (or type it), grade yourself, and an FSRS scheduler decides when you see it again. Sessions resume where you left off.
- **Games.** Import your games from Lichess or Chess.com by username (both allow it without signing in), or paste PGN. Each game is replayed against your repertoire: where you left your preparation, where your opponent did, and which games reached your prep by transposition.
- **Engine.** Stockfish 19 (lite, single-threaded WASM) runs in a Web Worker on your device. It reaches depth 20 from the start position in about two seconds.
- **Offline.** A service worker caches the app shell and the engine, and the app installs as a PWA.
- **Backup and sync.** Export or restore a JSON backup at any time. Optional sync between devices uses a six-word phrase and end-to-end encryption; see [Sync](#sync).

## Stack

React 19, TypeScript, Vite, chess.js, IndexedDB (with an in-memory fallback), Stockfish.js 19 and WebCrypto. The sync server is a Cloudflare Worker (Hono) on Neon Postgres, in [`sync/`](sync/).

## Development

```sh
npm install        # also copies the Stockfish build into public/stockfish
npm run dev        # http://localhost:5174
npm test           # vitest: domain logic, scheduler, PGN, sync crypto
npm run build      # typecheck + production build
npm run shots      # screenshots of every view plus an axe run (needs `npm run preview` running)
```

To try sync locally, start the dev server in `sync/` and point the app at it:

```sh
cd sync && npm install && npm run dev:local    # http://localhost:8788, in-memory database
# in another terminal, from the repo root:
VITE_SYNC_URL=http://localhost:8788 npm run dev
```

Without `VITE_SYNC_URL` the app still works fully: the sync section says no server is configured, and backups still work. Copy `.env.example` to `.env.local` to set it permanently.

## Layout

| Path | What is there |
| --- | --- |
| `src/domain/` | Pure logic with no DOM: the position graph, repertoire lines, PGN parsing, game review, the FSRS scheduler. |
| `src/lib/` | The store, IndexedDB, Lichess and Chess.com imports, the Stockfish wrapper, sync crypto and client. |
| `src/app/` | The four views (Repertoire, Graph, Drill, Games), game review and the sync dialog. |
| `src/embed/` | `/embed`, a small build used by the Lab on [amittal.dev](https://www.amittal.dev): a five-card drill and a transposition demo, driven over `postMessage`. |
| `sync/` | The sync API Worker, its schema and tests. |
| `public/sw.js` | The service worker. |

## Sync

A six-word phrase from the BIP-39 English list (66 bits) is generated on the device. From it the app derives:

- an **id**: SHA-256 of a domain-separated string. It is the only thing the server can link to you;
- an **AES-GCM key** via PBKDF2 (200,000 iterations). The snapshot is encrypted before it leaves the device.

The phrase is never stored. The device keeps the id and a non-extractable `CryptoKey` in IndexedDB.

The server stores one opaque blob per id, with a version number:
- Writes send `If-Match` with the version the device last saw.
- If another device wrote first, the server answers 409 and the app asks which copy to keep.
- Snapshots are limited to 1 MB, and snapshots nobody has written for a year are deleted.

The API is documented in [`sync/README.md`](sync/README.md).

If you lose the phrase, nobody can recover the synced copy, including the server. Keep a backup.

## Deploy

Everything runs on free tiers.

1. **Frontend (Vercel).** Import the repo; `vercel.json` sets the build, rewrites and security headers. Set `VITE_SYNC_URL=https://sync.openingos.amittal.dev` and add the domain `openingos.amittal.dev`.
2. **Sync (Cloudflare Workers + Neon).** Follow [`sync/README.md`](sync/README.md).

The CSP in `vercel.json` allows network requests only to Lichess, Chess.com and the sync host. `/embed` may be framed only by `https://www.amittal.dev`; every other page refuses framing.

## Licence

Stockfish is GPL-3.0; its licence ships alongside the engine in `public/stockfish/COPYING.txt`.
