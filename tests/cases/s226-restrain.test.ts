// 226 BF5 (Bug Fix Questions, run 82b steps 30–31: three tries to grab Wat by the sleeve): restrain is a grab that holds
// someone back unhurt. The grabber's grapple against the target's better of grapple and dodge; no damage, no hostility.
// Held, the target's next move is its break-free try, and failing it loses that move.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play, plannerOut, act } from './w4-kit';
import { actorById, stance } from '../../src/engine/relations';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';

const village = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });

it('BF5: a grab holds or is slipped, never hurts or angers; a held target\'s move is its break-free try', () => {
  const outcomes = new Set<string>();
  for (let seed = 1; seed <= 40 && outcomes.size < 2; seed++) {
    const s = village();
    const t = beside(s, 'patron_1');
    const before = stance(s, t, s.player);
    const ev = play(s, { intent: intent({ action: { type: 'restrain', target: 'patron_1' } }) }, seed);
    const e = ev.find((x) => x.kind === 'restrain')!;
    expect(e.target).toBe('patron_1');
    const kind = e.effects[0].kind;
    outcomes.add(kind);
    expect(t.core.condition.hpLostPct).toBe(0);
    expect(stance(s, t, s.player)).toBe(before);
    expect(ev.some((x) => x.kind === 'attack')).toBe(false);
    if (kind === 'held') {
      expect(t.heldBy).toBe(s.player.id);
      // its next move toward the street is a break-free try: held, it stays put
      const zone = t.zone;
      const ev2 = play(s, { agentOutputs: [plannerOut('patron_1', act('move', 'street_door'))] }, seed);
      const bf = ev2.find((x) => x.kind === 'break_free' && x.actorId === 'patron_1');
      expect(bf).toBeDefined();
      if (bf!.effects[0].kind === 'still_held') expect(actorById(s, 'patron_1')!.zone).toBe(zone);
    } else expect(kind).toBe('slipped_grab');
  }
  expect(outcomes).toEqual(new Set(['held', 'slipped_grab']));
});

it('BF5: restrain aims at someone in view, never a place', () => {
  const s = village();
  expect(checkParserLegality(intent({ action: { type: 'restrain', target: 'patron_1' } }), buildPlayerView(s)).illegal).toEqual([]);
  expect(checkParserLegality(intent({ action: { type: 'restrain', target: 'tav_common' } }), buildPlayerView(s)).illegal.length).toBe(1);
});
