// 301 CS20: a sleeper's "near" is a sound rule, never a zone. Someone hostile is near a sleeper when their steps reach it
// (their movement sound, a sneaker's at its sneaking noise, carried as for a listener awake: metres, walls and doors).
// Light Sleeper rolls only against those; the player's night stops only for those.
import { afterEach, describe, expect, it } from 'vitest';
import type { Actor, GameState } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { now } from '../../src/time';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { fallAsleep, hostilesNear, wakeCheck, wakeChecksNear } from '../../src/engine/sleep';
import { distM } from '../../src/engine/position';
import { SK } from '../../src/library/skillIds';

// the village's fields are 40 m squares side by side: field_edge spans x 50..90, field_mid x 90..130
const Y = -13.872983346207416;
const setUp = () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'patron_1'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  (g.mind!.overrides ??= {}).player = 'hostile';
  s.player.pos = { x: 91, y: Y };
  s.player.core.perks.push({ perkId: PK.light_sleeper, source: 'level', gainedTurn: 0 });
  fallAsleep(s, s.player, now(s) + 480);
  return { s, g };
};
const put = (s: GameState, g: Actor, zone: string, x: number) => { g.zone = zone; g.pos = { x, y: Y }; return distM(s, s.player, g); };
const quietSteps = () => 'quiet' as const;
const grade = CONFIG.WAKE_GRADE.quiet;
afterEach(() => { CONFIG.WAKE_GRADE.quiet = grade; });

describe('301 sleepers hear who is near by sound, not by zone', () => {
  it('a hostile 3 m away across the zone line is near; one 30 m off in the same field is not', () => {
    const { s, g } = setUp();
    expect(put(s, g, 'field_edge', 88)).toBeLessThan(5);
    expect(hostilesNear(s, s.player, quietSteps).map((x) => x.id)).toEqual(['guard_1']);
    expect(put(s, g, 'field_mid', 121)).toBeGreaterThan(25);
    expect(hostilesNear(s, s.player, quietSteps)).toEqual([]);
    // louder steps carry further: the same foe stomping is near again
    expect(hostilesNear(s, s.player, () => 'normal').map((x) => x.id)).toEqual(['guard_1']);
  });
  it('Light Sleeper rolls against the foe whose steps reach it, in another zone too, and not against one out of earshot', () => {
    const { s, g } = setUp();
    CONFIG.WAKE_GRADE.quiet = 'none';
    put(s, g, 'field_mid', 121);
    wakeChecksNear(s, quietSteps, createRng(1));
    expect(s.log.some((l) => l.code === 'wake_check')).toBe(false);
    put(s, g, 'field_edge', 88);
    wakeChecksNear(s, quietSteps, createRng(1));
    expect(s.log.find((l) => l.code === 'wake_check')!.detail).toMatchObject({ other: 'guard_1' });
  });
  it('a sneaker whose steps cannot reach the sleeper gets no contest', () => {
    const { s, g } = setUp();
    g.posture = 'stealthy';
    put(s, g, 'field_mid', 121);
    expect(wakeCheck(s, s.player, g, 'quiet', createRng(1))).toBe(false);
    expect(s.log.some((l) => l.code === 'wake_check')).toBe(false);
    put(s, g, 'field_edge', 88);
    wakeCheck(s, s.player, g, 'quiet', createRng(1));
    expect(s.log.find((l) => l.code === 'wake_check')!.detail).toMatchObject({ sneaking: true });
  });
  // BG-249: wake checks learn like any other roll
  it('a Light Sleeper\'s hearing check against open steps marks its Earshot', () => {
    const { s, g } = setUp();
    s.player.core.skills[SK.earshot] = { raw: 50, state: 'normal' };
    CONFIG.WAKE_GRADE.quiet = 'moderate'; // 50: inside Earshot 50's learning window, passed or not
    put(s, g, 'field_edge', 88);
    wakeCheck(s, s.player, g, 'quiet', createRng(1));
    expect(s.player.progression!.marks).toContain(SK.earshot);
  });
  it('a Light Sleeper\'s contest against a sneaker marks its Earshot', () => {
    const { s, g } = setUp();
    s.player.core.skills[SK.earshot] = { raw: 50, state: 'normal' };
    g.core.skills[SK.sneaking] = { raw: 50, state: 'normal' };
    g.posture = 'stealthy';
    put(s, g, 'field_edge', 88);
    wakeCheck(s, s.player, g, 'quiet', createRng(1));
    expect(s.player.progression!.marks).toContain(SK.earshot);
  });
  it('the player sneaking past a Light Sleeper learns Sneaking from the contest', () => {
    const { s, g } = setUp();
    delete s.player.asleep;
    s.player.core.skills[SK.sneaking] = { raw: 50, state: 'normal' };
    s.player.posture = 'stealthy';
    g.core.skills[SK.earshot] = { raw: 50, state: 'normal' };
    g.core.perks.push({ perkId: PK.light_sleeper, source: 'level', gainedTurn: 0 });
    put(s, g, 'field_edge', 88);
    fallAsleep(s, g, now(s) + 480);
    wakeCheck(s, g, s.player, 'quiet', createRng(1));
    expect(s.log.find((l) => l.code === 'wake_check')!.detail).toMatchObject({ actorId: 'guard_1', sneaking: true });
    expect(s.player.progression!.marks).toContain(SK.sneaking);
  });
});
