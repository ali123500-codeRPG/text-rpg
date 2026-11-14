// Character sheet pieces (approved mock-up round 2): the character card, skill bars by tree, and the
// compact side sheet on the Play screen. Display only: every number comes from the ruleset or the saved actor.
import type { Actor, GameState, HealthLevel, LogLine, PartState } from '../types';
import { CONFIG } from '../config';
import { actorBody, getLibrary, itemDef } from '../library';
import { defaultMode, effectiveSkill, healthLevel, modeSkill, TAG_MARK, totalHp, trueSkill, usedOffSheet } from '../ruleset';
import { poolState, SHOWN_LEVELS, shownLevel } from '../ruleset/body';
import { augmentsOf, defenseItem, isHeld, tradesOut } from '../ruleset/gear';
import { hollowedMult, type SkillPart } from '../ruleset/perks';
import { charLevel, freeLevelsOwed, keepCapstone, levelTarget, swapCapstone, xpFill, xpToNext } from '../engine/xp';
import { essenceSlots } from '../engine/essence';
import { treeBlock } from '../ruleset/access';
import { augmentWindow, burdenOf, burdenParts, learningWindow } from '../ruleset/improve';
import { h } from './kit';
import { classIcon } from './itemIcons';
import { openPop } from './pop';
import { powerFigure } from './power';
import { ageText } from '../ruleset/age';
import { callName, staminaOf } from '../views';
import { fatigueLevel } from '../ruleset/fatigue';
import { skillName, SKILL_SUB, TREE_VIEW } from './creation';
import { DEFENSE_SKILL } from '../library/skillIds';
import { CLASS_TIERS, FATIGUE_LEVELS, HEALTH_LEVELS, MORALE_LEVELS, PART_STATES, type MoraleLevel } from '../scales';
import { maxMorale, moraleLevel, moraleLostPct } from '../ruleset/morale';
import { coins, coinWords } from '../engine/trade';
import { engagementEndS } from '../ruleset/actionTime';
import { cap, r1, theName } from '../words';

/** Set by a gear link on the character card; the Inventory page opens that item once. */
export const invFocus: { id: string | null } = { id: null };
/** Set by a link from another page; the Character page opens that pop-up once on arrival (CP1: its big sections live in pop-ups) */
export const charFocus: { open: 'essences' | 'perks' | 'classes' | null } = { open: null };

