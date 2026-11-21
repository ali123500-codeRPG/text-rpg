// Hierarchy and belonging as the player knows it (docs/spec/part-2-turn-engine/hierarchy-and-belonging.md), for the play
// screens only: the ties of people the player has seen clearly, the organizations those ties reach, and who holds the
// place the player stands in. Only ties the player knows (BEL-20: open ones; the player holds no ties, so it is nobody's
// fellow member) and never a commitment (BEL-08). Not part of PlayerView, so no agent's input changes.
import type { Actor, GameState, PlayerView, TieEnd } from '../types';
import { TIE_STATUS } from '../scales';
import { knownTies, orgById, orgChain } from '../engine/belonging';
import { actorById, labelFor, nameFor } from '../engine/relations';

/** one tie as the player knows it: to an organization (with its id) or a person, by name */
export type TieView = { org?: string; name: string; kind?: string; title?: string; status: string };
/** one organization the player knows of, through the ties it knows: its parent, whether its head is among the people
 *  listed, and those people with their titles */
export type OrgView = { id: string; name: string; kind: string; parentId?: string; people: { id: string; name: string; title?: string; head?: true }[] };
/** one end of a place's rule: its name, and whether it is an organization (else one person) */
export type RuleEnd = { name: string; org?: true };
export type BelongingView = {
  /** by actor id: the ties the player knows of everyone it sees clearly now or saw clearly before */
  people: Record<string, TieView[]>;
  /** parents before their units */
  orgs: OrgView[];
  /** BEL-15: who holds the place the player stands in, and whose law runs there (the nearest place up that names one) */
  rule?: { holder?: RuleEnd; law?: RuleEnd };
};

const who = (state: GameState, p: Actor, end: TieEnd): string => {
  if ('org' in end) return orgById(state, end.org)?.name ?? 'someone';
  const a = actorById(state, end.person);
  return !a ? 'someone' : a === p ? 'you' : nameFor(state, p, a) ?? labelFor(state, p, a);
};

export function belongingView(state: GameState, pv: PlayerView): BelongingView {
  const p = state.player;
  const ids = [...pv.actors.filter((a) => a.level === 'full').map((a) => a.id), ...(pv.lastSeen ?? []).map((x) => x.id)];
  const people: BelongingView['people'] = {};
  const orgs = new Map<string, OrgView>();
  for (const id of ids) {
    const a = actorById(state, id);
    if (!a) continue;
    const ties = knownTies(state, p, a);
    if (!ties.length) continue;
    const name = nameFor(state, p, a) ?? labelFor(state, p, a);
    people[id] = ties.map((t) => {
      const o = 'org' in t.to ? orgById(state, t.to.org) : undefined;
      if (o) {
        // BEL-03: a member of a unit is a member of its parent, so the whole chain is known
        for (const x of orgChain(state, o.id).reverse()) if (!orgs.has(x.id)) orgs.set(x.id, { id: x.id, name: x.name, kind: x.kind, ...(x.parentId ? { parentId: x.parentId } : {}), people: [] });
        orgs.get(o.id)!.people.push({ id, name, ...(t.title ? { title: t.title } : {}), ...(o.headId === id ? { head: true as const } : {}) });
      }
      return { ...(o ? { org: o.id, kind: o.kind } : {}), name: who(state, p, t.to), ...(t.title ? { title: t.title } : {}), status: TIE_STATUS.name(t.status) };
    });
  }
  for (const o of orgs.values()) o.people.sort((x, y) => Number(!!y.head) - Number(!!x.head));
  let holder: TieEnd | undefined, law: TieEnd | undefined;
  for (let pl = state.places.find((x) => x.id === p.placeId), n = 0; pl && n < 64 && !(holder && law); pl = pl.parentId ? state.places.find((x) => x.id === pl!.parentId) : undefined, n++) {
    holder ??= pl.holder;
    law ??= pl.law;
  }
  const end = (e: TieEnd): RuleEnd => ({ name: who(state, p, e), ...('org' in e ? { org: true as const } : {}) });
  const rule = holder || law ? { ...(holder ? { holder: end(holder) } : {}), ...(law ? { law: end(law) } : {}) } : undefined;
  return { people, orgs: [...orgs.values()], ...(rule ? { rule } : {}) };
}

const up = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
/** an organization's name as a sentence takes it: "the Millbrook Watch" (names made at spawn already start with "the") */
export const theName = (n: string): string => (/^the\b/i.test(n) ? n : `the ${n}`);

/** a tie in a few words: "Millbrook Watch · watch captain"; a tie to a person reads "hired by Osric" */
/** `mark` wraps each name (the screen tints them) */
export const tieText = (t: TieView, mark = (x: string) => x): string => (t.org ? [mark(up(t.name)), t.title].filter(Boolean).join(' · ') : `${t.status === TIE_STATUS.name('hired') ? 'hired by' : `${t.status} of`} ${mark(t.name)}`);

/** BEL-15 in one line: "Held by the Millbrook council, whose law runs here"; a different law-giver gets its own clause */
export function ruleText(r: NonNullable<BelongingView['rule']>, mark = (x: string) => x): string {
  const the = (x: RuleEnd) => (x.org ? theName(x.name) : x.name);
  if (r.holder && r.law && r.holder.name === r.law.name) return `Held by ${mark(the(r.holder))}, whose law runs here`;
  const law = r.law && the(r.law);
  return [r.holder ? `Held by ${mark(the(r.holder))}` : '', law ? `${law === 'you' ? 'Your' : mark(`${up(law)}’s`)} law runs here` : ''].filter(Boolean).join(' · ');
}
