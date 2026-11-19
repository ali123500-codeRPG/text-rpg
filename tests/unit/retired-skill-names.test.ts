// BG-321: a skill renamed on screen keeps its old name nowhere. Lying is shown as Falsehood (TC27) and its code key is
// falsehood, so a hand-typed "Lying" in code, comments, agent prompts, library text or the spec's rules is a stale name
// (BG-320's size-up and Misdirection's equation line both kept it). Name a skill through skillName(SK.x), never by hand.
// The body pose "Lying" (scales.ts BODY_POSES) is not a skill. The spec's Deferred items and Bug log keep their history.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';

/** retired skill name -> the name it is shown as now; add a row whenever a skill is renamed */
const RETIRED: Record<string, string> = { Lying: 'Falsehood' };
const POSE = "['lying', 'Lying']";

const walk = (dir: string): string[] => (readdirSync(dir) as string[]).flatMap((f: string) => {
  const p = `${dir}/${f}`;
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
});

describe('retired skill names (BG-321)', () => {
  for (const [old, now] of Object.entries(RETIRED)) {
    const word = new RegExp(`\\b${old}\\b`);
    it(`no source file names ${old}; it is ${now}`, () => {
      const hits = walk('src').flatMap((p) => (readFileSync(p, 'utf8') as string).split('\n')
        .map((l, i) => [l, i] as const).filter(([l]) => word.test(l.replace(POSE, ''))).map(([, i]) => `${p}:${i + 1}`));
      expect(hits).toEqual([]);
    });
    it(`the spec's rules never name ${old}; it is ${now}`, () => {
      const spec = readFileSync('docs/build-spec.md', 'utf8') as string;
      const rules = spec.slice(0, spec.indexOf('\n## Deferred items'));
      expect(rules.split('\n').map((l, i) => [l, i] as const).filter(([l]) => word.test(l)).map(([, i]) => i + 1)).toEqual([]);
    });
  }
});
