// BEL-30 to BEL-34, BB7 a, BB8 a (D-1768 step 4): the order check. Who may give whom an order, whether it is the kind that
// right covers, whether it goes against a stronger tie, and how the receiver answers it. Code works it all out (BEL-34);
// a code-run character follows the verdict, an agent-run one is told it and chooses.
import type { Actor, GameState, Tie, TieEnd } from '../types';
import type { Commitment } from '../scales';
import { COMMITMENT, MORALE_LEVELS, STANCES } from '../scales';
import { ORDER_BASES, DIRECTING_LINKS, type OrderBasis, type OrderKind } from '../library/npcs';
import { CONFIG } from '../config';
import { groupChain, knownOrgs, knownTies, orgById, orgChain } from './belonging';
import { stance } from './relations';
import { moraleLevel } from '../ruleset/morale';
import { power } from './xp';
import { logCode } from './effects';

export type OrderVerdict = 'obeys' | 'letter' | 'refuses' | 'pretends';
/** what the check found: the basis it rests on (none: no right to be obeyed, BEL-31), the tie behind it, and the verdict */
export type OrderCheck = { basis?: OrderBasis; behind?: Tie; right: boolean; verdict?: OrderVerdict; why: string };
/** an order: its kind (BB7 a), whom it is against when it names someone (a target to strike), and whether it sends the
 * receiver into a fight (a Move into one) */
export type Order = { kind: OrderKind; against?: Actor; intoFight?: boolean };

const orgOf = (t: Tie) => ('org' in t.to ? t.to.org : undefined);
const seatIn = (state: GameState, a: Actor, orgId: string) => { const o = orgById(state, orgId); return !!o && (o.headId === a.id || !!o.officerIds?.includes(a.id)); };
/** a's ties to an organization, each with the organization and the ones it is a unit of */
const tiesUp = (state: GameState, a: Actor) => (a.ties ?? []).flatMap((t) => { const o = orgOf(t); return o ? [{ t, chain: orgChain(state, o).map((x) => x.id) }] : []; });

/** Command (BEL-30): g holds a seat in an organization r belongs to, in r's unit or above it. The tie behind it is r's tie
 * to that unit */
function commandTie(state: GameState, g: Actor, r: Actor): Tie | undefined {
  return tiesUp(state, r).find(({ chain }) => chain.some((o) => seatIn(state, g, o)))?.t;
}

/** Link (BEL-30): seat to seat. r holds a seat in an organization that a link puts under one g holds a seat in (or under
 * g in person): r's vassal_of or hired_by link to it. The tie behind it is r's tie to its own organization */
function linkTie(state: GameState, g: Actor, r: Actor): Tie | undefined {
  const over = (end: TieEnd) => ('person' in end ? end.person === g.id : orgChain(state, end.org).some((o) => seatIn(state, g, o.id)));
  for (const { t, chain } of tiesUp(state, r)) {
    const mine = chain.filter((o) => seatIn(state, r, o));
    if (mine.some((o) => (state.orgLinks ?? []).some((l) => (DIRECTING_LINKS as readonly string[]).includes(l.kind) && 'org' in l.a && l.a.org === o && over(l.b)))) return t;
  }
  return undefined;
}

/** Lead (BEL-30): g leads, or is an officer of, a group r is in (its own or one it sits inside). The tie behind it is r's
 * tie to g in person, or to the group's backer; a group alone carries no commitment */
function leads(state: GameState, g: Actor, r: Actor): { tie?: Tie } | undefined {
  if (!r.bandId) return undefined;
  const grp = groupChain(state, r.bandId).find((b) => b.leaderId === g.id || !!b.officerIds?.includes(g.id));
  if (!grp || g === r) return undefined;
  const to = (end: TieEnd) => (r.ties ?? []).find((t) => ('person' in end && 'person' in t.to && t.to.person === end.person) || ('org' in end && orgOf(t) !== undefined && orgChain(state, orgOf(t)!).some((o) => o.id === end.org)));
  return { tie: to({ person: g.id }) ?? (grp.backer ? to(grp.backer) : undefined) };
}

/** Ground (BEL-30): g acts for whoever holds the place r stands in or whose law runs there, as r knows g's ties: g is that
 * person, or holds a tie to them, or a known tie to that organization or a unit of it. It reaches everyone standing there */
function onGround(state: GameState, g: Actor, r: Actor): boolean {
  const forEnd = (end: TieEnd) => 'person' in end
    ? end.person === g.id || knownTies(state, r, g).some((t) => 'person' in t.to && t.to.person === end.person)
    : knownOrgs(state, r, g).includes(end.org) || seatIn(state, g, end.org);
  for (let p = state.places.find((x) => x.id === r.placeId), n = 0; p && n < 64; p = state.places.find((x) => x.id === p!.parentId), n++) {
    if ((p.holder && forEnd(p.holder)) || (p.law && forEnd(p.law))) return true;
  }
  return false;
}

