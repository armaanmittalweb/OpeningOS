# Contributing

## Setup

```sh
npm install
npm run dev          # http://localhost:5174
```

The sync server has its own package in `sync/` (see its README).

## Before you open a pull request

- `npm run build` passes (it typechecks first) and `npm test` passes.
- If you touched `sync/`: `npm test` and `npm run typecheck` pass inside `sync/`.
- If you changed the UI:
  - run `npm run preview`, then `npm run shots`;
  - look at the screenshots in both themes, on desktop and phone;
  - keep the script's axe run at zero violations.

## Rules the code keeps

- Chess logic lives in `src/domain/`, stays pure (no DOM, no storage) and is covered by tests.
- New user data must be included in backup, restore and the sync snapshot (`AppData` in `src/lib/store.ts`), and its version must be checked on load.
- Render user text as text. No `innerHTML` or `dangerouslySetInnerHTML`.
- Network requests may go only to Lichess, Chess.com and the sync host. Anything new must also be added to the CSP in `vercel.json`, with a reason.
- No button that does nothing yet. If a feature is not finished, leave it out.
- Keep the sync server unable to read user data: it stores the envelope and nothing else.

## Scope

OpeningOS should help you prepare better for real games. Prefer a small workflow that works over a broad one that doesn't.
