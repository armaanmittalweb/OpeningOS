/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

interface VercelHeaders {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
}

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as VercelHeaders;
// Vercel sources are path-to-regexp; the ones used here are plain regex groups.
const rules = vercel.headers.map((r) => ({ re: new RegExp(`^${r.source.replace(/\.(?!\*)/g, '\.')}$`), headers: r.headers }));

/**
 * Serve /embed from embed.html and apply the vercel.json headers locally, so
 * dev and preview run under the same COOP/COEP split as production. In dev the
 * CSP is skipped (Vite's HMR client needs inline scripts and a websocket) and
 * the portfolio's local dev origin may frame /embed.
 */
function localHeaders(mode: 'dev' | 'preview'): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    if (path === '/embed' || path === '/embed/') req.url = '/embed.html';
    const match = path === '/embed.html' ? '/embed' : path;
    for (const rule of rules) {
      if (!rule.re.test(match)) continue;
      for (const h of rule.headers) {
        if (mode === 'dev' && h.key === 'Content-Security-Policy') continue;
        res.setHeader(h.key, h.value);
      }
    }
    if (mode === 'dev' && match.startsWith('/embed')) {
      res.setHeader('Content-Security-Policy', "frame-ancestors https://www.amittal.dev http://localhost:5173");
    }
    next();
  };
}

const headersPlugin = (): Plugin => ({
  name: 'openingos-local-headers',
  configureServer: (s) => void s.middlewares.use(localHeaders('dev')),
  configurePreviewServer: (s) => void s.middlewares.use(localHeaders('preview')),
});

export default defineConfig({
  plugins: [react(), headersPlugin()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: 'index.html', embed: 'embed.html' } },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
