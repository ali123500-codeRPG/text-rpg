// BG-317: the library viewer, built as in production, keeps every word whole: no table cell breaks a word that fits
// a wider column, and no rail item is wider than the rail. Run: npm run smoke.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { mkdtempSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { tmpdir } from 'node:os';

let browser: Browser, file: string;
beforeAll(async () => {
  const dir = mkdtempSync(`${tmpdir()}/lib-smoke-`);
  await build({ entryPoints: ['src/ui/libraryViewer.ts'], bundle: true, minify: true, format: 'iife', target: 'es2022', outdir: dir, logLevel: 'warning',
    loader: { '.woff2': 'file', '.webp': 'file' }, assetNames: 'assets/[name]', define: { __BUILD__: JSON.stringify({ sha: 'smoke', date: '2026-01-01' }) } });
  writeFileSync(`${dir}/index.html`, '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="libraryViewer.css"></head><body><script src="libraryViewer.js"></script></body></html>');
  file = `file://${dir}/index.html`;
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => { await browser?.close(); });

describe('library viewer smoke (BG-317)', () => {
  it('keeps words whole in table cells and rail items inside the rail at 1440 px', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(file);
    await page.locator('.lv-table td').first().waitFor();
    // a one-word cell drawn on more than one line means the table broke a word it had room to keep whole
    const split = await page.evaluate(() => Array.from(document.querySelectorAll('.lv-table td')).filter((td) => {
      const t = td.textContent!.trim();
      if (!t || /\s/.test(t)) return false;
      const r = document.createRange(); r.selectNodeContents(td);
      return new Set(Array.from(r.getClientRects()).map((x) => Math.round(x.top))).size > 1;
    }).map((td) => td.textContent!.trim()));
    expect(split).toEqual([]);
    const wide = await page.evaluate(() => Array.from(document.querySelectorAll('.hs-rail a, .hs-rail button'))
      .filter((e) => (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1).map((e) => e.textContent!.trim()));
    expect(wide).toEqual([]);
    await page.close();
  });
});
