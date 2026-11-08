// Character sheet pieces (approved mock-up round 2, 07/11/2026): the character card, skill bars by tree, and the
// compact side sheet on the Play screen. Display only: every number comes from the ruleset or the saved actor.
import type { Actor, GameState, LogLine } from '../types';
import { CONFIG } from '../config';
import { creatureType, getLibrary, itemDef } from '../library';
import { defaultMode, effectiveSkill, healthLevel, modeSkill, totalHp, trueSkill } from '../ruleset';
import { poolState, SHOWN_LEVELS, shownLevel } from '../ruleset/body';
import { achievementName, charLevel, xpToNext } from '../engine/xp';
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
/** V3a (Ali, 07/11/2026): a skill marked for an improvement roll */
const markDot = () => h('span', { class: 'mk-dot', title: 'Marked: rolls to improve when this fight ends', 'aria-label': 'marked to improve' });
const marked = (p: Actor, id: string) => !!p.progression?.marks.includes(id);
const bar = (raw: number) => h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.min(100, (raw / BAR_SCALE) * 100)}%` }));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const whole = (n: number | null) => (n === null ? '—' : String(+n.toFixed(2))); // fractions shown, not rounded (OQ-25); toFixed only drops float noise

/** one row of level names over the card's equal segments, alternating above (0) and below (1) the bar. Unhurt and
 * Incapacitated (the first and last) are not named (Ali, 08/11/2026). */
const steps = (levels: string[], level: string, below: 0 | 1) => h('div', { class: `cs-steps ${below ? 'down' : 'up'}` },
  levels.map((l, i) => (i > 0 && i < levels.length - 1 && i % 2 !== below ? h('span', { class: l === level ? 'now' : '', style: `grid-column:${i + 1}` }, l) : null)));

export function charCard(s: GameState, p: Actor): HTMLElement {
  const { hp } = hpLeft(s, p);
  const level = shownLevel(healthLevel(p));
  const levels = SHOWN_LEVELS().map(([l]) => l as string);
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
      // each level named at its segment, alternating one above the bar and one below (Ali, 08/11/2026)
      steps(levels, level, 0),
      h('div', { class: 'cs-hp', title: `Health track: ${levels.join(', ')}` }, levels.map((l, i) => h('i', { class: i < lit ? 'on' : '', 'aria-label': l }))),
      steps(levels, level, 1),
      bodyFigure(s, p)),
    xpTrack(p),
    h('div', { class: 'cs-figs' },
      h('div', {}, h('b', {}, whole(atk?.value ?? null)), h('span', {}, atk ? `Standing attack · ${atk.name}` : 'Standing attack · no weapon')),
      h('div', {}, h('b', {}, whole(def.value)), h('span', {}, `Standing defense · ${def.kind}`))),
    gear.length ? h('div', { class: 'cs-gear' }, h('p', { class: 'hs-label' }, 'In hand and worn'), gear) : null,
    h('div', { class: 'cs-gear' }, h('p', { class: 'hs-label' }, 'Achievements'),
      (p.progression?.achievements ?? []).length
        ? p.progression!.achievements!.map((a) => h('span', {}, achievementName(s, a), ` · turn ${a.turn}`))
        : h('span', {}, 'None yet')));
}

/** X9/X15: one XP bar, and a picker for the class the next level goes to when there is a choice. */
function xpTrack(p: Actor): HTMLElement | null {
  const pr = p.progression;
  if (!pr) return null;
  const lib = getLibrary();
  const need = xpToNext(p);
  const open = p.core.classes.filter((c) => c.state === 'current' || c.state === 'unlocked');
  const cur = open.find((c) => c.state === 'current');
  const name = (id: string) => lib.classes[id]?.name ?? id;
  return h('div', { class: 'cs-track' },
    h('div', { class: 'cs-row' }, h('span', {}, `Level ${charLevel(p)}`), h('b', {}, `${+pr.xp.toFixed(6)} / ${need} XP`)),
    h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.min(100, (pr.xp / need) * 100)}%` })),
    open.length > 1
      ? h('label', { class: 'cs-row' }, h('span', {}, 'Next level goes to'),
        h('select', { onchange: (e: Event) => { pr.nextClass = (e.target as HTMLSelectElement).value; } },
          open.map((c) => h('option', { value: c.classId, ...((pr.nextClass ?? cur?.classId) === c.classId ? { selected: true } : {}) }, name(c.classId)))))
      : null);
}

