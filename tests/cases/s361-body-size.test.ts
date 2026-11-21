// 361 Body size (SZ1-SZ13, SZ16, SZ18, SZ19): every body type has a length, width and height in metres, each race
// multiplies them; a body takes up a capsule on the floor, turned the way it faces; every distance between two people is
// the gap between their bodies, so reach is measured edge to edge; nobody is placed inside anybody else.
import { expect, it } from 'vitest';
import type { Actor, GameState } from '../../src/types';
import { forcedRng, landUnder, makeVillage, place } from '../harness';
import { middle, wayTo } from '../../src/plan/where';
import { CONFIG } from '../../src/config';
import { actorBody, getLibrary } from '../../src/library';
import { BT, RC } from '../../src/library/raceIds';
import { AM, LC } from '../../src/library/tableIds';
import { entryPoint, floorGap, placeAll, seeingM, seenSizeFactor, unplace, withinM } from '../../src/engine/position';
import { sightFactor } from '../../src/library/bodySize';
import { ruleset } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';
import { fitsThrough, wayPath, zoneById } from '../../src/engine/relations';
import { coverMod, coverShown, hostileNearM, meleeReachM, usableModes } from '../../src/ruleset/gear';
import { gripReachM } from '../../src/ruleset/body';

const OGRE = 'test_ogre';
const room = () => {
  return makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'], shape: { tav_common: { rect: { x: 0, y: 0, w: 20, d: 20 } } } });
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

it('SZ6: code places nobody inside anybody else: bodies keep PLACE_SPACING_M between them', () => {
  const s = room();
  const h = horse(s);
  const many = [s.player, h, ...s.actors.filter((a) => a !== h)];
  for (const a of many) { a.zone = 'tav_common'; unplace(s, a); }
  placeAll(s);
  for (let i = 0; i < many.length; i++) for (let j = i + 1; j < many.length; j++)
    expect(floorGap(s, many[i], many[j])).toBeGreaterThanOrEqual(CONFIG.PLACE_SPACING_M - 0.01);
});

it('SZ8, SZ10, FR2: an arm reaches (height × ARM_SPAN_SHARE − width) ÷ 2 past the body; a held weapon reaches that plus its length', () => {
  const s = room();
  const sword = s.player.core.inventory.find((i) => i.equippedIn?.length && getLibrary().items[i.itemId]?.weapon)!;
  const len = getLibrary().items[sword.itemId].weapon!.modes[0].lengthM!;
  const reachOf = () => usableModes(s, s.player).find((m) => m.itemId === sword.id)!.mode.reach;
  expect(gripReachM(s, s.player)).toBeCloseTo((1.75 * CONFIG.ARM_SPAN_SHARE - 0.5) / 2, 9);
  expect(gripReachM(s, s.player)).toBe(0.625); // SZ8: (1.75 × 1 − 0.5) ÷ 2
  expect(reachOf()).toBeCloseTo(0.625 + len, 9);
  // FR2, SZ9, SZ10: grip reach comes from the body: a horse takes things 0.2 m × 2.4/1.3 past its nose, a dragon in its jaws 0.8 m, a slime has no grip
  expect(gripReachM(s, horse(s))).toBeCloseTo(0.2 * 2.4 / 1.3, 9);
  const reachAs = (bodyTypeId: string) => gripReachM(s, { ...s.player, core: { ...s.player.core, bodyTypeId } });
  expect(reachAs(BT.winged_quadruped)).toBe(0.8);
  expect(reachAs(BT.amorphous)).toBe(0);
  getLibrary().races![OGRE] = { ...getLibrary().races![s.player.core.raceId!], id: OGRE, sizeMult: { length: 2, width: 2, height: 2 } };
  s.player.core.raceId = OGRE; // 3.5 m tall, 1 m wide: a 1.25 m arm, scaled by its own size
  expect(gripReachM(s, s.player)).toBeCloseTo(1.25, 9);
  expect(reachOf()).toBeCloseTo(1.25 + len, 9);
  delete getLibrary().races![OGRE];
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

it('SZ11: a body is seen as far as √(its seen area ÷ a person\'s); looking down shows its top', () => {
  const s = room();
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.zone = 'tav_common'; p.pos = { x: 10, y: 0 }; s.player.pos = { x: 0, y: 0 };
  expect(seenSizeFactor(s, s.player, p)).toBeCloseTo(1, 9);
  const gap = floorGap(s, s.player, p);
  expect(seeingM(s, s.player, p)).toBeCloseTo(gap, 9);
  horse(s); // 2.4 long, 1.6 high: √(2.4 × 1.6 ÷ (0.5 × 1.75))
  expect(seenSizeFactor(s, s.player, p)).toBeCloseTo(Math.sqrt((2.4 * 1.6) / 0.875), 6);
  expect(seeingM(s, s.player, p)).toBeCloseTo(floorGap(s, s.player, p) / Math.sqrt((2.4 * 1.6) / 0.875), 6);
  const python = { lengthM: 1, widthM: 1, heightM: 0.3 };
  expect(sightFactor(python)).toBeCloseTo(0.59, 2); // a hump in the grass from the ground
  expect(sightFactor(python, Math.PI / 4)).toBeCloseTo(1.02, 2); // seen from a balcony
  expect(sightFactor({ lengthM: 0.3, widthM: 0.5, heightM: 1.75 }, Math.PI / 4)).toBeCloseTo(0.91, 2);
});

it('SZ12, CV3, CV4: cover is set for a person; a smaller body shows less by its height, with no top; a taller one more, except under tall cover', () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const z = s.zones.find((x) => x.id === 'field_mid')!; // PZ6 a: clutter is the land's under the open sky
  const p = place(s, 'patron_1', 'field_mid');
  landUnder(s, z.outline, LC.marsh); // reed beds: some cover, 2 m high
  expect(coverShown(s, s.player, z)).toBe(0.5);
  expect(coverMod(coverShown(s, s.player, z))).toBe(13); // CV6: one halving
  p.core.bodyTypeId = BT.amorphous; p.core.raceId = s.actors.find((a) => a.id === 'slime_1')?.core.raceId ?? RC.slime;
  expect(coverShown(s, p, z)).toBeCloseTo(0.5 * 0.3 / 1.75); // a slime 0.3 m high
  expect(coverMod(coverShown(s, p, z))).toBe(46);
  getLibrary().races![OGRE] = { ...getLibrary().races![s.player.core.raceId!], id: OGRE, sizeMult: { length: 2, width: 2, height: 7 / 1.75 } };
  const giant = { ...s.player, core: { ...s.player.core, raceId: OGRE } };
  expect(coverShown(s, giant, z)).toBe(1); // 7 m tall behind a 1.1 m counter: nothing hidden
  landUnder(s, z.outline, LC.woods);
  expect(coverShown(s, giant, z)).toBe(0.25); // among 20 m trees: hidden like a person
  expect(coverMod(coverShown(s, p, z))).toBeGreaterThan(35); // the more it hides, the more it counts
  landUnder(s, z.outline, LC.farmland);
  expect(coverShown(s, p, z)).toBe(1); // no cover to hide in
  delete getLibrary().races![OGRE];
});

it('SZ13: the range penalty reads the shot\'s metres ÷ the target\'s size factor', () => {
  const s = makeVillage({ without: ['guard_1', 'trader', 'patron_1'] });
  place(s, 'player', 'field_mid'); place(s, 'slime_1', 'field_mid'); place(s, 'slime_2', 'field_far');
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  const t = s.actors.find((a) => a.id === 'slime_1')!;
  const r = middle(s.zones.find((z) => z.id === 'field_mid')!);
  s.player.pos = { x: r.x, y: r.y - 19 }; t.pos = { x: r.x, y: s.player.pos.y + 20 }; // a shortbow reaches 50 m
  const range = () => ruleset.attack({ attackerId: 'player', targetId: t.id, weaponId: 'bow', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50])).attack.modifiers.find((m) => m.source === 'range')?.pct ?? 0;
  const slime = range();
  t.core.bodyTypeId = BT.quadruped; t.core.raceId = RC.horse;
  const horseMod = range();
  expect(slime).toBe(-20); // a slime 20 m off looks as small as a person at 20 ÷ 0.41 = 48 m (over 75% of the reach)
  expect(horseMod).toBe(0); // a horse looks as near as a person at 20 ÷ 2.1 = 9.5 m (under 25%)
});

it('SZ7: a body goes through a doorway sideways and ducking; too big a body takes another way or none', () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  const link = wayTo(s, 'street_door', 'tav_common')!;
  const h = horse(s);
  expect(link.opening).toMatchObject({ widthM: CONFIG.DOORWAY_M[0], heightM: CONFIG.DOORWAY_M[1] });
  expect(fitsThrough(s, s.player, link)).toBe(true);
  expect(fitsThrough(s, h, link)).toBe(true); // nose first: 0.65 m wide, 1.6 m ducks to 0.8
  getLibrary().races![OGRE] = { ...getLibrary().races![s.player.core.raceId!], id: OGRE, sizeMult: { length: 2, width: 2, height: 6 / 1.75 } };
  const giant = { ...s.player, zone: 'street_door', core: { ...s.player.core, raceId: OGRE } };
  expect(fitsThrough(s, giant, link)).toBe(false); // 1 m wide, and 6 m ducks only to 3
  expect(wayPath(s, 'street_door', 'tav_common', giant)).toBeNull();
  expect(wayPath(s, 'street_door', 'tav_common', s.player)).toEqual(['tav_common']);
  expect(fitsThrough(s, giant, wayTo(s, 'field_edge', 'field_mid')!)).toBe(true); // open ground: as wide as the ground they share
  delete getLibrary().races![OGRE];
});

