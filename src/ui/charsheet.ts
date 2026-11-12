// Character sheet pieces (approved mock-up round 2): the character card, skill bars by tree, and the
// compact side sheet on the Play screen. Display only: every number comes from the ruleset or the saved actor.
import type { Actor, GameState, HealthLevel, LogLine, PartState } from '../types';
import { CONFIG } from '../config';
import { actorBody, getLibrary, itemDef } from '../library';
import { defaultMode, effectiveSkill, healthLevel, modeSkill, TAG_MARK, totalHp, trueSkill, usedOffSheet } from '../ruleset';
import { poolState, SHOWN_LEVELS, shownLevel } from '../ruleset/body';
import { defenseItem } from '../ruleset/gear';
import { achievementName, charLevel, freeLevelsOwed, keepCapstone, levelTarget, spendXp, swapCapstone, xpToNext } from '../engine/xp';
import { classMaxLevel } from '../library/spawn';
import { treeBlock } from '../ruleset/access';
import { augmentWindow, learningWindow } from '../ruleset/improve';
import { h } from './kit';
import { personalityBlock } from './personality';
import { ageText } from '../ruleset/age';
import { callName } from '../views';
import { skillName, SKILL_SUB, TREE_VIEW } from './creation';
import { SK, DEFENSE_SKILL } from '../library/skillIds';
import { CLASS_TIERS, HEALTH_LEVELS, MORALE_LEVELS, PART_STATES } from '../scales';
import { maxMorale, moraleLevel, moraleLostPct } from '../ruleset/morale';
import { coins, coinWords } from '../engine/trade';

/** Set by a gear link on the character card; the Inventory page opens that item once. */
export const invFocus: { id: string | null } = { id: null };

const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const BAR_SCALE = 100; // display only: the rules set no skill maximum yet (D-3)

export function hpLeft(s: GameState, p: Actor): { hp: number | null; total: number | null } {
  const total = safe(() => totalHp(s, p));
  return { total, hp: total === null ? null : total * (1 - p.core.condition.hpLostPct / 100) };
}

function standing(s: GameState, p: Actor): { kind: string; value: number | null } {
  const kind = p.core.standingDefense;
  const value = safe(() => effectiveSkill(s, p, DEFENSE_SKILL[kind], { itemId: defenseItem(s, p, kind)?.id }).value);
  return { kind, value };
}

/** Standing attack: the first usable weapon mode at reach 0 and its effective skill (same as the creation preview). */
function attackOf(s: GameState, p: Actor): { name: string; value: number | null } | null {
  const m = safe(() => defaultMode(s, p, 0));
  if (!m) return null;
  const inst = p.core.inventory.find((i) => i.id === m.itemId);
  const natural = m.itemId.startsWith('natural:') ? getLibrary().attackModes?.[m.mode.id]?.name?.toLowerCase() ?? m.mode.id : undefined; // a body attack has no item: name its mode (fists)
  return { name: natural ?? safe(() => itemDef(s, inst!.itemId).name) ?? m.itemId, value: safe(() => effectiveSkill(s, p, modeSkill(m.mode), { itemId: m.itemId, modeId: m.mode.id }).value) };
}

/** Trees the player has points in, each with its open skills. */
export function trees(s: GameState, p: Actor, withZero: boolean) {
  const lib = getLibrary(), used = usedOffSheet(p);
  return TREE_VIEW.filter((t) => lib.trees[t.id]).map((t) => {
    // a skill rolled but not on the sheet yet shows at 0 (fists use Strike), so the player sees it learning
    const ks = lib.trees[t.id].skills.filter((k) => p.core.skills[k] !== undefined || used.includes(k));
    const rows = ks.map((k) => ({ id: k, raw: p.core.skills[k]?.raw ?? 0, tagged: p.core.skills[k]?.state === 'tagged', off: p.core.skills[k] === undefined }));
    return { id: t.id, c: t.c, name: lib.trees[t.id].name, block: treeBlock(p, t.id), sum: rows.reduce((a, r) => a + r.raw, 0), rows: withZero ? rows : rows.filter((r) => r.raw > 0 || r.off) };
  }).filter((t) => t.sum > 0 || t.rows.some((r) => r.off));
}

