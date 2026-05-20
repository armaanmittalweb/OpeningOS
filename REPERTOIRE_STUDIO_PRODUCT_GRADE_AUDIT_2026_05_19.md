# OpeningOS Repertoire Studio product-grade audit and fix

This patch rebuilds the Repertoire page around a board-first professional chess workspace.

## Problems found

- The Repertoire page was fighting the fixed workspace sidebar and could appear underneath it.
- The line title/header duplicated information and wrapped awkwardly, making the page feel broken.
- The board was too small for serious opening study.
- Compact/Comfort/Analysis controls were present but did not reliably feel like the page owned them.
- Notes and tool panels were competing with the board and could hide important UI.
- Side variations used browser prompt text entry, which feels like a developer tool and not a chess product.
- The variation tree existed but was visually secondary and not practical enough for professional study.
- Mobile menu contrast was not strong enough.

## Implemented changes

- Replaced the Repertoire view with a clean Studio layout:
  - opening folder library on the left;
  - large board-first study workspace;
  - move list, idea card and position tools beside the board;
  - variation tree, progress and notes below the board area.
- Added board-owned Compact/Comfort/Analysis controls.
- Added a board composer for:
  - opponent replies;
  - side variations;
  - insert move.
- Removed native prompt flow for adding side variations from the variation tree.
- Kept advanced actions available:
  - practice from here;
  - add opponent reply;
  - add side variation;
  - insert/remove moves;
  - mark critical;
  - edit structured idea card;
  - split line;
  - retire/restore line;
  - show transpositions.
- Improved folder and line management presentation.
- Increased board size and fixed coordinate alignment.
- Prevented page overlap with the workspace sidebar.
- Kept the existing local/backend data model unchanged.

## Manual QA checklist

1. Open Repertoire on desktop.
2. Confirm the page starts to the right of the app sidebar.
3. Confirm the board is large enough in Comfort and Analysis modes.
4. Confirm Compact/Comfort/Analysis visibly changes board size.
5. Confirm Focus board hides distractions and can be toggled off.
6. Add side variation using the board composer.
7. Insert a move using the board composer.
8. Add opponent reply using the board composer.
9. Open position actions and verify all actions appear.
10. Open variation tree and view a branch.
11. Edit idea card.
12. Add a folder and move a line.
13. Test on mobile width and verify the menu contrast.
