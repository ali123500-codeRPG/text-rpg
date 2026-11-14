// 284 TF4–TF17 (speech with actions, round 3): talking someone out of a fight. Persuasion in a fight is an offer to stop:
// one contest, the foe's wound and fear penalties on its answer. Convinced (a win by OFFER_WIN_TIERS, fewer once it is hurt
// or uneasy), tempted (a smaller win or a tie) or unmoved (a loss). A code-run foe stands down when convinced; an AI-run one
// is told how it landed and answers standDown. A stand-down is a truce like a taken yield. Lies can be offers; a bribe is a
// barter offer whose coin is paid on agreeing. Beg for Mercy and Buy Them Off can't be refused. Foes can offer the player
// a stand-down too. No repeat-try penalty in a fight.
import { expect, it } from 'vitest';
import type { ContestResult, GameState, RollResult } from '../../src/types';
import { forcedRng, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { wholeTurn } from '../harness/turn';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { actorById, hostile, isEngaged, truce } from '../../src/engine/relations';
import { resolveSpeech } from '../../src/engine/speech';
import { answerOffer, canOffer, landed, makeOffer, offersTo, tiersToConvince } from '../../src/engine/offer';
import { coins } from '../../src/engine/trade';
import { repeatTryMods } from '../../src/ruleset/pressure';
import { buildPlayerView } from '../../src/views';
import { ideas } from '../../src/ui/play';

/** the patron (code-run) is hostile to the player and fighting them */
const fight = (who = 'patron_1', s: GameState = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] })): GameState => {
  const m = actorById(s, who)!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const roll = (actorId: string, tier: RollResult['tier']) => ({ actorId, tier, margin: 0 }) as unknown as RollResult;
/** a contest the speaker (side a) won by `by` tiers (negative: lost) */
const won = (by: number): ContestResult => ({ a: roll('a', 'success'), b: roll('b', 'success'), gap: -by, winner: by > 0 ? 'a' : by < 0 ? 'b' : 'tie' });
const patron = (s: GameState) => actorById(s, 'patron_1')!;

it('TF14: a fresh foe needs a win by OFFER_WIN_TIERS; a hurt or uneasy one by OFFER_WIN_TIERS_SHAKEN', () => {
  const s = fight(), p = patron(s);
  expect(tiersToConvince(p)).toBe(CONFIG.OFFER_WIN_TIERS);
  p.core.condition.hpLostPct = 30;
  expect(tiersToConvince(p)).toBe(CONFIG.OFFER_WIN_TIERS_SHAKEN);
  expect(landed(won(CONFIG.OFFER_WIN_TIERS_SHAKEN), p)).toBe('convinced');
  expect(landed(won(1), patron(fight()))).toBe('tempted');
  expect(landed(won(0), p)).toBe('tempted');
  expect(landed(won(-1), p)).toBe('unmoved');
});

it('TF13/TF16: a code-run foe convinced in the exchange stands down: a truce both ways, a talked-down tally, it counts as beaten', () => {
  const s = fight(), p = patron(s);
  expect(isEngaged(s, s.player) && canOffer(s, s.player, p)).toBe(true);
  const i = intent({ action: { type: 'persuade', target: 'patron_1' }, spoken: 'Put it down. Nobody else needs to bleed.', addressees: ['patron_1'] });
  const exchange = resolveSpeech(s, i, ['patron_1'], forcedRng([100, 1]));
  const ev = play(s, { intent: i, spokespeople: ['patron_1'], exchange });
  expect(ev.find((e) => e.actorId === 'player' && e.kind === 'speak')?.offers).toEqual([{ to: 'patron_1', landed: 'convinced' }]);
  expect(ev.some((e) => e.kind === 'stand_down' && e.actorId === 'patron_1' && e.target === 'player')).toBe(true);
  expect(truce(s, p, s.player) && truce(s, s.player, p)).toBe(true);
  expect(hostile(s, p, s.player)).toBe(false);
  expect(s.player.progression!.tally?.talked_down).toBe(1);
  expect(p.mind!.stoodDown && p.mind!.xpPaid).toBe(true); // payDefeats counted it beaten this turn
  // neither side may attack the other for the rest of the scenario
  const blow = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) });
  expect(blow.find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('truce');
});

it('TF13: a code-run foe only tempted fights on; there is no repeat-try penalty in a fight (TF9 b)', () => {
  const s = fight(), p = patron(s);
  expect(makeOffer(s, s.player, p, 'persuade', won(1), []).landed).toBe('tempted');
  expect(truce(s, p, s.player)).toBe(false);
  s.player.speechTries = { patron_1: { persuade: 3 } };
  const i = intent({ action: { type: 'persuade', target: 'patron_1' }, addressees: ['patron_1'] });
  const fresh = resolveSpeech(s, i, ['patron_1'], forcedRng([50, 50]));
  expect(fresh.perSpokesperson.patron_1.contest.a.modifiers?.some((m) => m.source === 'Repeat try') ?? false).toBe(false);
  expect(repeatTryMods(s.player, ['patron_1'], 'persuade')).not.toEqual([]); // out of a fight it would count
});

