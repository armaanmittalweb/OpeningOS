# OpeningOS player-experience audit implementation — 2026-05-18

This pass focuses on the product from a real chess player's point of view, especially board comfort, repertoire handling, game import clarity and keyboard flow.

## Audit findings

### Board and control
The board existed and was usable, but board size was buried in Settings and keyboard board control was too weak for serious study sessions. This pass adds visible board controls, persistent board sizing, focus mode and keyboard board navigation.

### Repertoire workspace
The repertoire screen had the right chess features, but line discovery, filtering and player flow were not obvious. This pass adds a line manager, filters, line health chips, a study flow strip, mobile workspace tabs and clearer idea-card guidance.

### Game import
The import engine existed, but the user needed more confidence during imports. This pass adds import status tracking, clear import action cards, duplicate-aware game persistence and repair-set visibility.

### Ease of use by rating level
Beginners need guidance to keep theory small. Tournament players need repair-first prep. This pass adds a training lens on the Today page to steer the workflow without adding more complexity.

### Keyboard controls
Global controls were present in pieces but not documented or comprehensive. This pass adds a keyboard shortcut system, visible help and board-level keyboard control.

## Implemented changes

- Added `js/player_experience_audit.js`.
- Added board size toolbar: S, M, L, XL.
- Added board focus mode.
- Added keyboard board interaction: arrows, Enter/Space, Escape, F, C.
- Added global shortcuts: search, navigation, import, add line, sync, practice, position actions, board focus, board flip, practice grading.
- Added repertoire line search and filters: All, Due, Weak, Critical, Branches, Retired.
- Added line health chips for due/weak/critical signals.
- Added repertoire flow strip for the player loop: choose line, understand position, practice from here.
- Added mobile workspace tabs for Board, Moves, Ideas and Notes.
- Added import cockpit and import health cards.
- Added duplicate-aware game import persistence and automatic matching metadata.
- Added repair-set card visibility from imported games.
- Added player level lens on Today: beginner, club player, tournament.
- Updated service worker cache to v15.
- Updated smoke tests to guard the new UX layer.

## Product result

OpeningOS now feels less like a developer-heavy app and more like a chess workspace where a player can quickly select a line, study the position, control the board, import games and practice repairs.
