// D-17: the facts a code-run NPC's fight rows read (TacticsView), built only from what it perceives. The rows themselves
// (what each one does) live in minds/routines.ts tacticsOrder; their skills and minimums in library/fightRules.ts.
import type { Actor, ActorView, GameState, Tactics, TacticsView, TacticsWalk, Zone } from '../types';
import type { Located, Pos } from '../engine/position';
import { FIGHT_RULES } from '../library/fightRules';
import { SK } from '../library/skillIds';
import { FX } from '../library/tableIds';
import { trueSkill } from '../ruleset/perks';
import { allActors, countsInFight, hostile, isActive, zoneById } from '../engine/relations';
import { fightingWith } from '../engine/engagement';
import { distM, entryPoint, seeingM, walkRoute } from '../engine/position';
import { clutterCover, hostileNearM } from '../ruleset/gear';
import { middle } from '../plan/where';
import { inOutline, nearestEdge } from '../plan/geom';
import { itemDef } from '../library';
import { sightLevel } from '../perception/sight';
import { isDark, zoneLight } from '../time';
import { turnMetres } from '../engine/speed';
import { hearsClearly } from '../perception';
import { VOLUME_NOISE } from '../perception/noise';
import { COVER, HEALTH_LEVELS, LIGHT, TACTICS } from '../scales';
import { CONFIG } from '../config';
import { feinting } from '../engine/feint';
import { freeGrips, healthLevel, poolState, working } from '../ruleset/body';
import { canBlock, isHeld } from '../ruleset/gear';

/** TC4 a: the Planner's tactics word: the last TACTICS word whose CONFIG.TACTICS_FROM value its own Battle Sense reaches */
export const tacticsWord = (a: Actor): Tactics => {
  const bs = trueSkill(a, SK.battle_sense);
  return [...TACTICS.keys].reverse().find((k) => bs >= CONFIG.TACTICS_FROM[k]) ?? TACTICS.keys[0];
};

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

type Near = TacticsWalk & { pos: Pos; m: number };
/** TC18 a: the zones `a` can step into within one move (its move slot in metres, by its own walk through the ways it
 * knows), nearest first; each with the point a step inside the doorway it comes in by */
export function oneMoveZones(state: GameState, a: Actor): Near[] {
  const oneMove = turnMetres(state, a, 'move'), from: Located = { zone: a.zone, ...(a.pos ? { pos: a.pos } : {}) };
  const out: Near[] = [];
  // BG-304: every title whose outline lies within one move in a straight line (the walk is never shorter), then by the walk
  const here = zoneById(state, a.zone), p = a.pos ?? (here?.outline?.length ? middle(here) : undefined);
  const near = (z: Zone) => !p || inOutline(p, z.outline) || nearestEdge(p, z.outline).d <= oneMove;
  for (const z of [...state.zones].sort((x, y) => x.id.localeCompare(y.id))) {
    if (z.id === a.zone || !z.outline?.length || !near(z)) continue;
    try {
      const r = walkRoute(state, from, { zone: z.id }, a);
      if (!r || !r.path.length) continue;
      const via = r.path.length > 1 ? r.path[r.path.length - 2] : a.zone, pos = entryPoint(state, z.id, via, a);
      if (!pos) continue;
      const m = walkRoute(state, from, { zone: z.id, pos }, a)?.metres;
      if (m !== undefined && m <= oneMove) out.push({ zone: z.id, via, pos, m });
    } catch { continue; } // a title with no way in is no place to walk to
  }
  return out.sort((x, y) => x.m - y.m || x.zone.localeCompare(y.zone));
}

/** F2: a foe that holds a weapon with a ranged mode, as the viewer sees its gear */
const showsRanged = (state: GameState, view: ActorView, f: Actor): boolean => {
  const seen = (view.seen ?? []).find((s) => s.id === f.id);
  return !!seen?.gear.some((g) => g.where === 'held' && f.core.inventory.some((i) => i.id === g.id && itemDef(state, i.itemId).weapon?.modes.some((m) => m.tree === 'ranged')));
};