it('TF15: an AI-run foe is asked: it answers standDown; no answer is no and the offer lapses', () => {
  const s = fight(), p = patron(s);
  p.mind!.control = 'agent';
  expect(makeOffer(s, s.player, p, 'persuade', won(5), []).stood).toBeUndefined(); // convinced, but its AI decides
  expect(offersTo(s, p)).toHaveLength(1);
  expect(buildPlayerView(s).player.standDownOffers).toBeUndefined();
  expect(answerOffer(s, p, false, true)).toBeUndefined();
  expect(truce(s, p, s.player)).toBe(false);
  makeOffer(s, s.player, p, 'deceive', won(0), []); // TF17: a lie is an offer too
  expect(answerOffer(s, p, true, true)?.who).toBe(p);
  expect(truce(s, p, s.player)).toBe(true);
  const s2 = fight(), p2 = patron(s2);
  p2.mind!.control = 'agent';
  makeOffer(s2, s2.player, p2, 'persuade', won(5), []);
  s2.turn += CONFIG.OFFER_OPEN_TURNS;
  expect(offersTo(s2, p2)).toEqual([]);
});

it('TF10: Beg for Mercy at the last health level before down, and Buy Them Off, make any win an offer that cannot be refused', () => {
  const s = fight(), p = patron(s);
  p.mind!.control = 'agent';
  s.player.core.perks.push({ perkId: PK.plead, source: 'level', gainedTurn: 0 });
  s.player.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'critical')![1];
  expect(makeOffer(s, s.player, p, 'persuade', won(1), []).stood?.who).toBe(p);
  const b = fight(), bp = patron(b);
  bp.mind!.control = 'agent';
  b.player.core.perks.push({ perkId: PK.buy_them_off, source: 'level', gainedTurn: 0 });
  b.player.core.inventory.push({ id: 'purse', itemId: IT.coin, qty: 40 });
  const before = coins(b.player);
  expect(makeOffer(b, b.player, bp, 'barter', won(1), [], 30).stood?.coin).toBe(30);
  expect(coins(b.player)).toBe(before - 30);
  expect(coins(bp)).toBeGreaterThanOrEqual(30);
});

it('TF10: a bribe is only a deal once the coin is paid: without it, nothing comes of the offer', () => {
  const s = fight(), p = patron(s);
  const purse = coins(s.player);
  expect(makeOffer(s, s.player, p, 'barter', won(5), [], purse + 100).stood).toBeUndefined();
  expect(truce(s, p, s.player)).toBe(false);
  expect(s.log.some((l) => l.code === 'offer_unpaid')).toBe(true);
});

it('TF11: a foe can offer the player a stand-down; the player takes it by saying so', () => {
  const s = fight(), p = patron(s);
  makeOffer(s, p, s.player, 'persuade', won(1), []);
  s.offers!.pending[0].turn = s.turn - 1; // made last turn: the player answers in the next
  expect(buildPlayerView(s).player.standDownOffers).toEqual([{ id: 'patron_1', name: expect.any(String), landed: 'tempts you' }]);
  play(s, { intent: intent({ standDown: 'patron_1', spoken: 'Fine. We stop.' }) });
  expect(truce(s, p, s.player)).toBe(true);
  expect(p.mind!.stoodDown).toBeUndefined(); // taking the foe's own offer beats no one
});

it('TF17 follow-up: in a fight the Talk ideas show the ways to talk a foe out of it', () => {
  const s = fight();
  const pv = buildPlayerView(s);
  const foe = pv.actors.find((a) => a.id === 'patron_1');
  expect(foe?.talkDown).toBe(true);
  const talk = ideas(pv).find((g) => g.group === 'Talk')!.items.map((x) => x.text);
  expect(talk.some((t) => t.endsWith(' down'))).toBe(true);
});

it('whole turn: an AI-run listener hears that the words are an offer and how it landed; the Narrator hears how it landed', async () => {
  const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  fight('patron_1', g.game.state()!);
  await g.turn(intent({ action: { type: 'persuade', target: 'patron_1' }, spoken: 'Put it down.', addressees: ['patron_1'] }));
  const voice = g.claude.callsFor('voice').at(-1) as { input: { content: string }[] } | undefined;
  if (voice) expect(JSON.stringify(voice.input)).toContain('an offer to stop fighting');
  const req = g.claude.callsFor('narrator').at(-1) as { input: { content: string }[] };
  expect(req.input[1].content).toMatch(/"offers":\[\{"to":"[^"]+","landed":"(convinced|tempted|unmoved)"\}\]/);
});
