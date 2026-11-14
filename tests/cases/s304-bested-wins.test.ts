// 304 BS1 d ("Essences: bested foes, extraction, balance"): besting covers, besides a defeat, a stand-down and a bribe
// (s302), a guard's suspicion talked away, a won persuasion, lie or threat against someone hostile or opposed, and a
// filch from someone hostile or opposed that the Filching contest leaves uncaught. Staying unseen never bests. BS4: a
// bested and a defeated person weigh the same in the ending draw.
import { expect, it } from 'vitest';
import type { Actor, GameState } from '../../src/types';
import { forcedRng, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { actorById } from '../../src/engine/relations';
import { resolveSpeech, selectSpokespeople } from '../../src/engine/speech';
import { talkedPast } from '../../src/engine/suspicion';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';

const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
const cold = (s: GameState, a: Actor) => { a.mind!.overrides = { ...(a.mind!.overrides ?? {}), player: 'opposed' }; };
const talk = (s: GameState, type: 'persuade' | 'deceive' | 'intimidate', to: string) => {
  const i = intent({ action: { type }, spoken: 'Let me through.', addressees: [to] });
  return resolveSpeech(s, i, selectSpokespeople(s, i), forcedRng([100, 1])); // natural 00 for the player, 01 for them
};

it('BS1 d: a won persuasion, lie or threat bests someone hostile or opposed, never someone warmer', () => {
  for (const type of ['persuade', 'deceive', 'intimidate'] as const) {
    const s = makeVillage({ playerZone: 'tav_counter' }), t = actorById(s, 'trader')!;
    cold(s, t);
    expect(talk(s, type, 'trader').perSpokesperson.trader.contest.winner).toBe('a');
    expect(t.mind!.bested).toBe(true);
  }
  const s = makeVillage({ playerZone: 'tav_counter' }), t = actorById(s, 'trader')!;
  expect(talk(s, 'persuade', 'trader').perSpokesperson.trader.contest.winner).toBe('a');
  expect(t.mind!.bested).toBeUndefined(); // not hostile or opposed: winning an argument with a friend bests no one
});

it('BS1 d: a guard\'s suspicion talked away bests it', () => {
  const s = makeVillage(), g = actorById(s, 'guard_1')!;
  g.mind!.suspects = { player: { box: 'box', turn: 1 } };
  talkedPast(s, g, s.player);
  expect(g.mind!.suspects.player).toBeUndefined();
  expect(g.mind!.bested).toBe(true);
});

it('BS1 d: an uncaught filch bests an owner hostile or opposed to you; one from a warmer owner does not', () => {
  const run = (opposed: boolean) => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
    const wim = actorById(s, 'patron_1')!;
    if (wim.pos) s.player.pos = { ...wim.pos };
    wim.core.inventory.push({ id: 'ring', itemId: IT.signet_ring });
    skill(s.player, SK.filching, 400);
    s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor')); // no armor short of its requirement
    skill(wim, SK.eyesight, 0); skill(wim, SK.earshot, 0);
    if (opposed) cold(s, wim);
    const e = play(s, { intent: intent({ action: { type: 'filch', target: 'patron_1', item: 'ring' } }) }).find((x) => x.kind === 'filch')!;
    return { taken: e.filch, bested: !!wim.mind!.bested };
  };
  expect(run(true)).toEqual({ taken: 'taken', bested: true });
  expect(run(false)).toEqual({ taken: 'taken', bested: false });
});
