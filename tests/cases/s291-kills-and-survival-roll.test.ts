// 291 Kills are counted apart from defeats and have a chain of their own (1, 10, 50); a passed survival roll has a row;
// both pay flat max morale (the maxMorale reward: ordeals pay nerve, never the skill used).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AM } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import { ACH } from '../../src/library/achievementIds';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { tally } from '../../src/engine/xp';
import { healthLevel, ruleset } from '../../src/ruleset';
import { maxMorale } from '../../src/ruleset/morale';
import { achievementMaxMorale, rewardLines } from '../../src/ruleset/achRewards';
import type { AttackRequest, AttackResult, GameState, RollResult, Tier } from '../../src/types';
import { actor, makeVillage, place } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';

afterEach(() => vi.restoreAllMocks());

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key!);
const roll = (actorId: string, skill: string, tier: Tier): RollResult =>
  ({ actorId, skill, d100: 90, margin: 40, tier, natural: 0, modifiers: [], tierShifts: [] });
/** the next attack lands on the general area for `damage`; the damage still goes through the real applyEffects */
const forceHit = (damage: number) => vi.spyOn(ruleset, 'attack').mockImplementationOnce((req: AttackRequest): AttackResult => ({
  attack: roll(req.attackerId, SK.melee_medium, 'critical_success'), defense: roll(req.targetId, SK.block, 'failure'), defenseType: 'block',
  gap: -4, gapShifts: [], outcome: 'heavy_hit', location: 'general', locationHow: 'rolled', multiplier: 1.5, damage,
  deciding: { attack: [], defense: [], gap: [] }, attackerId: req.attackerId, targetId: req.targetId, weaponId: req.weaponId, modeId: req.modeId ?? AM.cut,
}));
const strike = (s: GameState) => play(s, { intent: intent({ action: { type: 'attack', target: 'guard_1', skill: SK.melee_medium } }) });
const withGuard = () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  CONFIG.GROWTH_AT_SCENARIO_END = false; // granted at once, so the test reads the result the same turn
  const g = place(s, 'guard_1', 'tav_common');
  g.mind!.slots!.post = 'tav_common';
  g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: 1, source: 'seen', revealed: [] };
  return { s, g };
};

describe('291 kills and the survival roll', () => {
  it('a blow that takes a foe to Dead is a kill and a defeat; one that leaves it Down is a defeat only', () => {
    const { s, g } = withGuard();
    g.core.condition.hpLostPct = 95; // Critical: the next blow takes it Down, not Dead
    forceHit(10);
    strike(s);
    expect(healthLevel(g)).toBe('incapacitated');
    expect(s.player.progression!.tally!.defeats).toBe(1);
    expect(s.player.progression!.tally!.kills).toBeUndefined();
    expect(earned(s)).not.toContain(ACH.kills_1);
    g.core.condition.hpLostPct = CONFIG.HP_LOST_MAX - 1; // someone Down can still be struck
    forceHit(1000);
    strike(s);
    expect(healthLevel(g)).toBe('dead');
    expect(s.player.progression!.tally!.kills).toBe(1);
    expect(s.player.progression!.tally!.defeats).toBe(1); // the same foe never pays a second defeat
    expect(earned(s)).toContain(ACH.kills_1);
    expect(achievementMaxMorale(s.player)).toBe(1);
  });

  it('a foe someone else kills is not the player\'s kill', () => {
    const { s, g } = withGuard();
    const p = place(s, 'patron_1', 'tav_common');
    p.mind!.overrides = { guard_1: 'hostile' };
    g.core.condition.hpLostPct = CONFIG.HP_LOST_MAX - 1;
    forceHit(1000);
    play(s, { intent: intent({}), agentOutputs: [plannerOut('patron_1', act('attack', 'guard_1'))] });
    expect(healthLevel(actor(s, 'guard_1'))).toBe('dead');
    expect(s.player.progression!.tally?.kills).toBeUndefined();
  });

  it('the kills chain climbs at 1, 10 and 50, and each level adds its max morale to the ones below', () => {
    const s = makeVillage();
    CONFIG.GROWTH_AT_SCENARIO_END = false;
    const a = getLibrary().achievements!;
    expect([ACH.kills_1, ACH.kills_10, ACH.kills_50].map((id) => [a[id].count, a[id].level, a[id].maxMorale])).toEqual([[1, 'zero', 1], [10, 'i', 1], [50, 'ii', 1]]);
    const before = maxMorale(s.player);
    for (let i = 0; i < 10; i++) tally(s, 'kills');
    expect(earned(s)).toContain(ACH.kills_10);
    expect(earned(s)).not.toContain(ACH.kills_1);
    expect(maxMorale(s.player)).toBe(before + 2);
    for (let i = 10; i < 50; i++) tally(s, 'kills');
    expect(earned(s)).toContain(ACH.kills_50);
    expect(maxMorale(s.player)).toBe(before + 3);
    expect(rewardLines(a[ACH.kills_10])).toEqual(['+1 max morale (from A Life Taken)', '+1 max morale']);
    expect(s.player.progression!.tally!.defeats).toBeUndefined(); // the two tallies are separate
  });

  it('a passed survival roll earns its row and +10 max morale; a failed one earns nothing', () => {
    const outcomes = new Set<boolean>();
    for (let base = 0; base < 12 && outcomes.size < 2; base++) {
      const s = makeVillage({ playerZone: 'tav_common' }); // indoors: the lethal slimes out in the field can't sense the player
      CONFIG.GROWTH_AT_SCENARIO_END = false;
      const g = actor(s, 'guard_1');
      g.zone = 'tav_common';
      g.placeId = 'tavern';
      delete g.pos;
      s.bands.find((b) => b.id === g.bandId)!.lethal = false; // no one left to finish the job: the survival roll decides
      g.mind!.overrides = { player: 'hostile' };
      g.mind!.knowledge.player = { status: 'engaged', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
      s.player.core.condition.hpLostPct = 40;
      s.mode = 'tactical';
      let rolled: { survived?: boolean } | undefined;
      for (let i = 0; i < 40 && !rolled; i++) {
        play(s, { intent: intent({}), agentOutputs: [plannerOut('guard_1', act('attack', 'player'))] }, 1000 * base + 201 + i);
        rolled = s.log.find((l) => l.code === 'survival_roll')?.detail as { survived?: boolean } | undefined;
      }
      expect(rolled).toBeTruthy();
      const survived = !!rolled!.survived;
      outcomes.add(survived);
      expect(s.player.progression!.tally?.survival_rolls).toBe(survived ? 1 : undefined);
      expect(earned(s).includes(ACH.survival_roll_1)).toBe(survived);
      expect(achievementMaxMorale(s.player)).toBe(survived ? 10 : 0); // Resolve may also grow in the fight, so read the reward alone
    }
    expect(outcomes.has(true)).toBe(true);
  });
});
