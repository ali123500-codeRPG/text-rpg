// 361 Body size (SZ1-SZ6, SZ8-SZ10, SZ18, SZ19): every body type has a length, width and height in metres, each race
// multiplies them; a body takes up a capsule on the floor, turned the way it faces; every distance between two people is
// the gap between their bodies, so reach is measured edge to edge; nobody is placed inside anybody else.
import { expect, it } from 'vitest';
import type { Actor, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { actorBody, actorVolumeM3, getLibrary } from '../../src/library';
import { BT, RC } from '../../src/library/raceIds';
import { AM } from '../../src/library/tableIds';
import { entryPoint, floorGap, placeAll, withinM } from '../../src/engine/position';
import { hostileNearM, meleeReachM, usableModes } from '../../src/ruleset/gear';
import { gripReachM } from '../../src/ruleset/body';

const OGRE = 'test_ogre';
const room = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  s.zones.find((x) => x.id === 'tav_common')!.rect = { x: 0, y: 0, w: 20, d: 20 };
  return s;
};
const horse = (s: GameState): Actor => {
  const h = s.actors.find((a) => a.id === 'patron_1')!;
  h.core.bodyTypeId = BT.quadruped; h.core.raceId = RC.horse;
  return h;
};

it('SZ1-SZ3: a size is the body type × the race, in metres', () => {
  const s = room();
  expect(actorBody(s, s.player).size).toEqual({ lengthM: 0.3, widthM: 0.5, heightM: 1.75 });
  const h = actorBody(s, horse(s)).size;
  expect([h.lengthM, h.widthM, h.heightM].map((m) => +m.toFixed(6))).toEqual([2.4, 0.65, 1.6]);
  for (const r of Object.values(getLibrary().races!)) {
    const b = actorBody(s, { ...s.player, core: { ...s.player.core, bodyTypeId: r.bodyTypeId, raceId: r.id } }).size;
    expect(Math.min(b.lengthM, b.widthM, b.heightM), r.name).toBeGreaterThan(0);
  }
});

it('SZ4, SZ5: two people face to face with their middles 1 m apart stand 0.7 m apart', () => {
  const s = room();
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  s.player.pos = { x: 0, y: 0 }; s.player.facing = [1, 0];
  p.zone = 'tav_common'; p.pos = { x: 1, y: 0 }; p.facing = [-1, 0];
  expect(floorGap(s, s.player, p)).toBeCloseTo(0.7, 9);
  p.facing = [0, 1]; // side on: its shoulders reach 0.25 m toward the player
  expect(floorGap(s, s.player, p)).toBeCloseTo(0.6, 9);
});

it('SZ9: a horse kicks 1.8 m behind its rump, edge to edge; its bite reaches 0.5 m past its nose', () => {
  const s = room();
  const h = horse(s);
  h.zone = 'tav_common'; h.pos = { x: 0, y: 0 }; h.facing = [1, 0];
  s.player.pos = { x: -(1.2 + 1.5 + 0.15), y: 0 }; s.player.facing = [1, 0]; // 1.5 m behind the rump
  const reach = (id: string) => actorBody(s, h).naturalAttacks.find((m) => m.id === id)!.reach;
  expect(floorGap(s, h, s.player)).toBeCloseTo(1.5, 6);
  expect(withinM(floorGap(s, h, s.player), reach(AM.kick))).toBe(true);
  expect(withinM(floorGap(s, h, s.player), reach(AM.bite))).toBe(false);
  expect(reach(AM.bite)).toBe(0.5);
});

it('SZ10: a part of the shape reaches farther on a bigger race: a horse takes things 0.2 m × 2.4/1.3 past its nose', () => {
  const s = room();
  expect(gripReachM(s, horse(s))).toBeCloseTo(0.2 * 2.4 / 1.3, 9);
  expect(gripReachM(s, s.player)).toBe(0.625); // a person's arm comes from its size instead (SZ8)
});

it('SZ6: code places nobody inside anybody else: bodies keep PLACE_SPACING_M between them', () => {
  const s = room();
  const h = horse(s);
  const many = [s.player, h, ...s.actors.filter((a) => a !== h)];
  for (const a of many) { a.zone = 'tav_common'; delete a.pos; }
  placeAll(s);
  for (let i = 0; i < many.length; i++) for (let j = i + 1; j < many.length; j++)
    expect(floorGap(s, many[i], many[j])).toBeGreaterThanOrEqual(CONFIG.PLACE_SPACING_M - 0.01);
});

it('SZ8: an arm reaches (height × ARM_SPAN_SHARE − width) ÷ 2 past the body; a held weapon reaches that plus its length', () => {
  const s = room();
  const sword = s.player.core.inventory.find((i) => i.equippedIn?.length && getLibrary().items[i.itemId]?.weapon)!;
  const len = getLibrary().items[sword.itemId].weapon!.modes[0].lengthM!;
  const reachOf = () => usableModes(s, s.player).find((m) => m.itemId === sword.id)!.mode.reach;
  expect(gripReachM(s, s.player)).toBeCloseTo((1.75 * CONFIG.ARM_SPAN_SHARE - 0.5) / 2, 9);
  expect(reachOf()).toBeCloseTo(0.625 + len, 9);
  getLibrary().races![OGRE] = { ...getLibrary().races![s.player.core.raceId!], id: OGRE, sizeMult: { length: 2, width: 2, height: 2 } };
  s.player.core.raceId = OGRE; // 3.5 m tall, 1 m wide: a 1.25 m arm, scaled by its own size
  expect(gripReachM(s, s.player)).toBeCloseTo(1.25, 9);
  expect(reachOf()).toBeCloseTo(1.25 + len, 9);
  delete getLibrary().races![OGRE];
});

it('SZ18: a volume is the size\'s box, length × width × height', () => {
  const s = room();
  expect(actorVolumeM3(s, s.player)).toBeCloseTo(0.3 * 0.5 * 1.75, 9);
  expect(actorVolumeM3(s, horse(s))).toBeCloseTo(2.4 * 0.65 * 1.6, 6);
});

it('SZ19: a hostile is near within a step plus its own melee reach; a walk into a zone stands a step in to the body\'s near edge', () => {
  const s = room();
  expect(hostileNearM(s, s.player)).toBeCloseTo(CONFIG.HOSTILE_NEAR_STEP_M + meleeReachM(s, s.player), 9);
  const h = horse(s);
  for (const i of h.core.inventory) delete i.equippedIn;
  expect(hostileNearM(s, h)).toBeCloseTo(CONFIG.HOSTILE_NEAR_STEP_M + 1.8, 9); // its kick
  const street = s.zones.find((z) => z.id === 'street_door')!;
  const at = entryPoint(s, 'tav_common', street.id, h), door = entryPoint(s, 'tav_common', street.id)!;
  expect(at && Math.hypot(at.x - door.x, at.y - door.y)).toBeCloseTo(1.2, 6); // half the horse's 2.4 m further in than a point
});