const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const BAR_SCALE = CONFIG.SKILL_CAP; // display only: the bar fills at the mortal limit; true skill can pass it

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
export function trees(p: Actor, withZero: boolean) {
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
type Win = { lo: number; hi: number; via?: string };
/** the skill's learning window: the opposition range a use of it learns from (SP2). An augmenting skill learns only on the
 * rolls it adds to, at that roll's level (AU1), so it shows that roll's window */
const windowOf = (p: Actor, id: string): Win => {
  const aug = augmentWindow(p, id);
  const [lo, hi] = (aug?.window ?? learningWindow(p.core.skills[id]?.raw ?? 0, trueSkill(p, id))).map((n) => Math.max(0, Math.round(n)));
  return { lo, hi, via: aug ? skillName(aug.via) : undefined };
};
const winText = (w: Win) => `${w.via ? `via ${w.via} ` : ''}${w.lo}–${w.hi}`;
const winTitle = (w: Win) => `Learns from opposition ${w.lo} to ${w.hi}${w.via ? `, on ${w.via} rolls it adds to` : ''}`;
const bar = (raw: number, win?: Win) => h('div', { class: 'cs-bar' }, h('b', { style: `width:${pct(raw)}%` }),
  win ? h('i', { class: 'lw' + (win.via ? ' via' : ''), style: `left:${pct(win.lo)}%;width:${pct(win.hi) - pct(win.lo)}%`, title: winTitle(win) }) : null);
const whole = (n: number | null) => (n === null ? '—' : String(+n.toFixed(2))); // fractions shown, not rounded (OQ-25); toFixed only drops float noise

/** one row of level names over the card's equal boxes, alternating above (0) and below (1) the bar. The boxes run
 * Critical on the left to Bruised, then a 7th box for Unhurt on the right, so the bar empties from the
 * right like the side sheet's. Unhurt and Incapacitated are not named. */
const steps = (boxes: HealthLevel[], level: HealthLevel, below: 0 | 1) => h('div', { class: `cs-steps ${below ? 'down' : 'up'}` },
  boxes.map((l, i) => (l !== 'unhurt' && i % 2 === below ? h('span', { class: l === level ? 'now' : '', style: `grid-column:${i + 1}` }, HEALTH_LEVELS.name(l)) : null)));

/** `openClasses` opens the class tree (the class line is its button); without it the line is plain text */
export function charCard(s: GameState, p: Actor, openClasses?: (opener: HTMLElement) => void): HTMLElement {
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
  return h('div', { class: 'cs-card' },
    h('div', { class: 'cs-who' }, h('div', { class: 'cs-sigil', 'aria-hidden': 'true' }, '⚔'),
      h('div', {}, h('b', {}, p.names.current || (getLibrary().classes[cls]?.name ?? cls)), h('span', {}, [ageText(s, p), place ? `In ${theName(place)}` : ''].filter(Boolean).join(' · ')))), // AG16
    h('div', { class: 'cs-track' },
      h('div', { class: 'cs-row' }, h('span', {}, 'Health'), h('b', {}, `${HEALTH_LEVELS.name(level)} · ${whole(hp)} HP`)),
      // each level named at its segment, alternating one above the bar and one below
      steps(boxes, level, 0),
      h('div', { class: 'cs-hp', title: `Health track: ${levels.map(HEALTH_LEVELS.name).join(', ')}` }, boxes.map((l) => h('i', { class: at <= levels.indexOf(l) ? 'on' : '', title: HEALTH_LEVELS.name(l), 'aria-label': HEALTH_LEVELS.name(l) }))),
      steps(boxes, level, 1)),
    xpTrack(s, p, openClasses),
    capstoneChoice(s, p),
    // the body figure beside the figures (CP5: a click opens each part in a pop-up); gear and personality are tiles under the page
    h('div', { class: 'cs-bodyrow' }, bodyButton(s, p),
      h('div', { class: 'cs-figs' },
        powerFigure(s, p),
        h('div', {}, h('b', {}, whole(atk?.value ?? null)), h('span', {}, atk ? `Standing attack · ${atk.name}` : 'Standing attack · no weapon')),
        h('div', {}, h('b', {}, whole(def.value)), h('span', {}, `Standing defense · ${def.kind}`)))));
}

/** the card's body figure as one button: a click (on a part, or anywhere on it) opens every part's state in a pop-up */
function bodyButton(s: GameState, p: Actor): HTMLElement | null {
  const fig = bodyFigure(s, p);
  if (!fig) return null;
  const svg = fig.querySelector('.bf-svg')!;
  const btn: HTMLElement = h('button', { type: 'button', class: 'cs-bfbtn', 'aria-haspopup': 'dialog', title: 'Each body part and its state', 'aria-label': 'Body parts: open each part and its state' }, svg);
  btn.addEventListener('click', (e) => openBodyPop(s, p, btn, (e.target as Element).closest('[data-part]')?.getAttribute('data-part') ?? undefined));
  return btn;
}

/** CP5: the body parts pop-up: total health, then each part with its state word and what is left of its pool */
export function openBodyPop(s: GameState, p: Actor, opener?: HTMLElement | null, part?: string): void {
  const ct = safe(() => actorBody(s, p));
  if (!ct) return;
  const { hp, total } = hpLeft(s, p);
  const row = (id: string, name: string, pct: number, amount: string) => {
    const st = poolState(pct);
    return h('div', { class: 'bp-row' + (id === part ? ' on' : ''), 'data-part': id }, h('i', { class: `bf-${st}`, 'aria-hidden': 'true' }), h('b', {}, name),
      h('span', { class: 'bp-st' }, PART_STATES.name(st)), h('span', { class: 'bp-amt' }, amount));
  };
  openPop({ title: 'Body', cls: 'bp-pop', opener, body: [
    h('div', { class: 'bp-list' },
      row('general', cap(ct.general.name), 100 - p.core.condition.hpLostPct, `${whole(hp)} of ${whole(total)} HP`),
      ...ct.parts.map((d) => {
        const pct = p.core.condition.parts[d.id] ?? 100;
        const pool = total === null ? null : total * (CONFIG.PART_SHARE[d.size] ?? 0);
        return row(d.id, partName(d.id), pct, pool === null ? '' : `${whole(Math.max(0, pool * pct / 100))} of ${whole(pool)}`);
      })),
    h('p', { class: 'bf-key' }, PART_STATES.keys.map((st) => h('span', {}, h('i', { class: `bf-${st}` }), PART_STATES.name(st)))),
  ] });
}

/** X9/X15: one XP bar, and the class line: the current class, and where the next level goes when that is another class.
 * The line opens the class tree, where the class for the next level is chosen. A class at its top level (classMaxLevel,
 * by tier) takes no levels; while no class can take one, XP banks and the line asks for a class. */
function xpTrack(s: GameState, p: Actor, openClasses?: (opener: HTMLElement) => void): HTMLElement | null {
  const pr = p.progression;
  if (!pr) return null;
  const lib = getLibrary();
  const need = xpToNext(p);
  const cur = p.core.classes.find((c) => c.state === 'current');
  const target = levelTarget(p);
  const name = (id: string) => lib.classes[id]?.name ?? id;
  const line = [cur ? `${name(cur.classId)} · ${CLASS_TIERS.name(lib.classes[cur.classId]?.tier ?? 'tier_0')}` : 'No class',
    target && target.classId !== cur?.classId ? `next level to ${name(target.classId)}` : ''].filter(Boolean).join(' · ');
  const cls: HTMLElement = openClasses
    ? h('button', { type: 'button', class: 'cs-class', 'aria-haspopup': 'dialog', title: 'Open the class tree: how classes link, and where your next level goes',
      onclick: () => openClasses(cls) }, h('span', { class: 'hs-label' }, 'Class'), cur ? classIcon(cur.classId) : '', h('b', {}, line), h('span', { class: 'cs-class-go', 'aria-hidden': 'true' }, '›'))
    : h('div', { class: 'cs-row' }, h('span', {}, 'Class'), h('b', {}, cur ? classIcon(cur.classId) : '', line));
  return h('div', { class: 'cs-track' },
    h('div', { class: 'cs-row' }, h('span', {}, `Level ${charLevel(p)}`), h('b', {}, `${+pr.xp.toFixed(6)} / ${need} XP`)),
    h('div', { class: 'cs-bar' }, h('b', { style: `width:${xpFill(p).pct}%` })),
    cls,
    !target ? h('small', { class: 'cs-bank' }, `Your class is at its top level. XP${freeLevelsOwed(p) ? ` and ${freeLevelsOwed(p)} free level${freeLevelsOwed(p) === 1 ? '' : 's'} are` : ' is'} banked until you pick a class for the next level in the class tree.`) : null);
}

/** 2.7 on the play sheet: the essences held by name, and any offer still waiting, both opening the Character page's Essences pop-up */
function essenceRow(p: Actor): HTMLElement | null {
  const pr = p.progression, held = pr?.essences ?? [], offers = pr?.essenceOffers ?? [];
  if (!pr || (!held.length && !offers.length && charLevel(p) < 2)) return null;
  return h('div', { class: 'cs-row' }, h('span', {}, 'Essences'), h('b', {},
    h('a', { href: '#stats', class: 'cs-item', title: 'Open Essences on the Character page', onclick: () => { charFocus.open = 'essences'; } },
      held.length ? held.map((e) => getLibrary().essences?.[e.essence]?.name ?? e.essence).join(' · ') : `None · ${essenceSlots(p)} slot${essenceSlots(p) === 1 ? '' : 's'} free`),
    offers.length ? h('a', { href: '#stats', class: 'ess-waiting', 'data-chip': 'essence-waiting', onclick: () => { charFocus.open = 'essences'; } }, ` ◆ ${offers.length} on offer`) : null));
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

export function treeBars(p: Actor): HTMLElement {
  return h('div', { class: 'cs-trees' }, trees(p, true).map((t) =>
    h('div', { class: 'cs-tree', style: `--t:var(--${t.c})` },
      h('div', { class: 'cs-tree-h' }, h('b', {}, t.name), h('span', {}, `${t.sum} pts`)),
      t.block ? h('small', { class: 'cs-tree-block' }, t.block) : null, // TA10: points kept in a tree the character can't use
      t.rows.map((r) => h('div', { class: 'cs-sk' + (r.raw ? '' : ' zero'), role: 'button', tabindex: '0', 'aria-haspopup': 'dialog', 'data-skill': r.id,
        title: 'What makes up this skill', onclick: (e: Event) => openSkillPop(p, r.id, e.currentTarget as HTMLElement),
        onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSkillPop(p, r.id, e.currentTarget as HTMLElement); } } },
        h('div', { class: 'n' }, skillName(r.id), r.tagged ? [' ', tag()] : null, r.off ? [' ', offNote()] : null, marked(p, r.id) ? markDot() : null, SKILL_SUB[r.id] ? h('small', {}, SKILL_SUB[r.id]) : null),
        bar(r.raw, windowOf(p, r.id)), ((w) => h('div', { class: 'lwn', title: winTitle(w) }, winText(w)))(windowOf(p, r.id)), skillNum(trueSkill(p, r.id), r.raw))))));
}

