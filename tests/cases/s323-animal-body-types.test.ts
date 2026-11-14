// 323 Animal body types (NR14 a): one Quadruped shape for land beasts plus Serpent and Eight-legged; each animal race
// sets its own real speeds and natural attacks, and the Weaver can compose any of them as a beast.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { getLibrary } from '../../src/library';
import { BT, RC } from '../../src/library/raceIds';
import { RO, TH } from '../../src/library/npcLayerIds';
import { moveSpeed } from '../../src/engine/speed';
import { usableModes } from '../../src/ruleset/gear';
import { gripReachM, roleOff } from '../../src/ruleset/body';
import { RL } from '../../src/library/tableIds';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const ANIMALS = [RC.dog, RC.wolf, RC.tiger, RC.bear, RC.boar, RC.horse, RC.lizard, RC.python];

describe('323 animal body types', () => {
  it('every animal composes, spawns with its race speed and attacks, and grips only with jaws', () => {
    const s = toStoryStart(makeVillage());
    for (let i = 0; i < ANIMALS.length; i += 3) { // the cast cap is 8: the village's 5 plus 3 animals a plan
      const p = villageStagePlan();
      for (const race of ANIMALS.slice(i, i + 3)) p.cast.push({ compose: { race, role: RO.beast, theme: TH.wild_beasts, rank: 'rank_1' }, key: race, label: 'a beast', name: race,
        appearance: 'a beast', band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'roams' });
      expect(validateStagePlan(s, p, ctx)).toEqual([]);
      applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    }
    for (const race of ANIMALS) {
      const a = s.actors.find((x) => x.names.current === race)!, r = getLibrary().races![race];
      expect(a.core.bodyTypeId).toBe(r.bodyTypeId);
      expect(moveSpeed(s, a)).toEqual(r.speed); // no armor: the race's own speeds
      expect(usableModes(s, a).map((m) => m.itemId)).toEqual(r.naturalAttacks!.map((m) => `natural:${m.id}`));
      expect(gripReachM(s, a)).toBe(r.bodyTypeId === BT.quadruped ? 0.5 : 0); // a snake carries nothing
    }
    const tiger = s.actors.find((x) => x.names.current === RC.tiger)!, dog = s.actors.find((x) => x.names.current === RC.dog)!;
    expect(moveSpeed(s, tiger).run).toBeGreaterThan(moveSpeed(s, dog).run); // same shape, different speeds
  });

  it('the spider shape stops running at 5 of 8 legs Crippled (CS24)', () => {
    const s = makeVillage(), a = s.player;
    a.core.bodyTypeId = BT.eight_legged;
    a.core.raceId = undefined;
    const legs = getLibrary().bodyTypes[BT.eight_legged].parts.filter((p) => p.roles.includes(RL.move)).map((p) => p.id);
    expect(legs).toHaveLength(8);
    legs.slice(0, 4).forEach((id) => (a.core.condition.parts[id] = -50));
    expect(roleOff(s, a, RL.move)).toBe(false);
    a.core.condition.parts[legs[4]] = -50;
    expect(roleOff(s, a, RL.move)).toBe(true);
  });
});
