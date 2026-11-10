// 156 Overheard (LI5a, Insight 20): a lie told to someone else, heard by an owner of Overheard (the words or the voice's
// sound), gets the speaker's Lying against the owner's answer to a lie. An owner that wins sees through it: the hint, or
// plainly a lie with Plain as Day. The one lied to, and anyone who already answered it, is not checked again.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { act, play, plannerOut } from './w4-kit';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { actorById } from '../../src/engine/relations';
import { overhearLie, PLAIN, TELL } from '../../src/engine/speech';
import { buildActorView, buildNarrationView } from '../../src/views';
import type { Actor, GameEvent, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
/** guard_1 tells patron_1 a lie in the tavern; `heard` is how the player and trader perceive it */
const lie = (s: GameState, heard: 'full' | 'sound' | 'none' = 'full'): GameEvent => {
  const per = heard === 'none' ? { level: 'partial', cue: 'sight' } : heard === 'full' ? { level: 'full', cue: 'sight' } : { level: 'partial', cue: 'sound' };
  return { id: 'ev_lie', turn: s.turn, actorId: 'guard_1', kind: 'speak', zone: s.player.zone, target: 'patron_1', effects: [],
    noise: 'normal', visibility: 'normal', line: { text: 'The captain said you could go.', volume: 'normal' },
    perception: { player: per, patron_1: { level: 'full', cue: 'sight' }, trader: per } } as GameEvent;
};

describe('156 Overheard', () => {
  it('is the Insight 20 perk and is built', () => {
    expect(getLibrary().perks[PK.overheard]?.ladder).toEqual({ skill: SK.insight, milestone: 20 });
    expect(BUILT_PERKS.has(PK.overheard)).toBe(true);
  });

  it('an owner who hears a lie told to someone else can see through it; others are not checked', () => {
    const s = makeVillage();
    const e = lie(s);
    overhearLie(s, e, [], forcedRng([5, 95]));
    expect(e.overheard).toBeUndefined(); // nobody owns the perk
    give(s.player, PK.overheard);
    overhearLie(s, e, [], forcedRng([5, 95])); // the guard's Lying rolls 5, the player's Insight 95
    expect(e.overheard).toEqual(['player']);
    const f = lie(s);
    overhearLie(s, f, [], forcedRng([95, 5]));
    expect(f.overheard).toBeUndefined(); // the lie holds
  });

  it('works on the sound of the voice, not on a lie the owner did not hear', () => {
    const s = makeVillage();
    give(s.player, PK.overheard);
    const e = lie(s, 'sound');
    overhearLie(s, e, [], forcedRng([5, 95]));
    expect(e.overheard).toEqual(['player']);
    const f = lie(s, 'none');
    overhearLie(s, f, [], forcedRng([5, 95]));
    expect(f.overheard).toBeUndefined();
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

  it('the player is told it does not sit right, or plainly a lie with Plain as Day; an NPC owner sees the same', () => {
    const s = makeVillage();
    const p2 = actorById(s, 'trader')!;
    p2.zone = s.player.zone;
    give(s.player, PK.overheard);
    give(p2, PK.overheard);
    const e = lie(s);
    e.overheard = ['player', 'trader'];
    s.events.push(e);
    expect(buildNarrationView(s, [e]).events.find((x) => x.id === e.id)?.overheard).toBe(TELL);
    give(s.player, PK.plain_as_day);
    expect(buildNarrationView(s, [e]).events.find((x) => x.id === e.id)?.overheard).toBe(PLAIN);
    expect(buildActorView(s, 'trader').perceived.find((x: { id: string; tell?: string }) => x.id === e.id)?.tell).toBe(TELL);
  });

  it('in play: an NPC lie to another NPC is checked for an owner nearby', () => {
    const caught = (perk: boolean) => {
      for (let seed = 1; seed <= 40; seed++) {
        const s = makeVillage({ playerZone: 'gate_inner' });
        actorById(s, 'patron_1')!.zone = 'gate_inner';
        if (perk) give(s.player, PK.overheard);
        s.player.core.skills[SK.insight] = { raw: 60, state: 'normal' };
        const ev = play(s, { agentOutputs: [plannerOut('guard_1', act('deceive', 'patron_1'), { dialogue: { line: 'The gate is shut till dawn.', volume: 'normal' } })] }, seed);
        if (ev.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')?.overheard?.includes('player')) return true;
      }
      return false;
    };
    expect(caught(false)).toBe(false);
    expect(caught(true)).toBe(true);
  });
});
