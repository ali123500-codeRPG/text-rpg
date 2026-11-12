// 177 From a playtest game (BG-23): the barkeep, 0.7 m from the player, broke and fled through the kitchen door. Perception took
// the move only where it ended, beyond a door with no sight, so the player only heard "something" and forgot her; next
// turn "cut down the barkeep" asked who that was. A leg out of a zone is now seen where it set off too.
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, place, createRng } from '../harness';
import { computePerception, noteSightings } from '../../src/perception';
import { buildPlayerView } from '../../src/views';

let n = 0;
const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'actorId' | 'kind' | 'zone'>): GameEvent =>
  ({ id: `e${++n}`, turn: 1, effects: [], noise: 'quiet', visibility: 'normal', perception: {}, ...e });

describe('177 seen leaving (BG-23)', () => {
  it('someone walking out of the player\'s zone through a door with no sight is seen going, and last seen where they went', () => {
    const s = makeVillage({ playerZone: 'tav_counter' });
    const keep = place(s, 'trader', 'tav_counter');
    s.player.journal = { ...(s.player.journal ?? { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] }), clearSight: { trader: 'tav_counter' } };
    keep.zone = 'tav_cellar'; // she has gone down the steps: no sight from behind the bar into the cellar
    const e = ev({ actorId: 'trader', kind: 'move', zone: 'tav_cellar', fromZone: 'tav_counter' });
    e.perception = computePerception(e, s, createRng(1));
    expect(e.perception.player).toMatchObject({ level: 'full', cue: 'sight' });
    noteSightings(e, s);
    expect(s.player.journal!.clearSight!.trader).toBe('tav_cellar');
    expect(buildPlayerView(s).lastSeen).toContainEqual(expect.objectContaining({ id: 'trader', zone: 'cellar' }));
  });

  it('a move that ends in a zone out of sight and starts in one too stays unseen', () => {
    const s = makeVillage({ playerZone: 'field_far' });
    place(s, 'trader', 'tav_cellar');
    const e = ev({ actorId: 'trader', kind: 'move', zone: 'tav_cellar', fromZone: 'tav_counter', noise: 'silent' });
    expect(computePerception(e, s, createRng(1)).player).toBeUndefined();
  });
});
