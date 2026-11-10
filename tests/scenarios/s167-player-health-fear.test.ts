// 167 The player's health fears (MB11, MB21), and the part fear (a part Crippled or worse rolls morale): rolled fears count only in a fight, and the player is in one when someone
// is fighting them. isEngaged is an NPC's view (always false for the player), so before this the player never paid a
// health fear.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { act, intent, plannerOut } from './w4-kit';
import { resolveTurn } from '../../src/engine';
import { healthLevel, partStates } from '../../src/ruleset';
import { partFears } from '../../src/ruleset/morale';
import { isActive } from '../../src/engine/relations';
import { FR } from '../../src/library/tableIds';

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

it('167b a hit that cripples a part rolls the part fear, once per hit', () => {
  expect(partFears([{ id: 'arm', state: 'Damaged' }], [{ id: 'arm', state: 'Crippled' }]).map((f) => f.id)).toEqual([FR.own_part_crippled]);
  expect(partFears([{ id: 'arm', state: 'Healthy' }], [{ id: 'arm', state: 'Destroyed' }]).map((f) => f.id)).toEqual([FR.own_part_crippled]);
  expect(partFears([{ id: 'arm', state: 'Crippled' }], [{ id: 'arm', state: 'Destroyed' }])).toEqual([]);
  expect(partFears([{ id: 'arm', state: 'Healthy' }], [{ id: 'arm', state: 'Damaged' }])).toEqual([]);
  let checked = 0, paid = 0;
  for (let seed = 1; seed < 400 && checked < 5; seed++) {
    const s = makeVillage({ playerZone: 'tav_common' });
    s.actors.find((a) => a.id === 'patron_1')!.mind!.overrides = { player: 'hostile' };
    for (const k of Object.keys(s.player.core.condition.parts)) if (k !== 'head' && k !== 'neck') s.player.core.condition.parts[k] = 1;
    const before = partStates(s, s.player);
    resolveTurn(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }), aimed: false, agentOutputs: [plannerOut('patron_1', act('attack', 'player'))], spokespeople: [] }, createRng(seed));
    if (!partFears(before, partStates(s, s.player)).length || !isActive(s.player)) continue;
    checked++;
    const mine = s.log.filter((l) => l.code === 'morale' && (l.detail as { actorId: string }).actorId === 'player' && (l.detail as { fear: string }).fear === FR.own_part_crippled);
    expect(mine.length).toBeLessThanOrEqual(1); // once per hit, however many parts
    paid += mine.length;
  }
  expect(checked).toBe(5);
  expect(paid).toBeGreaterThan(0); // a Critical Success costs nothing, so not every crippling logs
});
