// Copies the Stockfish WASM builds this app uses from node_modules/stockfish
// into public/stockfish so Vite serves them as static files (never bundled).
//   stockfish-19-lite-single.{js,wasm}  single-threaded; works everywhere
//   stockfish-19-lite.{js,wasm}         multi-threaded; needs crossOriginIsolated
// Stockfish is GPL-3.0; its licence text is copied alongside.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'stockfish');
const dest = join(root, 'public', 'stockfish');
const files = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm', 'stockfish-19-lite.js', 'stockfish-19-lite.wasm'];

if (!existsSync(src)) {
  console.warn('[stockfish] node_modules/stockfish not installed; engine analysis will be unavailable.');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of files) copyFileSync(join(src, 'bin', f), join(dest, f));
copyFileSync(join(src, 'Copying.txt'), join(dest, 'COPYING.txt'));
console.log(`[stockfish] copied ${files.length} files to public/stockfish`);
