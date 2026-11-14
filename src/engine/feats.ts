// Deed achievements checked every turn: zones walked, days survived, and the fight achievements (flawless,
// outnumbered, back from the brink), judged when the player's fight ends from the FightLog kept on the engagement.
// Critical Success achievements count in every player roll (rollFeats in xp.ts).
import { yieldTaken } from './yield';
import { defended, struck } from '../ruleset/hits';
import { moraleLevel } from '../ruleset/morale';
import type { Actor, AchievementRule, ContestResult, FightLog, GameEvent, GameState, RollResult, SkillFunction } from '../types';
import { CONFIG } from '../config';
import { healthLevel, partStates, working } from '../ruleset/body';
import { trueSkill } from '../ruleset/perks';
import { actorBody, getLibrary } from '../library';
import { dayOf, now } from '../time';
import { actorById, allActors, atLeast, countsInFight, hostile, isActive, stance, warm } from './relations';
import { besidePlayer, fightingWith } from './engagement';
import { power, tally } from './xp';
import { HEALTH_LEVELS, TIERS } from '../scales';
import { tierLevel } from '../ruleset';
import { seeingM } from './position';

/** every turn, after the turn's events: zones and days, then the fight log */
export function turnFeats(state: GameState, events: GameEvent[]): void {
  const p = state.player, pr = p.progression;
  if (!pr) return;
  const seen = (pr.zonesSeen ??= []);
  if (!seen.includes(p.zone)) { seen.push(p.zone); tally(state, 'zones', { to: seen.length }); }
  placeFeats(state);
  tally(state, 'days', { to: dayOf(now(state)) - 1 });
  logFight(state, events);
  eventFeats(state, events);
  stateFeats(state, events);
}

/** TM14: every place the player stands in, and the places holding it (a tavern, its settlement …), counted once per
 * place, per kind of place */
function placeFeats(state: GameState): void {
  const pr = state.player.progression!, seen = (pr.placesSeen ??= []);
  for (let id: string | null = state.player.placeId, i = 0; id && i < 10; i++) {
    const place = state.places.find((x) => x.id === id);
    if (!place) break;
    if (!seen.includes(place.id)) {
      seen.push(place.id);
      tally(state, 'places', { by: 'place_kind', of: place.kind, to: seen.filter((x) => state.places.find((y) => y.id === x)?.kind === place.kind).length });
    }
    id = place.parentId;
  }
}

/** the turn's events: clean defenses (N1), holds and aimed hits (N8), and contests won against better attackers or
 * defenders (N4c) */
