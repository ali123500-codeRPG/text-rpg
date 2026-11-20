// rpg-map MAP-04, MAP-51, MAP-52: the Map's and the minimap's checkers find nothing on the three test stages, drawn by
// the page as built. Run: npm run smoke.
// near: src/ui/map src/ui/minimap.ts src/ui/furnitureIcons.ts src/ui/fakeStages.ts src/ui/styles.css src/plan/ src/scenario/geometry.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { tmpdir } from 'node:os';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { createServer, type Server } from 'node:http';

let browser: Browser, server: Server, url: string;
beforeAll(async () => {
  const dir = mkdtempSync(`${tmpdir()}/map-smoke-`);
  await build({ entryPoints: ['src/ui/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2022', outdir: dir, logLevel: 'warning',
    loader: { '.woff2': 'file', '.webp': 'file', '.mp3': 'dataurl' }, assetNames: 'assets/[name]', define: { __BUILD__: JSON.stringify({ sha: 'smoke', date: '2026-01-01' }) } });
  writeFileSync(`${dir}/index.html`, '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="main.css"></head><body><script src="main.js"></script></body></html>');
  cpSync('assets/figures', `${dir}/assets/figures`, { recursive: true, filter: (f: string) => !f.includes('/models') });
  const TYPES: Record<string, string> = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp' };
  server = createServer((req: { url: string }, res: { writeHead: (n: number, h?: object) => void; end: (b?: unknown) => void }) => {
    const path = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    let body: unknown;
    try { body = readFileSync(`${dir}/${path}`); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.split('.').pop()!] ?? 'application/octet-stream' }); res.end(body);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/index.html`;
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => { await browser?.close(); server?.close(); });

type Found = { findings: string[] } | undefined;
describe('map checker on the test stages (MAP-52)', () => {
  // bent-nail-saved is left out: it draws a stored layout that breaks MAP-10 and MAP-12 on purpose, to show it named
  for (const stage of ['bent-nail', 'one-room', 'long-names']) it(`${stage}: no findings on the minimap or the Map`, async () => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }), errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${url}?fake=1&stage=${stage}`);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __minimapFindings?: Found }).__minimapFindings?.findings), { timeout: 15_000 }).toEqual([]);
    await page.locator('[data-open="map"]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __mapFindings?: Found }).__mapFindings?.findings), { timeout: 15_000 }).toEqual([]);
    expect(errors).toEqual([]);
    await page.close();
  });
});
