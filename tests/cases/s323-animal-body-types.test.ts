// 323 Animal body types (NR14 a, AB1-AB15): one Quadruped shape for land beasts plus Serpent and Eight-legged; each animal
// race sets its own real speeds, attacks and natural armor, and the Weaver can compose any of them as a beast. Round 2:
// one skill per kind of natural attack (AB16), a 1,000 kg dragon (AB17), Scent (AB18, AB19) and Hide (AB20).
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { actorBody, getLibrary } from '../../src/library';
import { skillOpen } from '../../src/ruleset/access';
import { SK } from '../../src/library/skillIds';
import { BT, RC } from '../../src/library/raceIds';
import { RO, TH } from '../../src/library/npcLayerIds';
import { moveSpeed } from '../../src/engine/speed';
import { usableModes } from '../../src/ruleset/gear';
import { effectiveSkill } from '../../src/ruleset';
import { gripReachM, roleOff } from '../../src/ruleset/body';
import { RL } from '../../src/library/tableIds';
import { TR } from '../../src/library/treeIds';
import { naturalReduction } from '../../src/ruleset';
import { perceptionOf, smells } from '../../src/perception';
import { CONFIG } from '../../src/config';
import type { GameEvent } from '../../src/types';
import { unplace } from '../../src/engine/position';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const ANIMALS = [RC.dog, RC.wolf, RC.tiger, RC.bear, RC.boar, RC.horse, RC.lizard, RC.python, RC.spider, RC.lion, RC.leopard, RC.hyena, RC.crocodile];
/** the animals composed and spawned: each body type, natural armor (boar), two quadrupeds of different speeds; every
 *  race's own attacks are checked without spawning in BG-250 below */
const SPAWNED = [RC.dog, RC.wolf, RC.tiger, RC.boar, RC.python, RC.spider];