const signed = (n: number) => `${n < 0 ? '−' : '+'}${whole(Math.abs(n))}`;

/** CP5: what makes up a skill, read from the same sums the rules use (trueSkill lists its parts; augmentsOf and tradesOut
 * are what its rolls get): raw, each part that adds to it, its rolls' augments, what it adds to, its learning range and
 * its next perk milestone */
export function skillFacts(p: Actor, id: string) {
  const parts: SkillPart[] = [];
  const value = trueSkill(p, id, parts);
  const raw = p.core.skills[id]?.raw ?? 0;
  const lib = getLibrary();
  const every = CONFIG.PERK_MILESTONE_EVERY;
  const next = (Math.floor(value / every) + 1) * every;
  return {
    value, raw, parts, mult: hollowedMult(p, id),
    rolls: [...augmentsOf(p, id), ...tradesOut(p, id)].filter((x) => x.value),
    gives: (lib.skills[id]?.augments ?? []).map((g) => skillName(g.skill)),
    window: windowOf(p, id), next, toNext: next - value,
    // BU3: what Burden takes off this skill's improvement rolls (0 for a tagged skill, or with no progression record)
    burden: p.progression && p.core.skills[id]?.state !== 'tagged' ? { by: burdenOf(p), ...burdenParts(p) } : { by: 0, total: 0, potential: 0 },
  };
}

