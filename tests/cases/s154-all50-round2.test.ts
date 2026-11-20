// 154 All-50 parts round 2 (PT1, PT2, PT6): Junk Arsenal (Improvisation), Know the Step (Earshot), Last to Fall
// (the Fortitude passive).
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { payFear } from '../../src/engine/morale';
import { moraleLost } from '../../src/ruleset/morale';
import { CONFIG } from '../../src/config';
import type { Actor } from '../../src/types';
import { PK } from '../../src/library/perkIds';
import { FR } from '../../src/library/tableIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });

describe('154 All-50 parts round 2', () => {

  it('Last to Fall: at Wounded or worse, morale losses are ×0.75', () => {
    const lost = (perk: boolean, hpLost: number) => {
      const s = makeVillage();
      const p = s.player;
      if (perk) give(p, PK.last_to_fall);
      p.core.condition.hpLostPct = hpLost;
      payFear(s, forcedRng([50, 50]), p, FR.dread_presence, { gap: 1 });
      return moraleLost(p);
    };
    const wounded = CONFIG.HEALTH_TRACK.find(([l]) => l === 'wounded')![1] as number;
    expect(lost(true, 0)).toBeCloseTo(lost(false, 0)); // unhurt: no change
    expect(lost(false, wounded + 1)).toBeGreaterThan(0);
    expect(lost(true, wounded + 1)).toBeCloseTo(lost(false, wounded + 1) * CONFIG.LAST_TO_FALL_MULT);
  });

});
