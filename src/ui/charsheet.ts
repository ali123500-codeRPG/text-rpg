// Character sheet pieces (approved mock-up round 2, 07/11/2026): the character card, skill bars by tree, and the
// compact side sheet on the Play screen. Display only: every number comes from the ruleset or the saved actor.
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { getLibrary, itemDef } from '../library';
import { effectiveSkill, healthLevel, totalHp } from '../ruleset';
import { h } from './kit';
import { skillName, SKILL_SUB, TREE_VIEW } from './creation';

const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const LOCKED = new Set(['unarmed_natural']);
const BAR_SCALE = 100; // display only: the rules set no skill maximum yet (D-3)

export function hpLeft(s: GameState, p: Actor): { hp: number | null; total: number | null } {
  const total = safe(() => totalHp(s, p));
  return { total, hp: total === null ? null : total * (1 - p.core.condition.hpLostPct / 100) };
}

function standing(s: GameState, p: Actor): { kind: string; value: number | null } {
  const kind = p.core.standingDefense;
  const shield = p.core.inventory.find((i) => safe(() => itemDef(s, i.itemId).kind) === 'shield' && i.equippedIn?.length);
  const value = safe(() => effectiveSkill(s, p, kind, kind === 'block' && shield ? { itemId: shield.id } : {}).value);
  return { kind, value };
}

/** Trees the player has points in, each with its open skills. */
export function trees(s: GameState, p: Actor, withZero: boolean) {
  const lib = getLibrary();
  return TREE_VIEW.filter((t) => lib.trees[t.id]).map((t) => {
    const ks = lib.trees[t.id].skills.filter((k) => !LOCKED.has(k) && p.core.skills[k] !== undefined);
    const rows = ks.map((k) => ({ id: k, raw: p.core.skills[k].raw, tagged: p.core.skills[k].state === 'tagged' }));
    return { id: t.id, c: t.c, name: lib.trees[t.id].name, sum: rows.reduce((a, r) => a + r.raw, 0), rows: withZero ? rows : rows.filter((r) => r.raw > 0) };
  }).filter((t) => t.sum > 0);
}

const tag = () => h('span', { class: 'tag', title: 'Tagged skill' }, '✦');
const bar = (raw: number) => h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.min(100, (raw / BAR_SCALE) * 100)}%` }));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const whole = (n: number | null) => (n === null ? '—' : String(Math.round(n)));

export function charCard(s: GameState, p: Actor): HTMLElement {
  const { hp } = hpLeft(s, p);
  const level = healthLevel(p);
  const levels = CONFIG.HEALTH_TRACK.map(([l]) => l as string);
  const lit = Math.round(levels.length * (1 - Math.min(100, p.core.condition.hpLostPct) / 100));
  const place = s.places.find((x) => x.id === p.placeId)?.names.current;
  const cls = p.core.classes.find((c) => c.state === 'current')?.classId ?? '';
  const def = standing(s, p);
  const gear = p.core.inventory.filter((i) => i.equippedIn?.length).map((i) =>
    h('span', {}, h('b', {}, cap(safe(() => itemDef(s, i.itemId).name) ?? i.itemId)), ` · ${i.equippedIn!.some((x) => x.startsWith('hand:')) ? 'held' : 'worn'}`));
  return h('div', { class: 'cs-card' },
    h('div', { class: 'cs-who' }, h('div', { class: 'cs-sigil', 'aria-hidden': 'true' }, '⚔'),
      h('div', {}, h('b', {}, p.names.current || cls.charAt(0).toUpperCase() + cls.slice(1)), h('span', {}, place ? `In the ${place}` : ''))),
    h('div', { class: 'cs-track' },
      h('div', { class: 'cs-row' }, h('span', {}, 'Health'), h('b', {}, `${level} · ${whole(hp)} HP`)),
      h('div', { class: 'cs-hp', title: `Health track: ${levels.join(', ')}` }, levels.map((l, i) => h('i', { class: i < lit ? 'on' : '', 'aria-label': l }))),
      h('div', { class: 'cs-steps' }, ['Unhurt', 'Hurt', 'Wounded', 'Critical', 'Out'].map((l) =>
        h('span', { class: (l === 'Out' ? 'Incapacitated' : l) === level ? 'now' : '' }, l)))),
    h('div', { class: 'cs-figs' },
      h('div', {}, h('b', {}, whole(def.value)), h('span', {}, `Standing defense · ${def.kind}`)),
      h('div', {}, h('b', {}, String(p.progression?.potential.base ?? '—')), h('span', {}, 'Potential')),
      h('div', {}, h('b', {}, String(p.progression?.startingTotal ?? '—')), h('span', {}, 'StartingTotal')),
      h('div', {}, h('b', {}, String(Object.values(p.core.skills).filter((e) => e.state === 'tagged').length)), h('span', {}, 'Tagged skills'))),
    gear.length ? h('div', { class: 'cs-gear' }, h('p', { class: 'hs-label' }, 'In hand and worn'), gear) : null);
}

export function treeBars(s: GameState, p: Actor): HTMLElement {
  return h('div', { class: 'cs-trees' }, trees(s, p, true).map((t) =>
    h('div', { class: 'cs-tree', style: `--t:var(--${t.c})` },
      h('div', { class: 'cs-tree-h' }, h('b', {}, t.name), h('span', {}, `${t.sum} pts`)),
      t.rows.map((r) => h('div', { class: 'cs-sk' + (r.raw ? '' : ' zero') },
        h('div', { class: 'n' }, skillName(r.id), r.tagged ? [' ', tag()] : null, SKILL_SUB[r.id] ? h('small', {}, SKILL_SUB[r.id]) : null),
        bar(r.raw), h('div', { class: 'num' }, String(r.raw)))))));
}

/** Compact sheet beside the story: health, standing defense and skills above 0. */
export function sideSheet(s: GameState, p: Actor): HTMLElement[] {
  const { hp, total } = hpLeft(s, p);
  const def = standing(s, p);
  return [
    h('div', { class: 'cs-hpline' }, h('div', { class: 'cs-row' }, h('span', {}, `Health · ${healthLevel(p)}`), h('b', {}, `${whole(hp)} HP`)),
      h('div', { class: 'cs-meter' }, h('b', { style: `width:${total ? Math.max(0, (hp ?? 0) / total) * 100 : 0}%` }))),
    h('div', { class: 'cs-row' }, h('span', {}, `Standing defense · ${def.kind}`), h('b', {}, whole(def.value))),
    ...trees(s, p, false).map((t) => h('div', { class: 'cs-mini', style: `--t:var(--${t.c})` },
      h('div', { class: 'th' }, h('span', {}, t.name.replace(/^Combat – /, '')), h('span', {}, String(t.sum))),
      t.rows.map((r) => h('div', { class: 'r' }, h('span', {}, skillName(r.id), r.tagged ? [' ', tag()] : null), bar(r.raw), h('b', {}, String(r.raw)))))),
  ];
}
