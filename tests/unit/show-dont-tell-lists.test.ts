// SD14: no thick one-side stripe as a cue in the library viewer and the shared styles.
// The styles are text, so this reads them.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');

describe('show, don’t tell: list pages', () => {

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
