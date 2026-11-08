// Perks that leave a short-lived mark (Ali, 07/11/2026; rules in src/library/perks.ts). attack() reads marks without
// changing state; this module makes and clears them after each attack, and clears them when they run out.
//   Turn the Blade (A2): a clean block (gap +2 or better) with a melee weapon opens the attacker to the owner's next melee attack.
//   Hunter's Mark (A5): a ranged hit marks the target for the owner's next ranged attack.
//   Make Them Stumble (A10): a clean dodge of a melee attack makes the attacker's next defense one tier worse.
//   Leg Bolt (A6): a medium or heavy ranged hit that wounds a leg slows the target (no dash) until the end of its next turn.
//   Dirt in the Eyes (A9): the foe's next attack or defense roll (they need sight) is two tiers worse (perkMoves.ts makes it).
//   Set Them Up (B15): a Strike attack, hit or miss, marks the target for the owner's next improvised attack on it, and an
//   improvised attack marks it for the owner's next Strike.
// The two openings last until used or the owner's engagement ends; the stumble, slow and dirt until the end of the
// marked actor's next turn.
import type { Actor, AttackResult, GameState } from '../types';
import { itemDef } from '../library';
import { hasPerk } from '../ruleset/perks';
import { blockItem, canBlock, effectiveSkill } from '../ruleset/gear';
import { allActors, isActive, stance } from './relations';

const HITS = new Set(['grazed', 'blocked', 'full_hit', 'heavy_hit', 'crushing_hit']);
export const MARK_SOURCE: Record<string, string> = { set_them_up: 'Set Them Up', turn_the_blade: 'Turn the Blade', hunters_mark: 'Hunter’s Mark', make_them_stumble: 'Make Them Stumble', leg_bolt: 'Leg Bolt', dirt_in_the_eyes: 'Dirt in the Eyes' };

const drop = (a: Actor, f: (m: NonNullable<Actor['perkMarks']>[number]) => boolean) => {
  if (!a.perkMarks) return;
  a.perkMarks = a.perkMarks.filter((m) => !f(m));
  if (!a.perkMarks.length) delete a.perkMarks;
};
const add = (a: Actor, m: NonNullable<Actor['perkMarks']>[number]) => {
  drop(a, (x) => x.perk === m.perk && x.target === m.target);
  (a.perkMarks ??= []).push(m);
};

/** attack shifts from marks (read only): the attacker's opening on the target, the defender's stumble */
/** B15 Set Them Up: the mark a Strike or improvised attack leaves, and the one it uses (the other skill's) */
const SET_UP: Record<string, { leaves: string; uses: string }> = {
  unarmed_strike: { leaves: 'set_up:unarmed_improvised', uses: 'set_up:unarmed_strike' },
  unarmed_improvised: { leaves: 'set_up:unarmed_strike', uses: 'set_up:unarmed_improvised' },
};
export function markShifts(state: GameState, A: Actor, D: Actor, ranged: boolean, skill?: string) {
  const has = (a: Actor, perk: string, target?: string) => !!a.perkMarks?.some((m) => m.perk === perk && m.target === target && (m.until === undefined || m.until >= state.turn));
  const open = ranged ? 'hunters_mark' : 'turn_the_blade';
  const dirt = [{ source: MARK_SOURCE.dirt_in_the_eyes, value: -2 }];
  return {
    attack: [...(has(A, open, D.id) ? [{ source: MARK_SOURCE[open], value: 1 }] : []), ...(has(A, 'dirt_in_the_eyes') ? dirt : []),
      ...(skill && SET_UP[skill] && has(A, SET_UP[skill].uses, D.id) ? [{ source: MARK_SOURCE.set_them_up, value: 1 }] : [])],
    defense: [...(has(D, 'make_them_stumble') ? [{ source: MARK_SOURCE.make_them_stumble, value: -1 }] : []), ...(has(D, 'dirt_in_the_eyes') ? dirt : [])],
  };
}

