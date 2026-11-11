// 181 Event-roll criticals: a chain for Critical Success and a scar for Critical Failure on your event rolls. Each opens
// one tier past its Critical (tierUnlocks, summed along the chain and from perks). Without an unlock the roll stops at Critical.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, tierName } from '../../src/ruleset';
import { tierReach } from '../../src/ruleset/achRewards';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import type { GameState } from '../../src/types';

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key!);

describe('181 event-roll criticals open Critical+ and Critical−', () => {
  it('without an unlock a natural 100 stops at Critical Success, and earns the first level', () => {
    const s = makeVillage();
    const r = ruleset.eventRoll(s.player, s, forcedRng([100]));
    expect(r.tier).toBe('critical_success');
    expect(r.beyond).toBeUndefined();
    expect(earned(s)).toContain(ACH.event_crit_1);
  });
  it('once earned, a natural 00 reaches Critical Success+; the chain adds a tier per level', () => {
    const s = makeVillage();
    ruleset.eventRoll(s.player, s, forcedRng([100]));
    const r = ruleset.eventRoll(s.player, s, forcedRng([100]));
    expect(tierName(r)).toBe('Critical Success+');
    for (let i = 0; i < 3; i++) ruleset.eventRoll(s.player, s, forcedRng([99])); // five Critical Successes in all
    expect(earned(s)).toContain(ACH.event_crit_5);
    expect(tierReach(s.player, 'event')).toEqual({ up: 2, down: 0 });
    getLibrary().perks.blessed2 = { id: 'blessed2', name: 'Blessed', eventRoll: 30 };
    s.player.core.perks.push({ perkId: 'blessed2', source: 'level', gainedTurn: 0 });
    try { expect(tierName(ruleset.eventRoll(s.player, s, forcedRng([100])))).toBe('Critical Success++'); } // margin 80, +2 natural
    finally { delete getLibrary().perks.blessed2; s.player.core.perks.pop(); }
    expect(tierReach(s.player, 'hit')).toEqual({ up: 0, down: 0 }); // event rolls only
  });
  it('a Critical Failure leaves the scar, which opens Critical Failure−', () => {
    const s = makeVillage();
    expect(ruleset.eventRoll(s.player, s, forcedRng([1])).tier).toBe('critical_failure');
    expect(earned(s)).toContain(ACH.event_crit_fail_1);
    expect(getLibrary().achievements![ACH.event_crit_fail_1].scar).toBe(true);
    expect(tierName(ruleset.eventRoll(s.player, s, forcedRng([1])))).toBe('Critical Failure−');
  });
  it('a perk can open tiers too', () => {
    const s = makeVillage();
    getLibrary().perks.fated = { id: 'fated', name: 'Fated', tierUnlocks: [{ roll: 'any', side: 'up', steps: 2 }] };
    s.player.core.perks.push({ perkId: 'fated', source: 'level', gainedTurn: 0 });
    try {
      expect(tierName(ruleset.eventRoll(s.player, s, forcedRng([100])))).toBe('Critical Success+'); // a natural 00 is one past
    } finally { delete getLibrary().perks.fated; }
  });
});
