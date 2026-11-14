import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { TIERS } from '../../src/scales';

// ER3: the event roll reads the normal roll table, so only a natural roll reaches a critical tier unless modifiers are big
describe('180 Event roll on the normal roll table', () => {
  const withBonus = (v: number) => {
    const s = makeVillage();
    getLibrary().perks.er3_luck = { id: 'er3_luck', name: 'Luck', eventRoll: v };
    s.player.core.perks = v ? [{ perkId: 'er3_luck', source: 'level', gainedTurn: 0 }] : [];
    return s;
  };
  const tierFor = (d: number, v = 0) => { const s = withBonus(v); return ruleset.eventRoll(s.player, s, forcedRng([d])).tier; };

  it('reads the same bands as a skill roll', () => {
    expect(CONFIG.MARGIN_BANDS).toEqual([-75, -25, 0, 25, 75]);
    expect(CONFIG.EVENT_BASE).toBe(50);
  });

  it('a +10 bonus on a 95 stays Great Success; only a natural 96+ reaches Critical Success', () => {
    expect(tierFor(95, 10)).toBe('great_success');
    expect(tierFor(90)).toBe('great_success');
    expect(tierFor(96)).toBe('critical_success');
  });

  it('a −15 penalty on a 6 stays Failure; only a natural 05 or lower reaches Critical Failure', () => {
    expect(tierFor(6, -15)).toBe('failure');
    expect(tierFor(5)).toBe('critical_failure');
  });

  it('with no modifier the odds are 5 / 19 / 25 / 25 / 21 / 5', () => {
    const count = Object.fromEntries(TIERS.keys.map((k) => [k, 0]));
    for (let d = 1; d <= 100; d++) count[tierFor(d)]++;
    expect(TIERS.keys.map((k) => count[k])).toEqual([5, 19, 25, 25, 21, 5]);
  });
});
