// 182 D-211 on skill rolls ("an extra band past the end"): a perk or achievement that opens tiers past Critical adds
// a margin band TIER_EXTRA_BAND wider past each end of the table, for its roll kind or for every roll.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, extraBands, tierLevel } from '../../src/ruleset';
import { TIERS } from '../../src/scales';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import type { TierUnlock } from '../../src/types';

const give = (s: ReturnType<typeof makeVillage>, unlocks: TierUnlock[]) => {
  getLibrary().perks.d211_test = { id: 'd211_test', name: 'Test unlock', tierUnlocks: unlocks };
  s.player.core.perks.push({ perkId: 'd211_test', source: 'level', gainedTurn: 0 });
};
// margin = d + 0.5 × skill + mods − 63.5; a d100 of 50 with no natural edge
const rollAt = (s: ReturnType<typeof makeVillage>, mod: number, rollKind?: 'hit' | 'dodge') =>
  ruleset.roll({ actorId: 'player', skill: 'awareness', modifiers: [{ source: 'test', type: 'situational', value: mod }], tierShifts: [], auto: false, ...(rollKind ? { rollKind } : {}) }, s, forcedRng([50]));

describe('182 skill-roll tier unlocks (D-211)', () => {
  it('extra bands: one per tier opened, TIER_EXTRA_BAND apart', () => {
    expect(CONFIG.TIER_EXTRA_BAND).toBe(50);
    expect(extraBands(124, { up: 2, down: 0 })).toBe(0);
    expect(extraBands(125, { up: 2, down: 0 })).toBe(1);
    expect(extraBands(175, { up: 2, down: 0 })).toBe(2);
    expect(extraBands(400, { up: 2, down: 0 })).toBe(2);
    expect(extraBands(-125, { up: 0, down: 1 })).toBe(0);
    expect(extraBands(-126, { up: 0, down: 1 })).toBe(-1);
    expect(extraBands(500, { up: 0, down: 0 })).toBe(0);
  });

  it('a hit unlock makes a huge margin Critical Success+ on hit rolls only', () => {
    const s = makeVillage();
    give(s, [{ roll: 'hit', side: 'up', steps: 1 }]);
    const hit = rollAt(s, 300, 'hit');
    expect(hit.margin).toBeGreaterThanOrEqual(125);
    expect(tierLevel(hit)).toBe(TIERS.pos('critical_success') + 1);
    const dodge = rollAt(s, 300, 'dodge');
    expect(dodge.margin).toBe(hit.margin);
    expect(tierLevel(dodge)).toBe(TIERS.pos('critical_success'));
  });

  it("an 'any' unlock opens a tier below Critical Failure on every roll", () => {
    const s = makeVillage();
    give(s, [{ roll: 'any', side: 'down', steps: 1 }]);
    const r = rollAt(s, -300);
    expect(r.margin).toBeLessThan(-125);
    expect(tierLevel(r)).toBe(-1);
  });

  it('without an unlock nothing changes', () => {
    const s = makeVillage();
    const r = rollAt(s, 300);
    expect(tierLevel(r)).toBe(TIERS.pos('critical_success'));
  });
});
