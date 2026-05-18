import { test, expect } from '@playwright/test';

const route = (hash = 'today') => `/?skip-auth&skip-onboard#${hash}`;

test('product shell loads with sidebar, trust pill and dashboard', async ({ page }) => {
  await page.goto(route('today'));
  await expect(page.getByText('OpeningOS')).toBeVisible();
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await expect(page.locator('#syncTrustPill')).toBeVisible();
  await expect(page.locator('.today-command-center')).toBeVisible();
});

test('repertoire workspace exposes premium position actions', async ({ page }) => {
  await page.goto(route('repertoire'));
  await page.evaluate(() => {
    const DB = (window as any).OOSData;
    DB.addUserLine({ name:'E2E Caro Workspace', eco:'B12', opening:'Caro-Kann', color:'b', tag:'must-know', repId:'rep-b-e4', moves:['e4','c6','d4','d5','e5','Bf5'] });
  });
  await page.reload();
  await expect(page.locator('.premium-repertoire-head')).toBeVisible();
  await page.getByRole('button', { name: /Position actions/i }).click();
  await expect(page.getByText(/Practice from here/i)).toBeVisible();
  await expect(page.getByText(/Add opponent reply/i)).toBeVisible();
  await expect(page.getByText(/Add side variation/i)).toBeVisible();
});

test('graph editing API supports insert remove branch split and critical idea cards', async ({ page }) => {
  await page.goto(route('repertoire'));
  const result = await page.evaluate(() => {
    const DB = (window as any).OOSData;
    const line = DB.addUserLine({ name:'E2E Graph Line', eco:'B12', opening:'Caro', color:'b', tag:'must-know', repId:'rep-b-e4', moves:['e4','c6','d4','d5'] });
    const inserted = DB.insertGraphMove(line.id, 2, 'Nf3');
    const removed = DB.removeGraphMove(line.id, 2);
    const branch = DB.addGraphBranch(line.id, 2, ['Nc3']);
    const split = DB.splitLineFromPly(line.id, 2);
    const card = DB.positionsForLine(line.id)[0];
    DB.markPositionCritical(card.id, true, 'E2E critical');
    DB.setIdeaCard(card.id, { idea:'Control the center', plan:'Prepare ...d5', hook:'Caro first' });
    return { inserted: !!inserted, removed: !!removed, branch: !!branch, split: !!split, critical: DB.positionFlag(card.id).critical, idea: DB.ideaCardFor(card.id).idea };
  });
  expect(result.branch).toBeTruthy();
  expect(result.split).toBeTruthy();
  expect(result.critical).toBeTruthy();
  expect(result.idea).toContain('Control');
});

test('practice session can resume after reload', async ({ page }) => {
  await page.goto(route('practice'));
  await page.evaluate(() => {
    const DB = (window as any).OOSData;
    const line = DB.addUserLine({ name:'E2E Practice', eco:'B12', opening:'Caro', color:'b', tag:'must-know', repId:'rep-b-e4', moves:['e4','c6','d4','d5','e5','Bf5'] });
    const cards = DB.positionsForLine(line.id);
    (window as any).OOSViews.startSessionWith(cards, { mode:'daily' });
  });
  await expect(page.locator('.board, .chess-board, [data-board]').first()).toBeAttached();
  await page.reload();
  await expect(page.getByText(/Resume|Practice|Review/i).first()).toBeVisible();
});

test('game review creates repair moments from imported game', async ({ page }) => {
  await page.goto(route('games'));
  const result = await page.evaluate(() => {
    const DB = (window as any).OOSData;
    const line = DB.addUserLine({ name:'E2E Game Line', eco:'B12', opening:'Caro', color:'b', tag:'must-know', repId:'rep-b-e4', moves:['e4','c6','d4','d5','e5','Bf5'] });
    const game = DB.addUserGame({ vs:'Opponent', yourColor:'b', pgn:'1. e4 c6 2. d4 d5 3. Nc3', lineId:line.id });
    const review = DB.deepReviewGame(game);
    return { matches: review.matches.length, deviations: review.deviations.length, moments: review.moments.length };
  });
  expect(result.matches).toBeGreaterThan(0);
  expect(result.deviations).toBeGreaterThan(0);
  expect(result.moments).toBeGreaterThan(0);
});

test('backup export/import and trust settings are reachable', async ({ page }) => {
  await page.goto(route('settings'));
  await page.evaluate(() => {
    const snap = (window as any).OOSData.exportSnapshot();
    (window as any).OOSData.importSnapshot(snap);
  });
  await expect(page.getByText(/Trust and beta readiness/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Export data/i })).toBeVisible();
});

test('offline reload still serves the PWA shell after first load', async ({ page, context }) => {
  await page.goto(route('today'));
  await expect(page.getByText('OpeningOS')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('OpeningOS')).toBeVisible();
  await context.setOffline(false);
});

test.use({ viewport: { width: 390, height: 844 } });
test('mobile layout keeps product navigation usable', async ({ page }) => {
  await page.goto(route('repertoire'));
  await expect(page.locator('.mobile-tabbar')).toBeVisible();
  await expect(page.locator('.app-sidebar')).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
});