/** a tagged skill's mark; hovering it says Tagged */
export const tag = () => h('span', { class: 'tag', title: 'Tagged', 'aria-label': 'tagged' }, TAG_MARK);
const offNote = () => h('small', { class: 'off', title: 'You have used this skill. It is not on your sheet yet and learns as you use it.' }, 'used');
/** V3a: a skill marked for an improvement roll */
const markDot = () => h('span', { class: 'mk-dot', title: 'Marked: rolls to improve when this fight ends', 'aria-label': 'marked to improve' });
const marked = (p: Actor, id: string) => !!p.progression?.marks.includes(id);
const pct = (n: number) => Math.max(0, Math.min(100, (n / BAR_SCALE) * 100));
/** the skill's learning window: the opposition range a use of it learns from (SP2) */
/** an augmenting skill learns only on the rolls it adds to, at that roll's level (AU1), so it shows that roll's window */
type Win = { lo: number; hi: number; via?: string };
const windowOf = (p: Actor, id: string): Win => {
  const aug = augmentWindow(p, id);
  const [lo, hi] = (aug?.window ?? learningWindow(p.core.skills[id]?.raw ?? 0, trueSkill(p, id))).map((n) => Math.max(0, Math.round(n)));
  return { lo, hi, via: aug ? skillName(aug.via) : undefined };
};
const winText = (w: Win) => `${w.via ? `via ${w.via} ` : ''}${w.lo}–${w.hi}`;
const winTitle = (w: Win) => `Learns from opposition ${w.lo} to ${w.hi}${w.via ? `, on ${w.via} rolls it adds to` : ''}`;
const bar = (raw: number, win?: Win) => h('div', { class: 'cs-bar' }, h('b', { style: `width:${pct(raw)}%` }),
  win ? h('i', { class: 'lw' + (win.via ? ' via' : ''), style: `left:${pct(win.lo)}%;width:${pct(win.hi) - pct(win.lo)}%`, title: winTitle(win) }) : null);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const whole = (n: number | null) => (n === null ? '—' : String(+n.toFixed(2))); // fractions shown, not rounded (OQ-25); toFixed only drops float noise

/** one row of level names over the card's equal boxes, alternating above (0) and below (1) the bar. The boxes run
 * Critical on the left to Bruised, then a 7th box for Unhurt on the right, so the bar empties from the
 * right like the side sheet's. Unhurt and Incapacitated are not named. */
const steps = (boxes: HealthLevel[], level: HealthLevel, below: 0 | 1) => h('div', { class: `cs-steps ${below ? 'down' : 'up'}` },
  boxes.map((l, i) => (l !== 'unhurt' && i % 2 === below ? h('span', { class: l === level ? 'now' : '', style: `grid-column:${i + 1}` }, HEALTH_LEVELS.name(l)) : null)));

export function charCard(s: GameState, p: Actor): HTMLElement {
  const { hp } = hpLeft(s, p);
  const level = shownLevel(healthLevel(p));
  const levels = SHOWN_LEVELS().map(([l]) => l);
  // boxes left to right: Critical … Bruised, then Unhurt; a box is lit while the character is at its level or better
  const boxes = [...levels.slice(1, -1).reverse(), levels[0]];
  const at = levels.indexOf(level);
  const place = s.places.find((x) => x.id === p.placeId)?.names.current;
  const cls = p.core.classes.find((c) => c.state === 'current')?.classId ?? '';
  const def = standing(s, p);
  const atk = attackOf(s, p);
  const gear = p.core.inventory.filter((i) => i.equippedIn?.length).map((i) =>
    h('span', {}, h('a', { href: '#inv', class: 'cs-item', title: 'Open in Inventory for its full stats', onclick: () => { invFocus.id = i.id; } }, cap(safe(() => itemDef(s, i.itemId).name) ?? i.itemId)), ` · ${i.equippedIn!.some((x) => x.startsWith('hand:')) ? 'held' : 'worn'}`));
  return h('div', { class: 'cs-card' },
    h('div', { class: 'cs-who' }, h('div', { class: 'cs-sigil', 'aria-hidden': 'true' }, '⚔'),
      h('div', {}, h('b', {}, p.names.current || (getLibrary().classes[cls]?.name ?? cls)), h('span', {}, [ageText(s, p), place ? `In the ${place}` : ''].filter(Boolean).join(' · ')))), // AG16
    h('div', { class: 'cs-track' },
      h('div', { class: 'cs-row' }, h('span', {}, 'Health'), h('b', {}, `${HEALTH_LEVELS.name(level)} · ${whole(hp)} HP`)),
      // each level named at its segment, alternating one above the bar and one below
      steps(boxes, level, 0),
      h('div', { class: 'cs-hp', title: `Health track: ${levels.map(HEALTH_LEVELS.name).join(', ')}` }, boxes.map((l) => h('i', { class: at <= levels.indexOf(l) ? 'on' : '', title: HEALTH_LEVELS.name(l), 'aria-label': HEALTH_LEVELS.name(l) }))),
      steps(boxes, level, 1),
      bodyFigure(s, p)),
    xpTrack(s, p),
    capstoneChoice(s, p),
    h('div', { class: 'cs-figs' },
      h('div', {}, h('b', {}, whole(atk?.value ?? null)), h('span', {}, atk ? `Standing attack · ${atk.name}` : 'Standing attack · no weapon')),
      h('div', {}, h('b', {}, whole(def.value)), h('span', {}, `Standing defense · ${def.kind}`))),
    gear.length ? h('div', { class: 'cs-gear' }, h('p', { class: 'hs-label' }, 'In hand and worn'), gear) : null,
    personalityBlock(p),
    h('div', { class: 'cs-gear' }, h('p', { class: 'hs-label' }, 'Achievements'),
      (p.progression?.achievements ?? []).length
        ? p.progression!.achievements!.map((a) => h('span', {}, achievementName(s, a), ` · turn ${a.turn}`, a.replacedBy ? ' · replaced by the next level' : ''))
        : h('span', {}, 'None yet')));
}

