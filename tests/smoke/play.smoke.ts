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
let browser: Browser, page: Page, url: string, errors: string[], server: Server, backdrops: string[];

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
  cpSync('src/ui/assets/backdrops', `${dir}/assets/backdrops`, { recursive: true }); // PS-486, as scripts/build.mjs ships them
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
  errors = []; backdrops = [];
  page.on('request', (r) => { if (r.url().includes('/backdrops/')) backdrops.push(r.url()); }); // PS-489
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
    expect(backdrops.length).toBeLessThanOrEqual(1); // PS-489: only the opening zone's picture, if it has one
    expect(errors).toEqual([]);
  });

  it('creation: the creation screen downloads no backdrop (PS-489)', async () => {
    await page.getByRole('button', { name: 'Begin the story' }).waitFor();
    expect(backdrops).toEqual([]);
  });

  it('plays a turn: the input shows, the turn advances, the narration shows', async () => {
    await turn('look around', 1);
    await expect.poll(() => page.getByText(NARRATION).count()).toBe(2); // the opening and this turn
    expect(await page.getByText('look around', { exact: true }).count()).toBeGreaterThan(0);
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
