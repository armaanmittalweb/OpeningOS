import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function files(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory() && !['.git','node_modules','dist'].includes(ent.name)) await files(p, out);
    else if (ent.isFile() && /\.(js|html|css|md|ts|json)$/.test(ent.name)) out.push(p);
  }
  return out;
}
const all = await files('.');
const bad = [];
for (const f of all) {
  const s = await readFile(f, 'utf8');
  if (/TODO: ship|console\.log\([^)]*password/i.test(s)) bad.push(f);
}
if (bad.length) {
  console.error('Static lint failed:', bad.join(', '));
  process.exit(1);
}
console.log(`Static lint passed (${all.length} files checked).`);
