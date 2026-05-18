# OpeningOS World-Class Product Core Implementation — 2026-05-18

This release consolidates the product experience around the real player loop:

**Build repertoire → Practice due positions → Import games → Review mistakes → Repair prep → Sync safely.**

## Implemented

### 1. Product shell
- Added a persistent chess-product sidebar: Today, Repertoire, Practice, Games, Insights, Library, Coach, Settings.
- Added a sticky top workspace bar with command search, cloud sync trust, and account access.
- Removed developer-facing vocabulary from visible product surfaces where possible.
- Added feedback/report issue entry point.

### 2. Repertoire workspace
- Added a premium Repertoire command header.
- Added search and filters for lines: All, Due, Weak, Critical, Branches, Retired.
- Added board toolbar: Flip, Focus board, Compact, Comfort, Analysis.
- Added position action dock: Practice, Reply, Variation, Critical, Idea, Split, Retire, Transpositions.
- Improved keyboard and focus behavior for line entries.

### 3. Account/workspace clarity
- Kept account as the primary product concept.
- Moved cloud connection details into hidden/advanced settings.
- Uses user-facing language: Account, Workspace, Cloud sync, Repertoire.

### 4. Today dashboard
- Added a command-center style dashboard with next-action cards:
  - positions due today
  - weakest line
  - repair moments
  - cloud safety state

### 5. Sync trust
- Added visible indicators for local save and cloud sync.
- Added retry sync action.
- Wrapped sync functions to update the trust state after successful push/pull.

### 6. Import flow
- Replaced the import wizard with a player-friendly import cockpit.
- Added import states: Connecting, Fetching games, Parsing games, Matching repertoire, Finding repair moments.
- Added friendlier errors for private profiles, no games, rate limits and network failures.
- Added duplicate-skipped summary and repair-moment preview.

### 7. Game repair report
- Added a repair inbox that summarizes useful corrections from imported games.
- Added one-click Practice repair set.
- Added repeated mistake language where the same line/ply appears multiple times.

### 8. Backend import quality
- Normalized Chess.com and Lichess imports into a common game schema.
- Lichess imports now request PGN in JSON when available and normalize NDJSON records.
- Chess.com imports support a higher game limit and return normalized metadata.

### 9. Email reliability
- SMTP email delivery now uses nodemailer when SMTP credentials are configured.
- In development/no-SMTP mode, emails are still logged/queued without pretending delivery happened.

### 10. CI and repo hygiene
- Push CI is fast again: smoke/lint/build/typecheck and backend build only.
- Full Playwright E2E is manual/PR-based and Chromium-only by default in CI.
- Added world-class core checks to the smoke suite.
- Service worker cache bumped to `oos-v18-world-class-product-core`.

## Still requires deployment/provider configuration
- Real SMTP provider credentials for password reset and coach invitation emails.
- Credential rotation for previously exposed database credentials.
- Real browser/device QA on iOS Safari, Android Chrome, iPad Safari.
- Full E2E run before inviting larger beta groups.
- Stockfish/server engine configuration if engine-backed opening evaluation is needed.

## Recommended beta QA
1. Sign up, log in, log out, log back in.
2. Create and edit a repertoire line.
3. Use board size modes and focus board.
4. Add reply branch, side variation, critical flag and idea card.
5. Import Chess.com games.
6. Import Lichess games.
7. Verify duplicates are skipped.
8. Practice repair set from imported games.
9. Refresh and confirm cloud sync status remains clear.
10. Run E2E manually from GitHub Actions before sharing with users.
