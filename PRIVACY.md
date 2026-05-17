# Privacy Notes

OpeningOS is private by default.

## Local-first mode

In the default mode, repertoire data, notes, games, review progress, coach records, and settings are stored in the user's browser storage.

No data is sent to an OpeningOS server because this static build does not have an OpeningOS server.

## Optional external services

Users may choose to use:

- Lichess public game imports
- Chess.com public game imports
- Lichess opening explorer
- Appwrite cloud sync

These features require network requests to those services.

## Backups

Users can export JSON backups manually. These files may contain private preparation and should be stored carefully.

## Cloud sync

Appwrite sync sends a JSON snapshot of the active OpeningOS profile to the configured Appwrite project. It is off by default.