export function treeBars(s: GameState, p: Actor): HTMLElement {
  return h('div', { class: 'cs-trees' }, trees(s, p, true).map((t) =>
    h('div', { class: 'cs-tree', style: `--t:var(--${t.c})` },
      h('div', { class: 'cs-tree-h' }, h('b', {}, t.name), h('span', {}, `${t.sum} pts`)),
      t.rows.map((r) => h('div', { class: 'cs-sk' + (r.raw ? '' : ' zero') },
        h('div', { class: 'n' }, skillName(r.id), r.tagged ? [' ', tag()] : null, marked(p, r.id) ? markDot() : null, SKILL_SUB[r.id] ? h('small', {}, SKILL_SUB[r.id]) : null),
        bar(r.raw), h('div', { class: 'num' }, String(trueSkill(p, r.id)), trueSkill(p, r.id) !== r.raw ? h('small', { title: 'Raw skill' }, ` raw ${r.raw}`) : null))))));
}

const partOpen = { on: false, autoTurn: -1 }; // body-part list under the health bar, kept open across turns; opens once on a turn that healed a part (H2 a)
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Body figure (Ali, 07/11/2026): the creature type's silhouette, each part tinted by its state; the general area shows
 * total health. Clicking a part names it with its state and amount. Null for body types without a figure. */
export function bodyFigure(s: GameState, p: Actor, healed: Set<string> = new Set()): HTMLElement | null {
  const ct = safe(() => creatureType(s, p.core.creatureTypeId));
  if (!ct?.figure) return null;
  const { hp, total } = hpLeft(s, p);
  const info = (id: string): { name: string; state: string; amount: string } => {
    if (id === 'general') return { name: cap(ct.general.name), state: poolState(100 - p.core.condition.hpLostPct), amount: `${whole(hp)} of ${whole(total)} HP` };
    const d = ct.parts.find((x) => x.id === id);
    const pct = p.core.condition.parts[id] ?? 100;
    const pool = total === null || !d ? null : total * (CONFIG.PART_SHARE[d.size] ?? 0);
    return { name: partName(id), state: poolState(pct), amount: pool === null ? '' : `${whole(Math.max(0, pool * pct / 100))} of ${whole(pool)}` };
  };
  const shapes = Object.entries(ct.figure.parts).map(([id, d]) => {
    const i = info(id);
    const hl = healed.has(id) ? ' · healed this turn' : '';
    return `<path data-part="${esc(id)}" class="bf-${i.state.toLowerCase()}${hl ? ' bf-healed' : ''}" d="${esc(d)}"><title>${esc(i.name)} · ${i.state}${hl}</title></path>`;
  }).join('');
  const svg = h('div', { class: 'bf-svg' });
  svg.innerHTML = `<svg viewBox="${esc(ct.figure.viewBox)}" role="img" aria-label="Body parts"><defs><pattern id="bf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#5a6488"/><rect width="2.5" height="6" fill="#0b1330" fill-opacity=".6"/></pattern></defs>${shapes}</svg>`;
  const out = h('p', { class: 'bf-out', 'aria-live': 'polite' });
  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-part]');
    svg.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
    if (!el) { out.textContent = ''; return; }
    el.classList.add('on');
    const i = info(el.getAttribute('data-part')!);
    out.textContent = [i.name, i.state, i.amount, healed.has(el.getAttribute('data-part')!) ? 'healed this turn' : ''].filter(Boolean).join(' · ');
  });
  const key = h('p', { class: 'bf-key' }, ['Healthy', 'Damaged', 'Crippled', 'Destroyed'].map((st) => h('span', {}, h('i', { class: `bf-${st.toLowerCase()}` }), st)));
  return h('div', { class: 'bf' }, svg, out, key);
}
const partName = (id: string) => cap(id.replace(/_/g, ' '));

