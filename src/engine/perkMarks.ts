// Perks that leave a short-lived mark (rules in src/library/perks.ts). attack() reads marks without
// changing state; this module makes and clears them after each attack, and clears them when they run out.
//   Turn the Blade (A2): a clean parry (gap CLEAN_GAP or better) with a melee weapon opens the attacker to the owner's next melee attack.
//   Hunter's Mark (A5): a ranged hit marks the target for the owner's next ranged attack.
//   Make Them Stumble (A10): a clean dodge of a melee attack makes the attacker's next defense one tier worse.
//   Leg Bolt (A6): a medium or heavy ranged hit that wounds a leg slows the target (no dash) for PERK_MARK_ROUNDS rounds.
//   Dirt in the Eyes (A9): the foe's next attack or defense roll (they need sight) is two tiers worse (perkMoves.ts makes it).
//   Bluff (LI1c): a foe that believed the bluff hesitates: its next turn starts after its reaction time again (perkMoves.ts
//   makes it, resolve.ts initiativeOrder reads and spends it).
//   Press the Opening (TC28 a): an ally's hit on a foe opens it to the owner's next attack, until the owner's next turn ends.
//   Draw Them In (TC31 a): a drawn foe comes at the owner on its next turn, and the owner's next attack on it is +1 tier.
//   Hug the Cover (TC30 a): marks the turn the owner took its first ranged attack (the shift is in ruleset attack()).
//   Set Them Up (B15): a Strike attack, hit or miss, marks the target for the owner's next improvised attack on it, and an
//   improvised attack marks it for the owner's next Strike.
// The two openings last until used or the owner's engagement ends; the stumble, slow and dirt PERK_MARK_ROUNDS rounds of
// game time from the turn they were made (AT74).
import type { Actor, AttackResult, GameState, PerkMark } from '../types';
import { hasPerk } from '../ruleset/perks';
import { canBlock, defenseItem, effectiveSkill, parryItem, usableDefense } from '../ruleset/gear';
import { allActors, foe, isActive, stance, warm } from './relations';
import { SK, DEFENSE_SKILL } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { met } from '../ruleset/hits';
import { withinGrip } from './position';
import { CONFIG } from '../config';
import { secondsSince } from '../time';

/** AT74: a timed mark lasts PERK_MARK_ROUNDS rounds from the turn it was made; one with no stamp lasts until used */
const live = (state: GameState, m: PerkMark): boolean => m.made === undefined || secondsSince(state, m.made) < CONFIG.PERK_MARK_ROUNDS * CONFIG.ROUND_S;

export const MARK_SOURCE: Record<string, string> = { [PK.draw_them_in]: 'Draw Them In', [PK.press_the_opening]: 'Press the Opening', [PK.hug_the_cover]: 'Hug the Cover', [PK.set_them_up]: 'Set Them Up', [PK.turn_the_blade]: 'Turn the Blade', [PK.hunters_mark]: 'Hunter’s Mark', [PK.make_them_stumble]: 'Make Them Stumble', [PK.leg_bolt]: 'Leg Bolt', [PK.dirt_in_the_eyes]: 'Dirt in the Eyes' };

const drop = (a: Actor, f: (m: NonNullable<Actor['perkMarks']>[number]) => boolean) => {
  if (!a.perkMarks) return;
  a.perkMarks = a.perkMarks.filter((m) => !f(m));
  if (!a.perkMarks.length) delete a.perkMarks;
};
const add = (a: Actor, m: NonNullable<Actor['perkMarks']>[number]) => {
  drop(a, (x) => x.perk === m.perk && x.target === m.target);
  (a.perkMarks ??= []).push(m);
};

/** B15 Set Them Up: the mark a Strike or improvised attack leaves, and the one it uses (the other skill's) */
const SET_UP: Record<string, { leaves: string; uses: string }> = {
  [SK.unarmed_strike]: { leaves: 'set_up:unarmed_improvised', uses: 'set_up:unarmed_strike' },
  [SK.unarmed_improvised]: { leaves: 'set_up:unarmed_strike', uses: 'set_up:unarmed_improvised' },
};
/** attack shifts from marks (read only): the attacker's opening on the target, the defender's stumble */
export function markShifts(state: GameState, A: Actor, D: Actor, ranged: boolean, skill?: string) {
  const mark = (a: Actor, perk: string, target?: string) => a.perkMarks?.find((m) => m.perk === perk && m.target === target && live(state, m));
  const has = (a: Actor, perk: string, target?: string) => !!mark(a, perk, target);
  const open = ranged ? PK.hunters_mark : PK.turn_the_blade;
  const dirt = [{ source: MARK_SOURCE[PK.dirt_in_the_eyes], value: -2 }];
  return {
    attack: [...(has(A, open, D.id) ? [{ source: MARK_SOURCE[open], value: 1 }] : []), ...(has(A, PK.press_the_opening, D.id) ? [{ source: MARK_SOURCE[PK.press_the_opening], value: 1 }] : []), ...(has(A, PK.draw_them_in, D.id) ? [{ source: MARK_SOURCE[PK.draw_them_in], value: 1 }] : []), ...(has(A, PK.dirt_in_the_eyes) ? dirt : []),
      ...(skill && SET_UP[skill] && has(A, SET_UP[skill].uses, D.id) ? [{ source: MARK_SOURCE[PK.set_them_up], value: mark(A, SET_UP[skill].uses, D.id)?.value ?? 1 }] : [])],
    defense: [...(has(D, PK.make_them_stumble) ? [{ source: MARK_SOURCE[PK.make_them_stumble], value: -1 }] : []), ...(has(D, PK.dirt_in_the_eyes) ? dirt : [])],
  };
}

