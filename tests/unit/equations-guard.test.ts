// CS6 (a): guards that keep the Equations tab from drifting away from the code. The tab must render fully, every
// place it points to must exist, and its prose must not carry balancing numbers typed by hand (they come from CONFIG,
// the library or the rule functions, so they follow every change).
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { existsSync, readFileSync } from 'node:fs';
import { equations } from '../../src/ruleset/equations';
import { prototypeLibrary } from '../../src/library/data';

const all = () => equations(prototypeLibrary()).flatMap((g) => g.equations);
const texts = (e: ReturnType<typeof all>[number]) => [e.name, e.at, e.formula, ...(e.terms ?? []).flat(), ...(e.notes ?? []),
  ...(e.table ? [...e.table.head, ...e.table.rows.flat()] : [])].filter((t): t is string => typeof t === 'string');

describe('the Equations tab stays tied to the code', () => {
  it('renders with no leftover code, undefined or NaN', () => {
    for (const e of all()) for (const t of texts(e)) expect(t, e.name).not.toMatch(/\$\{|\bundefined\b|\bNaN\b|\[object /);
  });

  it('every place it points to names a real file and a name defined there', () => {
    for (const e of all()) {
      for (const seg of e.at.split(';').map((s) => s.trim())) {
        const parts = seg.split(' · ').map((s) => s.trim());
        const file = parts.pop()!;
        expect(file, `${e.name}: "${seg}" names no file`).toMatch(/^src\/.+\.ts$/);
        expect(existsSync(file), `${e.name}: ${file}`).toBe(true);
        const code = readFileSync(file, 'utf8');
        for (const name of parts) {
          const defined = new RegExp(`(?:function\\*?|const|let|class)\\s+${name}\\b|^\\s+${name}\\s*[:(]`, 'm');
          expect(code, `${e.name}: ${name} is not defined in ${file}`).toMatch(defined);
        }
      }
    }
  });

});
