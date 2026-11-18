// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Colours come from the HISAB tokens in :root; rules use var(--…) or colour mixes of tokens, never a raw hex.
// Depth is borders and tints: the only shadow is the toast shadow.
describe('play styles use tokens only', () => {
  const css: string = readFileSync('src/ui/styles.css', 'utf8');
  const body = css.replace(/:root\s*\{[^}]*\}/, '');
  it('has no hex colours outside :root', () => {
    expect(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
  it('has no glows or drop shadows other than the toast shadow', () => {
    const shadows = body.match(/(box-shadow|text-shadow|drop-shadow)[^;}]*/g) ?? [];
    expect(shadows.filter((s) => !/box-shadow:\s*var\(--shadow-toast\)/.test(s))).toEqual([]);
  });
  it('buttons and form fields take the page font (BG-302)', () => {
    expect(css).toMatch(/button, input, select, textarea \{ font-family: inherit; \}/);
  });
  it('no UI text is smaller than 13px, except the step numbers inside the perk ladder marks (LK6)', () => {
    const small: string[] = [];
    for (const [, sel, decl] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const px = decl.match(/font-size:\s*([0-9.]+)px/) ?? decl.match(/(?<![-\w])font:[^;]*?\b([0-9.]+)px/);
      if (px && Number(px[1]) < 13) small.push(sel.trim());
    }
    expect(small).toEqual(['.pk-n span', '.pk-n.sealed span']);
  });
  it('text colour tokens reach 4.5:1 on --bg and --surface (G5); the skill-group colours too, since tree names use them', () => {
    const root = css.match(/:root\s*\{([^}]*)\}/)![1];
    const hex = (k: string) => root.match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    const lum = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const groups = [...readFileSync('src/ui/creation.ts', 'utf8').matchAll(/c: '(c\d+)'/g)].map((m) => m[1]);
    const text = ['text', 'muted', 'faint', 'accent', 'ok', 'warn', 'danger', 'scenario-mark', 'perk-40', ...groups];
    const low = text.flatMap((k) => ['bg', 'surface'].filter((g) => ratio(hex(k)!, hex(g)!) < 4.5).map((g) => `${k} on ${g}: ${ratio(hex(k)!, hex(g)!).toFixed(2)}`));
    expect(low).toEqual([]);
  });
  it('hover and focus never change size or position, only colour, opacity, background or an outline (P6)', () => {
    const moved: string[] = [];
    for (const [, sel, decl] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (!/:hover|:focus/.test(sel)) continue;
      const bad = decl.match(/(?<![-\w])(width|height|(?:min|max)-(?:width|height)|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|border(?:-[a-z]+)?-width|font-size|font-weight|letter-spacing|font)\s*:/g);
      if (bad) moved.push(`${sel.trim()} → ${bad.join(' ')}`);
    }
    expect(moved).toEqual([]);
  });
});
