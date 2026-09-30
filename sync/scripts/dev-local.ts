// DEV ONLY. Serves the Worker's Hono app on Node against an in-process PGlite
// database, so the app's sync can be tried without Neon or wrangler.
//
//   npm run dev:local        -> http://localhost:8788
//   then run the app with VITE_SYNC_URL=http://localhost:8788
//
// The database lives in memory: every restart starts empty.

import { serve } from '@hono/node-server';
import { createApp, type Bindings } from '../src/app';
import { freshPglite, pgliteDb } from '../test/helpers';

const PORT = Number(process.env.PORT) || 8788;

const env: Bindings = {
  DATABASE_URL: 'pglite://memory',
  ALLOWED_ORIGINS: 'http://localhost:5174,http://localhost:5173',
};

const db = pgliteDb(await freshPglite());
const app = createApp(() => db);

serve({ fetch: (req) => app.fetch(req, env), port: PORT }, ({ port }) => {
  console.log(`OpeningOS sync (dev-local, PGlite in memory) on http://localhost:${port}`);
});
