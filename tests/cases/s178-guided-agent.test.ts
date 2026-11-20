// 178 Guided autoplay (GA1–GA17): code spots the crossroads a turn brought (a fight others started, bad wounds, a foe's
// yield); the agent is told the kinds it must ask about before moving, and its question is read safely.
import { describe, expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { askKey, readAsk, spotCrossroads, turnSnap } from '../../src/agents/crossroads';
import { readMove } from '../../src/agents/autopilot';

describe('178 guided agent', () => {
  it('code spots a fight someone else started, once the character is engaged', () => {
    const s = makeVillage({ playerZone: 'street_square', without: ['slime_1', 'slime_2'] });
    const before = turnSnap(s);
    const g = actor(s, 'guard_1');
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'aware', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    expect(spotCrossroads(before, s, undefined, false).map((c) => c.kind)).toEqual(['fight_started']);
    expect(spotCrossroads(before, s, undefined, true)).toEqual([]); // the watcher already approved the agent's own fight
  });

  it('a question is read safely; a bad one is no question', () => {
    expect(readAsk({ kind: 'deal', about: 'the barkeep', choices: ['I accept', 'I refuse', 7], pick: 9 })).toEqual({ kind: 'deal', about: 'the barkeep', choices: ['I accept', 'I refuse'], pick: 0 });
    expect(readAsk({ kind: 'nonsense', choices: ['x'] })).toBeNull();
    expect(readAsk({ choices: ['I fight'] }, 'fight_started')?.kind).toBe('fight_started');
    expect(readMove({ ask: { kind: 'kill', about: 'the slime', choices: ['I finish it', 'I let it go'], pick: 1 }, say: 'Finish it?' }))
      .toEqual({ command: '', say: 'Finish it?', ask: { kind: 'kill', about: 'the slime', choices: ['I finish it', 'I let it go'], pick: 1 } });
    expect(askKey('deal', 'The Barkeep')).toBe('deal: the barkeep');
  });
});
