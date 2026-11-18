// D-17: the facts a code-run NPC's fight rows read (TacticsView), built only from what it perceives. The rows themselves
// (what each one does) live in minds/routines.ts tacticsOrder; their skills and minimums in library/fightRules.ts.
import type { Actor, ActorView, GameState, TacticsView } from '../types';
import { FIGHT_RULES } from '../library/fightRules';
import { SK } from '../library/skillIds';
import { FX } from '../library/tableIds';
import { trueSkill } from '../ruleset/perks';
import { allActors, countsInFight, hostile, isActive } from '../engine/relations';
import { fightingWith } from '../engine/engagement';
import { distM } from '../engine/position';
import { slotMetres } from '../engine/speed';
import { hearsClearly } from '../perception';
import { VOLUME_NOISE } from '../perception/noise';
import { HEALTH_LEVELS } from '../scales';

/** TC7 a: the best Command among `a`'s bandmates whose shouted orders it hears clearly (a broken commander counts until
 * it is down or gone) */
export function commandLent(state: GameState, a: Actor): number {
  let best = 0;
  for (const b of allActors(state)) {
    if (b === a || b.bandId !== a.bandId || !isActive(b)) continue;
    if (!hearsClearly(state, { zone: b.zone, ...(b.pos ? { pos: b.pos } : {}) }, a, VOLUME_NOISE.shout)) continue;
    best = Math.max(best, trueSkill(b, SK.command));
  }
  return best;
}

/** TC3 a + TC7 a: a row's value for `a`: its own skill for that row, or the Command it is lent, whichever is higher */
export const rowValue = (a: Actor, skill: string, lent: number): number => Math.max(trueSkill(a, skill), lent);

/** the FIGHT_RULES rows `a` may use, in table order */
export function rowsOf(state: GameState, a: Actor): string[] {
  const lent = commandLent(state, a);
  return FIGHT_RULES.filter((r) => rowValue(a, r.skill, lent) >= r.min).map((r) => r.id);
}

/** a row gave its order since `a`'s engagement began (used on the turn the fight started, the engagement begins that turn) */
export const rowUsedThisFight = (a: Actor, rule: string): boolean => {
  const at = a.mind?.rowsUsed?.[rule];
  return at !== undefined && !!a.engagement && at >= a.engagement.start;
};

/** D-17: the TacticsView for `a`, from its own view's seen list; undefined when it may use no row */
export function tacticsView(state: GameState, a: Actor, view: ActorView): TacticsView | undefined {
  const rows = rowsOf(state, a);
  if (!rows.length) return undefined;
  const seenIds = new Set(view.seen.map((s) => s.id));
  const seen = allActors(state).filter((x) => x !== a && seenIds.has(x.id) && countsInFight(x));
  const fights = (x: Actor, y: Actor) => fightingWith(state, x, y) || fightingWith(state, y, x);
  const foes = seen.filter((x) => fights(a, x));
  // its side: anyone not hostile to it who fights one of its foes (the fight sides the held-the-line count uses)
  const allies = seen.filter((x) => !hostile(state, x, a) && !hostile(state, a, x) && foes.some((f) => fights(x, f)));
  const out: TacticsView = { rows };
  if (foes.length > allies.length + 1) out.outnumbered = true;
  if (rowUsedThisFight(a, FX.call_help)) out.calledHelp = true;
  const at = (x: Actor) => distM(state, { zone: a.zone, ...(a.pos ? { pos: a.pos } : {}) }, { zone: x.zone, ...(x.pos ? { pos: x.pos } : {}) });
  if (rows.includes(FX.gang_up)) {
    const oneMove = slotMetres(state, a, 'move');
    const ganged = foes.filter((f) => allies.some((y) => fights(y, f)) && at(f) <= oneMove).sort((x, y) => at(x) - at(y) || x.id.localeCompare(y.id))[0];
    if (ganged) out.allyFoe = ganged.id;
  }
  if (rows.includes(FX.back_off)) {
    const free = seen.filter((x) => x.bandId === a.bandId && !hostile(state, x, a) && !allActors(state).some((o) => o !== x && fights(x, o)))
      .sort((x, y) => at(x) - at(y) || x.id.localeCompare(y.id))[0];
    if (free) out.freeAlly = { id: free.id, zone: free.zone };
  }
  if (rows.includes(FX.finish_hurt) && foes.length >= 2) {
    // only a hurt it can see: others' health shows from CONFIG.HEALTH_SHOWN_FROM down (SeenActor.health)
    const hurt = view.seen.filter((s) => s.health && foes.some((f) => f.id === s.id))
      .sort((x, y) => HEALTH_LEVELS.pos(y.health!) - HEALTH_LEVELS.pos(x.health!) || x.id.localeCompare(y.id))[0];
    if (hurt) out.hurtFoe = hurt.id;
  }
  return out;
}

/** the view the code-run fight list reads: the NPC's own view plus its TacticsView */
export const withTactics = (state: GameState, a: Actor, view: ActorView): ActorView => {
  const t = tacticsView(state, a, view);
  return t ? { ...view, tactics: t } : view;
};
