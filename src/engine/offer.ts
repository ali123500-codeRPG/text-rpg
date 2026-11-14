// Talking someone out of a fight (TF1, TF4–TF17, speech with actions page round 3). In a fight, persuasion is an offer to
// stop (TF13): one contest, the speaker's Persuasion against the listener's, with the listener's wound and fear penalties
// on its answer as on every roll, so a hurt or frightened foe is easier to talk down: the health and morale bars are the
// will to fight, with no new bar. A lie can be an offer too, Lying against Insight (TF17); threats stay as they are (they
// wear down morale). A bribe is a barter offer of named coin (Barter against Barter, a bigger offer helps), and the
// stand-down only comes once the coin changes hands (TF10).
// How it landed (TF15): convinced (a win by CONFIG.OFFER_WIN_TIERS, fewer once the listener is hurt or uneasy: TF14),
// tempted (a smaller win or a tie) or unmoved (a loss). A foe run by code stands down when convinced. A foe its AI plays
// is told how it landed and answers standDown (yes or no; no answer is no), in this turn's Responder output or its next
// output. Beg for Mercy and Buy Them Off (TF10) make any win an offer that can't be refused, even by an AI-run foe.
// The listener answers for the bandmates together with it who heard the offer (TF6). A stand-down is a truce like a taken
// yield (TF16): for the rest of the scenario neither the foes who stood down nor the speaker's side as it stood may attack
// the other (TF5). Foes may offer the player a stand-down the same way, and the player accepts by saying so (TF11).
// There is no repeat-try penalty in a fight (TF9 b, ruleset/pressure).
import type { Actor, ContestResult, GameState, Intent } from '../types';
import type { AcceptedAgentOutput } from './types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { INTELLIGENCE, HEALTH_LEVELS, MORALE_LEVELS } from '../scales';
import { healthLevel } from '../ruleset/body';
import { moraleLevel } from '../ruleset/morale';
import { hasPerk } from '../ruleset/perks';
import { PK } from '../library/perkIds';
import { actorById, allActors, atLeast, countsInFight, hostile, isActive, isEngaged } from './relations';
import { besidePlayer } from './engagement';
import { together } from './yield';
import { logCode } from './effects';
import { coins, payCoin } from './trade';
import { tally } from './xp';

/** how an offer landed with its listener (TF15) */
export type OfferLanded = 'convinced' | 'tempted' | 'unmoved';
/** the speech types that can be an offer to stop in a fight (TF13, TF17; TF10 a bribe) */
export const OFFER_TYPES = ['persuade', 'deceive', 'barter'];

/** TF4: a foe of a speaking race can take an offer, whoever runs it (slimes and beasts can't be talked to) */
export function speaks(a: Actor): boolean {
  const mind = a.core.raceId ? getLibrary().races?.[a.core.raceId]?.intelligence : undefined;
  return !!mind && INTELLIGENCE.pos(mind) >= INTELLIGENCE.pos('intelligent');
}

/** in a fight, `to` can be offered a stand-down by `from`: both count in the fight, `to` speaks and is hostile to `from` */
export function canOffer(state: GameState, from: Actor, to: Actor): boolean {
  return from !== to && countsInFight(from) && countsInFight(to) && speaks(to) && hostile(state, to, from) && isEngaged(state, from);
}

/** TF14: the win, in tiers, that convinces a listener: CONFIG.OFFER_WIN_TIERS, or OFFER_WIN_TIERS_SHAKEN once it is
 * at OFFER_EASIER_HEALTH or worse in health, or OFFER_EASIER_MORALE or worse in morale (placeholders) */
export function tiersToConvince(a: Actor): number {
  const hurt = HEALTH_LEVELS.pos(healthLevel(a)) >= HEALTH_LEVELS.pos(CONFIG.OFFER_EASIER_HEALTH);
  const uneasy = MORALE_LEVELS.pos(moraleLevel(a)) >= MORALE_LEVELS.pos(CONFIG.OFFER_EASIER_MORALE);
  return hurt || uneasy ? CONFIG.OFFER_WIN_TIERS_SHAKEN : CONFIG.OFFER_WIN_TIERS;
}

/** TF15: how an offer landed, from its contest (the speaker is side a) */
export function landed(contest: ContestResult, listener: Actor): OfferLanded {
  const won = -contest.gap;
  return won >= tiersToConvince(listener) ? 'convinced' : won >= 0 ? 'tempted' : 'unmoved';
}

/** TF10: Beg for Mercy (the speaker at the last health level before going down, pleading) and Buy Them Off (a bribe) make
 * a won offer one that can't be refused */
