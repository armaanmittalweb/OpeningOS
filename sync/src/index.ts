import { createApp, prune, type Bindings } from './app';
import { neonDb } from './db';

const app = createApp((env) => neonDb(env.DATABASE_URL));

export default {
  fetch: app.fetch,
  // Cron trigger (wrangler.jsonc): drop snapshots nobody has written for a year.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(prune(neonDb(env.DATABASE_URL)).then((n) => console.log(`prune: deleted ${n} snapshots`)));
  },
} satisfies ExportedHandler<Bindings>;
