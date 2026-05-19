# OpeningOS Repertoire UX audit and implementation — 2026-05-19

## Audit summary

The Repertoire page had enough chess functionality, but the player experience was still too dense. The major issues were:

1. The board could become too small because three major columns competed for width.
2. Notes felt like an overlay/side panel that could hide important content.
3. Coordinates on the SVG board were positioned too close to square edges and looked misaligned at some board sizes.
4. Opening organization was folder-limited: users could not create their own preparation folders or act at folder level.
5. Branches and side variations existed in data, but the page did not expose them as a visual opening tree.
6. Mobile quick actions were readable in some themes but could merge with the background and had no obvious close button.

## Implemented changes

### Board-first Repertoire workspace

- Increased Repertoire board target size to a 720px workspace size on desktop.
- Rebalanced the Repertoire grid so the board and move list receive priority.
- Added responsive breakpoints so the board stays large on tablets and safe on phones.
- Kept all existing editor tools: line surgery, practice from here, idea cards, notes, branch tools, and progress strip.

### Board coordinate alignment

- Adjusted file/rank coordinate SVG positioning.
- Added `text-anchor` and `dominant-baseline` attributes for centered coordinates.
- Added CSS for more legible coordinates across light/dark themes.

### Movable notes

- Notes now have three dock modes: Right, Below, and Floating.
- Floating notes can be dragged and persist their position.
- On narrower screens, notes move below the workspace or become a safe floating panel instead of hiding content.

### Custom folders

- Users can create custom opening folders.
- Folder-level actions added: Study, PGN export, Rename, Delete.
- Deleting a folder keeps the lines and moves them back to a default White/Black folder.
- Lines can be moved to folders. Non-editable lines are copied into an editable line before being moved.

### Variation tree / flow map

- Added a visual variation map for the selected repertoire family.
- Main-line moves are displayed as clickable flow nodes.
- Branches and deviations are displayed as branch cards.
- Branch cards support View, Move, Edit, and Delete actions when available.
- Users can add a branch from the current position directly from the flow map.

### Mobile quick actions

- Added a visible close button to the mobile sheet.
- Strengthened sheet contrast and button backgrounds.
- Improved hover/focus states so actions do not blend into the page background.

## Validation

Validated with:

```bash
npm run validate:full
```

Result:

```text
OpeningOS product smoke checks passed
Static lint passed
Built static app into dist/
tsc --noEmit -p tsconfig.json
```

## Notes

The changes are intentionally additive and do not remove existing features. They reorganize and expose existing capabilities more clearly while adding folder management and a visual variation map.
