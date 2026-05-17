import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const entries = [
  'index.html','styles.css','manifest.json','sw.js','404.html','robots.txt','sitemap.xml',
  'icons','vendor','js','public','docs','PRIVACY.md','SECURITY.md','README.md','README_FULLSTACK.md','FULL_PRODUCT_IMPLEMENTATION.md','BACKEND_PRODUCTION_DEPLOYMENT.md','PRODUCT_COMPLETION_MATRIX.md','SECURITY_PRODUCTION_REVIEW.md','DEPLOYMENT_GITHUB_STUDENT.md'
];
for (const entry of entries) {
  if (existsSync(entry)) await cp(entry, new URL(entry, dist), { recursive: true });
}
await writeFile(new URL('build-info.json', dist), JSON.stringify({ name: 'OpeningOS', builtAt: new Date().toISOString(), mode: 'static-local-first' }, null, 2));
console.log('Built static app into dist/.');
