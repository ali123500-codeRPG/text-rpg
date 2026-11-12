// 59 Place facts stay player-side: no OppositionView, DialogueView or ActorView contains a place fact or headline.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildActorView, buildDialogueView, buildOppositionView, buildPlayerView } from '../../src/views';

it('59 Place facts stay player-side', () => {
  const s = makeVillage();
  s.facts.push({ id: 'f1', storyId: 'test', placeId: 'tavern', turn: 0, text: 'PLACEFACT a bench was broken in a brawl', refs: ['patron_1'], source: 'rule', promotedTo: ['village'] });
  s.facts.push({ id: 'f2', storyId: 'test', placeId: 'village', turn: 0, text: 'HEADLINEFACT slimes seen near the gate', refs: [], source: 'rule', promotedTo: [] });
  s.places.find((p) => p.id === 'village')!.headlines.push('f2');
  const pv = buildPlayerView(s);
  expect(pv.facts.join()).toContain('PLACEFACT');
  expect(pv.headlines.join()).toContain('HEADLINEFACT');
  for (const a of s.actors) {
    for (const v of [buildActorView(s, a.id), buildOppositionView(s, a.id), buildDialogueView(s, a.id, [{ spoken: 'what happened here?', impression: 'convincing' }])])
      expect(JSON.stringify(v)).not.toMatch(/PLACEFACT|HEADLINEFACT/);
  }
});
