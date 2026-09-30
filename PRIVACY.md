# Privacy

OpeningOS has no accounts, no analytics and no ads.

## On your device

Your repertoire, drill history, imported games and settings are stored in your browser's IndexedDB. They never leave the device unless you use one of the features below. Clearing site data deletes them, so export a backup first.

The engine runs entirely on your device.

## Network requests you trigger

**Game imports.** When you import by username, the app fetches that user's public games directly from `lichess.org` or `api.chess.com`. Those sites see the request and your IP address, as with any visit to them.

**Sync (optional, off by default).** Turning sync on sends an encrypted snapshot of your data to `openingos-sync.amittal.dev`. The server receives and keeps only:
- an id derived from your phrase by SHA-256 (the phrase itself never leaves your device);
- the snapshot, encrypted with AES-GCM using a key derived from your phrase on your device, which the server cannot decrypt;
- a version number and the time of the last write.

What happens to that data afterwards:
- Cloudflare, which runs the server, processes IP addresses for rate limiting (30 requests a minute) and may keep standard request logs.
- Snapshots nobody has written for 365 days are deleted automatically.
- **Delete the synced copy**, in the sync dialog, removes yours immediately.

## Backups

Backups are plain JSON files that you download. They are not encrypted and may contain private preparation, so store them accordingly.
