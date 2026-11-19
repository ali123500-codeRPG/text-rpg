// TQ7 browser smoke tests: the play page, built (and minified) as in production, on the real game (tests/smoke/game.ts: in-memory save,
// stand-in Claude). Few flows, the ones where screen wiring broke before: load and create (the opening), play a turn,
// report a bug (BG-27), switch story (BG-63), restore a backup (BG-123). Run: npm run smoke.
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

  it('creation: Ctrl+click (or Cmd+click) on Raise or Lower moves the skill by 1, a plain click by 5', async () => {
    const raise = page.getByRole('button', { name: 'Raise Parry' }), lower = page.getByRole('button', { name: 'Lower Parry' });
    const val = async () => Number(await page.locator('.row[data-k]', { has: raise }).locator('.val').textContent());
    await lower.click(); await lower.click(); // the opening build spends every point: free 10
    const v0 = await val();
    await raise.click({ modifiers: ['Control'] });
    expect(await val()).toBe(v0 + 1);
    await raise.click({ modifiers: ['Meta'] });
    expect(await val()).toBe(v0 + 2);
    await lower.click({ modifiers: ['Control'] });
    expect(await val()).toBe(v0 + 1);
    await raise.click();
    expect(await val()).toBe(v0 + 6);
    expect(errors).toEqual([]);
  });

  it('creation: SD9 tag and flaw are two icon toggles after each skill name, lit when set; the rules and estimate are tile tips', async () => {
    const k = await page.locator('.row[data-k]').filter({ has: page.locator('.tg-btn.tg-tag[aria-pressed="true"]') }).first().getAttribute('data-k');
    const tagged = page.locator(`.row[data-k="${k}"]`);
    const name = (await tagged.locator('.nm b').textContent())!;
    const tag = tagged.locator('.tg-btn.tg-tag');
    expect(await tag.getAttribute('aria-label')).toBe(`Untag ${name}`);
    expect(await tagged.locator('.tg-btn.tg-flaw').evaluate((b) => getComputedStyle(b).visibility)).toBe('hidden'); // a tagged skill can't be flawed
    await tag.click();
    expect(await tag.getAttribute('aria-pressed')).toBe('false');
    expect(await tag.getAttribute('aria-label')).toBe(`Tag ${name}`);
    await tag.click();
    expect(await tag.getAttribute('aria-pressed')).toBe('true');
    // no word pills, no Tag / Flaw words on the rows, and no sub-lines under the names
    expect(await page.locator('.row .hs-tg, .key .hs-tg').count()).toBe(0);
    expect(await page.locator('.row').filter({ hasText: /^Tag|Flaw|sets HP/ }).count()).toBe(0);
    expect(await page.getByRole('img', { name: 'Tagged' }).count()).toBeGreaterThan(0); // the key's icon
    // SD4: the rule line is the Points left tile's tip; the estimate's source is its tile's tip, with its control by it
    expect(await page.getByText(/^Spend \d+ points/).count()).toBe(0);
    expect(await page.locator('.hs-readout', { hasText: 'Points left' }).getAttribute('title')).toMatch(/^Spend \d+ points\. Your class sets floors/);
    const slime = page.locator('.hs-readout', { hasText: 'Vs one slime' });
    expect(await slime.getAttribute('title')).toMatch(/practice swings each way/);
    expect(await slime.getByRole('button', { name: 'Change the estimate' }).count()).toBe(1);
    expect(await page.locator('.hs-ro-i').count()).toBe(0);
    // SD14: the Placeholders box is for the GM view only; SD3: an axis with no lean shows no word
    expect(await page.getByText('Placeholders').count()).toBe(0);
    expect(await page.getByText('no lean').count()).toBe(0);
    expect(errors).toEqual([]);
  });

  it('SD1-SD5, SD10: the Character page shows no help lines; health and classes keep their words in tips', async () => {
    await nav('Character');
    const card = page.locator('.cs-card');
    await card.waitFor();
    expect(await page.getByText(/Same as \/stats|marks a tagged skill/).count()).toBe(0);
    expect(await card.getByText(/Unhurt|Bruised|Critical/).count()).toBe(0);
    expect(await card.getByRole('img', { name: /^Health: / }).count()).toBe(1);
    expect(await card.locator('.cs-class .hs-label').count()).toBe(0);
    await card.locator('.cs-class').click();
    const tree = page.locator('.ct-full');
    await tree.waitFor();
    expect(await tree.getByText(/Started here|current/).count()).toBe(0);
    expect(await tree.getByRole('img', { name: 'Started here' }).count()).toBe(1);
    expect(await tree.locator('.ct-node').first().getAttribute('title')).toMatch(/Level \d+/);
    await page.locator('.fpop-x').click();
    await page.locator('.cs-bfbtn').click();
    const body = page.locator('.bp-pop');
    await body.waitFor();
    expect(await body.locator('.bp-st').allTextContents()).not.toContain('Healthy');
    expect(errors).toEqual([]);
  });

  it('plays a turn: the input shows, the turn advances, the narration shows', async () => {
    await turn('look around', 1);
    await expect.poll(() => page.getByText(NARRATION).count()).toBe(2); // the opening and this turn
    expect(await page.getByText('look around', { exact: true }).count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  it('AD6/AD7: a click on Look around in the action deck plays the turn at once, with no typing', async () => {
    const before = await page.locator('.ln-player').count();
    await page.locator('.dk-act[data-kind="look"]').click();
    await expect.poll(() => page.locator('.ln-player').count()).toBe(before + 1);
    expect(await page.locator('.ln-player').last().innerText()).toBe('Look around');
    await page.locator('.dk-act[data-kind="look"]:not([disabled])').waitFor(); // the deck comes back once the turn lands
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
    // SD3: the pop-up shows the held essence and any empty slot as a dashed box, with no count line or empty line of its own
    await expect.poll(() => sec.innerText()).toMatch(/Street Instinct/);
    expect(await sec.getByText(/slots? used|No essences yet/).count()).toBe(0);
    expect(await sec.locator('.ess-tile:not(.ess-empty)').count()).toBe(1);
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
    await page.getByText(/^Turn 4\b/).waitFor();
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

  it('BG-228: a question with answers shows them as buttons; a tap fills the box and sends nothing', async () => {
    await page.getByPlaceholder(/What do you do/).fill('ask me');
    await page.getByRole('button', { name: 'Send' }).click();
    const ans = page.locator('.ln-clarify .clar-ans');
    await ans.first().waitFor();
    expect(await ans.allTextContents()).toEqual(['I hold my place and wait to see who appears', 'I go back inside']);
    await ans.first().click();
    expect(await page.locator('.inbar .hs-input').inputValue()).toBe('I hold my place and wait to see who appears');
    expect(await page.getByText(/^Turn 1\b/).count()).toBe(0); // nothing was sent
    expect(await page.locator('.ln-clarify .clar-pick').count()).toBe(0); // BF72: the answers are the one way to answer
    expect(errors).toEqual([]);
  });

  // BF66: the strike card shows as the turn lands and lives its full time: a click on the story doesn't take it away.
  // BF64: no "draws to a close" line ever shows while a turn runs. M-72: motion always plays: there is no Motion switch, and
  // an old stored switch or the system's reduced-motion setting changes nothing.
  it('BF66: a landed blow shows the strike card at once, animated even with reduced motion set, and a click on the story keeps it', async () => {
    expect(await page.getByRole('button', { name: /Motion/ }).count()).toBe(0);
    await page.evaluate(() => localStorage.setItem('motion', 'off')); // what the old switch stored
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // someone to hit, half a metre away: the smoke world's opening has no one beside the player
    const id = await page.evaluate(() => {
      type A = { id: string; kind: string; name?: string; zone: string; pos: { x: number; y: number }; core: { skills: Record<string, unknown>; inventory: unknown[] } };
      const s = (globalThis as unknown as { __GAME_API__: { state(): { player: A; actors: A[] } } }).__GAME_API__.state();
      s.player.core.skills.SK2 ??= { raw: 30, state: 'normal' }; // a made character may lack Medium weapons: the order names it
      const d = { ...structuredClone(s.player), id: 'dummy', kind: 'npc', name: 'Straw Dummy', pos: { x: s.player.pos.x + 0.5, y: s.player.pos.y }, mind: { control: 'code', knowledge: {}, knows: [] } };
      d.core.inventory = []; // BG-258: a straw dummy holds no weapon (a copy of the player's would cut back and could fell the player)
      s.actors.push(d);
      return d.id;
    });
    await page.evaluate(() => { (window as unknown as { endWait: number }).endWait = 0; new MutationObserver(() => { if (document.querySelector('.end-wait')) (window as unknown as { endWait: number }).endWait++; }).observe(document.body, { childList: true, subtree: true }); });
    let seen = false;
    type Api = { __GAME_API__: { state(): { turn: number }; busy(): boolean } };
    for (let n = 1; n <= 8 && !seen; n++) {
      const was = await page.evaluate(() => (globalThis as unknown as Api).__GAME_API__.state().turn);
      await page.getByPlaceholder(/What do you do/).fill(`hit ${id} SK2`);
      await page.getByRole('button', { name: 'Send' }).click();
      // the turn has landed: the game moved on and is no longer busy (not a "Turn n" label, which earlier tests may have used)
      await page.waitForFunction((t) => { const a = (globalThis as unknown as Api).__GAME_API__; return a.state().turn > t && !a.busy(); }, was);
      for (let i = 0; i < 10 && !seen; i++) { seen = await page.locator('.strike').count() > 0; if (!seen) await page.waitForTimeout(100); }
    }
    expect(seen).toBe(true);
    expect(await page.evaluate(() => document.querySelector('.strike')!.getAnimations().length)).toBeGreaterThan(0);
    await page.locator('.story').click({ position: { x: 20, y: 20 } }); // a skip (M-12)
    await page.waitForTimeout(200);
    expect(await page.locator('.strike').count()).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { endWait: number }).endWait)).toBe(0);
    expect(errors).toEqual([]);
  }, 60_000);

  it('AU6/AU7: no sound starts while a turn runs; the Sound switch shows a volume slider and, off, silences clicks', async () => {
    type Api = { __GAME_API__: { busy(): boolean } };
    await page.evaluate(() => {
      const w = window as unknown as { starts: { busy: boolean }[] } & Api;
      w.starts = [];
      for (const C of [OscillatorNode, AudioBufferSourceNode]) {
        const start = C.prototype.start;
        C.prototype.start = function (this: AudioScheduledSourceNode, when?: number) { w.starts.push({ busy: w.__GAME_API__.busy() }); return start.call(this, when); };
      }
    });
    await turn('look around', 1);
    await turn('look around', 2);
    expect(await page.evaluate(() => (window as unknown as { starts: { busy: boolean }[] }).starts.filter((x) => x.busy).length)).toBe(0);
    const sw = page.getByRole('button', { name: /Sound/ });
    expect(await sw.getAttribute('aria-pressed')).toBe('true');
    expect(await page.getByRole('slider', { name: 'Sound volume' }).count()).toBe(1);
    await sw.click();
    expect(await page.getByRole('slider', { name: 'Sound volume' }).count()).toBe(0);
    const before = await page.evaluate(() => (window as unknown as { starts: unknown[] }).starts.length);
    await page.getByRole('button', { name: /Sound/ }).click(); // turning it back on is the one click that may sound
    await page.getByRole('button', { name: /Sound/ }).click();
    await page.locator('nav').getByText('Character', { exact: true }).click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { starts: unknown[] }).starts.length)).toBeLessThanOrEqual(before + 1);
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

  it('BG-310: on a short window the minimap shrinks (to about 180 px of map at least) so the Level / XP bar stays inside the window; past that the column scrolls', async () => {
    const xpIn = () => page.evaluate(() => document.querySelector('.cs-side [data-m="xp-track"]')!.getBoundingClientRect().bottom <= innerHeight);
    // the map's height as shown: -1 when its box cuts it off
    const map = () => page.evaluate(() => {
      const svg = document.querySelector('.cs-side .mm-svg')!.getBoundingClientRect(), box = document.querySelector('.cs-side .mm')!.getBoundingClientRect();
      return box.bottom + 0.5 >= svg.bottom ? Math.round(svg.height) : -1;
    });
    await page.setViewportSize({ width: 1400, height: 1300 });
    await expect.poll(map).toBe(360); // room to spare: the full minimap
    await page.setViewportSize({ width: 1400, height: 900 }); // the minimap gives way, the bar stays in view
    await expect.poll(xpIn).toBe(true);
    expect(await map()).toBeGreaterThanOrEqual(175);
    for (const height of [595, 420]) { // shorter than the floor allows: the column scrolls to the bar
      await page.setViewportSize({ width: 1568, height });
      await expect.poll(async () => { const m = await map(); return m >= 175 && m <= 205; }).toBe(true); // the floor: about 180 px
      await page.locator('.cs-side [data-m="xp-track"]').scrollIntoViewIfNeeded();
      await expect.poll(xpIn).toBe(true);
    }
    expect(errors).toEqual([]);
  });
  it('the map is a big pop-up from the Play header, not a tab: Map opens it over Play, Esc closes it', async () => {
    await nav('Play');
    expect(await page.locator('nav').getByText('Map', { exact: true }).count()).toBe(0);
    await page.locator('[data-open="map"]').click();
    const pop = page.locator('.fpop.map-full');
    await pop.locator('.map-svg').waitFor();
    expect(await pop.locator('h1', { hasText: 'Map' }).count()).toBe(1);
    await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running')); // M-12: while it fades in, Esc only skips
    await page.keyboard.press('Escape');
    await expect.poll(() => page.locator('.fpop').count()).toBe(0);
    expect(new URL(page.url()).hash).toBe('#play');
    expect(errors).toEqual([]);
  });

  it('the map card of the zone you stand in has no Move to here', async () => {
    await nav('Play');
    await page.locator('[data-open="map"]').click();
    const pop = page.locator('.fpop.map-full');
    await pop.locator('.map-card h2').waitFor();
    expect(await pop.locator('[data-zone].here').count()).toBe(1);
    expect(await pop.locator('[data-move]').count()).toBe(0);
    await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running'));
    await page.keyboard.press('Escape');
    await page.locator('.fpop').waitFor({ state: 'detached' });
    expect(errors).toEqual([]);
  });

  it('Watch an agent play opens a floating pop-up over Play; its ✕ closes it', async () => {
    await nav('Play');
    await page.locator('.auto-open').click();
    const pop = page.locator('.auto.dpop.auto-pop');
    await pop.locator('.dpop-head').waitFor();
    expect(await pop.evaluate((e) => getComputedStyle(e).position)).toBe('fixed');
    expect(await pop.getByRole('button', { name: 'Play', exact: true }).count()).toBe(1);
    await pop.locator('.dpop-x').click();
    await expect.poll(() => page.locator('.auto-pop').count()).toBe(0);
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
