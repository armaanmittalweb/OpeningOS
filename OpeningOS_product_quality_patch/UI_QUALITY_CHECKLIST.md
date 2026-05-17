# OpeningOS UI Quality Checklist

This checklist is for every build before sharing the app with players, coaches, or students.

## Core UX

- Today clearly shows the next best action.
- Repertoire creation, editing, duplication, deletion, and practice entry work.
- Practice feedback distinguishes correct, alternate, wrong, timeout, and guessed states.
- Game repair actions persist: practice, alternate, ignore, and create/match line.
- Coach packs can be exported and imported by a student profile.
- Backup/restore works before any serious user stores private prep.

## Responsive layout

- Desktop: board and side panels are readable at 1280px+.
- Tablet: major grids collapse without horizontal scrolling.
- Mobile: five-item bottom tabbar is visible and the FAB sits above it.
- Mobile: modals become bottom sheets with scrollable content.
- Mobile: chessboard never overflows the viewport.
- Mobile: toasts do not cover the bottom navigation.

## Accessibility

- Keyboard focus is visible.
- Command palette opens with Ctrl/Cmd+K.
- Card-like controls support Enter/Space via the UX polish layer.
- Skip-to-content link is available.
- Touch targets are at least comfortable size on mobile.
- Reduced-motion and high-contrast settings are available.

## Trust and safety

- Product assurance panel appears in Settings.
- Reliability center shows backup/deployment status.
- Security and privacy docs are present.
- No critical runtime dependency is loaded from a CDN.
- CSS variable check passes.
- `npm test` passes.