/** Health bar with the health-track thresholds (Part 3) marked; clicking it opens each body part's pool and state. */
function healthBar(s: GameState, p: Actor, healed: Set<string>, turn: number): HTMLElement[] {
  if (healed.size && partOpen.autoTurn !== turn) { partOpen.on = true; partOpen.autoTurn = turn; }
  const { hp, total } = hpLeft(s, p);
  const level = shownLevel(healthLevel(p));
  const left = Math.max(0, 100 - p.core.condition.hpLostPct);
  // segments by % left: Bruised 85–100, Hurt 70–85 … Critical 0–25 (Unhurt is only the full bar, Incapacitated the empty one)
  const track = SHOWN_LEVELS();
  const segs = track.slice(1, -1).map(([l, max], i, all) => ({ l, from: 100 - Math.min(100, max), to: i ? 100 - all[i - 1][1] : 100 }));
  // each segment's level named mid-segment, alternating one above the bar and one below; Unhurt (the full bar) and
  // Incapacitated (the empty one) are not named (Ali, 08/11/2026)
  const marks = [...segs].reverse().map((x) => ({ l: x.l, at: (x.from + x.to) / 2 }));
  const parts = h('div', { class: 'cs-parts', hidden: !partOpen.on, 'aria-label': 'Body parts' },
    h('p', { class: 'hs-label' }, 'Body parts'),
    bodyFigure(s, p, healed) ?? safe(() => creatureType(s, p.core.creatureTypeId).parts.map((d) => {
      const pct = p.core.condition.parts[d.id] ?? 100;
      const pool = total === null ? null : total * (CONFIG.PART_SHARE[d.size] ?? 0);
      const st = poolState(pct);
      return h('div', { class: 'cs-part', title: pool === null ? '' : `${whole(pool * pct / 100)} of ${whole(pool)}` },
        h('span', {}, partName(d.id)), h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.max(0, Math.min(100, pct))}%` })),
        h('span', { class: 'w' + (st === 'Healthy' ? '' : ' bad') }, st));
    })) ?? []);
  const sideSteps = (odd: 0 | 1) => h('span', { class: 'cs-hpsteps' }, marks.map((x, i) => (i % 2 === odd
    ? h('span', { class: x.l === level ? 'now' : '', style: `left:${x.at}%` }, x.l) : null)));
  const btn = h('button', { class: 'cs-hpbtn', type: 'button', 'aria-expanded': String(partOpen.on), title: 'Click to show or hide each body part',
    onclick: () => { partOpen.on = !partOpen.on; parts.hidden = !partOpen.on; btn.setAttribute('aria-expanded', String(partOpen.on)); } },
    h('span', { class: 'cs-row' }, h('span', {}, `Health · ${level} ${partOpen.on ? '⌄' : '›'}`), h('b', {}, `${whole(hp)} HP`)),
    sideSteps(0),
    h('span', { class: 'cs-hptrack' }, h('b', { style: `width:${left}%` }), segs.slice(0, -1).map((x) => h('i', { style: `left:${x.from}%` }))),
    sideSteps(1));
  btn.addEventListener('click', () => { (btn.querySelector('.cs-row span') as HTMLElement).textContent = `Health · ${level} ${partOpen.on ? '⌄' : '›'}`; });
  return [btn, parts];
}

/** Compact sheet beside the story: health, standing defense and skills above 0. */
export function sideSheet(s: GameState, p: Actor, last?: LogLine): HTMLElement[] {
  const def = standing(s, p);
  const gains = last?.gains ?? {}; // V1b: skill gains from the last played turn
  const healed = new Set((last?.heals ?? []).flatMap((x) => x.parts.filter((pt) => pt.to !== pt.from).map((pt) => pt.id))); // H2 a
  const atk = attackOf(s, p);
  return [
    ...healthBar(s, p, healed, last?.turn ?? -1),
    h('div', { class: 'cs-row' }, h('span', {}, `Standing attack · ${atk?.name ?? 'no weapon'}`), h('b', {}, whole(atk?.value ?? null))),
    h('div', { class: 'cs-row' }, h('span', {}, `Standing defense · ${def.kind}`), h('b', {}, whole(def.value))),
    ...trees(s, p, false).map((t) => h('div', { class: 'cs-mini', style: `--t:var(--${t.c})` },
      h('div', { class: 'th' }, h('span', {}, t.name.replace(/^Combat – /, '')), h('span', {}, String(t.sum))),
      t.rows.map((r) => h('div', { class: 'r' + (gains[r.id] ? ' up' : '') },
        h('span', {}, skillName(r.id), r.tagged ? [' ', tag()] : null, marked(p, r.id) ? markDot() : null, gains[r.id] ? h('span', { class: 'gain', title: 'Improved this turn' }, `▲${gains[r.id]}`) : null),
        bar(r.raw), h('b', {}, String(r.raw)))))),
  ];
}
