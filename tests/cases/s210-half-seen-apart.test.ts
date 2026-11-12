// BG-92: a figure half seen back down the road "resolved into" a man in a different zone, so the player walked the wrong way
import { TP } from '../../src/library/templateIds';
import { afterEach, expect, it, vi } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import { ruleset } from '../../src/ruleset';
import { spawnNpc } from '../../src/library/spawn';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';
import type { ContestResult, Intent } from '../../src/types';

afterEach(() => vi.restoreAllMocks());
const hold: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };

it('BG-92: a half-seen someone keeps its place (distance, side) in the narration view', () => {
  const s = makeVillage();
  place(s, 'player', 'street_square');
  const t = spawnNpc(null, TP.thief, { id: 'thief_1', zone: 'street_square', placeId: 'street', bandId: 'thieves', name: 'Nell', storyId: 'test' });
  s.bands.push({ ...s.bands[0], id: 'thieves', name: 'the light-fingered', relations: {} });
  s.actors.push(t);
  place(s, 'thief_1', 'street_square');
  t.posture = 'stealthy';
  s.player.journal!.stealthSeen = { thief_1: 'unaware' };
  const real = ruleset.contested;
  vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
    const r = real(a, b, st, rng);
    return a.rollKind === 'stealth' ? ({ ...r, gap: 0, winner: 'tie' } as ContestResult) : r;
  });
  s.turn += 1;
  resolveTurn(s, { intent: hold, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
  expect(buildPlayerView(s).actors.find((x) => x.id === 'thief_1')).toMatchObject({ label: 'someone', level: 'partial' });
  s.player.pos = { x: 0, y: 0 }; s.player.facing = [0, 1];
  t.pos = { x: 0, y: 6 };
  const v = buildNarrationView(s, s.events);
  const someone = v.actors.find((a) => a.label === 'someone');
  expect(someone).toMatchObject({ zone: 'the square', side: 'ahead' });
  expect(someone?.distanceM).toBeTypeOf('number');
});

it('BG-92: the Narrator never turns a half-seen someone into another person', () => {
  expect(NARRATOR_INSTRUCTIONS).toContain('Every entry in actors is a different person');
  expect(NARRATOR_INSTRUCTIONS).toContain('never let it turn out to be, or resolve into, anyone else in actors or events');
});
