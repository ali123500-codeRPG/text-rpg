// Guided autoplay ("Asks me at crossroads", GA1–GA17): the agent plays most turns itself and hands the big calls to the
// watcher. GA2: code spots some crossroads after each turn, the agent stops itself before the others; all of them live in
// the one table below, so adding or removing a kind is a one-line change.
import type { GameState, LogLine } from '../types';
import { CONFIG } from '../config';
import { allActors, isEngaged, stance } from '../engine/relations';
import { coinWords, coins } from '../engine/trade';
import { healthLevel } from '../ruleset/body';
import { HEALTH_LEVELS, PART_STATES, type HealthLevelKey } from '../scales';

/** by: 'code' = checked after each turn; 'agent' = the agent asks before making such a move */
export const CROSSROADS: { kind: string; by: 'code' | 'agent'; rule: string }[] = [
  { kind: 'fight_started', by: 'code', rule: 'a fight starts that you did not start (GA3)' },
  { kind: 'badly_hurt', by: 'code', rule: 'your health first reaches Wounded, Mauled or Critical, or a body part becomes Crippled or Destroyed (GA4)' },
  { kind: 'foe_yields', by: 'code', rule: 'a foe yields to you: spare them or fight on (GA5)' },
  { kind: 'perk_point', by: 'code', rule: 'a perk point is waiting, on the watcher’s own story only (GA6)' },
  { kind: 'start_fight', by: 'agent', rule: 'attacking anyone who is not already attacking you (fighting back does not count)' },
  { kind: 'kill', by: 'agent', rule: 'finishing off someone who is down, has yielded or is fleeing' },
  { kind: 'deal', by: 'agent', rule: 'agreeing to, turning down or giving up a deal or a quest; say who offers what and for how much, if you know' },
  { kind: 'part_with', by: 'agent', rule: 'selling or giving away any gear, or spending more than the coin limit below in one go' },
  { kind: 'new_place', by: 'agent', rule: 'leaving for a place you have never been (moving around here, or going back somewhere you know, does not count)' },
  { kind: 'character', by: 'agent', rule: 'a choice that shapes who your character is: lying to someone friendly, stealing, breaking a promise, betraying or joining a side, or anything else that cannot be taken back' },
];
const KINDS = new Set(CROSSROADS.map((c) => c.kind));

/** GA12: what never asks */
const NEVER = 'scenario breaks, people arriving or leaving, achievements, skill gains, level-ups, ordinary talk, small buys, or a fight you are already in';

/** what the bar keeps for the guided agent: this scenario's guidance (GA14), calls already made this
 *  scenario (GA12: the same kind about the same thing asks once per scenario), and a crossroads code spotted that it must word */
export type GuidedCtx = { guidance?: string; settled?: string[]; mustAsk?: Crossroad; answered?: { about: string; words: string } };
/** key: what makes two of them the same thing for GA12's once-per-scenario rule (about when left out) */
export type Crossroad = { kind: string; about: string; situation: string; key?: string };
export type Ask = { kind: string; about: string; choices: string[]; pick: number };

/** the guided part of the agent's per-turn prompt */
export function guidedPrompt(s: GameState | null, lines: LogLine[], g: GuidedCtx, inCharacter = false): string {
  const out: string[] = [];
  // the character's signatures stand in for standing orders (GA16 is gone): kept to, and never asked about. In character
  // they are already in who the character is, so they are not given twice (BG-232)
  const signs = inCharacter ? [] : s?.player.core.signatures ?? [];
  if (signs.length) out.push(`Your character's signatures (habits to keep to when they come up, not lines to repeat; never ask about what they already settle): ${signs.join(' ')}`);
  if (g.guidance?.trim()) out.push(`The watcher's guidance for this scenario (follow it): ${g.guidance.trim()}`);
  if (g.answered) return [...out, `The watcher answered your question about ${g.answered.about}: "${g.answered.words}". Make your next move from that answer now; do not ask again.`].join('\n\n');
  const coin = s ? coins(s.player) : 0;
  const places = [...new Set(lines.map((l) => l.place?.name).filter((x): x is string => !!x))];
  const asking = `To ask, reply {"ask": {"kind": "<the kind>", "about": "who or what it is about, 1 to 4 words", "choices": ["2 to 4 moves you could type next, each one short line"], "pick": <the number of the choice you would take, from 0>}, "say": "your question to the watcher, spoken in your voice: the situation in a breath, and what you would do"} with no "command".`;
  if (g.mustAsk) {
    out.push(`STOP: the watcher must decide this one (kind "${g.mustAsk.kind}", about "${g.mustAsk.about}"): ${g.mustAsk.situation}. Do not make a move. ${asking}`);
    return out.join('\n\n');
  }
  out.push([
    'The watcher makes the big calls. Before a move that is one of these, do not make it: ask instead.',
    ...CROSSROADS.filter((c) => c.by === 'agent').map((c) => `- ${c.kind}: ${c.rule}`),
    `Never ask about ${NEVER}. Everything else you decide yourself.`,
    asking,
    `Coin limit: you carry ${coinWords(coin)}; ask before spending more than ${coinWords(Math.floor(coin * CONFIG.GUIDED_COIN_SHARE))} in one go.`,
    `Places you have been: ${places.join('; ') || 'only here'}.`,
    ...(g.settled?.length ? [`Already settled this scenario (never ask again; follow the answer): ${g.settled.join('; ')}`] : []),
  ].join('\n'));
  return out.join('\n\n');
}

