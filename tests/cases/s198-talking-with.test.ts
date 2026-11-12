// BG-55: words that name no one, right after an exchange, go to whoever the player was just talking with.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage } from '../harness';
import { fillSpeech, talkingWith } from '../../src/engine/speech';
import { buildPlayerView } from '../../src/views';
import { intent } from './w4-kit';

const said = (s: ReturnType<typeof makeVillage>, actorId: string, target: string, turn: number): GameEvent => ({
  id: `e${turn}${actorId}`, turn, actorId, kind: 'speak', zone: s.player.zone, target, effects: [], noise: 'N4' as never, visibility: 'V1' as never,
  perception: { player: { level: 'full', cue: 'sight', heard: true } as never }, line: { text: 'Interested?', volume: 'normal' } });

it('BG-55: a reply naming no one goes to the NPC who just spoke to the player', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const npc = s.actors.find((a) => a.id !== s.player.id && a.zone === s.player.zone)!;
  s.recentEvents = [said(s, 'guard_1', s.player.id, 1), said(s, npc.id, s.player.id, 2)];
  expect(talkingWith(s)).toEqual([npc.id]); // only the last turn counts
  const i = fillSpeech(s, intent({ action: { type: 'talk' }, spoken: "Yes, I'll take the work." }), "Yes, I'll take the work.");
  expect(i.addressees).toEqual([npc.id]);
  expect(buildPlayerView(s).talkingWith?.map((t) => t.id)).toEqual([npc.id]);
  const named = fillSpeech(s, intent({ action: { type: 'talk' }, spoken: 'Hi.', addressees: ['guard_1'] }), 'Hi.');
  expect(named.addressees).toEqual(['guard_1']);
});

it('BG-61: the player can answer someone heard through a barred door, out of sight', async () => {
  const { checkParserLegality } = await import('../../src/agents/legality');
  const s = makeVillage({ playerZone: 'street_door' });
  s.recentEvents = [said(s, 'trader', s.player.id, 1)];
  const v = buildPlayerView(s);
  expect(v.actors.some((a) => a.id === 'trader')).toBe(false);
  expect(v.talkingWith?.map((t) => t.id)).toEqual(['trader']);
  const r = checkParserLegality(intent({ action: { type: 'talk', target: 'trader' }, spoken: 'Any work?', addressees: ['trader'] }), v);
  expect(r.illegal).toEqual([]);
});
