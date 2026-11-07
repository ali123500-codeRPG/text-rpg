// Character sheet pieces (approved mock-up round 2, 07/11/2026): the character card, skill bars by tree, and the
// compact side sheet on the Play screen. Display only: every number comes from the ruleset or the saved actor.
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary, itemDef } from '../library';
import { defaultMode, effectiveSkill, healthLevel, modeSkill, totalHp } from '../ruleset';
import { poolState } from '../ruleset/body';
import { h } from './kit';
import { skillName, SKILL_SUB, TREE_VIEW } from './creation';

/** Set by a gear link on the character card; the Inventory page opens that item once. */
export const invFocus: { id: string | null } = { id: null };

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

/** Standing attack: the first usable weapon mode at reach 0 and its effective skill (same as the creation preview). */
function attackOf(s: GameState, p: Actor): { name: string; value: number | null } | null {
  const m = safe(() => defaultMode(s, p, 0));
  if (!m) return null;
  const inst = p.core.inventory.find((i) => i.id === m.itemId);
  return { name: safe(() => itemDef(s, inst!.itemId).name) ?? m.itemId, value: safe(() => effectiveSkill(s, p, modeSkill(m.mode), { itemId: m.itemId, modeId: m.mode.id }).value) };
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
const whole = (n: number | null) => (n === null ? '—' : String(+n.toFixed(2))); // fractions shown, not rounded (OQ-25); toFixed only drops float noise

export function charCard(s: GameState, p: Actor): HTMLElement {
  const { hp } = hpLeft(s, p);
  const level = healthLevel(p);
  const levels = CONFIG.HEALTH_TRACK.map(([l]) => l as string);
  const lit = Math.round(levels.length * (1 - Math.min(100, p.core.condition.hpLostPct) / 100));
  const place = s.places.find((x) => x.id === p.placeId)?.names.current;
  const cls = p.core.classes.find((c) => c.state === 'current')?.classId ?? '';
  const def = standing(s, p);
  const atk = attackOf(s, p);
  const gear = p.core.inventory.filter((i) => i.equippedIn?.length).map((i) =>
    h('span', {}, h('a', { href: '#inv', class: 'cs-item', title: 'Open in Inventory for its full stats', onclick: () => { invFocus.id = i.id; } }, cap(safe(() => itemDef(s, i.itemId).name) ?? i.itemId)), ` · ${i.equippedIn!.some((x) => x.startsWith('hand:')) ? 'held' : 'worn'}`));
  return h('div', { class: 'cs-card' },
    h('div', { class: 'cs-who' }, h('div', { class: 'cs-sigil', 'aria-hidden': 'true' }, '⚔'),
      h('div', {}, h('b', {}, p.names.current || cls.charAt(0).toUpperCase() + cls.slice(1)), h('span', {}, place ? `In the ${place}` : ''))),
    h('div', { class: 'cs-track' },
      h('div', { class: 'cs-row' }, h('span', {}, 'Health'), h('b', {}, `${level} · ${whole(hp)} HP`)),
      h('div', { class: 'cs-hp', title: `Health track: ${levels.join(', ')}` }, levels.map((l, i) => h('i', { class: i < lit ? 'on' : '', 'aria-label': l }))),
      h('div', { class: 'cs-steps' }, ['Unhurt', 'Hurt', 'Wounded', 'Critical', 'Out'].map((l) =>
        h('span', { class: (l === 'Out' ? 'Incapacitated' : l) === level ? 'now' : '' }, l)))),
    h('div', { class: 'cs-figs' },
      h('div', {}, h('b', {}, whole(atk?.value ?? null)), h('span', {}, atk ? `Standing attack · ${atk.name}` : 'Standing attack · no weapon')),
      h('div', {}, h('b', {}, whole(def.value)), h('span', {}, `Standing defense · ${def.kind}`))),
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

const partOpen = { on: false }; // body-part list under the health bar, kept open across turns
const partName = (id: string) => cap(id.replace(/_/g, ' '));

/** Health bar with the health-track thresholds (Part 3) marked; clicking it opens each body part's pool and state. */
function healthBar(s: GameState, p: Actor): HTMLElement[] {
  const { hp, total } = hpLeft(s, p);
  const level = healthLevel(p);
  const left = Math.max(0, 100 - p.core.condition.hpLostPct);
  // segments by % left: Bruised 85–100, Hurt 70–85 … Critical 0–25 (Unhurt is only the full bar, Incapacitated the empty one)
  const segs = CONFIG.HEALTH_TRACK.slice(1, -1).map(([l, max], i, all) => ({ l, from: 100 - Math.min(100, max), to: i ? 100 - all[i - 1][1] : 100 }));
  const at = Math.max(0, segs.findIndex((x) => x.l === level));
  const parts = h('div', { class: 'cs-parts', hidden: !partOpen.on, 'aria-label': 'Body parts' },
    h('p', { class: 'hs-label' }, 'Body parts'),
    safe(() => creatureType(s, p.core.creatureTypeId).parts.map((d) => {
      const pct = p.core.condition.parts[d.id] ?? 100;
      const pool = total === null ? null : total * (CONFIG.PART_SHARE[d.size] ?? 0);
      const st = poolState(pct);
      return h('div', { class: 'cs-part', title: pool === null ? '' : `${whole(pool * pct / 100)} of ${whole(pool)}` },
        h('span', {}, partName(d.id)), h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.max(0, Math.min(100, pct))}%` })),
        h('span', { class: 'w' + (st === 'Healthy' ? '' : ' bad') }, st));
    })) ?? [],
    h('p', { class: 'hs-note' }, 'Below 50% a part is Damaged; at 0 it is Crippled.'));
  const btn = h('button', { class: 'cs-hpbtn', type: 'button', 'aria-expanded': String(partOpen.on), title: 'Click to show or hide each body part',
    onclick: () => { partOpen.on = !partOpen.on; parts.hidden = !partOpen.on; btn.setAttribute('aria-expanded', String(partOpen.on)); } },
    h('span', { class: 'cs-row' }, h('span', {}, `Health · ${level} ${partOpen.on ? '⌄' : '›'}`), h('b', {}, `${whole(hp)} HP`)),
    h('span', { class: 'cs-hptrack' }, h('b', { style: `width:${left}%` }), segs.slice(0, -1).map((x) => h('i', { style: `left:${x.from}%` }))),
    h('span', { class: 'cs-hpsteps' }, segs.filter((_, i) => i % 2 === at % 2).map((x) =>
      h('span', { class: x.l === level ? 'now' : '', style: `left:${(x.from + x.to) / 2}%` }, x.l))));
  btn.addEventListener('click', () => { (btn.querySelector('.cs-row span') as HTMLElement).textContent = `Health · ${level} ${partOpen.on ? '⌄' : '›'}`; });
  return [btn, parts];
}

/** Compact sheet beside the story: health, standing defense and skills above 0. */
export function sideSheet(s: GameState, p: Actor): HTMLElement[] {
  const def = standing(s, p);
  const atk = attackOf(s, p);
  return [
    ...healthBar(s, p),
    h('div', { class: 'cs-row' }, h('span', {}, `Standing attack · ${atk?.name ?? 'no weapon'}`), h('b', {}, whole(atk?.value ?? null))),
    h('div', { class: 'cs-row' }, h('span', {}, `Standing defense · ${def.kind}`), h('b', {}, whole(def.value))),
    ...trees(s, p, false).map((t) => h('div', { class: 'cs-mini', style: `--t:var(--${t.c})` },
      h('div', { class: 'th' }, h('span', {}, t.name.replace(/^Combat – /, '')), h('span', {}, String(t.sum))),
      t.rows.map((r) => h('div', { class: 'r' }, h('span', {}, skillName(r.id), r.tagged ? [' ', tag()] : null), bar(r.raw), h('b', {}, String(r.raw)))))),
  ];
}
