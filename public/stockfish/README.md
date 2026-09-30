# Stockfish builds

These files are copied here from the `stockfish` npm package (Stockfish.js 19
by Nathan Rugg / Chess.com, GPL-3.0) by `scripts/copy-stockfish.mjs`, which
runs on `npm install`. They are git-ignored and loaded at runtime as a Web
Worker. They are never bundled into the app's JavaScript.

| File | Threads | Used when |
| --- | --- | --- |
| `stockfish-19-lite-single.js` + `.wasm` | 1 | Default. Works in any page, including `/embed` (not cross-origin isolated). |
| `stockfish-19-lite.js` + `.wasm` | many | Only when `crossOriginIsolated` is true (the standalone site sends COOP `same-origin` + COEP `require-corp`), which enables `SharedArrayBuffer`. |
| `COPYING.txt` | | The GPL-3.0 licence that ships with the engine. |

Both are the "lite" builds (about 1.7 MB WASM with an embedded small NNUE
net). The full 99 MB builds in the package are deliberately not copied.

The selection lives in `src/lib/engine.ts`.
