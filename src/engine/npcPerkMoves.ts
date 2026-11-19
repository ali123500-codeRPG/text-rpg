// TC53-TC59 a: when a code-run NPC uses the perk moves it owns. mergeOrders hands every order the code-run fight list made
// (fallbackOrder) to codePerkMove, which may add one perk move or, for a main-action move, turn the order into a hold
// that keeps its walk. One move a turn, first that fits:
//   Play Dead (TC58 a): the window is open (a blow left it Wounded or worse) and it is at CONFIG.PLAY_DEAD_AT or worse, or
//     CONFIG.PLAY_DEAD_FOES foes or more are within one move of it. A broken one can still do it (routines.ts
//     NERVE_ALLOWED_PERK_MOVES).
//   Rally (TC55 a): an ally it would reach (auras.ts rallyWouldReach) is at CONFIG.RALLY_AT or worse.
//   Battle Cry (TC54 a): the fight's first turn, a foe in sight and none within melee reach: it roars while it closes in.
//   Dirt in the Eyes (TC53 a): its first melee attack of the fight, at that foe, with a free hand.
//   Bluff (TC57 a): at each foe the first time it comes within melee reach (once per foe).
//   Draw Them In (TC56 a): the fight's first turn, a foe in sight and none within melee reach, unless it backs off or flees.
// Getting up (TC59 a): while it plays dead it lies still until no foe that saw through it is in sight and no believer is
// within one move, then sneaks away (the flee way: routines.ts fleeOrder); with no way away it stays down.
// "The fight's first turn": the turn its engagement begins, or the one after (an engagement begins when the turn's
// events are counted, so the first order of a fight can come before it or just after); each move is once a fight anyway.
// "Within melee reach": near enough to strike with a step (gear.ts hostileNearM), as the fight rows judge it.
import type { Actor, ActorView, GameState, Order } from '../types';
import { CONFIG } from '../config';
import { PK } from '../library/perkIds';
import { FX } from '../library/tableIds';
import { MORALE_LEVELS, type MoraleLevel } from '../scales';
import { moraleLevel } from '../ruleset/morale';
import { hostileNearM } from '../ruleset/gear';
import { actorById, allActors, countsInFight, foe, isActive } from './relations';
import { distM } from './position';
import { slotMetres } from './speed';
import { perkMoveBlock } from './perkMoves';
import { rallyWouldReach } from './auras';
import { fleeOrder } from '../minds';

/** what a code-run NPC may use: the move is owned and nothing blocks it now */
const can = (state: GameState, a: Actor, perk: string, target: string | null = null): boolean => perkMoveBlock(state, a, perk, target) === null;
const atOrWorse = (a: Actor, level: MoraleLevel): boolean => MORALE_LEVELS.pos(moraleLevel(a)) >= MORALE_LEVELS.pos(level);
const fightStart = (state: GameState, a: Actor): boolean => !a.engagement || state.turn - a.engagement.start <= 1;
/** the foes it sees, nearest first */
function seenFoes(state: GameState, a: Actor, view: ActorView): Actor[] {
  const seen = new Set((view.seen ?? []).map((s) => s.id));
  return allActors(state).filter((x) => x !== a && seen.has(x.id) && isActive(x) && countsInFight(x) && (foe(state, a, x) || foe(state, x, a)))
    .sort((x, y) => distM(state, x, a) - distM(state, y, a) || x.id.localeCompare(y.id));
}
/** a foe near enough to strike `a` with a step */
const inMelee = (state: GameState, f: Actor, a: Actor): boolean => distM(state, f, a) <= hostileNearM(state, f);

/** a walk or flight away from the fight: no time to draw anyone in (TC56 a) */
const AWAY_RULES: readonly string[] = [FX.back_off, FX.draw_into_pack, FX.feigned_flight];
const goingAway = (o: Order): boolean => o.type === 'flee' || (!!o.rule && AWAY_RULES.includes(o.rule)) || o.intent.startsWith('fall back');

