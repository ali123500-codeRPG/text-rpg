// 174 From playtest run 37: a move names where the player means to end up, any zone it knows (BG-15); a move-only turn
// has no "holds" after the move (BG-16).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';
import { noteZonesSeen } from '../../src/engine/trail';

describe('174 far moves (BG-15)', () => {
  it('"up the cellar steps and out the front door into the street" is one move to the street, walked through the rooms between', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    noteZonesSeen(s);
    for (const z of ['tav_counter', 'tav_cellar']) play(s, { intent: intent({ move: { toZone: z } }) });
    expect(s.player.zone).toBe('tav_cellar');
    const view = buildPlayerView(s);
    expect(view.known).toContainEqual({ id: 'street_door', name: 'out the front door (from common room)' });
    expect(view.known?.map((k) => k.id)).toContain('tav_common');
    const i = intent({ move: { toZone: 'street_door' } });
    expect(checkParserLegality(i, view).illegal).toEqual([]);
    expect(checkParserLegality(intent({ move: { toZone: 'field_far' } }), view).illegal).toEqual(['move.toZone field_far']); // never seen
    for (let n = 0; n < 6 && s.player.zone !== 'street_door'; n++) play(s, { intent: i });
    expect(s.player.zone).toBe('street_door');
  });
});

describe('174 a move-only turn (BG-16)', () => {
  it('walks and nothing more: no hold event after the move, unless words go with it', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const ev = play(s, { intent: intent({ move: { toZone: 'tav_counter' } }) });
    const mine = ev.filter((e) => e.actorId === s.player.id).map((e) => e.kind);
    expect(mine).toContain('move');
    expect(mine).not.toContain('hold');
    const said = play(s, { intent: intent({ move: { toZone: 'tav_common' }, spoken: 'Back in a moment.' }) });
    expect(said.some((e) => e.actorId === s.player.id && e.line?.text === 'Back in a moment.')).toBe(true);
    const still = play(s, { intent: intent({}) });
    expect(still.some((e) => e.actorId === s.player.id && e.kind === 'hold')).toBe(true); // standing still is still a hold
  });
});
