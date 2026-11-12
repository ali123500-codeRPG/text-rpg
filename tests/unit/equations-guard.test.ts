// CS6 (a): guards that keep the Equations tab from drifting away from the code. The tab must render fully, every
// place it points to must exist, and its prose must not carry balancing numbers typed by hand (they come from CONFIG,
// the library or the rule functions, so they follow every change).
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { existsSync, readFileSync } from 'node:fs';
import { equations } from '../../src/ruleset/equations';
import { prototypeLibrary } from '../../src/library/data';

const SRC = 'src/ruleset/equations.ts';
const all = () => equations(prototypeLibrary()).flatMap((g) => g.equations);
const texts = (e: ReturnType<typeof all>[number]) => [e.name, e.at, e.formula, ...(e.terms ?? []).flat(), ...(e.notes ?? []),
  ...(e.table ? [...e.table.head, ...e.table.rows.flat()] : [])].filter((t): t is string => typeof t === 'string');

/** the string and template literal texts of a source file, with each `${…}` replaced by a space (its own literals are
 * returned too) and comments skipped */
function literals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1, s = '';
      while (src[j] !== c) {
        if (src[j] === '\\') { s += src[j + 1]; j += 2; } else if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          let depth = 1, inner = '';
          for (j += 2; depth; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; if (depth) inner += src[j]; }
          out.push(...literals(inner));
          s += ' ';
        } else s += src[j++];
      }
      out.push(s);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

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

  it('carries no hand-typed balancing numbers', () => {
    // pure maths and die readings only: none, one, a doubling, the d100's ends and middle. Anything else must be read
    // from CONFIG, the library or a rule function. Rule and decision IDs (D-211, AG7, All-150, Part 1 §6) are not numbers.
    const allowed = new Set(['0', '1', '2', '01', '50', '50.5', '51', '100']);
    const stray: string[] = [];
    for (const s of literals(readFileSync(SRC, 'utf8'))) {
      const clean = s.replace(/\b(?:[A-Z]{1,3}-?\d+[a-z]?|All-\d+|Part \d+ §\d+)\b|§\d+/g, '');
      for (const m of clean.match(/(?<![\w.])\d+(?:\.\d+)?/g) ?? []) if (!allowed.has(m)) stray.push(`${m} in "${s.slice(0, 80)}"`);
    }
    expect(stray).toEqual([]);
  });
});
