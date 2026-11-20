// TQ7 browser smoke tests: the play page, built (and minified) as in production, on the real game (tests/smoke/game.ts: in-memory save,
// stand-in Claude). Few flows, the ones where screen wiring broke before: load and create (the opening), play a turn,
// report a bug (BG-27), switch story (BG-63), restore a backup (BG-123). Run: npm run smoke.
// near: src/ui/ tests/smoke/game.ts tests/smoke/entry.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { chromium, type Browser, type Page } from 'playwright';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { createServer, type Server } from 'node:http';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { tmpdir } from 'node:os';

const NARRATION = 'Smoke narration: the world goes on around you.';
let browser: Browser, page: Page, url: string, errors: string[], server: Server;

beforeAll(async () => {
  const dir = mkdtempSync(`${tmpdir()}/smoke-`);
  // sounds go inline as data URLs
  await build({
    entryPoints: ['tests/smoke/entry.ts'], bundle: true, minify: true, format: 'iife', target: 'es2022', outdir: dir, logLevel: 'warning',
    loader: { '.woff2': 'file', '.webp': 'file', '.mp3': 'dataurl' }, assetNames: 'assets/[name]', define: { __BUILD__: JSON.stringify({ sha: 'smoke', date: '2026-01-01' }) },
  });
  writeFileSync(`${dir}/index.html`, '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="entry.css"></head><body><script src="entry.js"></script></body></html>');
  // served over http, as the published page is: the body figures (assets/figures, BV15) load by fetch, which file:// refuses
  cpSync('assets/figures', `${dir}/assets/figures`, { recursive: true, filter: (f: string) => !f.includes('/models') });
  const TYPES: Record<string, string> = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp' };
  server = createServer((req: { url: string }, res: { writeHead: (n: number, h?: object) => void; end: (b?: unknown) => void }) => {
    const path = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    let body: unknown;
    try { body = readFileSync(`${dir}/${path}`); } catch { res.writeHead(path.startsWith('sfx/') ? 204 : 404); res.end(); return; } // sfx/: optional sounds the page probes for
    res.writeHead(200, { 'content-type': TYPES[path.split('.').pop()!] ?? 'application/octet-stream' }); res.end(body);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/index.html`;
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => { await browser?.close(); server?.close(); });

beforeEach(async ({ task }) => {
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
  if (task.name.startsWith('creation:')) return; // stays on the creation screen
  await page.getByRole('button', { name: 'Begin the story' }).click();
  await page.getByText(/^Turn 0/).waitFor();
});

const turn = async (text: string, n: number) => {
  await page.getByPlaceholder(/What do you do/).fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText(new RegExp(`^Turn ${n}\\b`)).waitFor();
};
const nav = (name: string) => page.locator('nav').getByText(name, { exact: true }).click();

describe('play page smoke (TQ7)', () => {
  it('loads, creates a character and shows the opening', async () => {
    await page.getByText(NARRATION).first().waitFor(); // the opening, narrated
    expect(errors).toEqual([]);
  });

  it('creation: BG-264, a race change (the race buttons or Random) keeps the skill points as set', async () => {
    const race = (n: string) => page.getByRole('group', { name: 'Race' }).getByRole('button', { name: n });
    const points = () => page.locator('.row[data-k]').evaluateAll((rs) => Object.fromEntries(rs.map((r) => [(r as HTMLElement).dataset.k, r.querySelector('.val')!.textContent])));
    await race('Human').click();
    await page.getByRole('button', { name: 'Lower Parry' }).click();
    await page.getByRole('button', { name: 'Raise Dodge' }).click();
    const set = await points();
    await race('Elf').click();
    expect(await race('Elf').getAttribute('aria-pressed')).toBe('true');
    expect(await points()).toEqual(set);
    for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: 'Random' }).click(); expect(await points()).toEqual(set); }
    expect(errors).toEqual([]);
  });

  it('plays a turn: the input shows, the turn advances, the narration shows', async () => {
    await turn('look around', 1);
    await expect.poll(() => page.getByText(NARRATION).count()).toBe(2); // the opening and this turn
    expect(await page.getByText('look around', { exact: true }).count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  it('AD6/AD7, LX1: a click on Search in the action deck plays the turn at once, with no typing', async () => {
    const before = await page.locator('.ln-player').count();
    await page.locator('.dk-act[data-kind="search"]').click();
    await expect.poll(() => page.locator('.ln-player').count()).toBe(before + 1);
    expect(await page.locator('.ln-player').last().innerText()).toBe('Search');
    await page.locator('.dk-act[data-kind="search"]:not([disabled])').waitFor(); // the deck comes back once the turn lands
    expect(errors).toEqual([]);
  });

  it('the next step of an order is taken by clicking the box, or played by Enter in the empty box (D-20 b)', async () => {
    await turn('look around then search the shelf', 1);
    const box = page.locator('.inbar .hs-input');
    await expect.poll(() => box.getAttribute('placeholder')).toBe('search the shelf');
    await box.click();
    expect(await box.inputValue()).toBe('search the shelf');
    await box.fill('');
    await turn('look around then open the door', 2);
    await page.getByRole('button', { name: 'Play it' }).waitFor();
    const before = await page.locator('.ln-player').count();
    await box.press('Enter');
    await expect.poll(() => page.locator('.ln-player').count()).toBe(before + 1);
    expect(await page.locator('.ln-player').last().innerText()).toBe('open the door');
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
    await expect.poll(() => sec.innerText()).toMatch(/Street Instinct/);
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

  it('opens the Inventory with its Coin line, and the Quests page', async () => {
    await nav('Inventory');
    await page.getByText(/^Coin: /).waitFor();
    await nav('Quests');
    await page.locator('h1', { hasText: 'Quests' }).waitFor();
    expect(errors).toEqual([]);
  });

  it('switches to the agent’s own story and back to the player’s', async () => {
    await turn('look around', 1);
    await page.getByRole('button', { name: 'Watch an agent play' }).click();
    await page.getByRole('button', { name: 'Agent’s' }).click();
    await page.getByText(/^Turn 0\b/).waitFor(); // the agent's new story opens
    await page.getByRole('button', { name: 'Player’s' }).click();
    await page.getByText(/^Turn 1\b/).waitFor(); // the player's story, as it was left
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
