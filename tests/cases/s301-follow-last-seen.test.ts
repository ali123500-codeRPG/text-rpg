// BG-203 (BF28): "follow the lean man" when he had slipped out of sight walked to "the spot where you last saw them", and
// the story then had him standing there as if someone new. The walk names whom it was, the Narrator is told anyone like
// him there is him, and the follow stays a follow: seen or heard on the way, the next turns keep after him.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildPlayerView, buildNarrationView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { intent, play } from './w4-kit';
import type { GameState } from '../../src/types';

function slippedOff(): GameState {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
  s.zones.find((z) => z.id === 'tav_common')!.rect = { x: 0, y: 0, w: 12, d: 8 };
  const w = place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common'; s.player.pos = { x: -5, y: 0 };
  w.pos = { x: 4, y: 3 };
  play(s, { intent: intent({ action: { type: 'observe', target: null } }) }); // the player sees him there
  w.posture = 'stealthy'; w.pos = { x: 4, y: -3 }; delete s.player.journal!.clearSight!.patron_1; // he slips off unseen
  return s;
}
const followHim = (s: GameState) => {
  const r = checkParserLegality({ ...intent({ move: { toZone: 'tav_common', spot: { near: 'patron_1', follow: true } } }), action: null }, buildPlayerView(s));
  expect(r.intent.move!.spot).toMatchObject({ near: 'patron_1', follow: true, lastSeen: true });
  return r.intent;
};

describe('BG-203 following someone last seen', () => {
  it('the walk names him and the Narrator is told it is the same person', () => {
    const s = slippedOff();
    const label = s.actors.find((a) => a.id === 'patron_1')!.label.replace(/^(a|an)\s+/i, 'the ');
    const evs = play(s, { intent: followHim(s) });
    const ev = evs.find((e) => e.actorId === s.player.id && e.kind === 'move' && e.spot);
    expect(ev?.spot).toContain(`where you last saw ${label}`);
    expect(ev?.spot).not.toContain('them');
    expect(ev?.lastSeenOf).toBe('patron_1');
    const n = buildNarrationView(s, evs).events.find((e) => e.kind === 'move' && e.lastSeenOf);
    expect(n?.lastSeenOf).toBe(label);
  });
  it('seen on the way, the follow carries on after him', () => {
    const s = slippedOff();
    const w = s.actors.find((a) => a.id === 'patron_1')!;
    const go = followHim(s);
    w.posture = 'open'; // he steps back out where he can be seen as the player sets off
    play(s, { intent: go });
    expect(s.player.walking?.spot).toEqual({ near: 'patron_1', follow: true });
    expect(buildPlayerView(s).player.following).toMatchObject({ who: 'patron_1' });
    expect(buildPlayerView(s).player.following?.lost).toBeUndefined();
  });
  it('not there when the player arrives, he is lost', () => {
    const s = slippedOff();
    place(s, 'patron_1', 'field_far'); // gone, out of sight and earshot
    play(s, { intent: followHim(s) });
    expect(s.player.walking).toBeUndefined();
    expect(buildPlayerView(s).player.following).toMatchObject({ who: 'patron_1', lost: 'out_of_sight' });
  });
});
