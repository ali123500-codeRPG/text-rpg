// 156 Overheard (LI5a, Insight 20): a lie told to someone else, heard by an owner of Overheard (the words or the voice's
// sound), gets the speaker's Falsehood against the owner's answer to a lie. An owner that wins sees through it: the hint, or
// plainly a lie with Plain as Day. The one lied to, and anyone who already answered it, is not checked again.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { PK } from '../../src/library/perkIds';
import { actorById } from '../../src/engine/relations';
import { overhearLie } from '../../src/engine/speech';
import type { Actor, GameEvent, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
/** guard_1 tells patron_1 a lie in the tavern; `heard` is how the player and trader perceive it */
const lie = (s: GameState, heard: 'full' | 'sound' | 'none' = 'full'): GameEvent => {
  const per = heard === 'none' ? { level: 'partial', cue: 'sight' } : heard === 'full' ? { level: 'full', cue: 'sight', heard: true } : { level: 'partial', cue: 'sound', heard: true };
  return { id: 'ev_lie', turn: s.turn, actorId: 'guard_1', kind: 'speak', zone: s.player.zone, target: 'patron_1', effects: [],
    noise: 'normal', visibility: 'normal', line: { text: 'The captain said you could go.', volume: 'normal' },
    perception: { player: per, patron_1: { level: 'full', cue: 'sight' }, trader: per } } as GameEvent;
};

describe('156 Overheard', () => {

  it('an owner who hears a lie told to someone else, or only the voice\'s sound, can see through it; others, and a lie not heard, are not checked', () => {
    const s = makeVillage();
    const e = lie(s);
    overhearLie(s, e, [], forcedRng([5, 95]));
    expect(e.overheard).toBeUndefined(); // nobody owns the perk
    give(s.player, PK.overheard);
    overhearLie(s, e, [], forcedRng([5, 95])); // the guard's Falsehood rolls 5, the player's Insight 95
    expect(e.overheard).toEqual(['player']);
    const f = lie(s);
    overhearLie(s, f, [], forcedRng([95, 5]));
    expect(f.overheard).toBeUndefined(); // the lie holds
    // it works on the sound of the voice, not on a lie the owner did not hear
    const g = lie(s, 'sound');
    overhearLie(s, g, [], forcedRng([5, 95]));
    expect(g.overheard).toEqual(['player']);
    const h = lie(s, 'none');
    overhearLie(s, h, [], forcedRng([5, 95]));
    expect(h.overheard).toBeUndefined();
  });

  it('skips anyone who already answered the lie, and the speaker shares one roll among the owners', () => {
    const s = makeVillage();
    const p2 = actorById(s, 'trader')!;
    give(s.player, PK.overheard);
    give(p2, PK.overheard);
    give(actorById(s, 'patron_1')!, PK.overheard);
    const e = lie(s);
    // patron_1 answered already; the guard rolls once (5), then the player (95) and trader (95) answer
    overhearLie(s, e, ['patron_1'], forcedRng([5, 95, 95]));
    expect(e.overheard).toEqual(expect.arrayContaining(['player', 'trader']));
    expect(e.overheard).toHaveLength(2);
  });

});
