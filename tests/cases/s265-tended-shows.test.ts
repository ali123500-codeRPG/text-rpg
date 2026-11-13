// BG-181 (run 79g t38-42): Ness bound the player's leg, but nothing recorded it, so the story called them unbandaged and
// bleeding and Ness tried to bind it again with empty hands; her no_item reason left her view a turn later. One rule: a
// healing item used on someone marks them tended (with it) until their next wound, in every view; an NPC keeps its last
// wasted try and why (self.lastWasted) until it next does that kind of thing.
import { expect, it } from 'vitest';
import { actor, beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { buildActorView, buildNarrationView, buildPlayerView } from '../../src/views';
import { IT } from '../../src/library/itemIds';

it('a binding shows as tended, and a failed try stays in mind', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const ness = actor(s, 'patron_1');
  ness.mind!.control = 'agent';
  beside(s, 'patron_1', 'player', 0.8);
  s.player.core.condition.hpLostPct = 40;
  play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('use_item', 'player', { item: null }))] });
  expect(buildActorView(s, 'patron_1').self.lastWasted).toMatchObject({ action: 'use_item', reason: 'no_item' });
  play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('hold'))] });
  play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('hold'))] });
  expect(buildActorView(s, 'patron_1').self.lastWasted?.reason).toBe('no_item'); // still in mind turns later
  ness.core.inventory.push({ id: 'roll', itemId: IT.bandage, qty: 1 });
  const ev = play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('use_item', 'player', { item: 'roll' }))] });
  expect(ev.some((e) => e.kind === 'use_item' && e.actorId === 'patron_1')).toBe(true);
  expect(buildActorView(s, 'patron_1').self.lastWasted).toBeUndefined();
  expect(buildPlayerView(s).player.tended).toBe('bandage');
  expect(buildNarrationView(s, ev).player.tended).toBe('bandage');
});