/** X9/X15: one XP bar, and a picker for the class the next level goes to when there is a choice. A class at
 * its top level (classMaxLevel, by tier) can't be picked; while no class can take a level, XP banks and the picker asks for one. */
function xpTrack(s: GameState, p: Actor): HTMLElement | null {
  const pr = p.progression;
  if (!pr) return null;
  const lib = getLibrary();
  const need = xpToNext(p);
  const open = p.core.classes.filter((c) => c.state === 'current' || c.state === 'unlocked');
  const cur = open.find((c) => c.state === 'current');
  const target = levelTarget(p);
  const name = (id: string) => lib.classes[id] ? `${lib.classes[id].name} (${CLASS_TIERS.name(lib.classes[id].tier)})` : id;
  const capped = (c: { classId: string; level: number }) => c.level >= classMaxLevel(c.classId);
  const el: HTMLElement = h('div', { class: 'cs-track' },
    h('div', { class: 'cs-row' }, h('span', {}, `Level ${charLevel(p)}`), h('b', {}, `${+pr.xp.toFixed(6)} / ${need} XP`)),
    h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.min(100, (pr.xp / need) * 100)}%` })),
    !target ? h('small', {}, `Your class is at its top level. XP${freeLevelsOwed(p) ? ` and ${freeLevelsOwed(p)} free level${freeLevelsOwed(p) === 1 ? '' : 's'} are` : ' is'} banked until you pick a class for the next level.`) : null,
    open.length > 1 || !target
      ? h('label', { class: 'cs-row' }, h('span', {}, 'Next level goes to'),
        h('select', { onchange: (e: Event) => { pr.nextClass = (e.target as HTMLSelectElement).value; spendXp(s); el.replaceWith(xpTrack(s, p) ?? ''); } },
          !target ? h('option', { value: '', selected: true, disabled: true }, 'Choose a class') : null,
          open.map((c) => h('option', { value: c.classId, ...(capped(c) ? { disabled: true } : {}), ...(target && (pr.nextClass ?? cur?.classId) === c.classId ? { selected: true } : {}) },
            capped(c) ? `${name(c.classId)} (level ${c.level}, its top level)` : name(c.classId)))))
      : null);
  return el;
}

/** alternate capstones on offer: the default is inactive until the player keeps it or picks an alternate (final) */
function capstoneChoice(s: GameState, p: Actor): HTMLElement | null {
  const offers = Object.entries(p.progression?.capstoneOptions ?? {}).filter(([, ids]) => ids.length);
  if (!offers.length) return null;
  const lib = getLibrary();
  const perk = (id: string) => lib.perks[id];
  const el: HTMLElement = h('div', { class: 'cs-gear' }, h('p', { class: 'hs-label' }, 'Capstone choice'),
    offers.map(([classId, ids]) => {
      const base = (lib.classes[classId]?.capstone ?? []).map((id) => perk(id)?.name ?? id).join(', ');
      const redraw = () => el.replaceWith(capstoneChoice(s, p) ?? '');
      return h('div', {}, h('span', {}, `${lib.classes[classId]?.name ?? classId}: ${base || 'the default capstone'} is inactive until you choose. The choice is final.`),
        h('div', { class: 'actions' },
          h('button', { type: 'button', onclick: () => { keepCapstone(p, classId); redraw(); } }, `Keep ${base || 'the default'}`),
          ids.map((id) => h('button', { type: 'button', title: perk(id)?.story ?? '',
            onclick: () => { swapCapstone(s, classId, id); redraw(); } }, perk(id)?.name ?? id))));
    }));
  return el;
}

export function treeBars(s: GameState, p: Actor): HTMLElement {
  return h('div', { class: 'cs-trees' }, trees(s, p, true).map((t) =>
    h('div', { class: 'cs-tree', style: `--t:var(--${t.c})` },
      h('div', { class: 'cs-tree-h' }, h('b', {}, t.name), h('span', {}, `${t.sum} pts`)),
      t.block ? h('small', { class: 'cs-tree-block' }, t.block) : null, // TA10: points kept in a tree the character can't use
      t.rows.map((r) => h('div', { class: 'cs-sk' + (r.raw ? '' : ' zero') },
        h('div', { class: 'n' }, skillName(r.id), r.tagged ? [' ', tag()] : null, r.off ? [' ', offNote()] : null, marked(p, r.id) ? markDot() : null, SKILL_SUB[r.id] ? h('small', {}, SKILL_SUB[r.id]) : null),
        bar(r.raw, windowOf(p, r.id)), ((w) => h('div', { class: 'lwn', title: winTitle(w) }, winText(w)))(windowOf(p, r.id)), skillNum(trueSkill(p, r.id), r.raw))))));
}

/** the skill's true value; when raw differs it shows only on hover or keyboard focus, as a small card beside the number */
function skillNum(value: number, raw: number): HTMLElement {
  if (value === raw) return h('div', { class: 'num' }, String(value));
  return h('div', { class: 'num has-raw', tabindex: '0', 'aria-label': `${value}, raw ${raw}` }, String(value),
    h('span', { class: 'raw-tip', 'aria-hidden': 'true' }, `Raw ${raw}`));
}

const partOpen = { on: false, autoTurn: -1 }; // body-part list under the health bar, kept open across turns; opens once on a turn that healed a part (H2 a)
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Body figure: the body type's silhouette, each part tinted by its state; the general area shows
 * total health. Clicking a part names it with its state and amount. Null for body types without a figure. */
export function bodyFigure(s: GameState, p: Actor, healed: Set<string> = new Set()): HTMLElement | null {
  const ct = safe(() => actorBody(s, p));
  if (!ct?.figure) return null;
  const { hp, total } = hpLeft(s, p);
  const info = (id: string): { name: string; state: PartState; amount: string } => {
    if (id === 'general') return { name: cap(ct.general.name), state: poolState(100 - p.core.condition.hpLostPct), amount: `${whole(hp)} of ${whole(total)} HP` };
    const d = ct.parts.find((x) => x.id === id);
    const pct = p.core.condition.parts[id] ?? 100;
    const pool = total === null || !d ? null : total * (CONFIG.PART_SHARE[d.size] ?? 0);
    return { name: partName(id), state: poolState(pct), amount: pool === null ? '' : `${whole(Math.max(0, pool * pct / 100))} of ${whole(pool)}` };
  };
  const shapes = Object.entries(ct.figure.parts).map(([id, d]) => {
    const i = info(id);
    const hl = healed.has(id) ? ' · healed this turn' : '';
    return `<path data-part="${esc(id)}" class="bf-${i.state}${hl ? ' bf-healed' : ''}" d="${esc(d)}"><title>${esc(i.name)} · ${PART_STATES.name(i.state)}${hl}</title></path>`;
  }).join('');
  const svg = h('div', { class: 'bf-svg' });
  svg.innerHTML = `<svg viewBox="${esc(ct.figure.viewBox)}" role="img" aria-label="Body parts"><defs><pattern id="bf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" style="fill:var(--c3)"/><rect width="2.5" height="6" style="fill:var(--bg)" fill-opacity=".6"/></pattern></defs>${shapes}</svg>`;
  const out = h('p', { class: 'bf-out', 'aria-live': 'polite' });
  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('[data-part]');
    svg.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
    if (!el) { out.textContent = ''; return; }
    el.classList.add('on');
    const i = info(el.getAttribute('data-part')!);
    out.textContent = [i.name, PART_STATES.name(i.state), i.amount, healed.has(el.getAttribute('data-part')!) ? 'healed this turn' : ''].filter(Boolean).join(' · ');
  });
  const key = h('p', { class: 'bf-key' }, PART_STATES.keys.map((st) => h('span', {}, h('i', { class: `bf-${st}` }), PART_STATES.name(st))));
  return h('div', { class: 'bf' }, svg, out, key);
}
const partName = (id: string) => cap(id.replace(/_/g, ' '));

/** Health bar with the health-track thresholds (Part 3) marked; clicking it opens each body part's pool and state. */
/** width of the side sheet bar's Unhurt section, in % of the bar */
const UNHURT_SECTION = 12;

function healthBar(s: GameState, p: Actor, healed: Set<string>, turn: number, changed: Set<string> = new Set()): HTMLElement[] {
  // the body figure opens by itself once on a turn that healed or changed a part
  if ((healed.size || changed.size) && partOpen.autoTurn !== turn) { partOpen.on = true; partOpen.autoTurn = turn; }
  const { hp, total } = hpLeft(s, p);
  const level = shownLevel(healthLevel(p));
  const left = Math.max(0, 100 - p.core.condition.hpLostPct);
  // segments by % left: Bruised 85–100, Hurt 70–85 … Critical 0–25 (Unhurt is only the full bar, Incapacitated the empty one)
  const track = SHOWN_LEVELS();
  const segs = track.slice(1, -1).map(([l, max], i, all) => ({ l, from: 100 - Math.min(100, max), to: i ? 100 - all[i - 1][1] : 100 }));
  // each segment's level named mid-segment, alternating one above the bar and one below; Unhurt (the full bar) and
  // Incapacitated (the empty one) are not named
  // the Unhurt section is the bar's 7th section, on the right; the six damage sections share the rest by their % ranges
  // (a separate box read as detached)
  const scale = (100 - UNHURT_SECTION) / 100;
  const marks = [...segs].reverse().map((x) => ({ l: x.l, at: ((x.from + x.to) / 2) * scale }));
  const fill = level === 'unhurt' ? 100 : left * scale;
  const parts = h('div', { class: 'cs-parts', hidden: !partOpen.on, 'aria-label': 'Body parts' },
    h('p', { class: 'hs-label' }, 'Body parts'),
    bodyFigure(s, p, healed) ?? safe(() => actorBody(s, p).parts.map((d) => {
      const pct = p.core.condition.parts[d.id] ?? 100;
      const pool = total === null ? null : total * (CONFIG.PART_SHARE[d.size] ?? 0);
      const st = poolState(pct);
      return h('div', { class: 'cs-part', title: pool === null ? '' : `${whole(pool * pct / 100)} of ${whole(pool)}` },
        h('span', {}, partName(d.id)), h('div', { class: 'cs-bar' }, h('b', { style: `width:${Math.max(0, Math.min(100, pct))}%` })),
        h('span', { class: 'w' + (st === 'healthy' ? '' : ' bad') }, PART_STATES.name(st)));
    })) ?? []);
  const sideSteps = (odd: 0 | 1) => h('span', { class: 'cs-hpsteps' }, marks.map((x, i) => (i % 2 === odd
    ? h('span', { class: x.l === level ? 'now' : '', style: `left:${x.at}%` }, HEALTH_LEVELS.name(x.l)) : null)));
  const btn = h('button', { class: 'cs-hpbtn', type: 'button', 'aria-expanded': String(partOpen.on), title: 'Click to show or hide each body part',
    onclick: () => { partOpen.on = !partOpen.on; parts.hidden = !partOpen.on; btn.setAttribute('aria-expanded', String(partOpen.on)); } },
    // the current level sits beside the HP number, as on the character card
    h('span', { class: 'cs-row' }, h('span', {}, `Health ${partOpen.on ? '⌄' : '›'}`), h('b', {}, h('span', { 'data-m': 'hp-level' }, HEALTH_LEVELS.name(level)), ' · ', h('span', { 'data-m': 'hp' }, whole(hp)), ' HP')),
    sideSteps(0),
    // the 7th section lights only when Unhurt, so a full Bruised bar can't be read as Unhurt
    h('span', { class: 'cs-hptrack', title: 'Health track, Unhurt on the right', 'data-m': 'hp-track' }, h('b', { style: `width:${fill}%` }),
      [...segs.slice(0, -1).map((x) => x.from * scale), 100 - UNHURT_SECTION].map((at) => h('i', { style: `left:${at}%` }))),
    sideSteps(1));
  btn.addEventListener('click', () => { (btn.querySelector('.cs-row span') as HTMLElement).textContent = `Health ${partOpen.on ? '⌄' : '›'}`; });
  return [btn, partChips(s, p), parts];
}

/** each body part that is not Healthy, as "Left leg crippled" in its state's colour; none while all are Healthy */
export function partChips(s: GameState, p: Actor): HTMLElement {
  const bad = (safe(() => actorBody(s, p).parts) ?? []).map((d) => ({ id: d.id, st: poolState(p.core.condition.parts[d.id] ?? 100) })).filter((x) => x.st !== 'healthy');
  return h('p', { class: 'cs-pchips', hidden: !bad.length }, bad.map((x) => h('span', { class: `cs-pchip ps-${x.st}`, 'data-part': x.id }, `${partName(x.id)} ${PART_STATES.name(x.st).toLowerCase()}`)));
}

/** NT20: Shaken and Swayed as chips with the roll penalty; the title names who caused it and how long it lasts */
/** MB11: the player's morale bar, a second bar under health: level word, how much is left, and the track's thresholds as ticks */
export function moraleBar(p: Actor, full: boolean): HTMLElement[] {
  const level = MORALE_LEVELS.name(moraleLevel(p));
  const lost = Math.max(0, Math.min(100, moraleLostPct(p)));
  const max = maxMorale(p);
  const left = Math.round(max * (100 - lost) / 100);
  const ticks = full ? CONFIG.MORALE_TRACK.slice(1, -1).map(([, at]) => h('i', { style: `left:${100 - Math.min(100, at)}%` })) : [];
  return [
    h('span', { class: 'cs-row' }, h('span', {}, 'Morale'), h('b', {}, h('span', { 'data-m': 'morale-level' }, level), full ? [' · ', h('span', { 'data-m': 'morale-left' }, String(left)), ` / ${max}`] : null)),
    h('span', { class: 'cs-hptrack cs-morale', title: 'Morale track, Calm on the right', role: 'img', 'aria-label': `Morale: ${level}`, 'data-m': 'morale-track' },
      h('b', { style: `width:${100 - lost}%` }), ...ticks),
  ];
}

/** MB40–MB43: after /yield, who took it, who is still deciding and who fights on; nothing when the player has not yielded */
export function yieldBlock(s: GameState): HTMLElement | null {
  const y = s.yielding;
  if (!y) return null;
  const names = (ids: string[]) => ids.map((id) => cap(callName(s, s.player.id, id))).join(', ');
  const row = (k: string, ids: string[], cls: string) => ids.length ? h('span', { class: 'yr ' + cls }, h('span', {}, k), h('b', {}, names(ids))) : null;
  return h('div', { class: 'cs-yield' }, h('span', { class: 'hs-label' }, 'You yielded'),
    row('Took it', y.accepted, 'took'), row('Deciding', y.pending, 'wait'), row('Fight on', y.refused, 'refused'));
}

export function pressureChips(s: GameState, p: Actor): HTMLElement {
  const rows = Object.entries(p.pressure ?? {}).flatMap(([id, x]) => (['shaken', 'swayed'] as const).filter((k) => x[k]).map((k) => {
    const who = callName(s, p.id, id);
    return h('span', { class: 'cs-pchip ps-pressure', title: `${cap(k)} by ${who}: −${x[k]} on every roll against them, until this encounter ends` }, `${cap(k)} −${x[k]}`);
  }));
  return h('p', { class: 'cs-pchips', hidden: !rows.length }, rows);
}

/** M-35 (Q2): what a gear line says about an item's own pools: a shield's state (its words are the part states), an
 * armor pool's points left ("head 12 of 20", "head empty"); null for items with neither */
export function gearNote(s: GameState, i: Actor['core']['inventory'][number]): { text: string; cls: string } | null {
  const d = safe(() => itemDef(s, i.itemId));
  if (!d) return null;
  if (d.shield) { const st = poolState(i.pools?.shield ?? 100); return { text: PART_STATES.name(st), cls: `ps-${st}` }; }
  const pools = Object.entries(d.armor?.pools ?? {});
  if (!pools.length) return null;
  const bits = pools.map(([part, pts]) => {
    const left = Math.max(0, ((i.pools?.[part] ?? 100) / 100) * pts);
    return left <= 0 ? `${part.replace(/_/g, ' ')} empty` : `${part.replace(/_/g, ' ')} ${whole(left)} of ${whole(pts)}`;
  });
  return { text: bits.join(', '), cls: bits.some((b) => b.endsWith('empty')) ? 'ps-destroyed' : 'ps-pool' };
}

/** the gear lines on the play sheet: each held or worn item by name, with its gearNote (M-35) */
function gearLine(s: GameState, p: Actor, held: boolean): HTMLElement[] {
  const on = p.core.inventory.filter((i) => i.equippedIn?.length && i.equippedIn.some((x) => x.startsWith('hand:')) === held);
  return on.map((i, k) => {
    const n = gearNote(s, i);
    return h('span', { class: 'cs-gi', 'data-gear': i.id }, k ? ' · ' : '', cap(safe(() => itemDef(s, i.itemId).name) ?? i.itemId),
      n ? h('span', { class: `cs-gn ${n.cls}`, 'data-m': 'gear-note' }, n.text) : null);
  });
}

/** what the character holds and wears, by item name: "arming sword · round shield" */
export function heldWorn(s: GameState, p: Actor): { held: string[]; worn: string[] } {
  const on = p.core.inventory.filter((i) => i.equippedIn?.length);
  const name = (i: Actor['core']['inventory'][number]) => safe(() => itemDef(s, i.itemId).name) ?? i.itemId;
  return { held: on.filter((i) => i.equippedIn!.some((x) => x.startsWith('hand:'))).map(name), worn: on.filter((i) => !i.equippedIn!.some((x) => x.startsWith('hand:'))).map(name) };
}

/** Layout A: the narrow status strip beside the story (health word and bar, damaged parts, what is held); a click opens the full sheet */
export function statusStrip(s: GameState, p: Actor): HTMLElement[] {
  const level = shownLevel(healthLevel(p));
  const left = level === 'unhurt' ? 100 : Math.max(0, 100 - p.core.condition.hpLostPct) * (100 - UNHURT_SECTION) / 100;
  const hw = heldWorn(s, p);
  return [
    h('span', { class: 'cs-row' }, h('span', {}, 'Health'), h('b', {}, h('span', { 'data-m': 'hp-level' }, HEALTH_LEVELS.name(level)))),
    h('span', { class: 'cs-hptrack', 'data-m': 'hp-track' }, h('b', { style: `width:${left}%` })),
    partChips(s, p),
    ...moraleBar(p, false),
    ...[yieldBlock(s)].filter((x): x is HTMLElement => !!x),
    pressureChips(s, p),
    h('span', { class: 'cs-held' }, h('span', { class: 'hs-label' }, 'Held'), hw.held.length ? gearLine(s, p, true) : 'Nothing'),
  ];
}

/** Compact sheet beside the story: health, morale, gear, coin and skills above 0 (standing attack and defense live on the Character page). */
export function sideSheet(s: GameState, p: Actor, last?: LogLine, changed?: Set<string>): HTMLElement[] {
  const gains = last?.gains ?? {}; // V1b: skill gains from the last played turn
  const healed = new Set((last?.heals ?? []).flatMap((x) => x.parts.filter((pt) => pt.to !== pt.from).map((pt) => pt.id))); // H2 a
  return [
    // health and its part chips, then morale, then the body figure (when open)
    ...((hb) => [hb[0], hb[1], h('div', { class: 'cs-mbar' }, ...moraleBar(p, true)), ...[yieldBlock(s)].filter((x): x is HTMLElement => !!x), ...hb.slice(2)])(healthBar(s, p, healed, last?.turn ?? -1, changed)),
    pressureChips(s, p),
    h('div', { class: 'cs-row' }, h('span', {}, 'Held / worn'), h('b', { class: 'cs-hw' }, ...((g) => g.length ? g.map((x, k) => (k && !x.textContent?.startsWith(' · ') ? [' · ', x] : x)) : ['Nothing'])([...gearLine(s, p, true), ...gearLine(s, p, false)]))),
    h('div', { class: 'cs-row' }, h('span', {}, 'Coin'), h('b', {}, h('span', { 'data-m': 'coin' }, coinWords(coins(p))))),
    ...[xpLine(p)].filter((x): x is HTMLElement => !!x),
    ...trees(s, p, false).map((t) => h('div', { class: 'cs-mini', style: `--t:var(--${t.c})` },
      h('div', { class: 'th' }, h('span', {}, t.name.replace(/^Combat – /, '')), h('span', {}, String(t.sum))),
      t.rows.map((r) => h('div', { class: 'r' + (gains[r.id] ? ' up' : ''), 'data-skill': r.id },
        h('span', {}, skillName(r.id), r.tagged ? [' ', tag()] : null, r.off ? [' ', offNote()] : null, marked(p, r.id) ? markDot() : null, gains[r.id] ? h('span', { class: 'gain', title: 'Improved this turn' }, `▲${gains[r.id]}`) : null),
        bar(r.raw, windowOf(p, r.id)), h('b', { 'data-m': 'skill' }, String(r.raw)))))),
  ];
}

/** M-36: the level and XP on the play sheet, as a bar to the next level */
function xpLine(p: Actor): HTMLElement | null {
  const v = xpShown(p);
  if (!v) return null;
  return h('div', { class: 'cs-xp' },
    h('div', { class: 'cs-row' }, h('span', { 'data-m': 'lvl' }, `Level ${v.level}`), h('b', {}, h('span', { 'data-m': 'xp' }, whole(v.xp)), ` / ${v.need} XP`)),
    h('div', { class: 'cs-bar', 'data-m': 'xp-track' }, h('b', { style: `width:${v.pct}%` })));
}
const xpShown = (p: Actor) => {
  const pr = p.progression;
  if (!pr) return null;
  const need = xpToNext(p);
  return { level: charLevel(p), xp: pr.xp, need, pct: need > 0 ? Math.min(100, (pr.xp / need) * 100) : 100 };
};

/** M-74: every value the play sheet shows, before and after a turn, so the screen animates only what changed */
export type ShownValues = {
  hp: number | null; level: HealthLevel; hpFill: number;
  morale: string; moraleLeft: number; moraleFill: number;
  parts: Record<string, PartState>; skills: Record<string, number>;
  lvl: number | null; xp: number | null; xpPct: number | null; coin: number; points: number;
  gear: Record<string, { name: string; note: string }>; chips: string[]; yielded: boolean;
};
export function shownValues(s: GameState, p: Actor): ShownValues {
  const level = shownLevel(healthLevel(p));
  const left = Math.max(0, 100 - p.core.condition.hpLostPct);
  const scale = (100 - UNHURT_SECTION) / 100;
  const lost = Math.max(0, Math.min(100, moraleLostPct(p)));
  const xp = xpShown(p);
  return {
    hp: hpLeft(s, p).hp, level, hpFill: level === 'unhurt' ? 100 : left * scale,
    morale: MORALE_LEVELS.name(moraleLevel(p)), moraleLeft: Math.round(maxMorale(p) * (100 - lost) / 100), moraleFill: 100 - lost,
    parts: Object.fromEntries((safe(() => actorBody(s, p).parts) ?? []).map((d) => [d.id, poolState(p.core.condition.parts[d.id] ?? 100)])),
    skills: Object.fromEntries(trees(s, p, false).flatMap((t) => t.rows.map((r) => [r.id, r.raw]))),
    lvl: xp?.level ?? null, xp: xp?.xp ?? null, xpPct: xp?.pct ?? null, coin: coins(p),
    gear: Object.fromEntries(p.core.inventory.filter((i) => i.equippedIn?.length).map((i) => [i.id, { name: cap(safe(() => itemDef(s, i.itemId).name) ?? i.itemId), note: gearNote(s, i)?.text ?? '' }])),
    chips: Object.entries(p.pressure ?? {}).flatMap(([id, x]) => (['shaken', 'swayed'] as const).filter((k) => x[k]).map((k) => `${id}:${k}`)),
    yielded: !!s.yielding,
    points: p.progression?.unspentPerkPoints ?? 0,
  };
}