export function cannotRefuse(speaker: Actor, type: string, contest: ContestResult): boolean {
  if (contest.winner !== 'a') return false;
  const lastLevel = HEALTH_LEVELS.pos(healthLevel(speaker)) === HEALTH_LEVELS.pos('incapacitated') - 1;
  return (type === 'persuade' && lastLevel && hasPerk(speaker, PK.plead)) || (type === 'barter' && hasPerk(speaker, PK.buy_them_off));
}

/** TF10: a bribe's pull on the briber's Barter roll: OFFER_BRIBE_MOD for each doubling of the coin over the listener's
 * price (OFFER_BRIBE_PRICE per character level, at least 1), as much less for each halving (placeholders) */
export function bribeMod(coin: number, listener: Actor): number {
  const level = listener.core.classes.reduce((n, c) => n + (c.level ?? 0), 0);
  const price = Math.max(1, CONFIG.OFFER_BRIBE_PRICE * level);
  return coin > 0 ? Math.round(CONFIG.OFFER_BRIBE_MOD * Math.log2(coin / price)) : 0;
}

/** TF15: how an offer struck its listener, in words (an AI-run listener's prompt; the player's view) */
export const OFFER_WORDS: Record<OfferLanded, string> = { convinced: 'convinces you', tempted: 'tempts you', unmoved: 'does not move you' };

/** TF13/TF17/TF10: the player's words this turn are an offer to stand down to `to`: a persuasion or lie at a foe in a
 * fight, or a bribe (barter naming its coin) */
export function playerOffer(state: GameState, intent: Intent | null | undefined, to: Actor): { type: string; coin: number } | undefined {
  const type = intent?.action?.type ?? '';
  if (!OFFER_TYPES.includes(type) || !canOffer(state, state.player, to)) return undefined;
  const coin = type === 'barter' ? Math.max(0, Math.floor(intent?.action?.qty ?? 0)) : 0;
  return type === 'barter' && !coin ? undefined : { type, coin };
}

/** TF15: what an AI-run listener hears beside the impression, when the player's words are an offer: how it landed, and
 * that it can't be refused (TF10) */
export function offerNote(state: GameState, intent: Intent | null | undefined, to: Actor, contest: ContestResult): string | undefined {
  const o = playerOffer(state, intent, to);
  if (!o) return undefined;
  const coin = o.coin ? `, for ${o.coin} coin paid when you agree,` : '';
  return `it is an offer to stop fighting${coin} and it ${OFFER_WORDS[landed(contest, to)]}${cannotRefuse(state.player, o.type, contest) ? ' (you cannot refuse it)' : ''}`;
}

type Offers = NonNullable<GameState['offers']>;
const offers = (state: GameState): Offers => (state.offers ??= { pending: [], truces: {} });
/** a stand-down that happened: `who` (with `with`) stood down from `from`; coin paid for it */
export type StoodDown = { who: Actor; from: Actor; with: string[]; coin?: number };

/** the offer `from` made to `to` in a fight: code-run listeners settle it now, AI-run ones (and the player) are asked
 * (TF13, TF15, TF11). `heard`: the listener's bandmates who heard it (they go with the listener's answer, TF6). */
export function makeOffer(state: GameState, from: Actor, to: Actor, type: string, contest: ContestResult, heard: string[], coin = 0): { landed: OfferLanded; stood?: StoodDown } {
  const how = landed(contest, to);
  const forced = cannotRefuse(from, type, contest);
  logCode(state, 'offer_made', { from: from.id, to: to.id, type, landed: how, ...(forced ? { forced: true } : {}), ...(coin ? { coin } : {}) });
  const asked = to.kind === 'player' || to.mind?.control === 'agent';
  if (!forced && asked) {
    offers(state).pending.push({ from: from.id, to: to.id, landed: how, turn: state.turn, heard, ...(coin ? { coin } : {}) });
    return { landed: how };
  }
  const stood = forced || how === 'convinced' ? standDown(state, to, from, heard, coin) : undefined;
  return { landed: how, ...(stood ? { stood } : {}) };
}

/** the offers waiting on `to`'s answer: made within CONFIG.OFFER_OPEN_TURNS turns by someone still active */
export function offersTo(state: GameState, to: Actor): Offers['pending'] {
  return (state.offers?.pending ?? []).filter((o) => o.to === to.id && state.turn - o.turn < CONFIG.OFFER_OPEN_TURNS && isActive(actorById(state, o.from) ?? to));
}