/** a main-action move takes the turn's action: the order becomes a hold that keeps its walk toward the fight (an attack's
 * walk to its target, a close-in's step); null for an order that is not a fight or a closing in */
function asMainAction(state: GameState, o: Order, perk: string, intent: string): Order | null {
  const keep = { actorId: o.actorId, type: 'hold' as const, target: null, skill: null, intent, source: o.source, perkMove: { perk, target: null }, ...(o.line ? { line: o.line } : {}) };
  if (o.type === 'attack' && o.target) {
    const t = actorById(state, o.target);
    return { ...keep, ...(t ? { move: t.zone, moveSpot: { near: t.id } } : {}) };
  }
  if (o.type === 'move' && o.target) return { ...keep, move: o.target };
  if (o.type === 'hold' || o.type === 'search' || o.type === 'idle') return { ...keep, ...(o.move ? { move: o.move } : {}), ...(o.moveSpot ? { moveSpot: o.moveSpot } : {}) };
  return null;
}

/** TC59 a: lying still, or sneaking away once no one who saw through it is in sight and no believer is within one move */
function getUp(state: GameState, a: Actor, view: ActorView, o: Order): Order {
  const lie: Order = { actorId: a.id, type: 'hold', target: null, skill: null, intent: 'lies still', source: o.source };
  const believers = a.playingDead!.believers, oneMove = slotMetres(state, a, 'move');
  const foes = seenFoes(state, a, view);
  if (foes.some((f) => !believers.includes(f.id) || distM(state, f, a) <= oneMove)) return lie;
  const away = fleeOrder(view, o.source);
  const zone = away.type === 'flee' ? away.target : away.move;
  return zone ? { actorId: a.id, type: 'sneak', target: zone, skill: null, intent: 'slip away', source: o.source } : lie;
}

/** TC53-TC59 a: the order a code-run NPC gives once its perk moves are weighed (see the file head) */
export function codePerkMove(state: GameState, a: Actor, view: ActorView, o: Order): Order {
  if (a.playingDead) return getUp(state, a, view, o);
  if (o.perkMove) return o;
  const foes = seenFoes(state, a, view);
  const oneMove = slotMetres(state, a, 'move');
  if (can(state, a, PK.play_dead) && (atOrWorse(a, CONFIG.PLAY_DEAD_AT) || foes.filter((f) => distM(state, f, a) <= oneMove).length >= CONFIG.PLAY_DEAD_FOES))
    return { actorId: a.id, type: 'hold', target: null, skill: null, intent: 'play dead', source: o.source, perkMove: { perk: PK.play_dead, target: null } };
  if (view.self.broken) return o; // only Play Dead (and Battle Cry, never chosen here once the fight is on) survives a broken nerve
  if (can(state, a, PK.rally) && allActors(state).some((t) => rallyWouldReach(state, a, t) && atOrWorse(t, CONFIG.RALLY_AT))) {
    const r = asMainAction(state, o, PK.rally, 'rally');
    if (r) return r;
  }
  const opening = fightStart(state, a) && foes.length > 0 && !foes.some((f) => inMelee(state, f, a));
  if (opening && can(state, a, PK.battle_cry)) {
    const r = asMainAction(state, o, PK.battle_cry, 'battle cry');
    if (r) return r;
  }
  if (o.type === 'attack' && o.target) {
    const t = foes.find((f) => f.id === o.target);
    if (t && distM(state, t, a) <= hostileNearM(state, a) && can(state, a, PK.dirt_in_the_eyes, t.id)) return { ...o, perkMove: { perk: PK.dirt_in_the_eyes, target: t.id } };
  }
  const fresh = foes.find((f) => inMelee(state, f, a) && can(state, a, PK.bluff, f.id));
  if (fresh) return { ...o, perkMove: { perk: PK.bluff, target: fresh.id } };
  if (opening && !goingAway(o) && can(state, a, PK.draw_them_in)) return { ...o, perkMove: { perk: PK.draw_them_in, target: null } };
  return o;
}