/** TC31 a Draw Them In: the mark a drawn foe carries (the owner it comes at), spent by its next turn's order */
const DRAWN = 'drawn_in';
/** the owner gets an opening on the drawn foe (until used or the engagement ends); the foe comes at the owner next turn */
export function drawIn(state: GameState, owner: Actor, x: Actor): void {
  add(owner, { perk: PK.draw_them_in, target: x.id });
  add(x, { perk: DRAWN, target: owner.id, made: state.turn });
}
/** whom a drawn foe comes at this turn, if it is still drawn */
export const drawnTo = (state: GameState, x: Actor): string | undefined => x.perkMarks?.find((m) => m.perk === DRAWN && live(state, m))?.target;
/** the drawn foe has spent its turn coming at the owner */
export const spendDrawn = (x: Actor): void => drop(x, (m) => m.perk === DRAWN);
/** WN13 a: x saw through the false opening after all: it is not drawn, and the owner has no opening on it */
export function undraw(owner: Actor, x: Actor): void {
  spendDrawn(x);
  drop(owner, (m) => m.perk === PK.draw_them_in && m.target === x.id);
}

/** TC30 a Hug the Cover: the owner's first ranged attack taken this turn (the mark says one was already taken) */
export const hugReady = (state: GameState, D: Actor): boolean => hasPerk(D, PK.hug_the_cover) && !D.perkMarks?.some((m) => m.perk === PK.hug_the_cover && m.made === state.turn);

/** LI1c Bluff: the actor believed a bluff and hesitates (AT60) */
export const bluffed = (state: GameState, a: Actor) => !!a.perkMarks?.some((m) => m.perk === PK.bluff && m.made !== undefined && live(state, m));
/** AT60: the hesitation is spent once waited out */
export const spendBluff = (a: Actor): void => drop(a, (m) => m.perk === PK.bluff);
/** WN13 a: x still hesitates at `by`'s bluff */
export const bluffedBy = (state: GameState, x: Actor, by: string): boolean => !!x.perkMarks?.some((m) => m.perk === PK.bluff && m.target === by && m.made !== undefined && live(state, m));
/** Dirt in the Eyes is spoiling this actor's sight right now */
const blinded = (state: GameState, a: Actor) => !!a.perkMarks?.some((m) => m.perk === PK.dirt_in_the_eyes && live(state, m));
/** LR3 Blind Spot: the owner may Melt Away with no cover or shade while a foe's sight is spoiled by Dirt in the Eyes */
export const blindSpotNow = (state: GameState, a: Actor): boolean =>
  hasPerk(a, PK.blind_spot) && allActors(state).some((x) => x !== a && isActive(x) && foe(state, x, a) && blinded(state, x));
/** A6 Leg Bolt: slowed actors can't dash */
export const slowed = (state: GameState, a: Actor) => !!a.perkMarks?.some((m) => m.perk === PK.leg_bolt && live(state, m));

/** a mark that runs out PERK_MARK_ROUNDS rounds from now (AT74) */
export function markForRounds(state: GameState, a: Actor, perk: string, by?: string): void {
  add(a, { perk, made: state.turn, ...(by ? { target: by } : {}) }); // by: who left it (Bluff: who bluffed, WN13)
}

/** x counts A as a friend: its own stance, or for the player (who holds no stances) A's stance toward it */
const friends = (state: GameState, x: Actor, A: Actor): boolean => warm(stance(state, x, A)) || (x.kind === 'player' && warm(stance(state, A, x)));

