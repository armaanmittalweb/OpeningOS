# Security

Opening preparation can be private (tournament work, opponent prep), so OpeningOS keeps it on the device by default and encrypts it before it goes anywhere else.

## Protections

- **No accounts.** There are no passwords to leak and no user table.
- **End-to-end encrypted sync.**
  - A six-word phrase (66 bits) yields an AES-GCM key via PBKDF2-SHA-256 with 200,000 iterations, plus a separate SHA-256 id.
  - The server stores ciphertext keyed by that id.
  - The key is kept as a non-extractable `CryptoKey`, and the phrase is never stored.
- **Sync server.**
  - It accepts only well-formed ids (64 hex characters) and `{v, iv, ct}` envelopes up to 1 MB, and stores only those three fields.
  - Writes are conditional on the version (`If-Match`), so one device cannot silently overwrite another.
  - Each IP is limited to 30 requests a minute, and CORS allows only the app's origins.
  - New phrases are refused once the database nears the free-tier size cap.
- **Content Security Policy** (see `vercel.json`):
  - Scripts come from this origin only, plus `wasm-unsafe-eval` for Stockfish; there are no inline scripts.
  - Network requests may go only to Lichess, Chess.com and the sync host.
  - Every page refuses framing except `/embed`, which only `https://www.amittal.dev` may frame.
- **No HTML injection.** User text (line names, PGN headers) is rendered as text by React, and nothing uses `innerHTML`.

## Limits

- The id is derived from the phrase alone, so anyone who has your phrase can read and overwrite your synced copy. Treat the phrase like a password.
- The PBKDF2 salt is fixed per app, not per user. This is deliberate: the phrase alone must be enough to find and decrypt the data on a new device, and its 66 bits of entropy are what resist guessing.
- Deleting from the server does not delete copies on your other devices or your backup files.

## Reporting a problem

Please open a private report through GitHub Security Advisories on this repository rather than a public issue.
