// npm run spec (scripts/spec.ts): agents read one part of the build spec instead of the whole file.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { idRows, mentions, run, sections } from '../../scripts/spec';

const doc = [
  '# Top', 'intro', '## Part A', '### One', 'one text cites src/engine/gear.ts', '#### Deep', 'deep text', '### Two',
  '```', '# not a heading', '```', 'two text', '## Bug log', '| BG-1 | first | Fixed |', '| BG-10 | tenth | Open |',
  '## Open questions', '- OQ-9: the ninth', '## BG-7', '**What was wrong:** x',
];

describe('spec tool', () => {
  it('a section runs to the next heading of its level or higher, and fenced lines are not headings', () => {
    const s = sections(doc);
    const one = s.find((x) => x.title === 'One')!;
    expect(doc.slice(one.start, one.end)).toEqual(['### One', 'one text cites src/engine/gear.ts', '#### Deep', 'deep text']);
    expect(s.map((x) => x.title)).not.toContain('not a heading');
    expect(s.find((x) => x.title === 'Part A')!.end).toBe(doc.indexOf('## Bug log'));
  });

  it('an ID finds its table row, list item or own section, never a longer ID', () => {
    expect(idRows(doc, 'BG-1')).toEqual(['| BG-1 | first | Fixed |']);
    expect(idRows(doc, 'OQ-9')).toEqual(['- OQ-9: the ninth']);
    expect(idRows(doc, 'BG-7')).toEqual(['## BG-7\n**What was wrong:** x']);
    expect(idRows(doc, 'D-3')).toEqual([]);
  });

  it('a mention is counted in the innermost section that holds it', () => {
    expect(mentions(doc, 'SRC/engine/gear.ts').map((m) => [m.section.title, m.count])).toEqual([['One', 1]]);
  });

  it('on the real spec: every heading is found and a section stops at the next one of its level', () => {
    const lines = readFileSync('docs/build-spec.md', 'utf8').split('\n');
    const all = sections(lines);
    expect(all.length).toBe(lines.filter((l: string) => /^#{1,6} /.test(l)).length);
    const motion = run(['Play screen motion']).split('\n');
    expect(motion[0]).toBe('### Play screen motion');
    expect(motion.slice(1).some((l) => /^#{1,3} /.test(l))).toBe(false);
  });
});
