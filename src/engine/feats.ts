// Deed achievements checked every turn: zones walked, days survived, and the fight achievements (flawless,
// outnumbered, back from the brink), judged when the player's fight ends from the FightLog kept on the engagement.
// Critical Success achievements count in every player roll (rollFeats in xp.ts).
import { yieldTaken } from './yield';
import { moraleLevel } from '../ruleset/morale';
import type { ContestResult, FightLog, GameEvent, GameState, RollResult, SkillFunction } from '../types';
import { CONFIG } from '../config';
import { healthLevel, partStates, working } from '../ruleset/body';
import { trueSkill } from '../ruleset/perks';
import { actorBody, getLibrary } from '../library';
import { dayOf, now } from '../time';
import { actorById, allActors, atLeast, hostile, isActive, stance, warm } from './relations';
import { besidePlayer, fightingWith } from './engagement';
import { tally } from './xp';

const atLeastCritical = () => CONFIG.HEALTH_TRACK.findIndex(([l]) => l === 'Critical');

/** every turn, after the turn's events: zones and days, then the fight log */
export function turnFeats(state: GameState, events: GameEvent[]): void {
  const p = state.player, pr = p.progression;
  if (!pr) return;
  const seen = (pr.zonesSeen ??= []);
  if (!seen.includes(p.zone)) { seen.push(p.zone); tally(state, 'zones', { to: seen.length }); }
  tally(state, 'days', { to: dayOf(now(state)) - 1 });
  logFight(state, events);
  eventFeats(state, events);
  stateFeats(state, events);
}

const HITS = new Set(['grazed', 'full_hit', 'heavy_hit', 'crushing_hit']);

/** the turn's events: clean defenses (N1), holds and aimed hits (N8), and contests won against better attackers or
 * defenders (N4c) */
function eventFeats(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  for (const ev of events) {
    const a = ev.attack;
    if (a?.defense && a.targetId === p.id && (a.outcome === 'dodged' || a.outcome === 'blocked') && a.damage === 0) tally(state, 'clean_defense');
    if (a?.defense && (a.attackerId === p.id || a.targetId === p.id)) // an attack against a defense is a contest
      contestFeat(state, { a: a.attack, b: a.defense, gap: 0, winner: HITS.has(a.outcome) ? 'a' : a.outcome === 'dodged' || a.outcome === 'blocked' ? 'b' : 'tie' });
    if (a && a.attackerId === p.id && a.locationHow === 'aimed' && HITS.has(a.outcome) && a.location) {
      const t = actorById(state, a.targetId);
      const size = t && actorBody(state, t).parts.find((x) => x.id === a.location)?.size;
      tally(state, 'aimed_hits');
      if (size) tally(state, 'aimed_hits', { by: 'size', of: size });
    }
    if (ev.effects.some((e) => (e.kind === 'held' && e.data?.by === p.id) || (e.kind === 'broke_free' && e.actorId === p.id))) tally(state, 'holds');
  }
}

/** read from how things stand after the turn: unseen moves (N2), mended parts and back from Down (N6), enemies turned
 * friendly (N4d) */
function stateFeats(state: GameState, events: GameEvent[]): void {
  const p = state.player, pr = p.progression!;
  // a sneak into a zone where someone is suspicious of you, and no one there sees you
  if (p.posture === 'stealthy' && events.some((e) => e.actorId === p.id && e.kind === 'move' && !e.vanish)) {
    const here = state.actors.filter((x) => x.zone === p.zone && x.mind && isActive(x)).map((x) => x.mind!.knowledge[p.id]?.status ?? 'unaware');
    if (here.includes('suspicious') && !here.some((s) => atLeast(s, 'aware'))) tally(state, 'unseen_moves');
  }
  const parts = partStates(state, p);
  const crippled = (pr.crippled ??= []);
  for (const x of parts) {
    if (!working(x.state)) { if (!crippled.includes(x.id)) crippled.push(x.id); }
    else if (x.state === 'Healthy' && crippled.includes(x.id)) { crippled.splice(crippled.indexOf(x.id), 1); tally(state, 'mended'); }
  }
  if (!isActive(p)) pr.wasDown = true;
  else if (pr.wasDown && p.core.condition.hpLostPct === 0) { delete pr.wasDown; tally(state, 'back_from_down'); }
  const grudges = (pr.grudges ??= []);
  for (const x of state.actors) {
    const s = x.mind ? stance(state, x, p) : null;
    if (s === 'hostile' && !grudges.includes(x.id)) grudges.push(x.id);
    else if (s && warm(s) && grudges.includes(x.id)) { grudges.splice(grudges.indexOf(x.id), 1); tally(state, 'enemy_to_friend'); }
  }
}

