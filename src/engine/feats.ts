// Deed achievements checked every turn: Critical Success and beyond on the player's combat rolls, zones walked, days
// survived, and the fight achievements (flawless, outnumbered, back from the brink), which are judged when the
// player's fight ends from the FightLog kept on the player's engagement.
import type { FightLog, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { TIERS } from '../scales';
import { tierLevel } from '../ruleset';
import { healthLevel } from '../ruleset/body';
import { groupsOf } from '../library/functionNames';
import { dayOf, now } from '../time';
import { actorById, allActors, hostile, isActive } from './relations';
import { fightingWith } from './engagement';
import { tally } from './xp';

const atLeastCritical = () => CONFIG.HEALTH_TRACK.findIndex(([l]) => l === 'Critical');

/** every turn, after the turn's events: rolls, zones and days, then the fight log */
export function turnFeats(state: GameState, events: GameEvent[]): void {
  const p = state.player, pr = p.progression;
  if (!pr) return;
  for (const e of events) {
    const a = e.attack;
    const r = a?.attackerId === p.id ? a.attack : a?.targetId === p.id ? a.defense : null;
    if (!r) continue;
    const beyond = tierLevel(r) - TIERS.pos('critical_success');
    if (beyond < 0) continue;
    const groups = groupsOf(getLibrary().skills[r.skill]);
    for (const g of groups) tally(state, 'crits', { by: 'group', of: g });
    if (beyond > 0) {
      tally(state, 'beyond_crit', { to: beyond });
      for (const g of groups) tally(state, 'beyond_crit', { by: 'group', of: g, to: beyond });
    }
  }
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
  if (allActors(state).some((x) => x !== p && !hostile(state, x, p) && foes.some((o) => fightingWith(state, x, o) || fightingWith(state, o, x)))) f.helped = true;
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
}
