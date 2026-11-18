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
});
