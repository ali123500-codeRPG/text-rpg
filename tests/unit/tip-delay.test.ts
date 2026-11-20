// A7: a hover tip waits --m-tip-delay (150 ms); keyboard focus shows it at once; the next tip after one shows at once.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');

describe('tip delay (A7)', () => {
  it('one token, and every scripted tip goes through tipOn/tipOff with focus at once', () => {
    expect(src('styles.css')).toMatch(/--m-tip-delay: 150ms;/);
    expect(src('kit.ts')).toMatch(/if \(now \|\| tipUp \|\| performance\.now\(\) - tipDown < 2 \* tipDelay\(\)\) go\(\);/);
    expect(src('pages.ts')).toMatch(/addEventListener\('focusin', \(\) => tipOn\(\(\) => showTip\(s, it, el\), true\)\)/);
    expect(src('loot.ts')).toMatch(/addEventListener\('focusin', \(\) => tipOn\(\(\) => tipOf\(i\.id, b\), true\)\)/);
    expect(src('app.ts')).toMatch(/rail\.addEventListener\('focusin', \(e\) => tipOn\(\(\) => showTip\(e\), true\)\)/);
  });

  it("the minimap's hover text is the game's tip, not the browser's title tip", () => {
    const mm = src('minimap.ts');
    expect(mm).toMatch(/tipOn\(\(\) => showTip\(t, at\.x, at\.y\)\)/);
    expect(mm).toMatch(/svg\.querySelectorAll\('title'\)/);
    expect(mm).not.toMatch(/type: 'button', title,/);
  });

  it('the CSS tips wait on hover and not on focus', () => {
    const css = src('styles.css');
    expect(css).toMatch(/\.cs-tipped:hover \.cs-tip, \.cs-sk:hover \.raw-tip \{ transition-delay: var\(--m-tip-delay\); \}/);
    expect(css).toMatch(/\.cs-tipped:is\(:focus, :focus-within\) \.cs-tip, \.cs-sk \.num:focus-visible \.raw-tip \{ transition-delay: 0s; \}/);
  });
});
