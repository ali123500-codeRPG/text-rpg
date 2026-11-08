// 125 All-50 parts (Ali, 08/11/2026, All-50 doc round 1): a tree's built parts are granted free when every skill of the
// tree reaches 50 true skill, with the tree's mastery achievement; then the first six built parts.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { ruleset, trueSkill } from '../../src/ruleset';
import { grantAllSteps } from '../../src/ruleset/allSteps';
import { situational } from '../../src/ruleset/gear';
import { achievementName } from '../../src/engine';
import { zoneById } from '../../src/engine/relations';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const set = (a: Actor, skills: string[], raw: number) => { for (const k of skills) a.core.skills[k] = { raw, state: 'normal' }; };
const arm = (s: GameState, id: string, itemId = 'dagger') => {
  const a = id === 'player' ? s.player : s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
};

describe('125 All-50 parts', () => {
  it('every skill of the tree at 50 grants its built parts and the mastery achievement, once', () => {
    const s = makeVillage();
    const p = s.player;
    set(p, ['melee_light', 'melee_medium'], 50);
    set(p, ['melee_heavy'], 49);
    grantAllSteps(s, p);
    expect(p.core.perks.some((x) => x.source === 'mastery')).toBe(false);
    set(p, ['melee_heavy'], 50);
    grantAllSteps(s, p);
    grantAllSteps(s, p);
    const got = p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId);
    expect(got).toEqual(['fighters_frame']); // Weapon Drill and Counter are not built yet
    const ach = p.progression!.achievements!.filter((a) => a.key === 'mastery_50');
    expect(ach.map((a) => a.id)).toEqual(['mastery_50:melee']);
    expect(achievementName(s, ach[0])).toBe('Adept of Combat – Arms');
  });
  it("Hunter's Eye: +10 true skill in every skill with the sight function", () => {
    const s = makeVillage();
    set(s.player, ['sight', 'hearing'], 30);
    give(s.player, 'hunters_eye');
    expect(trueSkill(s.player, 'sight')).toBe(40);
    expect(trueSkill(s.player, 'hearing')).toBe(30);
  });
  it("Fighter's Frame: melee hits on the owner deal ×0.9 damage before armor", () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
      if (perk) give(s.player, 'fighters_frame');
      return ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 2, 50, 50])).damage;
    };
    expect(dmg(false)).toBeGreaterThan(0);
    expect(dmg(true)).toBeCloseTo(dmg(false) * 0.9);
  });
  it('Past the Cover: cover counts one step lighter for the owner\'s ranged attacks', () => {
    const gap = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'player', 'field_edge');
      zoneById(s, 'field_mid')!.cover = 'heavy';
      arm(s, 'player', 'shortbow');
      if (perk) give(s.player, 'past_the_cover');
      return ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'w_player', targetPart: null, aimed: false }, s, forcedRng([100, 50, 50])).gapShifts;
    };
    expect(gap(false)).toEqual([{ source: 'cover', value: 2 }]);
    expect(gap(true)).toEqual([{ source: 'cover', value: 1 }]);
  });
  it('Child of Night: light counts one step darker for the owner\'s stealth rolls only', () => {
    const s = makeVillage();
    const zone = zoneById(s, s.player.zone)!;
    zone.light = 'dim';
    delete (zone as { outdoor?: true }).outdoor;
    const mod = (skill: string) => situational(s, skill, { light: zone, actor: s.player }).modifiers[0]?.value ?? 0;
    const before = [mod('sneaking'), mod('sight')];
    give(s.player, 'child_of_night');
    expect(before).toEqual([5, -5]);
    expect([mod('sneaking'), mod('sight')]).toEqual([10, -5]); // dim read as dark for sneaking; sight unchanged
  });
  it('Curiouser and Curiouser: an Eyesight or Earshot roll at Success or better counts one tier higher', () => {
    const s = makeVillage();
    set(s.player, ['sight', 'persuasion'], 50);
    give(s.player, 'curiouser');
    const r = (skill: string, d: number) => ruleset.roll({ actorId: 'player', skill, modifiers: [], tierShifts: [] }, s, forcedRng([d]));
    expect(r('sight', 90).tierShifts).toEqual([{ source: 'Curiouser and Curiouser', value: 1 }]);
    expect(r('sight', 10).tierShifts).toEqual([]); // not a Success
    expect(r('persuasion', 90).tierShifts).toEqual([]); // not a sense roll
  });
  it('Dodgy: attack rolls against the owner get −5 effective skill', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'patron_1');
    give(s.player, 'dodgy');
    const r = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(r.attack.modifiers.filter((m) => m.type === 'foe_perk')).toEqual([{ source: 'Dodgy', type: 'foe_perk', value: -2.5 }]);
  });
});
