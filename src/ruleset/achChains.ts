// TB1–TB6 achievement chains and branches. A chain is a run of rows linked by `after` (each row names the level below
// it). A branch is a chain whose lowest row names, in `branchOf`, the trunk it counts a slice of (the trunk's lowest row)
// or a head with no trunk (ACH_HEADS). Branches are for display: each chain still climbs, carries rewards and switches its
// own lower levels off on its own (D-130); a branch never touches its trunk.
import type { AchievementDef, GameState } from '../types';
import { getLibrary } from '../library';
import { ACH_HEAD_NAMES, ACH_TAGS } from '../library/achievementIds';

const lib = (): Record<string, AchievementDef> => getLibrary().achievements ?? {};

/** the lowest row of a row's own chain */
export function chainRoot(key: string): string {
  const L = lib();
  let k = key;
  for (let i = 0; L[k]?.after && L[L[k].after!] && i < 20; i++) k = L[k].after!;
  return k;
}
/** a row's chain, lowest level first: down its `after` links, then up through the rows that name it */
export function chainRows(key: string): string[] {
  const L = lib();
  const out = [chainRoot(key)];
  for (let i = 0; i < 20; i++) {
    const next = Object.keys(L).find((n) => L[n].after === out[out.length - 1] && !out.includes(n));
    if (!next) break;
    out.push(next);
  }
  return out;
}
/** the chain a row shows under: its root's trunk or head (`branchOf`), else its own root */
export const chainHead = (key: string): string => { const r = chainRoot(key); return lib()[r]?.branchOf ?? r; };
/** a head with no trunk of its own (healing and calming by source) */
export const isBareHead = (head: string): boolean => !!ACH_HEAD_NAMES[head];
/** the roots of every branch under a head, in table order */
export const branchRoots = (head: string): string[] => Object.keys(lib()).filter((k) => lib()[k].branchOf === head);
/** the tag a chain is listed under: its trunk's first tag (or the head's), by ACH_TAGS order */
export function chainTag(head: string): string {
  if (isBareHead(head)) return ACH_HEAD_NAMES[head].tag;
  const tags = lib()[head]?.tags ?? [];
  return (Object.keys(ACH_TAGS) as (keyof typeof ACH_TAGS)[]).find((t) => tags.includes(t)) ?? tags[0] ?? 'progression';
}

export type HeldChain = { root: string; of?: string; rows: string[]; held: string[]; current: string; next?: string };
/** one chain (root, kind) as the player holds it: its rows, the rows held, the highest held, and the next row not held
 * (TB5: only a chain already started shows its next row) */
export function heldChain(s: GameState, root: string, of?: string): HeldChain | undefined {
  const mine = s.player.progression?.achievements ?? [];
  const rows = chainRows(root);
  const every = !!lib()[root]?.every; // an every-N row is earned again and again (its kind is the count): no next row to show
  const held = rows.filter((k) => mine.some((m) => m.key === k && (every || (m.of ?? '') === (of ?? ''))));
  if (!held.length) return undefined;
  const next = every ? undefined : rows.find((k) => !held.includes(k) && rows.indexOf(k) > rows.indexOf(held[held.length - 1]));
  return { root, ...(of ? { of } : {}), rows, held, current: held[held.length - 1], ...(next ? { next } : {}) };
}
/** whether the player can see where a chain ends: its last level is held or is the next one. Until then a chain's place
 * reads "I of ?", since later levels stay hidden (TB5) */
export const endInSight = (c: HeldChain): boolean => (c.next ? c.rows.indexOf(c.next) : c.rows.indexOf(c.current)) >= c.rows.length - 1;

/** every chain (root, kind) the player has started, grouped by the head it shows under. A by-kind chain with no trunk is
 * its own head per kind (`head:of`), so each skill group or class stands on its own line. */
export function heldChains(s: GameState, scars: boolean): Map<string, HeldChain[]> {
  const L = lib(), out = new Map<string, HeldChain[]>();
  const seen = new Set<string>();
  for (const a of s.player.progression?.achievements ?? []) {
    const d = a.key ? L[a.key] : undefined;
    if (!d || !!d.scar !== scars) continue;
    const root = chainRoot(a.key!), of = d.every ? undefined : a.of;
    const id = `${root}|${of ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const c = heldChain(s, root, of);
    if (!c) continue;
    const head = chainHead(root);
    const branch = head !== root;
    const key = !branch && L[root]?.by && of ? `${head}:${of}` : head;
    out.set(key, [...(out.get(key) ?? []), c]);
  }
  return out;
}
/** a branch's kind in words: by body type, by race, per source … */
export function branchLabel(d: AchievementDef | undefined): string {
  if (!d) return '';
  if (d.only) return d.rule === 'calmed' ? getLibrary().composure?.[d.only]?.name ?? d.only : getLibrary().healing?.[d.only]?.name ?? d.only;
  return d.by ? `by ${d.by.replace(/_/g, ' ')}` : d.name;
}