/** the last missile a foe it fights loosed at `a` this turn or the last, that `a` perceived */
const shotAt = (state: GameState, a: Actor, foes: Actor[]) => [...(state.recentEvents ?? []), ...state.events].reverse()
  .find((e) => e.kind === 'attack' && e.ranged && e.target === a.id && e.turn >= state.turn - 1 && e.perception[a.id] && foes.some((f) => f.id === e.actorId));

/** F1: the foe that shot at `a` from beyond its striking reach this turn or the last, if it can still see `a` */
function shooterOf(state: GameState, a: Actor, foes: Actor[]): Actor | undefined {
  const shot = shotAt(state, a, foes);
  const s = shot && foes.find((f) => f.id === shot.actorId);
  return s && distM(state, s, a) > hostileNearM(state, s) && seeingM(state, s, a) !== null ? s : undefined;
}

/** TC18 a, TC25 a: the Fieldcraft walks, only while no foe is near enough to strike `a` (a walk off would leave a fight) */
function fieldWalks(state: GameState, a: Actor, view: ActorView, rows: string[], foes: Actor[], out: TacticsView): void {
  if (!foes.length || foes.some((f) => distM(state, f, a) <= hostileNearM(state, f))) return;
  const near = oneMoveZones(state, a);
  if (!near.length) return;
  const walk = (n: Near | undefined): TacticsWalk | undefined => (n ? { zone: n.zone, via: n.via } : undefined);
  const shooter = rows.includes(FX.out_of_sight) ? shooterOf(state, a, foes) : undefined;
  if (shooter) out.outOfSight = walk(near.find((n) => seeingM(state, shooter, { zone: n.zone, pos: n.pos }) === null));
  // PC5: cover is the clutter where one stands (plan/clutter), not a word on the title
  const coverAt = (zone: string, pos?: Pos) => { const z = zoneById(state, zone); return COVER.pos(z ? clutterCover(state, z, pos) : 'none'); };
  const coverHere = coverAt(a.zone, a.pos);
  if (rows.includes(FX.into_cover) && foes.some((f) => showsRanged(state, view, f)))
    out.intoCover = walk(near.find((n) => coverAt(n.zone, n.pos) > coverHere));
  const lightHere = LIGHT.pos(zoneLight(state, zoneById(state, a.zone), a.pos));
  // TC25 a: it judges by its own eyes only: from there it still sees every foe it fights clearly. The title it goes to is
  // judged by its light as a whole (its dimmest, plan/light zoneLight), not at the doorway, where the light it left spills in
  if (rows.includes(FX.into_dark))
    out.intoDark = walk(near.find((n) => LIGHT.pos(zoneLight(state, zoneById(state, n.zone))) > lightHere
      && foes.every((f) => !isDark(zoneLight(state, zoneById(state, f.zone), f.pos)) && sightLevel('normal', seeingM(state, { zone: n.zone, pos: n.pos }, f)) === 'full')));
  for (const k of ['outOfSight', 'intoCover', 'intoDark'] as const) if (!out[k]) delete out[k];
}

/** B3: shot at, with no shield in hand and enough free hands, the working shield it carries stowed on it */
function shieldToReady(state: GameState, a: Actor, foes: Actor[]): string | undefined {
  if (canBlock(state, a) || !shotAt(state, a, foes)) return undefined;
  const free = freeGrips(state, a).length;
  return a.core.inventory.find((i) => {
    const d = itemDef(state, i.itemId);
    return !!d.shield && !isHeld(i) && !i.equippedIn?.length && working(poolState(i.pools?.shield ?? 100)) && free >= (d.grips ?? 1);
  })?.id;
}

/** S3 (TC50 a): while a feint is on, the believer that came within one move with no other foe within one move of it is
 * turned on, else it keeps running; with none on, it may start one once a fight when outnumbered and not Wounded */
