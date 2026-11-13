// 273 Walks on the world clock, stage 3d (AT45, AT46, AT49): outside a fight a walk is one turn whatever its length: the
// world clock walks what the turn's move time left, and stops it like any stretch. A walk not yet at its goal (stopped on
// the way, or in a fight's short turn) carries on next turn by itself, until the player orders a move or an action.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { now } from '../../src/time';
import { distM } from '../../src/engine/position';
import { moveSpeed } from '../../src/engine/speed';
import { SK } from '../../src/library/skillIds';

const quiet = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const go = (toZone: string) => intent({ move: { toZone } });

describe('273 walks', () => {
  it('AT45/AT46: outside a fight a walk goes all the way in one turn, taking its walking time', () => {
    const s = quiet();
    const far = { zone: 'gate_inner' };
    const metres = distM(s, s.player, far);
    const t = now(s);
    play(s, { intent: go('gate_inner') });
    expect(s.player.zone).toBe('gate_inner');
    expect(s.player.walking).toBeUndefined();
    expect((now(s) - t) * 60).toBeGreaterThan(metres / moveSpeed(s, s.player).run); // more than a dash could do
    expect((now(s) - t) * 60).toBeLessThan((metres / moveSpeed(s, s.player).walk) * 1.5 + 60);
  });
  it('BG-159: a way out 1.2 km along one long zone is walked in one turn, at a walk', () => {
    const s = quiet();
    const z = s.zones.find((x) => x.id === 'field_far')!, mid = s.zones.find((x) => x.id === 'field_mid')!;
    const dir = Math.sign(z.rect!.x - mid.rect!.x);
    z.rect!.x += dir * 580; // field_far grows 1160 m longer, away from field_mid
    z.rect!.w += 1160;
    place(s, 'player', 'field_far');
    s.player.pos = { x: z.rect!.x + dir * (z.rect!.w / 2 - 1), y: z.rect!.y };
    const metres = distM(s, s.player, { zone: 'field_mid' });
    expect(metres).toBeGreaterThan(1000);
    const t = now(s);
    play(s, { intent: go('field_mid') });
    expect(s.player.zone).toBe('field_mid');
    const took = (now(s) - t) * 60; // the turn's own move time (a dash) first, then a walk
    expect(took).toBeGreaterThan(metres / moveSpeed(s, s.player).run);
    expect(took).toBeLessThanOrEqual(metres / moveSpeed(s, s.player).walk + 1);
  });
  it('AT49: in a fight a walk not yet at its goal carries on next turn while the player orders nothing else', () => {
    const s = quiet();
    place(s, 'player', 'street_door');
    s.mode = 'tactical';
    play(s, { intent: go('field_far') });
    expect(s.player.zone).not.toBe('field_far');
    expect(s.player.walking).toEqual({ toZone: 'field_far' });
    const was = { zone: s.player.zone, pos: { ...s.player.pos! } };
    s.mode = 'tactical';
    play(s, { intent: intent() }); // nothing ordered: the walk goes on
    expect(distM(s, s.player, was)).toBeGreaterThan(1);
    s.mode = 'tactical';
    play(s, { intent: intent({ action: { type: 'observe', skill: SK.eyesight } }) }); // something else: it stops
    expect(s.player.walking).toBeUndefined();
  });
});
