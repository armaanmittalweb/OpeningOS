import { test, expect } from '@playwright/test';

test('onboarding, settings, and mobile shell load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('OpeningOS')).toBeVisible();
  await expect(page.locator('.mobile-tabbar')).toBeAttached();
  await page.goto('/#settings');
  await expect(page.getByText(/SaaS Center|Settings/i)).toBeVisible();
});

test('line creation entry point and graph actions are reachable', async ({ page }) => {
  await page.goto('/#repertoire');
  await expect(page.getByRole('button', { name: /create|manual|add/i }).first()).toBeVisible();
  await page.evaluate(() => {
    const line = (window as any).OOSData.addUserLine({ name:'E2E Caro', eco:'B12', opening:'Caro-Kann', color:'b', tag:'must-know', repId:'rep-b-e4', moves:['e4','c6','d4','d5'] });
    (window as any).OOSData.insertGraphMove(line.id, 2, 'Nf3');
    (window as any).OOSData.removeGraphMove(line.id, 2);
    (window as any).OOSData.addGraphBranch(line.id, 2, ['Nc3']);
  });
  await page.reload();
  await expect(page.getByText('E2E Caro')).toBeVisible();
});

test('practice session can resume after reload', async ({ page }) => {
  await page.goto('/#practice');
  await page.evaluate(() => {
    const line = (window as any).OOSData.addUserLine({ name:'E2E Practice', eco:'B12', opening:'Caro', color:'b', tag:'must-know', repId:'rep-b-e4', moves:['e4','c6','d4','d5','e5','Bf5'] });
    const cards = (window as any).OOSData.positionsForLine(line.id);
    (window as any).OOSViews.startSessionWith(cards, { mode:'daily' });
  });
  await expect(page.locator('.board, .chessboard, [data-board]').first()).toBeAttached();
  await page.reload();
  await expect(page.getByText(/Resume|Practice|Review/i).first()).toBeVisible();
});

test('game import and deviation repair core API works', async ({ page }) => {
  await page.goto('/#games');
  const result = await page.evaluate(() => {
    const DB = (window as any).OOSData;
    const line = DB.addUserLine({ name:'E2E Game Line', eco:'B12', opening:'Caro', color:'b', tag:'must-know', repId:'rep-b-e4', moves:['e4','c6','d4','d5','e5','Bf5'] });
    const game = DB.addUserGame({ vs:'Opponent', yourColor:'b', pgn:'1. e4 c6 2. d4 d5 3. Nc3', lineId:line.id });
    const review = DB.deepReviewGame(game);
    return { matches: review.matches.length, deviations: review.deviations.length };
  });
  expect(result.matches).toBeGreaterThan(0);
  expect(result.deviations).toBeGreaterThan(0);
});

test('backup export/import and SaaS center exist', async ({ page }) => {
  await page.goto('/#settings');
  await page.evaluate(() => {
    const snap = (window as any).OOSData.exportSnapshot();
    (window as any).OOSData.importSnapshot(snap);
  });
  await page.getByRole('button', { name: /SaaS Center/i }).click();
  await expect(page.getByText(/Backend & Account/i)).toBeVisible();
});

test.use({ viewport: { width: 390, height: 844 } });
test('mobile navigation and keyboard accessibility', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.mobile-tabbar')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
});