describe('323 animal body types', () => {
  it('an animal of each body type composes, spawns with its race speed and attacks, and grips only with jaws', () => {
    const s = toStoryStart(makeVillage());
    for (let i = 0; i < SPAWNED.length; i += 3) { // the cast cap is 8: the village's 5 plus 3 animals a plan
      // WI1: the village is built by the first plan; later plans add to it and never declare it again
      const p = i ? { ...villageStagePlan(), places: [], zones: [], bands: [], frontiers: [] } : villageStagePlan();
      for (const race of SPAWNED.slice(i, i + 3)) p.cast.push({ compose: { race, role: RO.beast, theme: TH.wild_beasts, rank: 'rank_1' }, key: race, label: 'a beast', name: race,
        appearance: 'a beast', band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'roams' });
      expect(validateStagePlan(s, p, ctx)).toEqual([]);
      applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    }
    for (const race of SPAWNED) {
      const a = s.actors.find((x) => x.names.current === race)!, r = getLibrary().races![race];
      expect(a.core.bodyTypeId).toBe(r.bodyTypeId);
      expect(moveSpeed(s, a)).toEqual(r.speed); // no armor: the race's own speeds
      expect(usableModes(s, a).map((m) => m.itemId)).toEqual(r.naturalAttacks!.map((m) => `natural:${m.id}`));
      expect(gripReachM(s, a)).toBeCloseTo(r.bodyTypeId === BT.quadruped ? 0.2 * actorBody(s, a).reachScale : 0, 9); // a snake carries nothing; SZ9, SZ10: jaws 0.2 m past the nose × the race's length
      expect(actorBody(s, a).naturalArmor).toEqual(r.naturalArmor); // AB13: boar, lizard, crocodile
    }
    const tiger = s.actors.find((x) => x.names.current === RC.tiger)!, dog = s.actors.find((x) => x.names.current === RC.dog)!;
    expect(moveSpeed(s, tiger).run).toBeGreaterThan(moveSpeed(s, dog).run); // same shape, different speeds
    expect(ANIMALS.filter((r) => getLibrary().races![r].naturalArmor)).toEqual([RC.boar, RC.lizard, RC.crocodile]);
    expect(skillOpen(s.actors.find((x) => x.names.current === RC.python)!, SK.tremor)).toBe(true); // AB11: snakes and spiders feel vibration
    expect(skillOpen(dog, SK.tremor)).toBe(false);
    // BG-250: an animal rolls its natural attacks at its real skill, not 0
    const wolf = s.actors.find((x) => x.names.current === RC.wolf)!;
    expect(effectiveSkill(s, wolf, SK.bite).value).toBeGreaterThan(0);
    // AB16 a: a composed beast trains exactly the natural skills its attacks roll; AB20: Hide only with natural armor
    const natural = getLibrary().trees[TR.natural].skills;
    for (const race of SPAWNED) {
      const a = s.actors.find((x) => x.names.current === race)!, r = getLibrary().races![race];
      const own = [...new Set(r.naturalAttacks!.map((m) => m.skill!).filter((k) => natural.includes(k)))].sort();
      expect(Object.keys(a.core.skills).filter((k) => natural.includes(k)).sort(), race).toEqual(own);
      expect(!!a.core.skills[SK.hide], race).toBe(!!r.naturalArmor);
      expect(effectiveSkill(s, a, SK.scent).value, race).toBeGreaterThan(0); // AB18: every animal smells
    }
    const boar = s.actors.find((x) => x.names.current === RC.boar)!;
    expect(effectiveSkill(s, boar, SK.hide).value).toBeGreaterThan(0);
    expect(naturalReduction(s, boar, getLibrary().races![RC.boar].naturalArmor!)).toBeCloseTo(CONFIG.ARMOR_FACTOR * effectiveSkill(s, boar, SK.hide).value * 1, 9);
  });

  it('AB18: a nose finds someone unseen and unheard within Scent metres along the open ways, in any light', () => {
    const s = makeVillage(), dog = s.player, patron = s.actors.find((x) => x.id === 'patron_1')!;
    patron.zone = 'tav_cellar'; unplace(s, patron); // 11 m away by the stairs, out of sight
    const ev = { id: 'e1', turn: 1, actorId: patron.id, kind: 'wait', zone: 'tav_cellar', effects: [], noise: 'silent', visibility: 'low', perception: {} } as unknown as GameEvent;
    expect(perceptionOf(ev, s, dog)).toBeNull(); // a person neither sees, hears nor smells it
    Object.assign(dog.core, { raceId: RC.dog, bodyTypeId: BT.quadruped });
    dog.core.skills[SK.scent] = { raw: 20, state: 'normal' };
    expect(perceptionOf(ev, s, dog)).toEqual({ level: 'partial', cue: 'smell' }); // something is there, not who
    expect(smells(s, dog, { zone: 'street_square' })).toBe(false); // 28 m: past its 20
    dog.core.skills[SK.scent].raw = 30;
    expect(smells(s, dog, { zone: 'street_square' })).toBe(true);
  });

  it('BG-250: every race can use every skill its own natural attacks roll', () => {
    const s = makeVillage(), a = s.player, lib = getLibrary();
    for (const r of Object.values(lib.races!)) {
      a.core.raceId = r.id;
      a.core.bodyTypeId = r.bodyTypeId;
      for (const m of actorBody(s, a).naturalAttacks) expect(skillOpen(a, m.skill!), `${r.name} ${m.name}`).toBe(true);
    }
  });

  it('a giant spider stops running at 5 of 8 legs Crippled (CS24)', () => {
    const s = makeVillage(), a = s.player;
    a.core.bodyTypeId = BT.eight_legged;
    a.core.raceId = RC.spider;
    const legs = getLibrary().bodyTypes[BT.eight_legged].parts.filter((p) => p.roles.includes(RL.move)).map((p) => p.id);
    expect(legs).toHaveLength(8);
    legs.slice(0, 4).forEach((id) => (a.core.condition.parts[id] = -50));
    expect(roleOff(s, a, RL.move)).toBe(false);
    a.core.condition.parts[legs[4]] = -50;
    expect(roleOff(s, a, RL.move)).toBe(true);
  });
});
