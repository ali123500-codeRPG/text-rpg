// 297 TF19 (speech with actions page): talking a foe into surrendering. A persuasion or lie can demand a foe's surrender,
// not only that it stop. It needs a bigger win (OFFER_YIELD_WIN_TIERS, less once the foe is hurt or uneasy, and less again
// for each of: it is Broken, a part of it is Crippled or worse). A code-run foe, or one cowering Broken, yields when
// convinced; an AI-run one is told and answers "yields". A talked surrender is a defeat (TF18: a stand-down is not).
import { expect, it } from 'vitest';
import type { ContestResult, GameState, RollResult } from '../../src/types';
import { forcedRng, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { actorById, hostile, truce } from '../../src/engine/relations';
import { resolveSpeech } from '../../src/engine/speech';
import { loseNerve } from '../../src/engine/effects';
import { answerOffer, canDemand, canOffer, makeOffer, offerNote, offersTo, playerOffer, tiersToConvince } from '../../src/engine/offer';
import { actorBody } from '../../src/library';
import { buildPlayerView } from '../../src/views';
import { ideas } from '../../src/ui/play';

const fight = (s: GameState = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] })): GameState => {
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const roll = (actorId: string, tier: RollResult['tier']) => ({ actorId, tier, margin: 0 }) as unknown as RollResult;
const won = (by: number): ContestResult => ({ a: roll('a', 'success'), b: roll('b', 'success'), gap: -by, winner: by > 0 ? 'a' : by < 0 ? 'b' : 'tie' });
const patron = (s: GameState) => actorById(s, 'patron_1')!;
const demand = (spoken = 'Drop it and kneel.') => intent({ action: { type: 'persuade', target: 'patron_1', demand: 'yield' }, spoken, addressees: ['patron_1'] });

it('TF19: a demand to yield needs a bigger win than a stand-down; hurt or uneasy, Broken and Crippled each make it easier', () => {
  const s = fight(), p = patron(s);
  expect(tiersToConvince(p, 'yield', s)).toBe(CONFIG.OFFER_YIELD_WIN_TIERS);
  expect(tiersToConvince(p, 'yield', s)).toBeGreaterThan(tiersToConvince(p));
  p.core.condition.hpLostPct = 30;
  expect(tiersToConvince(p, 'yield', s)).toBe(CONFIG.OFFER_YIELD_WIN_TIERS_SHAKEN);
  const part = actorBody(s, p).parts[0].id;
  p.core.condition.parts[part] = -50; // Crippled
  expect(tiersToConvince(p, 'yield', s)).toBe(CONFIG.OFFER_YIELD_WIN_TIERS_SHAKEN - CONFIG.OFFER_YIELD_EASIER);
  p.mind!.moraleState = 'broken';
  expect(tiersToConvince(p, 'yield', s)).toBe(Math.max(1, CONFIG.OFFER_YIELD_WIN_TIERS_SHAKEN - 2 * CONFIG.OFFER_YIELD_EASIER));
});

it('TF19: a code-run foe convinced by the demand surrenders: beaten (XP paid), no truce', () => {
  const s = fight(), p = patron(s);
  const i = demand();
  expect(playerOffer(s, i, p)?.kind).toBe('yield');
  const exchange = resolveSpeech(s, i, ['patron_1'], forcedRng([100, 1]));
  const ev = play(s, { intent: i, spokespeople: ['patron_1'], exchange });
  const offer = ev.find((e) => e.actorId === 'player' && e.kind === 'speak')?.offers?.[0];
  expect(offer?.demand).toBe('yield');
  expect(offer?.landed).toBe('convinced');
  expect(ev.some((e) => e.kind === 'surrender' && e.actorId === 'patron_1' && e.target === 'player')).toBe(true);
  expect(p.mind!.moraleState).toBe('surrendered');
  expect(hostile(s, p, s.player)).toBe(false);
  expect(truce(s, p, s.player)).toBe(false);
  expect(p.mind!.xpPaid).toBe(true); // TF19: a talked surrender is a defeat
});

it('TF19: a win short of the demand only tempts; the foe fights on', () => {
  const s = fight(), p = patron(s);
  const r = makeOffer(s, s.player, p, 'persuade', won(CONFIG.OFFER_YIELD_WIN_TIERS - 1), [], 0, 'yield');
  expect(r.landed).toBe('tempted');
  expect(r.yielded).toBeUndefined();
  expect(p.mind!.moraleState).toBeUndefined();
});

it('TF19: an AI-run foe is told it is a demand to surrender; standDown does not answer it, yields does', () => {
  const s = fight(), p = patron(s);
  p.mind!.control = 'agent';
  const i = demand();
  expect(offerNote(s, i, p, won(5))).toContain('a demand that you surrender');
  makeOffer(s, s.player, p, 'persuade', won(5), [], 0, 'yield');
  expect(offersTo(s, p)[0].demand).toBe('yield');
  expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')?.demandYield).toBe(true);
  expect(answerOffer(s, p, true, true)).toBeUndefined(); // standDown is no answer to a demand to surrender
  expect(truce(s, p, s.player)).toBe(false);
});

it('TF19: a foe cowering Broken can still be talked into surrendering, with one tier less', () => {
  const s = fight(), p = patron(s);
  loseNerve(s, p, 'broken');
  expect(canOffer(s, s.player, p)).toBe(false);
  expect(canDemand(s, s.player, p)).toBe(true);
  const r = makeOffer(s, s.player, p, 'persuade', won(CONFIG.OFFER_YIELD_WIN_TIERS - CONFIG.OFFER_YIELD_EASIER), [], 0, 'yield');
  expect(r.yielded?.who).toBe(p);
  expect(p.mind!.moraleState).toBe('surrendered');
});

it('TF19: the Talk ideas offer a demand to surrender', () => {
  const s = fight();
  const talk = ideas(buildPlayerView(s)).find((g) => g.group === 'Talk')!.items.map((x) => x.text);
  expect(talk.some((t) => t.startsWith('Demand ') && t.endsWith(' surrender'))).toBe(true);
});
