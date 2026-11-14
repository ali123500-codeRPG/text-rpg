// 293 Back from the break: a fight won although your morale broke in it climbs a chain at 1, 5 and 25. Each level pays
// max morale and one Nerve step. The fight still counts as lost for the Loser scars, as a break always does.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { CONFIG } from '../../src/config';
import { fightEnded, turnFeats } from '../../src/engine/feats';
import { tally } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { achievementMaxMorale } from '../../src/ruleset/achRewards';
import { maxMorale, setMoraleLost } from '../../src/ruleset/morale';
import type { Actor, GameState } from '../../src/types';

const know = (a: Actor, b: Actor) => { a.mind!.knowledge[b.id] = { status: 'engaged', lastKnownZone: b.zone, source: 'seen', revealed: [] }; };
const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key!);
const down = (a: Actor) => { a.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'incapacitated')![1]; };

/** the player in a fight with the hostile guard; `broken` breaks the player's morale before the turn is logged */
function fight(broken: boolean): { s: GameState; guard: Actor } {
  const s = makeVillage();
  CONFIG.GROWTH_AT_SCENARIO_END = false; // granted at once, so the test reads the result the same turn
  const guard = actor(s, 'guard_1');
  guard.zone = s.player.zone;
  (guard.mind!.overrides ??= {})[s.player.id] = 'hostile';
  know(guard, s.player);
  s.player.engagement = { start: 1, last: 1, kinds: ['fight'] };
  if (broken) setMoraleLost(s.player, maxMorale(s.player));
  turnFeats(s, []);
  return { s, guard };
}

describe('293 back from the break', () => {
  it('a fight won after your morale broke earns the first level; it still counts as a lost fight', () => {
    const { s, guard } = fight(true);
    expect(s.player.engagement!.fight!.broke).toBe(true);
    down(guard);
    fightEnded(s, s.player.engagement!.fight!);
    expect(earned(s)).toContain(ACH.won_broken_1);
    expect(achievementMaxMorale(s.player)).toBe(getLibrary().achievements![ACH.won_broken_1].maxMorale);
    expect(s.player.progression!.tally!.won_broken).toBe(1);
    expect(s.player.progression!.tally!.defeated).toBe(1);
  });

  it('nothing while a foe is still up, and nothing for a fight won with your nerve whole', () => {
    const a = fight(true);
    fightEnded(a.s, a.s.player.engagement!.fight!); // the guard still stands
    expect(a.s.player.progression!.tally?.won_broken).toBeUndefined();
    const b = fight(false);
    down(b.guard);
    fightEnded(b.s, b.s.player.engagement!.fight!);
    expect(b.s.player.progression!.tally?.won_broken).toBeUndefined();
  });

  it('nothing if you end the fight Down yourself', () => {
    const { s, guard } = fight(true);
    down(guard);
    down(s.player);
    fightEnded(s, s.player.engagement!.fight!);
    expect(s.player.progression!.tally?.won_broken).toBeUndefined();
  });

  it('the chain climbs at 1, 5 and 25, and its max morale adds up along it', () => {
    const { s } = fight(false);
    const lib = getLibrary().achievements!;
    const each = [ACH.won_broken_1, ACH.won_broken_5, ACH.won_broken_25].map((k) => lib[k].maxMorale!);
    tally(s, 'won_broken');
    expect(earned(s)).toContain(ACH.won_broken_1);
    for (let i = 1; i < 5; i++) tally(s, 'won_broken');
    expect(earned(s)).toContain(ACH.won_broken_5);
    expect(earned(s)).not.toContain(ACH.won_broken_1);
    expect(achievementMaxMorale(s.player)).toBe(each[0] + each[1]);
    for (let i = 5; i < 25; i++) tally(s, 'won_broken');
    expect(earned(s)).toContain(ACH.won_broken_25);
    expect(achievementMaxMorale(s.player)).toBe(each[0] + each[1] + each[2]);
  });
});
