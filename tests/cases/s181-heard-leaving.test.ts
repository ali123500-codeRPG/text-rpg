// 181 From Ali's game (BG-28): the barkeep was seen, then only heard running off to the kitchen. The unseen move wiped
// her from the player's clear sightings, so PLAYER_VIEW had no trace of her: "strike the innkeeper" became a guess at
// "behind the counter", and the next turn asked who that was. Anyone seen or heard is now kept in lastSeen.
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, place } from '../harness';
import { noteSightings } from '../../src/perception';
import { buildPlayerView } from '../../src/views';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

let n = 0;
const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'actorId' | 'kind' | 'zone'>): GameEvent =>
  ({ id: `e${++n}`, turn: 1, effects: [], noise: 'quiet', visibility: 'normal', perception: {}, ...e });

describe('181 heard leaving (BG-28)', () => {
  it('someone seen, then only heard moving off, stays in lastSeen at the zone heard', () => {
    const s = makeVillage({ playerZone: 'tav_counter' });
    const keep = place(s, 'trader', 'tav_counter');
    noteSightings(ev({ actorId: 'trader', kind: 'idle', zone: 'tav_counter', perception: { player: { level: 'full', cue: 'sight' } } }), s);
    keep.zone = 'tav_cellar';
    noteSightings(ev({ actorId: 'trader', kind: 'move', zone: 'tav_cellar', fromZone: 'tav_counter', perception: { player: { level: 'partial', cue: 'sound' } } }), s);
    expect(s.player.journal!.clearSight!.trader).toBeUndefined(); // Q17: no longer seen clearly
    expect(buildPlayerView(s).lastSeen).toContainEqual(expect.objectContaining({ id: 'trader', zone: 'cellar' }));
    // a later move the player doesn't perceive at all keeps the last place known
    keep.zone = 'tav_kitchen';
    noteSightings(ev({ actorId: 'trader', kind: 'move', zone: 'tav_kitchen', fromZone: 'tav_cellar' }), s);
    expect(buildPlayerView(s).lastSeen).toContainEqual(expect.objectContaining({ id: 'trader', zone: 'cellar' }));
  });

  it('the Parser is told not to ask who someone in lastSeen is', () => {
    expect(PARSER_INSTRUCTIONS).toContain('never ask who the player means when one of them fits the words');
  });
});
