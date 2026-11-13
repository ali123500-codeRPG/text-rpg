// 167 The player's health fears (MB11, MB21), and the part fear (a part Crippled or worse rolls morale): rolled fears count only in a fight, and the player is in one when someone
// is fighting them. isEngaged is an NPC's view (always false for the player), so before this the player never paid a
// health fear.
import { expect, it } from 'vitest';
import { createRng, forcedRng, makeVillage } from '../harness';
import { startSpar } from '../../src/engine/spar';
import { isEngaged } from '../../src/engine/relations';
import { IT } from '../../src/library/itemIds';
import { act, intent, plannerOut } from './w4-kit';
import { resolveTurn } from '../../src/engine';
import { healthLevel, partStates, ruleset } from '../../src/ruleset';
import { partFearCost, partFears } from '../../src/ruleset/morale';
import { getLibrary } from '../../src/library';
import { BT } from '../../src/library/raceIds';
import { isActive } from '../../src/engine/relations';
import { FR } from '../../src/library/tableIds';
import type { PartStateKey } from '../../src/scales';

it('167 a hit that moves the player to a new health level pays the health fear', () => {
  let checked = 0;
  for (let seed = 1; seed < 400 && checked < 5; seed++) {
    const s = makeVillage({ playerZone: 'tav_common' });
    s.actors.find((a) => a.id === 'patron_1')!.mind!.overrides = { player: 'hostile' };
    s.player.core.condition.hpLostPct = 40;
    const before = healthLevel(s.player);
    resolveTurn(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }), aimed: false, agentOutputs: [plannerOut('patron_1', act('attack', 'player'))], spokespeople: [] }, createRng(seed));
    if (healthLevel(s.player) === before) continue;
    checked++;
    expect(s.log.some((l) => l.code === 'morale' && (l.detail as { actorId: string }).actorId === 'player')).toBe(true);
  }
  expect(checked).toBe(5);
});

it('167b a hit that cripples a part rolls the part fear, once per hit; Destroyed rolls again', () => {
  const ids = (b: PartStateKey, a: PartStateKey) => partFears([{ id: 'arm', state: b }], [{ id: 'arm', state: a }]).map((x) => x.fear.id);
  expect(ids('damaged', 'crippled')).toEqual([FR.own_part_crippled]);
  expect(ids('healthy', 'destroyed')).toEqual([FR.own_part_crippled, FR.own_part_destroyed]);
  expect(ids('crippled', 'destroyed')).toEqual([FR.own_part_destroyed]);
  expect(ids('healthy', 'damaged')).toEqual([]);
  // costs by impact for a 6-part body (5 / 15 / 30), scaled by 6 ÷ the body's parts; Destroyed is 1.5 × Crippled
  const fears = getLibrary().fears!;
  const human = getLibrary().bodyTypes[BT.humanoid].parts;
  expect(human.length).toBe(6);
  expect(partFearCost(fears[FR.own_part_crippled], ['left_arm'], human)).toBe(15);
  expect(partFearCost(fears[FR.own_part_crippled], ['neck', 'left_arm'], human)).toBe(45);
  expect(partFearCost(fears[FR.own_part_destroyed], ['head'], human)).toBe(45);
  const dragon = getLibrary().bodyTypes[BT.winged_quadruped].parts;
  expect(partFearCost(fears[FR.own_part_crippled], ['tail'], dragon)).toBe(5 * 6 / dragon.length);
  const twelve = [...human, ...human.map((p) => ({ ...p, id: p.id + '_2' }))];
  expect(partFearCost(fears[FR.own_part_crippled], ['left_arm'], twelve)).toBe(7.5);
  let checked = 0, paid = 0;
  for (let seed = 1; seed < 400 && checked < 5; seed++) {
    const s = makeVillage({ playerZone: 'tav_common' });
    s.actors.find((a) => a.id === 'patron_1')!.mind!.overrides = { player: 'hostile' };
    for (const k of Object.keys(s.player.core.condition.parts)) if (k !== 'head' && k !== 'neck') s.player.core.condition.parts[k] = 1;
    const before = partStates(s, s.player);
    const ev = resolveTurn(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }), aimed: false, agentOutputs: [plannerOut('patron_1', act('attack', 'player'))], spokespeople: [] }, createRng(seed));
    const hits = ev.filter((e) => e.kind === 'attack' && e.actorId === 'patron_1' && e.target === 'player').length; // AT78: two blows a turn
    if (!partFears(before, partStates(s, s.player)).length || !isActive(s.player)) continue;
    checked++;
    const mine = s.log.filter((l) => l.code === 'morale' && (l.detail as { actorId: string }).actorId === 'player' && (l.detail as { fear: string }).fear === FR.own_part_crippled);
    expect(mine.length).toBeLessThanOrEqual(hits); // once per hit, however many parts
    paid += mine.length;
  }
  expect(checked).toBe(5);
  expect(paid).toBeGreaterThan(0); // a Critical Success costs nothing, so not every crippling logs
});

it('167c the player is in a fight in a spar too, and a foe in the zone crowds the player\'s shot whichever side holds the stance', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  const wim = s.actors.find((a) => a.id === 'patron_1')!;
  expect(isEngaged(s, s.player)).toBe(false);
  startSpar(s, [['player'], ['patron_1']], false, 'test');
  wim.mind!.knowledge.player = { ...(wim.mind!.knowledge.player ?? { source: 'seen', revealed: [] }), status: 'aware', lastKnownZone: s.player.zone } as never;
  expect(isEngaged(s, s.player)).toBe(true);
  // the player's own band holds no stance toward Wim's: only Wim is hostile, and the shot is still crowded
  const t = makeVillage({ playerZone: 'tav_common' });
  t.bands.find((b) => b.id === t.player.bandId)!.relations = {};
  t.actors.find((a) => a.id === 'patron_1')!.mind!.overrides = { player: 'hostile' };
  for (const i of t.player.core.inventory) delete i.equippedIn;
  t.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'bow', targetPart: null, aimed: false }, t, forcedRng([50, 50, 50]));
  expect(r.attack.modifiers.some((m) => m.source === 'hostile close')).toBe(true);
});
