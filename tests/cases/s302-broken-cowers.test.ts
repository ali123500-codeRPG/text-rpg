// BF37 → BF79: a broken nerve blocks attacking and any walk toward a foe, and lets a walk or run away go ahead. On turn 24
// Wren broke, and the game threw away his give and made him flee instead (BG-201): a broken NPC keeps what its mind chose,
// less the attack, and may also walk away in the same turn; with nothing allowed left it flees one link away from its foe,
// and cowers only when no way leads away. A broken player's walk toward a foe and attack come to nothing while their words
// are heard; a walk away plays. At Cowering (CONFIG.MORALE_COWER_AT × max morale lost) not even a walk away is left.
import { expect, it } from 'vitest';
import { beside, makeVillage, place } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import { maxMorale } from '../../src/ruleset/morale';

it('a broken NPC who chose to give and walk off does the give and steps away (BG-201 cannot return)', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = beside(s, 'patron_1', 'player', 1);
  w.mind!.moraleState = 'broken';
  w.core.inventory.push({ id: 'charm_1', itemId: IT.lucky_charm });
  const ev = play(s, { agentOutputs: [plannerOut(w.id, act('give', 'player', { item: 'charm_1' }), { move: { toZone: 'street_door', after: true } })] });
  expect(ev.some((e) => e.actorId === w.id && e.kind === 'offer')).toBe(true);
  expect(w.zone).toBe('street_door');
});

it('a broken NPC with nothing allowed to do flees one link away from its foe', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = place(s, 'patron_1', 'tav_counter');
  w.mind!.slots = {};
  w.mind!.overrides = { player: 'yielded' };
  w.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  w.mind!.moraleState = 'broken';
  const ev = play(s);
  expect(ev.find((e) => e.actorId === w.id)?.kind).toBe('move');
  expect(w.zone).toBe('tav_cellar');
});

it('a broken NPC with no way away cowers where it stands; at Cowering it cowers even with one', () => {
  const s = makeVillage({ playerZone: 'tav_counter', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = place(s, 'patron_1', 'tav_cellar');
  w.mind!.slots = {};
  w.mind!.overrides = { player: 'yielded' };
  w.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_counter', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  w.mind!.moraleState = 'broken';
  play(s);
  expect(w.zone).toBe('tav_cellar');
  const t = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const c = place(t, 'patron_1', 'tav_counter');
  c.mind!.slots = {};
  c.mind!.overrides = { player: 'yielded' };
  c.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: t.turn, source: 'seen', revealed: [] };
  c.mind!.moraleState = 'broken';
  c.core.condition.moraleLost = CONFIG.MORALE_COWER_AT * maxMorale(c);
  const ev = play(t);
  expect(c.zone).toBe('tav_counter');
  expect(ev.some((e) => e.actorId === c.id && e.kind === 'move')).toBe(false);
});

it("a broken player's walk toward a foe and attack come to nothing, and their words are heard", () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_2', 'guard_1'] });
  const sl = place(s, 'slime_1', 'tav_counter');
  sl.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.player.core.condition.moraleLost = maxMorale(s.player); // broken
  const at = { ...s.player.pos! };
  const ev = play(s, { intent: intent({ move: { toZone: 'tav_counter' }, action: { type: 'attack', target: sl.id }, spoken: 'Stay back!', addressees: [sl.id] }) });
  expect(s.player.zone).toBe('tav_common');
  expect(s.player.pos).toEqual(at);
  expect(ev.some((e) => e.actorId === s.player.id && e.kind === 'attack')).toBe(false);
  expect(ev.some((e) => e.actorId === s.player.id && e.line?.text === 'Stay back!')).toBe(true);
  expect(s.log.some((l) => l.code === 'broken_cowers')).toBe(true);
});

it("a broken player's walk away from the foe plays; at Cowering it does not", () => {
  const run = (cowering: boolean) => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_2', 'guard_1'] });
    const sl = place(s, 'slime_1', 'tav_counter');
    sl.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    s.player.core.condition.moraleLost = (cowering ? CONFIG.MORALE_COWER_AT : 1) * maxMorale(s.player);
    play(s, { intent: intent({ move: { toZone: 'street_door' } }) });
    return { zone: s.player.zone, turnedBack: s.log.some((l) => l.code === 'nerve_turned_back' || l.code === 'broken_cowers') };
  };
  expect(run(false)).toEqual({ zone: 'street_door', turnedBack: false });
  expect(run(true)).toEqual({ zone: 'tav_common', turnedBack: true });
});