/** TF15: an AI-run listener's answer to an offer, in this turn's Responder output (sameTurn) or a later output; TF11: the
 * player's, naming the offerer. No answer is no: an unanswered offer lapses after OFFER_OPEN_TURNS. */
export function answerOffer(state: GameState, to: Actor, yes: boolean | string | null | undefined, sameTurn: boolean): StoodDown | undefined {
  if (yes === undefined || yes === null) return undefined;
  const o = offersTo(state, to).find((x) => (sameTurn || x.turn < state.turn) && (typeof yes !== 'string' || x.from === yes));
  if (!o) return undefined;
  offers(state).pending = offers(state).pending.filter((x) => x !== o);
  logCode(state, yes ? 'offer_taken' : 'offer_refused', { actorId: to.id, from: o.from });
  const from = actorById(state, o.from);
  return yes && from ? standDown(state, to, from, o.heard, o.coin ?? 0) : undefined;
}

/** applies every standDown answer in this turn's agent outputs (before the turn's blows, so a foe that stands down strikes no more) */
export function answerOffers(state: GameState, outputs: AcceptedAgentOutput[]): StoodDown[] {
  const out: StoodDown[] = [];
  for (const o of outputs) {
    const a = actorById(state, o.actorId);
    const r = a && answerOffer(state, a, (o.output as { standDown?: boolean }).standDown, o.agent !== 'planner');
    if (r) out.push(r);
  }
  return out;
}

/** the side an actor stands on for a truce: the player and everyone fighting beside the player (TF5), or the actor with
 * the bandmates together with it (only those in `among`, when given: TF6, those who heard the offer) */
function sideOf(state: GameState, x: Actor, among?: string[]): Actor[] {
  const p = state.player;
  if (x === p || besidePlayer(state, x)) return [p, ...allActors(state).filter((o) => o !== p && besidePlayer(state, o))];
  return [x, ...state.actors.filter((m) => m !== x && isActive(m) && (!among || among.includes(m.id)) && together(state, x, m) && hostile(state, m, p) === hostile(state, x, p))];
}

/** TF16/TF5/TF6: `who` stands down from `from`: a truce between who's side (its bandmates together with it that heard the
 * offer) and from's side, as both stand now, for the rest of the scenario. A bribe is paid first; with too little coin
 * left, nothing comes of it (TF10: the trade must be completed). A foe talked down by the player before any blow from
 * them is tallied (N4b). A stand-down beats no one (TF18): it is not a defeat for either side. */
export function standDown(state: GameState, who: Actor, from: Actor, heard: string[], coin = 0): StoodDown | undefined {
  const payer = who.kind === 'player' ? who : from, payee = payer === who ? from : who;
  if (coin) {
    if (coins(payer) < coin) { logCode(state, 'offer_unpaid', { from: payer.id, to: payee.id, coin }); return undefined; }
    payCoin(payer, payee, coin);
  }
  const p = state.player;
  const mine = sideOf(state, who, heard), theirs = sideOf(state, from);
  const t = offers(state).truces;
  for (const m of mine) t[m.id] = [...new Set([...(t[m.id] ?? []), ...theirs.map((x) => x.id)])];
  for (const x of theirs) t[x.id] = [...new Set([...(t[x.id] ?? []), ...mine.map((m) => m.id)])];
  const ids = new Set([...mine, ...theirs].map((a) => a.id));
  offers(state).pending = offers(state).pending.filter((o) => !(ids.has(o.to) && ids.has(o.from)));
  const foes = mine.includes(p) ? theirs : mine, side = foes === mine ? theirs : mine;
  for (const m of foes) {
    for (const x of side) {
      const b = m.mind?.knowledge?.[x.id]; // as after a taken yield (YD3): the hunt for them is over
      if (b && atLeast(b.status, 'hunting')) b.status = 'tracking';
    }
    // TF18: a stand-down is its own outcome, never a defeat for either side; the player's talk-downs have their own tally
    if (foes === mine && !m.mind?.hitByPlayer) tally(state, 'talked_down');
  }
  const withIds = mine.filter((m) => m !== who).map((m) => m.id);
  logCode(state, 'stood_down', { actorId: who.id, from: from.id, with: withIds, ...(coin ? { coin } : {}) });
  return { who, from, with: withIds, ...(coin ? { coin } : {}) };
}

/** TF16: a stand-down truce bars `a` attacking `t` (either way round), for the rest of the scenario */
export const truceBars = (state: GameState, a: Actor, t: Actor): boolean => !!state.offers?.truces[a.id]?.includes(t.id);
