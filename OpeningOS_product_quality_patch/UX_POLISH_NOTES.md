# UX Polish Notes

This build includes a final responsive-polish layer for real user testing.

## Added

- Mobile-first board sizing and safe-area spacing.
- Larger touch targets on touch devices.
- Stronger keyboard focus states.
- Skip-to-content link.
- Keyboard activation for card-like controls.
- Better mobile modal/bottom-sheet behavior.
- More resilient line headers, action rows, game cards, practice grading, and settings layout.
- Settings -> Product assurance panel with an in-app feature checklist.
- `window.OOSUX.runUXChecklist()` for manual QA during launch testing.

## QA expectation

Before sharing with serious users, test at these viewport widths:

- 390px phone
- 768px tablet
- 1024px laptop
- 1440px desktop

Core flows to verify:

1. Create line manually.
2. Practice the line.
3. Add accepted alternate.
4. Import PGN/game.
5. Repair a deviation.
6. Export and restore backup.
7. Export/import coach pack.
8. Configure Appwrite cloud sync if needed.
