// Healing is counted by source for achievements (D-172). Health lost may only be written in the places below, so a new
// perk that heals must use healFromPerk (src/engine/heal.ts) and is counted as perk healing with no extra code.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';

const ALLOWED: Record<string, string> = {
  'src/engine/heal.ts': 'healing rows and healFromPerk',
  'src/ruleset/index.ts': 'damage from a hit',
  'src/engine/resolve.ts': 'the survival roll wakes the player at Critical (a story event, not healing)',
  'src/ui/fakeGame.ts': 'a fake save for the UI',
};
const files = (dir: string): string[] => readdirSync(dir).flatMap((f: string) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
});

describe('health lost is written only where healing is counted', () => {
  it('no other file sets or lowers hpLostPct', () => {
    const bad = files('src').filter((f) => /hpLostPct\s*(=[^=]|-=)/.test(readFileSync(f, 'utf8')) && !ALLOWED[f.replace(/\\/g, '/')]);
    expect(bad, 'a perk that heals must call healFromPerk; other writes go in ALLOWED with a reason').toEqual([]);
  });
  it('resolve.ts sets it only for the survival roll', () => {
    const lines = readFileSync('src/engine/resolve.ts', 'utf8').split('\n').filter((l: string) => /hpLostPct\s*(=[^=]|-=)/.test(l));
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("'Critical'");
  });
});
