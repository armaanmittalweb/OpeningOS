# Stockfish integration

OpeningOS supports engine-backed analysis through the backend service.

Preferred production mode:

1. Install Stockfish on the backend host.
2. Set `STOCKFISH_CMD=/path/to/stockfish`.
3. Call `POST /analysis/fen` or queue `POST /analysis/jobs`.

The static frontend also has `js/stockfish_client.js`, which calls the backend when connected and falls back to a lightweight offline material check when no engine is configured.

A WASM worker can be placed in this folder and wired through `js/stockfish_client.js` if you prefer client-side engine analysis, but server-side analysis is recommended for rate limiting and battery/performance control.
