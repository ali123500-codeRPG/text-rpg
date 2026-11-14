// 310 CS25: a stealth act against several watchers (a filch, an ambush from hiding, a sneak past sleepers) counts
// Against the Odds once, for the strongest watcher the player beat, and per function for the stealth it used.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { outmatchedOnce } from '../../src/engine/feats';
import { SK } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import type { ContestResult, RollResult } from '../../src/types';

const roll = (actorId: string, skill: string) => ({ actorId, skill, tier: 'success' }) as unknown as RollResult;
const won = (me: string, them: string, theirSkill: string, winner: 'a' | 'b' = 'a'): ContestResult =>
  ({ a: roll(me, SK.sneaking), b: roll(them, theirSkill), gap: winner === 'a' ? -1 : 1, winner }) as ContestResult;

describe('310 stealth wins against stronger watchers count once per act', () => {
  it('two stronger watchers beaten in one act count once; a weaker one alone counts nothing', () => {
    const s = makeVillage();
    const p = s.player, [g, w] = ['guard_1', 'patron_1'].map((id) => s.actors.find((a) => a.id === id)!);
    p.core.skills[SK.sneaking] = { ...(p.core.skills[SK.sneaking] ?? { raw: 0 }), raw: 10 } as never;
    g.core.skills[SK.earshot] = { ...(g.core.skills[SK.earshot] ?? { raw: 0 }), raw: 60 } as never;
    w.core.skills[SK.earshot] = { ...(w.core.skills[SK.earshot] ?? { raw: 0 }), raw: 40 } as never;
    const t = () => s.player.progression!.tally ?? {};
    outmatchedOnce(s, [{ c: won(p.id, g.id, SK.earshot) }, { c: won(p.id, w.id, SK.earshot) }]);
    expect(t().outmatched).toBe(1);
    outmatchedOnce(s, [{ c: won(p.id, g.id, SK.earshot, 'b') }]); // lost: nothing
    expect(t().outmatched).toBe(1);
    outmatchedOnce(s, [{ c: won(p.id, g.id, SK.earshot), fns: [FN.filching] }]);
    expect([t().outmatched, t()[`outmatched:function:${FN.filching}`]]).toEqual([2, 1]);
    p.core.skills[SK.sneaking].raw = 90; // now nobody is stronger
    outmatchedOnce(s, [{ c: won(p.id, g.id, SK.earshot) }]);
    expect(t().outmatched).toBe(2);
  });
});
