# Stockfish build

These files are copied here from the `stockfish` npm package (Stockfish.js 19
by Nathan Rugg / Chess.com, GPL-3.0) by `scripts/copy-stockfish.mjs`, which
runs on `npm install`. They are git-ignored and loaded at runtime as a Web
Worker. They are never bundled into the app's JavaScript.

| File | What it is |
| --- | --- |
| `stockfish-19-lite-single.js` + `.wasm` | The single-threaded "lite" build: about 1.7 MB of WASM with a small embedded NNUE net. Works in any page, including `/embed`. |
| `COPYING.txt` | The GPL-3.0 licence that ships with the engine. |

The threaded lite build is deliberately not used. In Chromium it usually never
answers `uci`: it respawns its pthread workers in a loop until WebAssembly
memory runs out and the page freezes. The full 99 MB builds are not copied
either. See `src/lib/engine.ts`.