/** BEL-32 step 2: every basis r believes g holds over it, strongest first, each with the tie behind it */
export function orderBases(state: GameState, g: Actor, r: Actor): { basis: OrderBasis; tie?: Tie }[] {
  if (g === r) return [];
  const out: { basis: OrderBasis; tie?: Tie }[] = [];
  const c = commandTie(state, g, r);
  if (c) out.push({ basis: 'command', tie: c });
  const l = linkTie(state, g, r);
  if (l) out.push({ basis: 'link', tie: l });
  const ld = leads(state, g, r);
  if (ld) out.push({ basis: 'lead', ...(ld.tie ? { tie: ld.tie } : {}) });
  if (onGround(state, g, r)) out.push({ basis: 'ground' });
  return out;
}

/** BEL-32 step 3, BB7 a: the strongest basis that covers this kind of order */
export function orderRight(state: GameState, g: Actor, r: Actor, kind: OrderKind): { basis: OrderBasis; tie?: Tie } | undefined {
  return orderBases(state, g, r).find((b) => (ORDER_BASES.find((x) => x.id === b.basis)!.covers as readonly OrderKind[]).includes(kind));
}

const cpos = (c: Commitment | undefined) => (c ? COMMITMENT.pos(c) : -1);

/** BEL-32 step 4: a tie of r's with a higher commitment than the one behind the order, to the one the order is against or
 * to an organization r knows them to be in */
function clashing(state: GameState, r: Actor, behind: Tie | undefined, against: Actor | undefined): Tie | undefined {
  if (!against || against === r) return undefined;
  const theirs = new Set(knownOrgs(state, r, against));
  return (r.ties ?? []).find((t) => t !== behind && cpos(t.commitment) > cpos(behind?.commitment)
    && (('person' in t.to && t.to.person === against.id) || (orgOf(t) !== undefined && theirs.has(orgOf(t)!))));
}

/** BEL-32, BEL-33, BB8 a: the whole check of an order from g to r (step 1, that r heard it, is the caller's). First match
 * wins in the will step: pretends, refuses openly, obeys the letter, obeys */
export function checkOrder(state: GameState, g: Actor, r: Actor, order: Order): OrderCheck {
  const right = orderRight(state, g, r, order.kind);
  if (!right) return { right: false, why: 'no basis covers this order' };
  const { basis, tie } = right;
  const base = { basis, ...(tie ? { behind: tie } : {}) };
  const clash = clashing(state, r, tie, order.against);
  // BEL-33: only a feigned tie, or a secret tie of higher commitment, leads to pretends
  if (tie?.commitment === 'feigned') return { ...base, right: true, verdict: 'pretends', why: 'its tie is feigned' };
  if (clash?.cover === 'secret') return { ...base, right: true, verdict: 'pretends', why: 'a secret tie of higher commitment' };
  if (clash) return { ...base, right: false, why: 'it goes against a tie of higher commitment' };
  const danger = order.kind === 'fight' || (order.kind === 'move' && !!order.intoFight);
  if (danger && MORALE_LEVELS.pos(moraleLevel(r)) >= MORALE_LEVELS.pos('afraid')) return { ...base, right: true, verdict: 'refuses', why: 'too afraid' };
  const st = stance(state, r, g), regard = st === 'yielded' ? 'neutral' : st; // a yield is no regard of its own
  if (STANCES.pos(regard) <= STANCES.pos('opposed')) return { ...base, right: true, verdict: 'refuses', why: 'its regard for the giver' };
  const gp = power(state, g);
  if (tie?.commitment !== 'devoted' && gp > 0 && power(state, r) >= CONFIG.ORDER_DEFY_POWER * gp) return { ...base, right: true, verdict: 'refuses', why: 'far stronger than the giver' };
  if (tie?.commitment === 'bound' || regard === 'unfriendly' || basis === 'ground') return { ...base, right: true, verdict: 'letter', why: basis === 'ground' ? 'no tie to the giver' : tie?.commitment === 'bound' ? 'bound only' : 'its regard for the giver' };
  return { ...base, right: true, verdict: 'obeys', why: 'its duty' };
}

const BASIS_WORDS: Record<OrderBasis, string> = {
  command: 'they hold a seat over you in your organization',
  link: 'their organization directs yours',
  lead: 'they lead your group',
  ground: 'they act for whoever holds this place or gives its law',
};
const VERDICT_WORDS: Record<OrderVerdict, string> = {
  obeys: 'you obey it',
  letter: 'you obey only its letter, doing the least that counts',
  refuses: 'you refuse it openly',
  pretends: 'you seem to obey it and do otherwise',
};

/** BEL-34, BB7 a: the line an addressed listener's agent is told about an order the player gave it (the Parser's kind): the
 * right behind it and the verdict. A code-run listener follows the verdict; an agent-run one is told it and chooses */
export function orderNote(state: GameState, kind: OrderKind | null | undefined, to: Actor): string | undefined {
  if (!kind) return undefined;
  const c = checkOrder(state, state.player, to, { kind });
  logCode(state, 'order_checked', { from: state.player.id, to: to.id, kind, ...(c.basis ? { basis: c.basis } : {}), ...(c.verdict ? { verdict: c.verdict } : {}), why: c.why });
  if (!c.right || !c.basis || !c.verdict) return `it is an order (${kind}) they have no right to give you: follow it only if you choose to`;
  return `it is an order (${kind}), and ${BASIS_WORDS[c.basis]}: ${VERDICT_WORDS[c.verdict]}${to.mind?.control === 'agent' ? ' (that is what duty and will say; you choose)' : ''}`;
}
