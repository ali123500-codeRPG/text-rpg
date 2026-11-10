// Morale restored is counted by source for achievements. restoreMorale may only be called from src/engine/heal.ts
// (calm and calmFromPerk), so a new perk or action that restores morale goes through the composure table and is counted.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';

const files = (dir: string): string[] => readdirSync(dir).flatMap((f: string) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
});

describe('morale is restored only where it is counted', () => {
  it('only heal.ts calls restoreMorale', () => {
    const bad = files('src').map((f) => f.replace(/\\/g, '/'))
      .filter((f) => f !== 'src/ruleset/morale.ts' && f !== 'src/engine/heal.ts' && /restoreMorale\s*\(/.test(readFileSync(f, 'utf8')));
    expect(bad, 'restore morale through calm (a composure row) or calmFromPerk').toEqual([]);
  });
});
