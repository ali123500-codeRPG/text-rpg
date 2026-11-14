// TQ7 browser smoke tests: the play page, built (and minified) as in production, on the real game (tests/smoke/game.ts: in-memory save,
// stand-in Claude). Few flows, the ones where screen wiring broke before: load and create (the opening), play a turn,
// report a bug (BG-27), switch story (BG-63), restore a backup (BG-123). Run: npm run smoke.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { chromium, type Browser, type Page } from 'playwright';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { mkdtempSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { tmpdir } from 'node:os';

const NARRATION = 'Smoke narration: the world goes on around you.';
let browser: Browser, page: Page, url: string, errors: string[];

beforeAll(async () => {
  const dir = mkdtempSync(`${tmpdir()}/smoke-`);
  await build({
    entryPoints: ['tests/smoke/entry.ts'], bundle: true, minify: true, format: 'iife', target: 'es2022', outdir: dir, logLevel: 'warning',
    loader: { '.woff2': 'file', '.webp': 'file' }, assetNames: 'assets/[name]', define: { __BUILD__: JSON.stringify({ sha: 'smoke', date: '2026-01-01' }) },
  });
  writeFileSync(`${dir}/index.html`, '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="entry.css"></head><body><script src="entry.js"></script></body></html>');
  url = `file://${dir}/index.html`;
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => { await browser?.close(); });

beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /not saved|unhandled/i.test(m.text()))) errors.push(`console: ${m.text()}`); });
  // a scenario that ends with gains shows the gains panel over the page; Continue closes it whenever it is in the way
  // (while it still moves, the first click only lands every gain, M-12, so it may take a second click)
  await page.addLocatorHandler(page.locator('.gains-veil'), async (veil) => {
    for (let i = 0; i < 5 && await veil.isVisible(); i++) {
      await veil.getByRole('button', { name: 'Continue' }).click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Begin the story' }).click();
  await page.getByText(/^Turn 0/).waitFor();
});

const turn = async (text: string, n: number) => {
  await page.getByPlaceholder(/What do you do/).fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText(new RegExp(`^Turn ${n} `)).waitFor();
};
const nav = (name: string) => page.locator('nav').getByText(name, { exact: true }).click();

describe('play page smoke (TQ7)', () => {
  it('loads, creates a character and shows the opening', async () => {
    await page.getByText(NARRATION).first().waitFor(); // the opening, narrated
    expect(errors).toEqual([]);
  });

  it('plays a turn: the input shows, the turn advances, the narration shows', async () => {
    await turn('look around', 1);
    await expect.poll(() => page.getByText(NARRATION).count()).toBe(2); // the opening and this turn
    expect(await page.getByText('look around', { exact: true }).count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  it('the suggestion from last turn is taken by clicking the box, or by Use it', async () => {
    await turn('look around then search the shelf', 1);
    const box = page.locator('.inbar .hs-input');
    await expect.poll(() => box.getAttribute('placeholder')).toBe('search the shelf');
    await box.click();
    expect(await box.inputValue()).toBe('search the shelf');
    await box.fill('');
    await turn('look around then open the door', 2);
    await page.getByRole('button', { name: 'Use it' }).click();
    expect(await box.inputValue()).toBe('open the door');
    expect(errors).toEqual([]);
  });

  it('an essence offer pops up after the turn; Take it puts it in a slot, shown in the Character page\'s Essences pop-up', async () => {
    await page.evaluate(() => {
      const s = (globalThis as unknown as { __GAME_API__: { state: () => { turn: number; player: { progression?: { essenceOffers?: unknown[] } } } } }).__GAME_API__.state();
      s.player.progression!.essenceOffers = [{ essence: 'ES3', grade: 'common', points: { SK11: 1, SK32: 1 }, turn: s.turn, source: 'foe', untilMin: 1e9 }];
    });
    await turn('look around', 1);
    const pop = page.locator('.ess-pop');
    await pop.waitFor();
    expect(await pop.innerText()).toMatch(/Street Instinct[\s\S]*\+1 Dodge[\s\S]*\+1 Insight/);
    await pop.getByRole('button', { name: 'Take it' }).click();
    await nav('Character');
    const tile = page.locator('[data-tile="essences"]');
    await expect.poll(() => tile.innerText()).toMatch(/1 of \d+/);
    await tile.click();
    const sec = page.locator('.ess-all');
    await expect.poll(() => sec.innerText()).toMatch(/1 of \d+ slots? used[\s\S]*Street Instinct/);
    expect(await sec.getByText('On offer').count()).toBe(0);
    expect(errors).toEqual([]);
  });

  it('reports a bug: it is filed as a new report, numbered later by Claude (BF45), and listed', async () => {
    await nav('Bugs');
    await page.getByPlaceholder(/What went wrong/).fill('smoke test report');
    await page.getByRole('button', { name: 'Report bug' }).click();
    await page.getByRole('cell', { name: 'smoke test report' }).waitFor();
    expect(await page.getByRole('row').filter({ hasText: 'smoke test report' }).getByText(/^New$/).count()).toBe(1);
    expect(errors).toEqual([]);
  });

  it('coming back to Play from another page shows the latest lines (BG-191)', async () => {
    await page.setViewportSize({ width: 1400, height: 420 }); // a short window, so the story overflows
    for (let n = 1; n <= 4; n++) await turn('look around', n);
    await nav('Bugs');
    await page.getByPlaceholder(/What went wrong/).waitFor();
    await nav('Play');
    await page.getByText(/^Turn 4 /).waitFor();
    const gap = await page.locator('.story').evaluate((s) => s.scrollHeight - s.scrollTop - s.clientHeight);
    expect(await page.locator('.story').evaluate((s) => s.scrollHeight > s.clientHeight)).toBe(true);
    expect(gap).toBeLessThan(40);
    expect(errors).toEqual([]);
  });

  it('BG-219: on a 2400px+ screen (page zoomed 1.3x) the Gear pop-up opens inside the window', async () => {
    const was = page.viewportSize();
    await page.setViewportSize({ width: 2560, height: 1440 });
    await nav('Character');
    await page.locator('[data-tile="gear"]').click();
    const pop = page.locator('.gear-pop');
    await pop.waitFor();
    const b = (await pop.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(2560);
    expect(b.y + b.height).toBeLessThanOrEqual(1440);
    await page.keyboard.press('Escape');
    if (was) await page.setViewportSize(was);
    expect(errors).toEqual([]);
  });

  it('BG-220: Back closes the full-screen Perks pop-up and stays on the Character page; closing it with ✕ leaves Back as it was', async () => {
    await nav('Character');
    const at = page.url();
    await page.locator('[data-tile="perks"]').click();
    await page.locator('.fpop').waitFor();
    await page.goBack();
    await page.locator('.fpop').waitFor({ state: 'detached' });
    expect(page.url()).toBe(at);
    await page.locator('[data-tile="perks"]').click();
    await page.locator('.fpop').waitFor();
    await page.locator('.fpop-x').click();
    await page.locator('.fpop').waitFor({ state: 'detached' });
    await page.waitForTimeout(100);
    expect(page.url()).toBe(at);
    expect(await page.evaluate(() => history.state?.fpop ?? null)).toBe(null);
    expect(errors).toEqual([]);
  });

  it('opens the Inventory with its Coin line and no summary boxes', async () => {
    await nav('Inventory');
    await page.getByText(/^Coin: /).waitFor();
    expect(await page.locator('.hs-readout.vis').count()).toBe(0); // the group-count boxes are gone from this page only
    await nav('Quests');
    await page.locator('h1', { hasText: 'Quests' }).waitFor();
    expect(errors).toEqual([]);
  });

  it('switches to the agent’s own story and back to the player’s', async () => {
    await turn('look around', 1);
    await page.getByRole('button', { name: 'Watch an agent play' }).click();
    await page.getByRole('button', { name: 'Agent’s' }).click();
    await page.getByText(/^Turn 0 /).waitFor(); // the agent's new story opens
    await page.getByRole('button', { name: 'Player’s' }).click();
    await page.getByText(/^Turn 1 /).waitFor(); // the player's story, as it was left
    expect(await page.getByText('look around', { exact: true }).count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  it('restores a backup from the GM view', async () => {
    for (let n = 1; n <= 12; n++) await turn('wait', n);
    await page.getByRole('button', { name: 'GM off' }).click();
    await nav('GM');
    await page.getByRole('row').filter({ hasText: 'Turn 10' }).getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('button', { name: 'Restore' }).last().click(); // the confirm
    await nav('Play');
    await page.getByText('Restored the backup from turn 10.').waitFor();
    await turn('wait', 11); // the next turn played is turn 11 again, not 13
    expect(errors).toEqual([]);
  });
}, 120_000);
