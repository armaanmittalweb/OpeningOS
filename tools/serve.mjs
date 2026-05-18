import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const port = Number(process.env.PORT || process.env.OPENINGOS_PORT || 4173);
const root = process.cwd();
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8' };
function safePath(url) {
  const clean = decodeURIComponent(String(url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const candidate = normalize(join(root, clean));
  return candidate.startsWith(root) ? candidate : join(root, 'index.html');
}
const server = http.createServer((req, res) => {
  let file = safePath(req.url);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  createReadStream(file).on('error', () => { res.writeHead(404); res.end('Not found'); }).pipe(res);
});
server.listen(port, '127.0.0.1', () => console.log(`OpeningOS dev server http://127.0.0.1:${port}`));