function feintFacts(state: GameState, a: Actor, foes: Actor[], out: TacticsView): void {
  const oneMove = turnMetres(state, a, 'move');
  if (feinting(state, a)) {
    const lone = foes.filter((f) => a.feint!.believers.includes(f.id) && distM(state, f, a) <= oneMove && !foes.some((g) => g !== f && distM(state, g, f) <= oneMove))
      .sort((x, y) => distM(state, x, a) - distM(state, y, a) || x.id.localeCompare(y.id))[0];
    if (lone) out.turnOn = lone.id;
    else out.feint = 'run';
  } else if (!a.feint && out.outnumbered && !rowUsedThisFight(a, FX.feigned_flight) && HEALTH_LEVELS.pos(healthLevel(a)) < HEALTH_LEVELS.pos('wounded')) out.feint = 'start';
}

/** D-17: the TacticsView for `a`, from its own view's seen list; undefined when it may use no row */
export function tacticsView(state: GameState, a: Actor, view: ActorView): TacticsView | undefined {
  const rows = rowsOf(state, a);
  if (!rows.length) return undefined;
  const seenIds = new Set((view.seen ?? []).map((s) => s.id)); // a hand-made view in a test may leave seen out
  const seen = allActors(state).filter((x) => x !== a && seenIds.has(x.id) && countsInFight(x));
  const fights = (x: Actor, y: Actor) => fightingWith(state, x, y) || fightingWith(state, y, x);
  const foes = seen.filter((x) => fights(a, x));
  // its side: anyone not hostile to it who fights one of its foes (the fight sides the held-the-line count uses)
  const allies = seen.filter((x) => !hostile(state, x, a) && !hostile(state, a, x) && foes.some((f) => fights(x, f)));
  const out: TacticsView = { rows };
  if (foes.length > allies.length + 1) out.outnumbered = true;
  if (rowUsedThisFight(a, FX.call_help)) out.calledHelp = true;
  if (rows.includes(FX.feigned_flight)) feintFacts(state, a, foes, out);
  if (rows.includes(FX.ready_shield)) { const sh = shieldToReady(state, a, foes); if (sh) out.readyShield = sh; }
  const at = (x: Actor) => distM(state, { zone: a.zone, ...(a.pos ? { pos: a.pos } : {}) }, { zone: x.zone, ...(x.pos ? { pos: x.pos } : {}) });
  if (rows.includes(FX.gang_up)) {
    const oneMove = turnMetres(state, a, 'move');
    const ganged = foes.filter((f) => allies.some((y) => fights(y, f)) && at(f) <= oneMove).sort((x, y) => at(x) - at(y) || x.id.localeCompare(y.id))[0];
    if (ganged) out.allyFoe = ganged.id;
  }
  if (rows.includes(FX.back_off) || rows.includes(FX.draw_into_pack)) {
    const free = seen.filter((x) => x.bandId === a.bandId && !hostile(state, x, a) && !allActors(state).some((o) => o !== x && fights(x, o)))
      .sort((x, y) => at(x) - at(y) || x.id.localeCompare(y.id))[0];
    if (free && rows.includes(FX.back_off)) out.freeAlly = { id: free.id, zone: free.zone };
    // TC23 a S1: it fights one foe with no one on its side, and that bandmate stands too far to strike the foe when it follows
    if (free && rows.includes(FX.draw_into_pack) && foes.length === 1 && !allies.length && at(free) > hostileNearM(state, free)) out.drawTo = { id: free.id, zone: free.zone };
  }
  if (rows.some((r) => r === FX.out_of_sight || r === FX.into_cover || r === FX.into_dark)) fieldWalks(state, a, view, rows, foes, out);
  if (rows.includes(FX.finish_hurt) && foes.length >= 2) {
    // only a hurt it can see: others' health shows from CONFIG.HEALTH_SHOWN_FROM down (SeenActor.health)
    const hurt = (view.seen ?? []).filter((s) => s.health && foes.some((f) => f.id === s.id))
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
