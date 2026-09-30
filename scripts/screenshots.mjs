// Visual check: captures desktop and phone screenshots of the main states and
// runs axe on each route. Expects `npm run build && npm run preview` on :5174.
//   node scripts/screenshots.mjs [--only name,name]
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://localhost:5174';
const OUT = new URL('../screenshots/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;

const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const axeResults = {};
const consoleErrors = [];

async function axe(page, name) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  axeResults[name] = r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target }));
}

async function run(size, scheme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: sizes[size], colorScheme: scheme, deviceScaleFactor: size === 'phone' ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${size}/${scheme}: ${m.text()}`));
  page.on('pageerror', (e) => consoleErrors.push(`${size}/${scheme}: ${e.message}`));
  const tag = `${size}-${scheme}`;
  const shot = async (name, full = false) => {
    if (only && !only.includes(name)) return;
    await page.waitForTimeout(250);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-${tag}.png`, OUT)), fullPage: full });
  };

  await page.goto(`${BASE}/`);
  await page.waitForSelector('.board');
  await shot('empty');
  if (size === 'desktop' && scheme === 'light') await axe(page, 'empty');

  await page.getByRole('button', { name: 'Load the Italian Game demo' }).first().click();
  await page.getByRole('button', { name: 'Two Knights, d3', exact: true }).click();
  await page.locator('.movetext button.mv').nth(5).click();
  await shot('repertoire');
  if (size === 'desktop' && scheme === 'light') await axe(page, 'repertoire');

  await page.goto(`${BASE}/drill`);
  await page.getByRole('button', { name: /Start drill/ }).click();
  await page.locator('#drill-input').fill('e4');
  await page.locator('#drill-input').press('Enter');
  await page.keyboard.press('3');
  await page.locator('#drill-input').waitFor({ state: 'detached' }).catch(() => {});
  await page.getByRole('button', { name: /Next card/ }).click();
  await page.locator('#drill-input').fill('Nf3');
  await page.locator('#drill-input').press('Enter');
  await shot('drill-grading');
  await page.keyboard.press('3');
  await shot('drill');
  if (size === 'desktop' && scheme === 'light') await axe(page, 'drill');

  await page.goto(`${BASE}/graph`);
  await page.waitForSelector('.graph');
  const merge = page.locator('[data-node][aria-label*="transposition"]').first();
  await merge.click();
  await shot('graph');
  if (size === 'desktop' && scheme === 'light') await axe(page, 'graph');

  await page.goto(`${BASE}/games`);
  await page.locator('.game-row').first().click();
  await shot('games');
  if (size === 'desktop' && scheme === 'light') await axe(page, 'games');

  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: 'Sync' }).click();
  await shot('sync');
  if (size === 'desktop' && scheme === 'light') await axe(page, 'sync');
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/embed`);
  await page.waitForSelector('.board');
  await page.locator('.embed .board').click({ position: { x: 10, y: 10 } }).catch(() => {});
  await shot('embed');
  if (size === 'desktop' && scheme === 'light') await axe(page, 'embed');
  await page.getByRole('button', { name: 'Transposition' }).click();
  await page.waitForTimeout(4600);
  await shot('embed-transpose');
  await browser.close();
}

for (const size of ['desktop', 'phone']) for (const scheme of ['light', 'dark']) await run(size, scheme);
writeFileSync(new URL('axe.json', OUT), JSON.stringify({ axeResults, consoleErrors }, null, 2));
console.log(JSON.stringify({ axeResults, consoleErrors }, null, 2));
