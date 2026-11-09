// Deed achievements checked every turn: zones walked, days survived, and the fight achievements (flawless,
// outnumbered, back from the brink), judged when the player's fight ends from the FightLog kept on the engagement.
// Critical Success achievements count in every player roll (rollFeats in xp.ts).
import type { FightLog, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { healthLevel } from '../ruleset/body';
import { dayOf, now } from '../time';
import { actorById, allActors, hostile, isActive } from './relations';
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
  if (lost > f.hp || events.some((v) => v.attack?.targetId === p.id && v.attack.damage > 0)) f.hurt = true;
  f.hp = lost;
  if (events.some((v) => v.attack?.targetId === p.id && v.attack.defense)) f.defended = true;
  const allies = allActors(state).filter((x) => besidePlayer(state, x));
  if (allies.length) f.helped = true;
  if (allies.length && foes.length > allies.length + 1) f.heldLine = true; // the foes outnumber your whole side
  if (CONFIG.HEALTH_TRACK.findIndex(([l]) => l === healthLevel(p)) >= atLeastCritical()) f.brink = true;
}

/** the player's fight has ended: won = every foe is down, fled or yielded */
export function fightEnded(state: GameState, f: FightLog): void {
  if (!isActive(state.player)) return;
  if (f.brink) tally(state, 'brink');
  const won = f.foes.every((id) => { const x = actorById(state, id); return !x || !isActive(x) || !!x.mind?.moraleState; });
  if (!won) return;
  if (!f.hurt && f.defended) tally(state, 'flawless');
  if (f.most >= CONFIG.OUTNUMBERED_FOES && !f.helped) tally(state, 'outnumbered');
  if (f.heldLine) tally(state, 'held_line');
}
