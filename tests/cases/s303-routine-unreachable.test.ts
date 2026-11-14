// 303 CS22: an NPC whose routine spot has no path from where it stands idles there, and the engine logs
// routine_unreachable once (where it stands, where it can't reach). It logs again only after its routine found a way.
import { describe, expect, it } from 'vitest';
import type { GameState, Intent, ParserActionType } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { UNREACHABLE } from '../../src/minds';

const act = (type: ParserActionType): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState) => { s.turn += 1; return resolveTurn(s, { intent: act('observe'), aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const stuck = (s: GameState) => s.log.filter((l) => l.code === UNREACHABLE && (l.detail as { actorId: string }).actorId === 'guard_1');

describe('303 routine_unreachable is logged once', () => {
  it('a guard cut off from its post logs it once, and again only after it found a way', () => {
    const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2', 'patron_1'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    const all = [...s.stage.zoneIds];
    g.zone = 'street_door'; delete g.pos;
    s.stage.zoneIds = all.filter((z) => z !== 'street_square'); // its post, gate_inner, lies past the square
    turn(s); turn(s); turn(s);
    expect(stuck(s)).toHaveLength(1);
    expect(stuck(s)[0].detail).toMatchObject({ from: 'street_door', to: 'gate_inner' });
    expect(g.zone).toBe('street_door');
    s.stage.zoneIds = all; // the way opens: its routine walks on
    turn(s);
    expect(g.mind!.unreachable).toBeUndefined();
    g.zone = 'street_door'; delete g.pos;
    s.stage.zoneIds = all.filter((z) => z !== 'street_square');
    turn(s);
    expect(stuck(s)).toHaveLength(2);
  });
});
