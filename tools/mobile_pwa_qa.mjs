import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('manifest.json','utf8'));
const sw = await readFile('sw.js','utf8');
const css = await readFile('styles.css','utf8');
const checks = [
  ['PWA has standalone display', manifest.display === 'standalone' || manifest.display_override],
  ['PWA has 192 icon', (manifest.icons || []).some(i => String(i.sizes || '').includes('192'))],
  ['PWA has 512 icon', (manifest.icons || []).some(i => String(i.sizes || '').includes('512'))],
  ['Service worker caches core shell', sw.includes('STATIC_ASSETS') && sw.includes('./index.html')],
  ['Service worker update version set', /oos-v\d|saas-complete|complete/.test(sw)],
  ['Mobile safe area CSS present', css.includes('safe-area-inset-bottom')],
  ['Mobile tabbar CSS present', css.includes('.mobile-tabbar')],
  ['Focus visible CSS present', css.includes(':focus-visible')],
];
let failed = false;
for (const [name, ok] of checks) { console.log(`${ok ? 'OK' : 'FAIL'} ${name}`); if (!ok) failed = true; }
if (failed) process.exit(1);
