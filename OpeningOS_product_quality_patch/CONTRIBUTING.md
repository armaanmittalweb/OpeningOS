# Contributing

## Development

```bash
npm test
npm run dev
```

## Quality bar

Before merging changes:

- All JavaScript files must pass syntax checks.
- `npm test` must pass.
- Do not add placeholder buttons that only show a toast unless clearly labelled as preview.
- User-entered text must not be inserted with `innerHTML`.
- Critical assets must be local and cached by `sw.js`.
- Any new user data object must be included in full backup/restore.

## Product principles

OpeningOS should help users prepare better for real games. Prefer smaller, reliable workflows over broad but incomplete feature surfaces.
