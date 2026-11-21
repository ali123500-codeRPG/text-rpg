// D-255 a (EP1–EP3): an essence grows a stand-in part on a body that lacks one for its skill: a natural weapon when no
// attack of the body rolls the skill, any other part when no part has its role. Letting the essence go takes the part,
// its wounds and its hold with it.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actorBody } from '../../src/library';
import { ES } from '../../src/library/essenceIds';
import { BT, RC } from '../../src/library/raceIds';
import { AM, RL } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import { canSpeak, hitTable } from '../../src/ruleset/body';
import { usableModes } from '../../src/ruleset/gear';
import { gripSlot } from '../../src/ruleset/slots';
import { removeEssence } from '../../src/engine/essence';
import type { Actor, GameState } from '../../src/types';

const hold = (a: Actor, ...ids: string[]) => {
  a.progression = { ...structuredClone(a.progression ?? { startingTotal: 0, potential: { base: 0, adjustments: [] }, xp: 0, unspentPerkPoints: 0, marks: [] }),
    essences: ids.map((essence) => ({ essence, grade: 'common' as const, points: {}, turn: 0 })) };
  return a;
};
const parts = (s: GameState, a: Actor) => actorBody(s, a).parts.map((p) => p.id);
const attack = (s: GameState, a: Actor, skill: string) => actorBody(s, a).naturalAttacks.find((m) => m.skill === skill);
const slime = (s: GameState) => s.actors.find((a) => a.core.raceId === RC.slime)!;

describe('D-255 a: stand-in parts from essences', () => {
  it('a human with Lashing Tail grows a tail that lashes on Tail, can be hit, and is gone without the essence', () => {
    const s = makeVillage(), p = s.player;
    expect(parts(s, p)).not.toContain('tail');
    hold(p, ES.lashing_tail);
    expect(parts(s, p)).toContain('tail');
    expect(attack(s, p, SK.tail)).toMatchObject({ id: AM.lash, partId: 'tail', reachM: 1 });
    expect(usableModes(s, p).some((m) => m.mode.id === AM.lash)).toBe(true);
    expect(hitTable(s, p).some((r) => r.part === 'tail')).toBe(true);
  });

  it('each beast essence gives a human its weapon: fangs, horns, claws, a gel knot', () => {
    const s = makeVillage(), p = hold(s.player, ES.fang_nose, ES.horn_hide, ES.claw_pounce, ES.gel_patience);
    expect(parts(s, p)).toEqual(expect.arrayContaining(['fangs', 'horns', 'claws', 'gel_knot']));
    expect(attack(s, p, SK.bite)).toMatchObject({ id: AM.bite, partId: 'fangs' });
    expect(attack(s, p, SK.hooves_horns)).toMatchObject({ id: AM.gore, partId: 'horns' });
    expect(attack(s, p, SK.claws)).toMatchObject({ id: AM.claw, partId: 'claws' });
    expect(attack(s, p, SK.slam)).toMatchObject({ id: AM.slam, partId: 'gel_knot' });
  });

  it('a body that has the part or the attack already gets nothing: the slime keeps its own slam, a person its arms', () => {
    const s = makeVillage(), sl = hold(slime(s), ES.gel_patience), p = hold(s.player, ES.gate_habit, ES.tavern_brawler, ES.haggler_ear);
    expect(parts(s, sl)).toEqual([]);
    expect(actorBody(s, sl).naturalAttacks.filter((m) => m.skill === SK.slam)).toHaveLength(1);
    expect(parts(s, p)).toEqual(parts(s, hold(structuredClone(p))));
  });

  it('a slime with Gate-Warden\'s Habit grows a gripping tendril; with Tavern Brawler an arm that punches', () => {
    const s = makeVillage(), sl = hold(slime(s), ES.gate_habit, ES.tavern_brawler);
    const body = actorBody(s, sl);
    expect(body.parts.filter((p) => p.roles.includes(RL.grip)).map((p) => p.id)).toEqual(['gripping_tendril', 'brawler_arm']);
    expect(attack(s, sl, SK.unarmed_strike)).toMatchObject({ id: AM.punch });
  });

  it('a speaking mouth lets a slime talk, and two essences that give one grow it once', () => {
    const s = makeVillage(), sl = slime(s);
    expect(canSpeak(s, sl)).toBe(false);
    hold(sl, ES.haggler_ear, ES.tavern_brawler);
    expect(parts(s, sl).filter((id) => id === 'speaking_mouth')).toHaveLength(1);
    expect(canSpeak(s, sl)).toBe(true);
  });

  it('a beast with its own tail lashes with it: no second tail', () => {
    const s = makeVillage(), w = hold(slime(s), ES.lashing_tail);
    w.core.bodyTypeId = BT.quadruped; w.core.raceId = RC.wolf;
    expect(parts(s, w).filter((id) => id === 'tail')).toHaveLength(1);
    expect(attack(s, w, SK.tail)).toMatchObject({ id: AM.lash, partId: 'tail' });
  });

  it('letting the essence go takes the part, its wounds and its hold: the shield goes back into the pack', () => {
    const s = makeVillage(), p = hold(s.player, ES.gate_habit);
    p.core.bodyTypeId = BT.amorphous; p.core.raceId = RC.slime;
    const item = p.core.inventory[0];
    item.equippedIn = [gripSlot('gripping_tendril')];
    p.core.condition.parts.gripping_tendril = 40;
    expect(removeEssence(s, 0, true)).toBeNull();
    expect(parts(s, p)).not.toContain('gripping_tendril');
    expect(p.core.condition.parts.gripping_tendril).toBeUndefined();
    expect(item.equippedIn).toBeUndefined();
  });
});
