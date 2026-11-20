// The show-don't-tell pass on the list pages, the map pop-up and the library viewer (SD1-SD4, SD8, SD11, SD12, SD14): no help
// line under a page title, no heading that repeats it and no ✦ on headings, no word for the normal case, and marks (icons with
// a tip) only for the exception. The pages build DOM, so these read the sources; the browser smoke test opens the Inventory.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');

describe('show, don’t tell: list pages', () => {
  it('SD1: no help line under the page titles (Inventory, Quests, Achievements, Gains, Journal, Hall of fame, Bugs, Map)', () => {
    const lines = ['What you carry. Same as /inv', 'Jobs people gave you', 'Deeds that earned you a name', 'What each scenario gave you',
      'What your character knows', 'Everyone who fell', 'Report what went wrong. New reports', 'Every zone you have stood in'];
    const all = ['pages.ts', 'gains.ts', 'fame.ts', 'bugs.ts', 'map.ts'].map(src).join('\n');
    for (const l of lines) expect(all).not.toContain(l);
    expect(src('gm.ts')).toMatch(/h\('h1', \{\}, 'GM debug'\), h\('p'/); // the GM page keeps its line
  });

  it('SD2: no heading repeats the page title, and section headings carry no ✦', () => {
    const pages = src('pages.ts');
    expect(pages).not.toMatch(/'hs-section' \}, spec\.title\)|'hs-section' \}, title\), foldAll/); // Quests, Achievements
    expect(pages).not.toMatch(/'hs-section' \}, 'Inventory'\)/);
    expect(src('styles.css')).not.toMatch(/\.hs-section::before/);
  });

  it('SD3, SD11: the Inventory is its pack grid alone, each item once, marks only for damaged or locked pieces', () => {
    const pages = src('pages.ts');
    expect(pages).not.toMatch(/'Carried'|'Whole'|'eq-none' \}, 'Empty'/);
    expect(pages).toMatch(/iconMark\(ICONS\.damaged, `Damaged: \$\{hurt\}`\)/);
    expect(pages).toMatch(/iconMark\(ICONS\.locked, `Needs \$\{needText\(need\)\}/);
    expect(pages).toMatch(/'aria-expanded': String\(opened\)/); // a sack opens in place
    expect(pages).toMatch(/closest\?\.\('\[data-row\], \[data-group\]'\)/); // and still takes a dragged item
    expect(pages).not.toMatch(/Hover an item for its stats|Click a heading to open its rows/);
  });

  it('SD4: the Quests boxes say how they cycle in their own tip; the Journal sections have no notes', () => {
    expect(src('kit.ts')).toMatch(/off: 'Click: once for Shown \(several Shown = either\), twice for Left out, three times to clear'/);
    const pages = src('pages.ts');
    for (const l of ['Click a box: once for Shown', 'A label until you learn the name', 'The Map page draws their zones', 'Turns played since this page was opened'])
      expect(pages).not.toContain(l);
  });

  it('SD14: a folded quest chain is titled by its current step; achievement chains keep their turn in the name tip; bug kinds are words', () => {
    expect(src('pages.ts')).toMatch(/title: last\.cells\.text, rows/);
    const th = src('achievementThreads.ts');
    expect(th).not.toMatch(/`turn \$\{v\.turn\}`/);
    expect(th).toMatch(/title: `Latest level earned on turn \$\{v\.turn\}`/);
    expect(src('pages.ts')).not.toMatch(/` · \$\{plural\(shown\.filter/); // the tag heading leaves the count to its tile
  });

  it('SD8: the map says where you are once, and only what is unusual about a zone', () => {
    const map = src('map.ts');
    expect(map).not.toMatch(/z\.here \? 'You are here' : z\.inView/);
    expect(map).not.toMatch(/'Where you are'|'k-pin' \}\), 'You'\)|' · you' : ''\) : ''\)/);
    expect(map).not.toContain('You have no picture of it.');
    expect(map).toMatch(/z\.links\.length \? h\('p', \{ class: 'hs-label' \}, 'Exits'\)/);
    expect(map).toMatch(/z\.light && z\.light !== 'bright'/);
    expect(map).toMatch(/z\.cover && z\.cover !== 'none'/);
  });

  it('SD12: the library viewer marks Threadbound gear, shows its count once and its build line at the foot', () => {
    const lv = src('libraryViewer.ts');
    expect(lv).not.toMatch(/row\('Family'/);
    expect(lv).toMatch(/iconMark\(ICON_ART\.threadbounded, 'Threadbound'\)/);
    expect(lv).not.toMatch(/titleEl\.replaceChildren\(sec\.title, h\('span', \{ class: 'lv-size' \}/);
    expect(lv).toMatch(/all\.length && n < all\.length \? \[`\$\{n\} of \$\{all\.length\} shown`\]/);
    expect(lv).toMatch(/h\('footer', \{ class: 'lv-foot' \}, h\('p', \{ class: 'lv-build'/);
  });

  it('SD14: no thick one-side stripe as a cue in the viewer and shared styles (impeccable side-stripe tell)', () => {
    for (const f of ['libraryViewer.css', 'styles.css']) {
      const css = src(f);
      for (const sel of ['.lv-rules', '.lv-cell.quirk', '.lv-formula', '.lv-notice', '.lv-chainlabel', '.cs-mhint', '.auto-ask', '.bar .tk.cap', '.key .tick.cap']) {
        const rule = css.split('\n').find((l) => l.trim().startsWith(`${sel} {`));
        if (rule) expect(rule, sel).not.toMatch(/border-left: [2-9]px|inset [2-9]px 0 0/);
      }
    }
    expect(src('libraryViewer.css')).not.toMatch(/lv-phonebar::before/);
  });
});
