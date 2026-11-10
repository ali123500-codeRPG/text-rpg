// 167 The player's health fears (MB11, MB21): rolled fears count only in a fight, and the player is in one when someone
// is fighting them. isEngaged is an NPC's view (always false for the player), so before this the player never paid a
// health fear.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { act, intent, plannerOut } from './w4-kit';
import { resolveTurn } from '../../src/engine';
import { healthLevel } from '../../src/ruleset';

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