/** A6 Leg Bolt: slowed actors can't dash */
export const slowed = (state: GameState, a: Actor) => !!a.perkMarks?.some((m) => m.perk === 'leg_bolt' && (m.until === undefined || m.until >= state.turn));

/** a mark that runs out at the end of the marked actor's next turn */
export function markUntilNextTurn(state: GameState, a: Actor, perk: string): void {
  add(a, { perk, until: state.turn + 1 });
}

/** after an attack resolves: spend the marks it used, then make the ones it earned */
export function afterAttack(state: GameState, A: Actor, D: Actor, r: AttackResult, ranged: boolean, skill?: string): void {
  const used = (src: string, shifts?: { source: string }[]) => !!shifts?.some((x) => x.source === src);
  for (const perk of ['turn_the_blade', 'hunters_mark']) if (used(MARK_SOURCE[perk], r.attack.tierShifts)) drop(A, (m) => m.perk === perk && m.target === D.id);
  if (used(MARK_SOURCE.make_them_stumble, r.defense?.tierShifts)) drop(D, (m) => m.perk === 'make_them_stumble');
  if (used(MARK_SOURCE.dirt_in_the_eyes, r.attack.tierShifts)) drop(A, (m) => m.perk === 'dirt_in_the_eyes');
  if (used(MARK_SOURCE.dirt_in_the_eyes, r.defense?.tierShifts)) drop(D, (m) => m.perk === 'dirt_in_the_eyes');
  const setUp = skill ? SET_UP[skill] : undefined;
  if (setUp && used(MARK_SOURCE.set_them_up, r.attack.tierShifts)) drop(A, (m) => m.perk === setUp.uses && m.target === D.id);
  if (setUp && hasPerk(A, 'set_them_up')) add(A, { perk: setUp.leaves, target: D.id }); // on the attempt, hit or miss (Ali)
  if (r.legBolt && hasPerk(A, 'leg_bolt')) markUntilNextTurn(state, D, 'leg_bolt');
  const clean = r.gap !== null && r.gap >= 2;
  if (!ranged && clean && r.defenseType === 'block' && hasPerk(D, 'turn_the_blade')) {
    const blocker = blockItem(state, D); // what the block was made with
    if (blocker && !itemDef(state, blocker.itemId).shield) add(D, { perk: 'turn_the_blade', target: A.id });
  }
  if (ranged && HITS.has(r.outcome) && hasPerk(A, 'hunters_mark')) add(A, { perk: 'hunters_mark', target: D.id });
  if (!ranged && clean && r.defenseType === 'dodge' && hasPerk(D, 'make_them_stumble')) add(A, { perk: 'make_them_stumble', until: state.turn + 1 });
}

/** each turn: stumbles run out; an actor whose engagement ended loses its openings */
export function expireMarks(state: GameState, a: Actor): void {
  drop(a, (m) => (m.until !== undefined && m.until < state.turn) || (!a.engagement && (m.perk === 'turn_the_blade' || m.perk === 'hunters_mark' || m.perk.startsWith('set_up:'))));
}

/** Cover Ally (A11): an actor in the target's zone, friendly to it, with the perk switched on, standing on block and able
 * to block, whose block beats the target's own standing defense, takes a ranged attack in the target's place. */
export function coverFor(state: GameState, target: Actor): Actor | undefined {
  const own = (a: Actor) => effectiveSkill(state, a, a.core.standingDefense, a.core.standingDefense === 'block' ? { itemId: blockItem(state, a)?.id } : {}).value;
  const mine = own(target);
  return allActors(state).filter((c) => c !== target && c.zone === target.zone && isActive(c) && hasPerk(c, 'cover_ally') && !c.core.perksOff?.includes('cover_ally')
    && stance(state, c, target) === 'friendly' && c.core.standingDefense === 'block' && canBlock(state, c) && own(c) > mine)
    .sort((x, y) => own(y) - own(x) || (x.id < y.id ? -1 : 1))[0];
}