/** the agent's question, made safe, or null when it isn't one */
export function readAsk(v: unknown, mustKind?: string): Ask | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kind = typeof o.kind === 'string' && KINDS.has(o.kind) ? o.kind : mustKind;
  const choices = Array.isArray(o.choices) ? o.choices.filter((c): c is string => typeof c === 'string' && !!c.trim()).map((c) => c.split('\n')[0].trim().slice(0, 200)).slice(0, 4) : [];
  if (!kind || !choices.length) return null;
  const about = typeof o.about === 'string' && o.about.trim() ? o.about.trim().slice(0, 60) : kind;
  const pick = typeof o.pick === 'number' && o.pick >= 0 && o.pick < choices.length ? Math.floor(o.pick) : 0;
  return { kind, about, choices, pick };
}

/** the once-per-scenario key of a question (GA12) */
export const askKey = (kind: string, about: string) => `${kind}: ${about.toLowerCase()}`;

/** what code compares across a turn */
export type TurnSnap = { engaged: boolean; health: HealthLevelKey; yielded: string[] };
export function turnSnap(s: GameState): TurnSnap {
  const p = s.player;
  return { engaged: isEngaged(s, p), health: healthLevel(p), yielded: allActors(s).filter((a) => a !== p && stance(s, a, p) === 'yielded').map((a) => a.id) };
}

const HURT_ASKS: HealthLevelKey[] = ['wounded', 'mauled', 'critical'];

/** the code-spotted crossroads of the turn that just ended (GA3–GA5; the perk point, GA6, is the bar's own card).
 *  ownFight: the watcher already approved the fight the agent started this turn. */
export function spotCrossroads(before: TurnSnap, s: GameState, line: LogLine | undefined, ownFight: boolean): Crossroad[] {
  const now = turnSnap(s), out: Crossroad[] = [];
  if (!before.engaged && now.engaged && !ownFight) out.push({ kind: 'fight_started', about: 'this fight', key: `fight from turn ${s.turn}`, situation: 'a fight has started that you did not start (see the latest story lines): fight, talk, run or yield?' });
  const health = HEALTH_LEVELS.name(now.health);
  if (HURT_ASKS.includes(now.health) && HEALTH_LEVELS.pos(now.health) > HEALTH_LEVELS.pos(before.health)) out.push({ kind: 'badly_hurt', about: health, situation: `your health is now ${health}` });
  for (const w of line?.wounds ?? []) if (PART_STATES.pos(w.to) >= PART_STATES.pos('crippled')) out.push({ kind: 'badly_hurt', about: `${w.id.replace(/_/g, ' ')} ${PART_STATES.name(w.to)}`, situation: `your ${w.id.replace(/_/g, ' ')} is now ${PART_STATES.name(w.to)}` });
  const yielded = now.yielded.filter((id) => !before.yielded.includes(id));
  if (yielded.length) out.push({ kind: 'foe_yields', about: 'a foe who yielded', key: `yield of ${yielded.join(', ')}`, situation: 'a foe has yielded to you (see the latest story lines): spare them or fight on?' });
  return out;
}
