// BG-221 (playtest, turn 43): Bettany's Weaver beat had her hail the player as soon as she saw him in the square. That
// beat came due in the middle of the turn, but a beat's words are written only for beats due at the start of a turn
// (BG-50, BG-146), so her speak went out with no line and the Narrator said her words slid past him unheard. A speech
// beat at the player that comes due mid-turn now waits for the next turn's start, where her Responder writes the words.
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { beatSpeakers, computePending } from '../../src/engine';
import { intent, play } from './w4-kit';

it('BG-221: a speech beat at the player that comes due mid-turn fires at the next turn start, with a Responder call', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  s.turn = 0;
  const g = actor(s, 'guard_1');
  delete g.mind!.knowledge.player; // has not seen the player yet: the beat can't fire at the turn start
  s.hidden.plans.guard_1 = { goal: 'hail strangers', steps: [], createdTurn: 0, triggers: [
    { id: 'hail', ownerId: 'guard_1', when: { type: 'player_seen_in_zone', zone: 'gate_inner' }, then: { type: 'talk', target: 'player', skill: null, intent: 'hail the stranger and ask his business' }, once: true },
  ] };
  expect(computePending(s).fired).toEqual([]);
  const ev = play(s, { intent: intent({ action: { type: 'other', approach: 'look around' } }) });
  // seen this turn, mid-turn: no wordless speak
  expect(ev.filter((e) => e.kind === 'speak' && e.actorId === 'guard_1')).toEqual([]);
  // at the next turn start (play computes it) it fires, and its owner is a beat speaker: the Responder writes the words
  expect(s.hidden.firedLog.filter((f) => f.triggerId === 'hail').map((f) => f.turn)).toEqual([s.pending.turn]);
  expect((s.scratch?.firedOrders as { actorId: string }[] | undefined)?.some((o) => o.actorId === 'guard_1')).toBe(true);
  expect(beatSpeakers(s, [])).toEqual(['guard_1']);
});