export function openSkillPop(p: Actor, id: string, opener?: HTMLElement | null): void {
  const f = skillFacts(p, id);
  const line = (label: string, v: string, cls = '') => h('div', { class: 'sk-line ' + cls }, h('span', {}, label), h('b', {}, v));
  const tagged = p.core.skills[id]?.state === 'tagged';
  openPop({ title: skillName(id), cls: 'sk-pop', opener, body: [
    h('div', { class: 'sk-top' }, h('b', { class: 'sk-v' }, whole(f.value)), h('span', {}, f.value === f.raw ? 'Skill' : `True skill · raw ${f.raw}`),
      tagged ? h('span', { class: 'sk-chip' }, tag(), ' Tagged') : null, marked(p, id) ? h('span', { class: 'sk-chip' }, markDot(), ' Marked to improve') : null),
    SKILL_SUB[id] && !f.gives.length ? h('p', { class: 'hs-note' }, cap(SKILL_SUB[id]) + '.') : null,
    h('div', { class: 'sk-list', 'aria-label': 'What adds to it' },
      line('Raw', whole(f.raw), 'sk-raw'), ...f.parts.map((x) => line(x.label, signed(x.adds))),
      f.mult !== 1 ? line('Hollowed', `×${whole(f.mult)}`, 'sk-bad') : null,
      line('True skill', whole(f.value), 'sk-sum')),
    f.rolls.length ? h('div', { class: 'sk-list' }, h('p', { class: 'hs-label' }, 'On its rolls'), ...f.rolls.map((x) => line(cap(x.source), signed(x.value), x.value < 0 ? 'sk-bad' : ''))) : null,
    f.gives.length ? h('p', {}, `Adds to ${f.gives.join(' and ')} rolls.`) : null,
    h('div', { class: 'sk-list' },
      line('Learns from', winText(f.window)),
      // BU3 b: shown only once Burden is above 0, and only here
      f.burden.by > 0 ? line('Burden', `−${f.burden.by} to improve`, 'sk-bad') : null,
      f.burden.by > 0 ? h('p', { class: 'hs-note' }, `Your untagged skills add up to ${f.burden.total}, past your Potential of ${f.burden.potential}. Every ${CONFIG.K} points past it makes each untagged skill 1 harder to improve. Tagged skills carry no Burden.`) : null,
      line('Next perk milestone', `${f.next} · ${whole(f.toNext)} to go`)),
  ] });
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

/** width of the side sheet bar's Unhurt section, in % of the bar */
const UNHURT_SECTION = 12;

/** Health bar with the health-track thresholds (Part 3) marked; clicking it opens each body part's pool and state. */
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

/** MB12 in plain words, one source for the sheet, the story card and the input's chips: how a broken nerve passes
 * (the engagement ending gives morale back, rest too) and what still works while it lasts */
export const NERVE_UNTIL = "You can't walk, run or attack until the fight is behind you: with nothing else to do you cower where you stand.";
export const NERVE_PASSES = () => `That is once no one has fought you for ${engagementEndS()} s, your yield is taken, this scenario ends, or you rest.`;
export const NERVE_STILL = 'You can still talk, beg, yield, give, hide, use an item such as a bandage, pick something up, or open a door or container within reach.';
const moraleRoll = (k: string) => CONFIG.MORALE_TRACK.find(([x]) => x === k)?.[2] ?? 0;
/** NB2: a level word that carries what it costs as a tip, shown on hover or keyboard focus (dotted underline as the cue);
 * screen readers get it as the word's description */
function tipped(word: string, tip: string, m: string, tm: string): HTMLElement {
  const id = `tip-${m}`;
  return h('span', { class: 'cs-tipped', tabindex: '0', 'aria-describedby': id }, h('span', { 'data-m': m }, word),
    h('span', { class: 'cs-tip', role: 'tooltip', id, 'data-m': tm }, tip));
}
/** the stakes under the morale level, from CONFIG.MORALE_HINT_FROM down (a tip above Broken, a line at Broken); null above it */
export function moraleHint(k: MoraleLevel): string | null {
  if (MORALE_LEVELS.pos(k) < MORALE_LEVELS.pos(CONFIG.MORALE_HINT_FROM as MoraleLevel)) return null;
  if (k === 'broken') return `${NERVE_PASSES()} ${NERVE_STILL}`;
  const roll = moraleRoll(k), last = MORALE_LEVELS.pos('broken') - MORALE_LEVELS.pos(k) === 1;
  return `${roll ? `−${Math.abs(roll)} on every roll. ` : ''}${last ? 'One more fright and your nerve breaks' : 'If your nerve breaks'}: you won't be able to walk away or attack.`;
}

/** MB11: the player's morale bar, a second bar under health: level word, how much is left, and the track's thresholds as ticks */
export function moraleBar(p: Actor, full: boolean): HTMLElement[] {
  const key = moraleLevel(p), hint = moraleHint(key);
  const level = MORALE_LEVELS.name(key);
  const lost = Math.max(0, Math.min(100, moraleLostPct(p)));
  const max = maxMorale(p);
  const left = Math.round(max * (100 - lost) / 100);
  const ticks = full ? CONFIG.MORALE_TRACK.slice(1, -1).map(([, at]) => h('i', { style: `left:${100 - Math.min(100, at)}%` })) : [];
  return [
    h('span', { class: 'cs-row' }, h('span', {}, 'Morale',
      // SY1: a Great Success or better at steadying yourself halves the next morale loss, then it is gone
      p.core.condition.mentallySteady ? h('span', { class: 'cs-steady', 'data-m': 'steady', title: 'Mentally steady: your next morale loss is halved' }, 'Mentally steady') : null),
      // NB2: above Broken the stakes are a tip on the level word (hover or focus), never a line of their own
      h('b', {}, hint && key !== 'broken' ? tipped(level, hint, 'morale-level', 'morale-hint') : h('span', { 'data-m': 'morale-level' }, level),
      full ? [' · ', h('span', { 'data-m': 'morale-left' }, String(left)), ` / ${max}`] : null)),
    h('span', { class: 'cs-hptrack cs-morale', title: 'Morale track, Calm on the right', role: 'img', 'aria-label': `Morale: ${level}`, 'data-m': 'morale-track' },
      h('b', { style: `width:${100 - lost}%` }), ...ticks),
    // NB3: at Broken the line stays under the bar: no attacks until the fight is behind you, how that comes, what still works
    ...(hint && key === 'broken' ? [h('span', { class: 'cs-mhint broken', 'data-m': 'morale-hint', role: 'status' },
      h('b', { 'data-m': 'morale-until' }, NERVE_UNTIL), ' ', hint)] : []),
  ];
}

/** FT20: the stamina bar under morale. One bar for the long term (sleep debt: the level word reads from it), with the thin
 * short line under it, as wide as the level's band of the bar and filled by what is left of it (breath). Spent: the bar is
 * full and nothing above Light can be done (FT10). Tired and worse name their roll penalty. */
export function staminaBar(p: Actor, full: boolean): HTMLElement[] {
  const v = staminaOf(p), key = FATIGUE_LEVELS.has(fatigueLevel(p)) ? fatigueLevel(p) : 'rested';
  const pct = (n: number, of: number) => (of > 0 ? Math.max(0, Math.min(100, (100 * n) / of)) : 0);
  const row = CONFIG.FATIGUE_TRACK.find(([k]) => k === key);
  const ticks = full ? CONFIG.FATIGUE_TRACK.slice(1, -1).map(([, at]) => h('i', { style: `left:${100 - Math.min(100, at)}%` })) : [];
  const breath = `Breath ${fmt1(v.lineLeft)} / ${fmt1(v.lineMax)}: strain spends it first, then eats into sleep debt; it comes back once you stop for a while`;
  return [
    h('span', { class: 'cs-row' }, h('span', {}, 'Stamina', v.spent ? h('span', { class: 'cs-spent', 'data-m': 'spent', title: 'Spent: nothing harder than a Light effort until you sleep' }, 'Spent') : null),
      h('b', {}, row && row[2] < 0 ? tipped(v.level, `${v.level}: −${Math.abs(row[2])} to rolls`, 'stamina-level', 'stamina-hint') : h('span', { 'data-m': 'stamina-level' }, v.level), full ? [' · ', h('span', { 'data-m': 'stamina-left' }, fmt1(v.left)), ` / ${fmt1(v.max)}`] : null)),
    h('span', { class: 'cs-hptrack cs-stam', title: 'Stamina: sleep debt, Rested on the right; only sleep clears it', role: 'img', 'aria-label': `Stamina: ${v.level}`, 'data-m': 'stamina-track' },
      h('b', { style: `width:${pct(v.left, v.max)}%` }), ...ticks),
    h('span', { class: 'cs-stline', title: breath, role: 'img', 'aria-label': breath, 'data-m': 'stamina-line', style: `width:${pct(v.lineMax, v.max)}%` },
      h('b', { style: `width:${pct(v.lineLeft, v.lineMax)}%` })),
  ];
}

const fmt1 = (n: number) => String(r1(n));

/** MB40–MB43: after /yield, who took it, who is still deciding and who fights on; nothing when the player has not yielded */
export function yieldBlock(s: GameState): HTMLElement | null {
  const y = s.yielding;
  if (!y) return null;
  const names = (ids: string[]) => ids.map((id) => cap(callName(s, s.player.id, id))).join(', ');
  const row = (k: string, ids: string[], cls: string) => ids.length ? h('span', { class: 'yr ' + cls }, h('span', {}, k), h('b', {}, names(ids))) : null;
  return h('div', { class: 'cs-yield' }, h('span', { class: 'hs-label' }, 'You yielded'),
    row('Took it', y.accepted, 'took'), row('Deciding', y.pending, 'wait'), row('Fight on', y.refused, 'refused'));
}

/** NT20: Shaken and Swayed as chips with the roll penalty; the title names who caused it and how long it lasts */
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
  const on = p.core.inventory.filter((i) => i.equippedIn?.length && isHeld(i) === held);
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
  return { held: on.filter(isHeld).map(name), worn: on.filter((i) => !isHeld(i)).map(name) };
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
    ...staminaBar(p, false),
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
    ...((hb) => [hb[0], hb[1], h('div', { class: 'cs-mbar' }, ...moraleBar(p, true)), h('div', { class: 'cs-mbar cs-sbar' }, ...staminaBar(p, true)), ...[yieldBlock(s)].filter((x): x is HTMLElement => !!x), ...hb.slice(2)])(healthBar(s, p, healed, last?.turn ?? -1, changed)),
    pressureChips(s, p),
    h('div', { class: 'cs-row' }, h('span', {}, 'Held / worn'), h('b', { class: 'cs-hw' }, ...((g) => g.length ? g.map((x, k) => (k && !x.textContent?.startsWith(' · ') ? [' · ', x] : x)) : ['Nothing'])([...gearLine(s, p, true), ...gearLine(s, p, false)]))),
    ...[essenceRow(p)].filter((x): x is HTMLElement => !!x),
    h('div', { class: 'cs-row' }, h('span', {}, 'Coin'), h('b', {}, h('span', { 'data-m': 'coin' }, coinWords(coins(p))))),
    ...[xpLine(p)].filter((x): x is HTMLElement => !!x),
    ...trees(p, false).map((t) => h('div', { class: 'cs-mini', style: `--t:var(--${t.c})` },
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
const xpShown = (p: Actor) => (p.progression ? xpFill(p) : null);

/** M-74: every value the play sheet shows, before and after a turn, so the screen animates only what changed */
export type ShownValues = {
  hp: number | null; level: HealthLevel; hpFill: number;
  morale: string; moraleKey: MoraleLevel; moraleLeft: number; moraleFill: number;
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
    morale: MORALE_LEVELS.name(moraleLevel(p)), moraleKey: moraleLevel(p), moraleLeft: Math.round(maxMorale(p) * (100 - lost) / 100), moraleFill: 100 - lost,
    parts: Object.fromEntries((safe(() => actorBody(s, p).parts) ?? []).map((d) => [d.id, poolState(p.core.condition.parts[d.id] ?? 100)])),
    skills: Object.fromEntries(trees(p, false).flatMap((t) => t.rows.map((r) => [r.id, r.raw]))),
    lvl: xp?.level ?? null, xp: xp?.xp ?? null, xpPct: xp?.pct ?? null, coin: coins(p),
    gear: Object.fromEntries(p.core.inventory.filter((i) => i.equippedIn?.length).map((i) => [i.id, { name: cap(safe(() => itemDef(s, i.itemId).name) ?? i.itemId), note: gearNote(s, i)?.text ?? '' }])),
    chips: Object.entries(p.pressure ?? {}).flatMap(([id, x]) => (['shaken', 'swayed'] as const).filter((k) => x[k]).map((k) => `${id}:${k}`)),
    yielded: !!s.yielding,
    points: p.progression?.unspentPerkPoints ?? 0,
  };
}