/** after an attack resolves: spend the marks it used, then make the ones it earned */
export function afterAttack(state: GameState, A: Actor, D: Actor, r: AttackResult, ranged: boolean, skill?: string, oneTwo = false): void {
  const used = (src: string, shifts?: { source: string }[]) => !!shifts?.some((x) => x.source === src);
  for (const perk of [PK.turn_the_blade, PK.hunters_mark]) if (used(MARK_SOURCE[perk], r.attack.tierShifts)) drop(A, (m) => m.perk === perk && m.target === D.id);
  if (used(MARK_SOURCE[PK.make_them_stumble], r.defense?.tierShifts)) drop(D, (m) => m.perk === PK.make_them_stumble);
  if (used(MARK_SOURCE[PK.press_the_opening], r.attack.tierShifts)) drop(A, (m) => m.perk === PK.press_the_opening && m.target === D.id);
  if (used(MARK_SOURCE[PK.draw_them_in], r.attack.tierShifts)) drop(A, (m) => m.perk === PK.draw_them_in && m.target === D.id);
  if (ranged && hasPerk(D, PK.hug_the_cover)) add(D, { perk: PK.hug_the_cover, made: state.turn }); // TC30 a: the first ranged attack this turn is taken
  // TC28 a Press the Opening: a hit opens the foe to the attacker's friends who own the perk, until their next turn ends
  if (met(r.outcome)) for (const x of allActors(state)) {
    if (x !== A && x !== D && isActive(x) && hasPerk(x, PK.press_the_opening) && friends(state, x, A) && (foe(state, x, D) || foe(state, D, x))) add(x, { perk: PK.press_the_opening, target: D.id, made: state.turn });
  }
  if (used(MARK_SOURCE[PK.dirt_in_the_eyes], r.attack.tierShifts)) drop(A, (m) => m.perk === PK.dirt_in_the_eyes);
  if (used(MARK_SOURCE[PK.dirt_in_the_eyes], r.defense?.tierShifts)) drop(D, (m) => m.perk === PK.dirt_in_the_eyes);
  const setUp = skill ? SET_UP[skill] : undefined;
  if (setUp && used(MARK_SOURCE[PK.set_them_up], r.attack.tierShifts)) drop(A, (m) => m.perk === setUp.uses && m.target === D.id);
  // on the attempt, hit or miss; LR2 Combination: One-Two's free Strike leaves a +2 mark
  if (setUp && hasPerk(A, PK.set_them_up)) add(A, { perk: setUp.leaves, target: D.id, ...(oneTwo && hasPerk(A, PK.combination) ? { value: 2 } : {}) });
  if (r.legBolt && hasPerk(A, PK.leg_bolt)) markForRounds(state, D, PK.leg_bolt);
  const clean = r.gap !== null && r.gap >= CONFIG.CLEAN_GAP;
  // A2 Turn the Blade: a clean parry made with a weapon (not barehanded)
  if (!ranged && clean && r.defenseType === 'parry' && hasPerk(D, PK.turn_the_blade) && parryItem(state, D)) add(D, { perk: PK.turn_the_blade, target: A.id });
  if (ranged && met(r.outcome) && hasPerk(A, PK.hunters_mark)) add(A, { perk: PK.hunters_mark, target: D.id });
  if (!ranged && clean && r.defenseType === 'dodge' && hasPerk(D, PK.make_them_stumble)) add(A, { perk: PK.make_them_stumble, made: state.turn });
}

/** each turn: stumbles run out; an actor whose engagement ended loses its openings */
export function expireMarks(state: GameState, a: Actor): void {
  drop(a, (m) => !live(state, m) || (!a.engagement && (m.perk === PK.turn_the_blade || m.perk === PK.hunters_mark || m.perk === PK.draw_them_in || m.perk.startsWith('set_up:'))));
}

/** Cover Ally (A11): an actor within its own grip reach of the target (ZR2), friendly to it, with the perk switched on, standing on block and able
 * to block, whose block beats the target's own standing defense, takes a ranged attack in the target's place. With Bulwark (LR4) a melee one too. */
export function coverFor(state: GameState, target: Actor, ranged = true): Actor | undefined {
  // the target's own defense against this attack: parry can't stop a missile, so it uses its fallback
  const own = (a: Actor) => { const t = usableDefense(state, a, ranged); return effectiveSkill(state, a, DEFENSE_SKILL[t], { itemId: defenseItem(state, a, t)?.id }).value; };
  const mine = own(target);
  return allActors(state).filter((c) => c !== target && isActive(c) && withinGrip(state, c, target) && hasPerk(c, PK.cover_ally) && (ranged || hasPerk(c, PK.bulwark)) && !c.core.perksOff?.includes(PK.cover_ally)
    && warm(stance(state, c, target)) && c.core.standingDefense === 'block' && canBlock(state, c) && own(c) > mine)
    .sort((x, y) => own(y) - own(x) || (x.id < y.id ? -1 : 1))[0];
}