function eventFeats(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  for (const ev of events) {
    const a = ev.attack;
    if (a?.defense && a.targetId === p.id && defended(a.outcome) && a.damage === 0) tally(state, 'clean_defense');
    if (a?.defense && (a.attackerId === p.id || a.targetId === p.id)) // an attack against a defense is a contest
      contestFeat(state, { a: a.attack, b: a.defense, gap: 0, winner: struck(a.outcome) ? 'a' : defended(a.outcome) ? 'b' : 'tie' });
    if (a && a.attackerId === p.id && a.locationHow === 'aimed' && struck(a.outcome) && a.location) {
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
  // a sneak past watchers: someone with sight of where you ended is suspicious of you, and none of them sees you (ZR5)
  if (p.posture === 'stealthy' && events.some((e) => e.actorId === p.id && e.kind === 'move' && !e.vanish)) {
    const here = state.actors.filter((x) => x.mind && isActive(x) && seeingM(state, x, p) !== null).map((x) => x.mind!.knowledge[p.id]?.status ?? 'unaware');
    if (here.includes('suspicious') && !here.some((s) => atLeast(s, 'aware'))) tally(state, 'unseen_moves');
  }
  const parts = partStates(state, p);
  const crippled = (pr.crippled ??= []);
  for (const x of parts) {
    if (!working(x.state)) { if (!crippled.includes(x.id)) crippled.push(x.id); }
    else if (x.state === 'healthy' && crippled.includes(x.id)) { crippled.splice(crippled.indexOf(x.id), 1); tally(state, 'mended'); }
  }
  // TM23: the first time the player's health reaches each wound level (and every milder one on the way)
  const lv = HEALTH_LEVELS.pos(healthLevel(p));
  for (let i = 1; i <= Math.min(lv, HEALTH_LEVELS.pos('incapacitated')); i++) tally(state, 'health_reached', { by: 'health_level', of: HEALTH_LEVELS.at(i), to: 1 });
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
  matchedCritFeat(state, c);
  const p = state.player;
  const side = c.a.actorId === p.id ? 'a' : c.b.actorId === p.id ? 'b' : null;
  if (!side || c.winner !== side) return;
  const mine: RollResult = side === 'a' ? c.a : c.b, theirs: RollResult = side === 'a' ? c.b : c.a;
  const them = actorById(state, theirs.actorId);
  if (!them || trueSkill(them, theirs.skill) <= trueSkill(p, mine.skill)) return;
  tally(state, 'outmatched');
  for (const f of fns ?? getLibrary().skills[mine.skill]?.functions ?? []) tally(state, 'outmatched', { by: 'function', of: f });
}

/** AS1–AS11: the player attacks `t` (hit or miss) while seeing it surrendered or broken, both visible states; each foe
 * counts once per line. A surrendered foe the player struck so is remembered, so killing it later counts on its branch. */
export function gaveUpFeats(state: GameState, a: Actor, t: Actor): void {
  const p = state.player, pr = p.progression;
  if (a !== p || !pr || t === p) return;
  const st = t.mind?.moraleState;
  if (!st || seeingM(state, p, t) === null) return;
  const seen = (pr.gaveUpStruck ??= { surrendered: [], broken: [] });
  const list = st === 'surrendered' ? seen.surrendered : seen.broken;
  if (list.includes(t.id)) return;
  list.push(t.id);
  tally(state, st === 'surrendered' ? 'struck_surrendered' : 'struck_fleeing');
}
/** AS4: the player's blow killed a foe they had struck after it surrendered */
export function killedSurrenderedFeat(state: GameState, t: Actor): void {
  if (state.player.progression?.gaveUpStruck?.surrendered.includes(t.id)) tally(state, 'killed_surrendered');
}

/** D-292: the player and the other side of a contest both landed on the same tier, Critical Success or past it */
export function matchedCritFeat(state: GameState, c: ContestResult): void {
  const p = state.player.id;
  if ((c.a.actorId === p) === (c.b.actorId === p)) return;
  const t = tierLevel(c.a);
  if (t === tierLevel(c.b) && t >= TIERS.pos('critical_success')) tally(state, 'matched_crits');
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
  if (HEALTH_LEVELS.pos(healthLevel(p)) >= HEALTH_LEVELS.pos('critical')) f.brink = true;
  if (moraleLevel(p) === 'broken') f.broke = true;
  // D-177: the strongest hostile foe, against the player's own power (the same power defeat XP uses)
  const mine = power(state, p);
  for (const x of foes.filter((y) => hostile(state, y, p))) {
    const gap = power(state, x) - mine;
    f.above = Math.max(f.above ?? gap, gap);
    if (mine > 0) f.abovePct = Math.max(f.abovePct ?? -100, (gap / mine) * 100);
  }
}

/** D-177: a fight against a stronger hostile foe ended with the player up (survived), or won: the gap is a high-water mark */
function strongerFoe(state: GameState, f: FightLog, won: boolean): void {
  if (!isActive(state.player)) return; // still Down at the end: not survived
  for (const [rule, gap] of [['survived_above', f.above], ['survived_above_pct', f.abovePct], ...(won ? [['won_above', f.above], ['won_above_pct', f.abovePct]] : [])] as [AchievementRule, number | undefined][])
    if (gap !== undefined && gap > 0) tally(state, rule, { to: gap });
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
  const won = f.foes.every((id) => { const x = actorById(state, id); return !x || !countsInFight(x); });
  const lost = !!(f.down || f.broke || yieldTaken(state) || !isActive(state.player));
  strongerFoe(state, f, won && !lost);
  // your nerve broke and the fight was won all the same; it still counts as a lost fight below (MB12), as going Down does
  if (won && f.broke && f.foes.length && isActive(state.player) && !yieldTaken(state)) tally(state, 'won_broken');
  if (lost) return tally(state, 'defeated');
  if (f.brink) tally(state, 'brink');
  if (!won) {
    if (f.foes.some((id) => { const x = actorById(state, id); return !!x && countsInFight(x) && hostile(state, x, state.player); })) tally(state, 'defeated');
    return;
  }
  if (moraleLevel(state.player) === 'panicking') tally(state, 'won_panicking'); // D-160
  if (!f.hurt && f.defended) tally(state, 'flawless');
  if (f.most >= CONFIG.OUTNUMBERED_FOES && !f.helped) tally(state, 'outnumbered');
  if (f.heldLine) tally(state, 'held_line');
  if (!f.struck && f.foes.length) tally(state, 'won_without_blow'); // the fight was won without the player attacking
}
