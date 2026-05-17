# Device and Browser QA Matrix

Use this matrix before giving OpeningOS to serious players or coaches.

## Desktop

- Chrome latest: dashboard, repertoire editing, practice, backup/restore, PWA update.
- Firefox latest: board input, modal focus, IndexedDB persistence, PGN import.
- Safari latest: offline reload, IndexedDB durability, service worker cache updates.
- Edge latest: GitHub Pages install prompt, export/import backup.

## Mobile

- Android Chrome: install to home screen, offline after first load, bottom tab bar safe-area spacing.
- Android Firefox: practice board taps, modal keyboard behavior.
- iPhone Safari: Add to Home Screen, orientation change, offline reload, bottom safe-area spacing.
- iPad Safari: two-column repertoire workspace, model-game trainer, focus rings.

## Critical flows

1. Create a profile.
2. Create a line manually.
3. Insert a middle move, remove a middle move, create a branch, split a line, retire/restore.
4. Mark a position critical and edit idea/plan/hook.
5. Practice from current ply; close tab; resume session.
6. Accept an alternate move and verify it appears as correct later.
7. Import a PGN game, match against multiple lines, repair deviations.
8. Export backup, clear browser data, import backup.
9. Install as PWA; go offline; practice due cards.
10. Run screen reader smoke test with move announcements enabled.
