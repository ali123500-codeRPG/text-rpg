// Hierarchy and belonging (docs/spec/part-2-turn-engine/hierarchy-and-belonging.md): reading the organization, link and
// tie records. Every answer takes a viewer and uses only the ties that viewer knows (BEL-20).
import type { Actor, Band, GameState, Organization, Stance, Tie } from '../types';
import { COMMITMENT, type StanceKey } from '../scales';

const orgIndex = new WeakMap<Organization[], Map<string, Organization>>();
export function orgById(state: GameState, id: string): Organization | undefined {
  const list = state.organizations;
  if (!list) return undefined;
  let m = orgIndex.get(list);
  if (!m || m.size !== list.length) orgIndex.set(list, (m = new Map(list.map((o) => [o.id, o]))));
  return m.get(id);
}

/** an organization and the ones it is a unit of, nearest first (BEL-03); a loop in bad data stops at the first repeat */
export function orgChain(state: GameState, id: string): Organization[] {
  const out: Organization[] = [];
  for (let o = orgById(state, id); o && !out.includes(o); o = o.parentId ? orgById(state, o.parentId) : undefined) out.push(o);
  return out;
}

/** a group and the groups it sits inside, nearest first (BEL-12) */
export function groupChain(state: GameState, id: string): Band[] {
  const out: Band[] = [];
  for (let g = state.bands.find((b) => b.id === id); g && !out.includes(g); g = g.parentId ? state.bands.find((b) => b.id === g!.parentId) : undefined) out.push(g);
  return out;
}

const orgOf = (t: Tie) => ('org' in t.to ? t.to.org : undefined);

/** BEL-20: the ties of `b` that `a` knows. A character knows all of its own; an open tie is known to anyone; a quiet tie
 * to fellow members of that organization or one it is a unit of. A secret tie, and a quiet one someone was told of, wait
 * for the rule that lets a character learn a tie */
export function knownTies(state: GameState, a: Actor, b: Actor): Tie[] {
  const ties = b.ties ?? [];
  if (a === b) return ties;
  const mine = new Set((a.ties ?? []).map(orgOf).filter((x): x is string => !!x));
  const fellow = (t: Tie) => { const o = orgOf(t); return !!o && orgChain(state, o).some((x) => mine.has(x.id)); };
  return ties.filter((t) => t.cover === 'open' || (t.cover === 'quiet' && fellow(t)));
}

/** the organizations `a` knows `b` to be in, each followed by the ones it is a unit of (BEL-03: a member of a unit is a
 * member of its parent), nearest first */
export function knownOrgs(state: GameState, a: Actor, b: Actor): string[] {
  const out: string[] = [];
  for (const t of knownTies(state, a, b)) { const o = orgOf(t); if (o) for (const x of orgChain(state, o)) if (!out.includes(x.id)) out.push(x.id); }
  return out;
}

/** BEL-16: what an organization says about any of `keys`: the nearest unit with an entry wins; within one, the first key */
function orgSays(state: GameState, orgId: string, keys: string[]): StanceKey | undefined {
  for (const o of orgChain(state, orgId)) for (const k of keys) { const s = o.stances?.[k]; if (s) return s; }
  return undefined;
}

/** a's ties in the order they decide (BEL-25 step 4): highest commitment first, then list order */
export function rankedTies(a: Actor): Tie[] {
  return (a.ties ?? []).map((t, i) => [t, i] as const).sort(([x, i], [y, j]) => COMMITMENT.pos(y.commitment) - COMMITMENT.pos(x.commitment) || i - j).map(([t]) => t);
}

/** a and b are in one group, directly or through the groups theirs sit inside (BEL-12) */
export function sameGroup(state: GameState, a: Actor, b: Actor): boolean {
  if (!a.bandId || !b.bandId) return false;
  if (a.bandId === b.bandId) return true;
  const gb = groupChain(state, b.bandId);
  return groupChain(state, a.bandId).some((g) => gb.includes(g));
}

/** a and b share a crew (BEL-04: a close-knit organization), as `a` knows b's ties (BEL-20) */
export function sameCrew(state: GameState, a: Actor, b: Actor): boolean {
  if (a === b || !a.ties?.length || !b.ties?.length) return false;
  const mine = new Set(a.ties.map(orgOf).filter((x): x is string => !!x && !!orgById(state, x)?.closeKnit));
  return mine.size > 0 && knownTies(state, a, b).some((t) => { const o = orgOf(t); return !!o && mine.has(o); });
}

/** BEL-51: `b` is one of `a`'s own: in a's group (or a group they share) or in a crew of a's that a knows b to be in */
export const ofOurs = (state: GameState, a: Actor, b: Actor): boolean => a !== b && (sameGroup(state, a, b) || sameCrew(state, a, b));

/** BEL-27: b is on a's side of a fight: b fights one of a's foes and is not a's foe (from engagements; a passer-by who
 * joins the fight is on your side without joining your group) */
export function onSide(state: GameState, a: Actor, b: Actor, fighting: (x: Actor, y: Actor) => boolean): boolean {
  if (a === b || fighting(a, b) || fighting(b, a)) return false;
  const all = [state.player, ...state.actors];
  return all.some((f) => f !== a && f !== b && (fighting(a, f) || fighting(f, a)) && (fighting(b, f) || fighting(f, b)));
}

/** BEL-25 steps 3 to 5: a's default attitude toward b from groups and organizations, before regard, the fight's state and
 * perks (relations.ts baseStance). The player holds no stances (BEL-22): only its group speaks for it */
export function groupAndOrgStance(state: GameState, a: Actor, b: Actor): Stance {
  // step 3: a's group and the groups above it. Sharing any of them is the same team
  if (a.bandId === b.bandId || sameGroup(state, a, b)) return 'friendly';
  const ga = groupChain(state, a.bandId), gb = groupChain(state, b.bandId);
  const theirs = a.kind === 'player' ? [] : knownOrgs(state, a, b);
  const keys = [b.id, ...gb.map((g) => g.id), ...theirs];
  for (const g of ga) for (const k of keys) { const s = g.relations[k]; if (s) return s; }
  if (a.kind === 'player') return 'neutral';
  // step 4: a's ties, highest commitment first; same crew is friendly
  const people = [b.id, ...theirs];
  for (const t of rankedTies(a)) {
    const o = orgOf(t);
    if (!o) continue;
    if (orgById(state, o)?.closeKnit && theirs.includes(o)) return 'friendly';
    const s = orgSays(state, o, people);
    if (s) return s;
  }
  // step 5: the stance toward strangers of a's first organization
  const first = (a.ties ?? []).map(orgOf).find((x) => x && orgById(state, x));
  return (first && orgById(state, first)!.strangers) || 'neutral';
}

/** every stance a's groups and organizations hold toward anyone: RS3 asks whether any of them is loyal or friend */
export function heldStances(state: GameState, a: Actor): StanceKey[] {
  const out: StanceKey[] = [];
  for (const g of groupChain(state, a.bandId)) for (const s of Object.values(g.relations)) if (s !== 'yielded') out.push(s);
  if (a.kind === 'player') return out;
  for (const t of a.ties ?? []) { const o = orgOf(t); if (o) for (const x of orgChain(state, o)) out.push(...Object.values(x.stances ?? {})); }
  return out;
}
