# OpeningOS freeze fix — 2026-05-19

This patch fixes the browser unresponsive issue after the world-class product shell deployment.

Root causes found:

1. `js/world_class_product_core.js` had a recursive sync-trust path: `updateSyncTrust()` called `ensureShell()`, and when the shell already existed, `ensureShell()` called `updateSyncTrust()` again. This can freeze the page immediately after the shell mounts.
2. Earlier product text polishing could do excessive DOM work. The product-experience layer is kept in the safe/debounced version.

Fixes:

- `ensureShell()` now returns after updating active navigation when the shell already exists. It no longer calls `updateSyncTrust()` recursively.
- Product text polishing remains scoped/debounced.
- Service worker cache version is bumped to `oos-v19-freeze-fix-auth-text`.
- Smoke tests now guard against the recursion returning.

After deploying, clear old PWA cache once or test in Incognito.
