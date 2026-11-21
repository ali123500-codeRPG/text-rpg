// D-1621: the GM view's logs on the hidden page keep a set size. Cast power keeps its newest rows (WT7 a); the roles wanted
// (WT8 c) and the templates, routines and deed ideas wanted (WT9) fold into counted groups, the least recently seen dropped
// past the cap; the owner's verdict on a group removes it (approved) or keeps only its count (turned down).
import type { HiddenStore, RoleWant, TemplateWant } from '../types';
import { CONFIG } from '../config';

type Groups = { roleWants: NonNullable<HiddenStore['roleWants']>[number]; templateWants: NonNullable<HiddenStore['templateWants']>[number] };
export type WantList = keyof Groups;
export type WantVerdict = 'approved' | 'turned_down';

/** the group a want counts in: roles by who (any case), the wanted skills (any order) and the role used; the rest by kind, who
 * (any case) and what was used instead */
export const wantKey = {
  roleWants: (w: Pick<RoleWant, 'label' | 'skills' | 'role'>) => [w.label.toLowerCase(), [...w.skills].sort().join(','), w.role].join('|'),
  templateWants: (w: Pick<TemplateWant, 'label' | 'template' | 'of'>) => [w.of ?? 'template', w.label.toLowerCase(), w.template].join('|'),
};
/** what a turned-down group drops: everything but its key, count and when it was last wanted */
const DETAIL = { roleWants: ['actorId', 'missing'], templateWants: ['actorId', 'wanted'] } as const;
const CAP = { roleWants: () => CONFIG.GM_LOG_GROUPS_ROLE_WANTS, templateWants: () => CONFIG.GM_LOG_GROUPS_TEMPLATE_WANTS };

/** fold a want into its group, which moves to the end (most recently seen); its first label stays. A turned-down group takes
 * no detail back, only the count and the time. Past the cap the least recently seen groups go. */
export function addWant<L extends WantList>(h: Pick<HiddenStore, WantList>, list: L, w: L extends 'roleWants' ? RoleWant : TemplateWant): void {
  const groups = (h[list] ??= []) as Groups[L][], key = wantKey[list] as (x: Groups[L]) => string, k = key(w as Groups[L]);
  const i = groups.findIndex((g) => key(g) === k), was = i < 0 ? undefined : groups.splice(i, 1)[0];
  groups.push((was?.turnedDown ? { ...was, turn: w.turn, scenario: w.scenario } : { ...was, ...w, ...(was ? { label: was.label } : {}) }) as Groups[L]);
  groups[groups.length - 1].count = (was?.count ?? 0) + 1;
  groups.splice(0, Math.max(0, groups.length - CAP[list]()));
}

/** WT7 a: a cast power reading; the oldest go past CONFIG.GM_LOG_ROWS_CAST_POWER */
export function addCastPower(h: Pick<HiddenStore, 'castPower'>, row: NonNullable<HiddenStore['castPower']>[number]): void {
  const rows = (h.castPower ??= []);
  rows.push(row);
  rows.splice(0, Math.max(0, rows.length - CONFIG.GM_LOG_ROWS_CAST_POWER));
}

/** the owner's verdict on the group `key` of `list`: approved, it goes; turned down, only its key, count and time stay.
 * False when no such group is left. */
export function ruleWant(h: Pick<HiddenStore, WantList>, list: WantList, key: string, verdict: WantVerdict): boolean {
  const groups = h[list] as Groups[WantList][] | undefined, of = wantKey[list] as (x: Groups[WantList]) => string;
  const i = groups?.findIndex((g) => of(g) === key) ?? -1;
  if (!groups || i < 0) return false;
  if (verdict === 'approved') groups.splice(i, 1);
  else {
    const g = groups[i] as Record<string, unknown>;
    for (const d of DETAIL[list]) delete g[d];
    g.turnedDown = true;
  }
  return true;
}