/** N4c: the player won a contest against someone with higher true skill: counted in general and per function of the
 * player's skill (or the functions given, such as the sense a notice roll used). Ties win nothing. */
export function contestFeat(state: GameState, c: ContestResult, fns?: SkillFunction[]): void {
  const p = state.player;
  const side = c.a.actorId === p.id ? 'a' : c.b.actorId === p.id ? 'b' : null;
  if (!side || c.winner !== side) return;
  const mine: RollResult = side === 'a' ? c.a : c.b, theirs: RollResult = side === 'a' ? c.b : c.a;
  const them = actorById(state, theirs.actorId);
  if (!them || trueSkill(them, theirs.skill) <= trueSkill(p, mine.skill)) return;
  tally(state, 'outmatched');
  for (const f of fns ?? getLibrary().skills[mine.skill]?.functions ?? []) tally(state, 'outmatched', { by: 'function', of: f });
}

/** keeps the player's fight log while the player's engagement holds a fight */
function logFight(state: GameState, events: GameEvent[]): void {
  const p = state.player, e = p.engagement;
  if (!e?.kinds.includes('fight')) return;
  const lost = p.core.condition.hpLostPct;
  const f = (e.fight ??= { hp: lost, foes: [], most: 0 });
  const foes = allActors(state).filter((x) => x !== p && fightingWith(state, x, p));
  for (const x of foes) if (!f.foes.includes(x.id)) f.foes.push(x.id);
  f.most = Math.max(f.most, foes.length);
  if (lost > f.hp) f.hurt = true;
  f.hp = lost;
  noteBlows(state, f, events);
  const allies = allActors(state).filter((x) => besidePlayer(state, x));
  if (allies.length) f.helped = true;
  if (allies.length && foes.length > allies.length + 1) f.heldLine = true; // the foes outnumber your whole side
  if (CONFIG.HEALTH_TRACK.findIndex(([l]) => l === healthLevel(p)) >= atLeastCritical()) f.brink = true;
  if (moraleLevel(p) === 'broken') f.broke = true;
}

/** the turn's blows: the player hurt, the player defending, the player attacking (hit or miss) */
function noteBlows(state: GameState, f: FightLog, events: GameEvent[]): void {
  const p = state.player;
  if (events.some((v) => v.attack?.targetId === p.id && v.attack.damage > 0)) f.hurt = true;
  if (events.some((v) => v.attack?.targetId === p.id && v.attack.defense)) f.defended = true;
  if (events.some((v) => v.attack?.attackerId === p.id)) f.struck = true;
}

/** the player's fight has ended: won = every foe is down, fled or yielded. The last turn's blows count too. */
export function fightEnded(state: GameState, f: FightLog, events: GameEvent[] = []): void {
  noteBlows(state, f, events);
  // a lost fight (the Loser scars): you went Down, or it ended with a foe still up and fighting you (you got away).
  // a morale break counts too (MB12), and a yield a foe took (MB42)
  if (f.down || f.broke || yieldTaken(state) || !isActive(state.player)) return tally(state, 'defeated');
  if (f.brink) tally(state, 'brink');
  const won = f.foes.every((id) => { const x = actorById(state, id); return !x || !isActive(x) || !!x.mind?.moraleState; });
  if (!won) {
    if (f.foes.some((id) => { const x = actorById(state, id); return !!x && isActive(x) && !x.mind?.moraleState && hostile(state, x, state.player); })) tally(state, 'defeated');
    return;
  }
  if (moraleLevel(state.player) === 'panicking') tally(state, 'won_panicking'); // D-160
  if (!f.hurt && f.defended) tally(state, 'flawless');
  if (f.most >= CONFIG.OUTNUMBERED_FOES && !f.helped) tally(state, 'outnumbered');
  if (f.heldLine) tally(state, 'held_line');
  if (!f.struck && f.foes.length) tally(state, 'won_without_blow'); // the fight was won without the player attacking
}
