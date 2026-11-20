// npm run spec (scripts/spec.ts): agents read one part of the build spec instead of the whole file.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { idRows, mentions, run, sections, specFiles } from '../../scripts/spec';

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
    expect(idRows(['- **MAP-4** One rule', '  wrapped on.', '- **MAP-5** next'], 'MAP-4')).toEqual(['- **MAP-4** One rule\n  wrapped on.']);
  });

  it('a mention is counted in the innermost section that holds it', () => {
    expect(mentions(doc, 'SRC/engine/gear.ts').map((m) => [m.section.title, m.count])).toEqual([['One', 1]]);
  });

  it('on the real spec: every topic file the index links exists and starts with its heading, and a section stops at the next one', () => {
    const files = specFiles();
    expect(files.length).toBeGreaterThan(50);
    for (const f of files.slice(1)) expect(readFileSync(f, 'utf8'), f).toMatch(/^#{2,3} /);
    const motion = run(['Play screen motion']).split('\n');
    expect(motion[1]).toBe('### Play screen motion');
    expect(motion.slice(2).some((l) => /^#{1,3} /.test(l))).toBe(false);
  });

  it('every file under docs/spec is linked from the index', () => {
    const all = readdirSync('docs/spec', { recursive: true, encoding: 'utf8' }).filter((f: string) => f.endsWith('.md')).map((f: string) => `docs/spec/${f.split('\\').join('/')}`);
    expect(all.filter((f: string) => !specFiles().includes(f))).toEqual([]);
  });
});
