// Character page perks (Part 2 Play screen, Perks, K1–K4, S1, S7). Two views: By tree (a ladder per
// skill, tracks on narrow screens) and By effect (tracks grouped by what the perks do, each group folds). Sealed milestones
// show only their number and nothing hints at what comes next (K4). A small card beside the tapped milestone takes or undoes.
import type { Actor, GameApi, GameState, PerkDef, PerkEffect } from '../types';
import { getLibrary } from '../library';
import { MILESTONES, allStepsUpTo, canUndo, milestonesUpTo, milestonePerk, milestoneState, trueSkill, type MilestoneState } from '../ruleset';
import { h } from './kit';
import { CONFIG } from '../config';
import { skillName, TREE_VIEW } from './creation';
import { PK } from '../library/perkIds';
import { allStepNeed, skillsAt } from '../ruleset/allSteps';
import { PERK_LINKS } from '../library/perkLinks';

const EFFECTS: [PerkEffect, string][] = [['attack', 'Attack'], ['defense', 'Defense'], ['health', 'Health'], ['speed', 'Speed'], ['senses', 'Senses'], ['speech', 'Speech'], ['stealth', 'Stealth']];
// Story or Rules: the player picks which write-up the perk card shows; kept per browser
const readText = (): 'story' | 'rules' => { try { return localStorage.getItem('perkText') === 'rules' ? 'rules' : 'story'; } catch { return 'story'; } };
const ui = { view: 'tree' as 'tree' | 'effect', text: readText(), tree: '', sel: null as null | { skill: string; milestone: number }, folded: new Set<string>(),
  /** where the floating perk card was dragged to (viewport px); null = beside the tapped milestone */
  pos: null as null | { left: number; top: number } };
type Show = MilestoneState | 'other';
/** which perk series a milestone belongs to: 20/60/100/140 change what you can do, 40/80/120 raise numbers; each series has its own colour */
export const perkSeries = (milestone: number): '20' | '40' => (milestone % 40 === 20 ? '20' : '40');
const seriesList = (series: '20' | '40') => MILESTONES.filter((m) => perkSeries(m) === series).join(', ');
/** CS11: the rails reach PERK_RAILS_TO, or the next All step past the actor's highest true skill */
const railTop = (p: Actor) => {
  const top = Math.max(CONFIG.PERK_RAILS_TO, ...Object.keys(p.core.skills).map((k) => trueSkill(p, k)));
  return Math.ceil(top / CONFIG.ALL_STEP_EVERY) * CONFIG.ALL_STEP_EVERY;
};
const pctOf = (top: number) => (v: number) => `${Math.min(100, (v / top) * 100).toFixed(2)}%`;

function treesOf(p: Actor) {
  const lib = getLibrary();
  return TREE_VIEW.filter((t) => lib.trees[t.id]).map((t) => ({ id: t.id, name: lib.trees[t.id].name, skills: lib.trees[t.id].skills.filter((k) => p.core.skills[k] !== undefined) }))
    .filter((t) => t.skills.length);
}

function node(skill: string, milestone: number, st: Show, label: boolean) {
  const d = st === 'own' || st === 'open' ? milestonePerk(skill, milestone) : undefined;
  const sel = ui.sel?.skill === skill && ui.sel.milestone === milestone;
  return h('button', {
    type: 'button', class: `pk-n ${st}${sel ? ' sel' : ''}`, 'data-k': `${skill}:${milestone}`, 'data-series': perkSeries(milestone), disabled: st === 'sealed',
    'aria-label': st === 'sealed' ? `${skillName(skill)} ${milestone}, sealed` : `${skillName(skill)} ${milestone}${d ? ', ' + d.name : st === 'empty' ? ', no perk yet' : ''}`,
    onclick: () => { ui.sel = sel ? null : { skill, milestone }; redraw(); },
  }, h('span', {}, String(milestone)), label && d ? h('em', {}, d.name) : null);
}

/** the All-XXX marker: tree skills at the step, of the count the tree's rating needs (allStepNeed); an inferior tree never earns one */
function allStepCount(p: Actor, treeId: string, step: number): string {
  const need = allStepNeed(treeId);
  return need === null ? 'never' : `${Math.min(skillsAt(p, treeId, step).length, need)} of ${need}`;
}

function ladders(p: Actor, treeId: string, skills: string[]) {
  const top = railTop(p), pct = pctOf(top);
  return h('div', { class: 'pk-lad' },
    allStepsUpTo(top).map((m) => h('div', { class: 'pk-mb', style: `bottom:calc(${m / top} * var(--rh))` }, h('b', {}, `All-${m}`), h('small', {}, allStepCount(p, treeId, m)))),
    skills.map((k) => {
      const v = trueSkill(p, k);
      return h('div', { class: 'pk-col' },
        h('div', { class: 'pk-ch' }, h('b', {}, skillName(k)), h('span', {}, String(v))),
        h('div', { class: 'pk-rail' }, h('i', { class: 'pk-fill', style: `height:${pct(v)}` }),
          milestonesUpTo(top).map((r) => h('div', { class: 'pk-at', style: `bottom:${pct(r)}` }, node(k, r, milestoneState(p, k, r), true)))));
    }));
}

function track(p: Actor, k: string, show: (r: number, st: MilestoneState) => Show) {
  const v = trueSkill(p, k), top = railTop(p), pct = pctOf(top);
  return h('div', { class: 'pk-tr' },
    h('div', { class: 'pk-tl' }, h('b', {}, skillName(k)), h('span', {}, String(v))),
    h('div', { class: 'pk-tt' }, h('i', { class: 'pk-tf', style: `width:${pct(v)}` }),
      allStepsUpTo(top).map((m) => h('b', { class: 'pk-tm', style: `left:${pct(m)}` })),
      milestonesUpTo(top).map((r) => h('div', { class: 'pk-ta', style: `left:${pct(r)}` }, node(k, r, show(r, milestoneState(p, k, r)), false)))));
}

function effectView(p: Actor) {
  const lib = getLibrary();
  const groups = EFFECTS.map(([id, name]) => {
    const skills = [...new Set(Object.values(lib.perks).filter((d) => d.effect === id && d.ladder && ['own', 'open'].includes(milestoneState(p, d.ladder.skill, d.ladder.milestone))).map((d) => d.ladder!.skill))];
    return { id, name, skills };
  }).filter((g) => g.skills.length);
  if (!groups.length) return h('p', { class: 'empty' }, 'No perks taken or open yet.');
  return h('div', { class: 'pk-eff' }, groups.map((g) => {
    const open = !ui.folded.has(g.id);
    return h('section', { class: 'pk-g' },
      h('button', { type: 'button', class: 'pk-gh', 'aria-expanded': String(open), onclick: () => { if (open) ui.folded.add(g.id); else ui.folded.delete(g.id); redraw(); } }, g.name),
      open ? g.skills.map((k) => track(p, k, (r, st) => (st === 'sealed' ? st : milestonePerk(k, r)?.effect === g.id ? st : 'other'))) : null);
  }));
}

/** perks the owner can switch on and off */
const SWITCHABLE = new Set<string>([PK.cover_ally]);

function card(s: GameState, p: Actor, api: GameApi) {
  if (!ui.sel) return null;
  const { skill, milestone } = ui.sel;
  const st = milestoneState(p, skill, milestone);
  if (st === 'sealed') return null;
  const d = milestonePerk(skill, milestone);
  const pts = p.progression?.unspentPerkPoints ?? 0;
  // a floating card like the details pop-ups: dragged by its head, closed with ✕ or Esc, and it stays where it was put
  const head = h('div', { class: 'pk-card-head' }, h('p', { class: 'k' }, `${skillName(skill)} · ${milestone}`),
    h('button', { type: 'button', class: 'hs-icon-btn', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => { ui.sel = null; redraw(); } }, '✕'));
  return h('aside', { class: 'pk-card', 'data-series': perkSeries(milestone), role: 'dialog', 'aria-modal': 'false', 'aria-label': d?.name ?? `${skillName(skill)} ${milestone}` },
    head,
    d ? [h('h4', {}, d.name), ...writeup(d)] : h('p', {}, 'No perk is written for this milestone yet.'),
    st === 'own' && d && linkNote(p, d.id) ? h('p', { class: 'pk-link-note' }, linkNote(p, d.id)) : null,
    st === 'open' && d?.built === false ? h('p', { class: 'tiny' }, 'Not in the game yet.') : null,
    st === 'open' && d?.built !== false ? h('button', { type: 'button', class: 'hs-btn-main pk-take', disabled: pts < 1 || api.busy(), onclick: () => api.takePerk(d!.id) }, pts < 1 ? 'No perk point' : 'Take · 1 point') : null,
    // A11: a perk the owner can switch off, on by default
    st === 'own' && d && SWITCHABLE.has(d.id) ? h('button', { type: 'button', class: 'hs-btn-text', 'aria-pressed': String(!p.core.perksOff?.includes(d.id)),
      onclick: () => { const off = new Set(p.core.perksOff ?? []); if (off.has(d.id)) off.delete(d.id); else off.add(d.id); p.core.perksOff = [...off]; redraw(); } },
      p.core.perksOff?.includes(d.id) ? 'Off · switch on' : 'On · switch off') : null,
    st === 'own' && d && canUndo(s, p, d.id) ? h('button', { type: 'button', class: 'hs-btn-text', onclick: () => api.undoPerk(d.id) }, 'Undo') : null,
    st === 'open' && pts > 0 ? h('p', { class: 'tiny' }, 'You can undo until you play the next turn.') : null);
}

function writeup(d: PerkDef) {
  const r = d.rules;
  if (ui.text === 'rules' && r) {
    const rows: [string, string][] = [['Kind', r.kind], ['Trigger', r.trigger], ...(r.conditions.length ? [['Conditions', r.conditions.join(' ')] as [string, string]] : []), ['Effect', r.effect], ['Lasts', r.lasts], ...(r.cooldown ? [['Cooldown', r.cooldown] as [string, string]] : [])];
    return [h('dl', { class: 'pk-rules' }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))];
  }
  const t = d.story ?? d.text;
  return t ? [h('p', {}, t)] : [];
}

/** where a perk sits: "Intimidation 100" for a milestone perk; '' for one on no ladder */
const perkWhere = (d: PerkDef): string => (d.ladder ? `${skillName(d.ladder.skill)} ${d.ladder.milestone}` : '');

/** LR5: the linked perks the actor holds. A link shows only once its whole set is owned (a link not yet earned stays
 *  unseen, like a sealed milestone, K4): its perk, whether it was granted beside the set or merged from it, and each perk
 *  of the set with where it sits and whether it is asleep inside the merge. */
export type LinkView = { id: string; perk: string; name: string; kind: 'grant' | 'merge'; needs: { id: string; name: string; where: string; asleep: boolean }[] };
export function linkViews(p: Actor): LinkView[] {
  const lib = getLibrary();
  return PERK_LINKS.filter((l) => p.core.perks.some((o) => o.perkId === l.perk && o.source === 'link')).map((l) => ({
    id: l.id, perk: l.perk, name: lib.perks[l.perk]?.name ?? l.perk, kind: l.kind,
    needs: l.needs.map((id) => ({ id, name: lib.perks[id]?.name ?? id, where: lib.perks[id] ? perkWhere(lib.perks[id]) : '',
      asleep: p.core.perks.some((o) => o.perkId === id && o.dormant && o.mergedInto === l.perk) })),
  }));
}

/** the line a perk's card adds when the perk is part of a link the actor holds */
export function linkNote(p: Actor, perkId: string): string | null {
  const v = linkViews(p).find((l) => l.needs.some((n) => n.id === perkId));
  if (!v) return null;
  const others = v.needs.filter((n) => n.id !== perkId).map((n) => n.name).join(' and ');
  return v.kind === 'merge' ? `Merged with ${others} into ${v.name}: asleep while the merge holds.` : `Linked with ${others}: together they grant ${v.name}.`;
}

function linked(p: Actor) {
  const lib = getLibrary(), list = linkViews(p);
  if (!list.length) return null;
  return h('section', { class: 'pk-inn pk-links', 'aria-label': 'Linked perks' }, h('h3', {}, 'Linked'),
    list.map((v) => h('div', { class: `pk-in pk-link ${v.kind}` }, h('b', {}, v.name), h('span', { class: 'pk-tag' }, v.kind === 'merge' ? 'Merged' : 'Linked'),
      h('p', { class: 'pk-link-from' }, v.kind === 'merge' ? 'Merged from ' : 'From ',
        ...v.needs.flatMap((n, i) => [i ? ' + ' : '', h('span', { class: n.asleep ? 'asleep' : '' }, h('b', {}, n.name), n.where || n.asleep ? ` (${[n.where, n.asleep ? 'asleep' : ''].filter(Boolean).join(', ')})` : '')]),
        v.kind === 'merge' ? '. The set sleeps while the merge holds.' : '. It lasts while you hold them all.'),
      ...(lib.perks[v.perk] ? writeup(lib.perks[v.perk]) : []))));
}

// innate perks and quirks: what the race gives; nothing shows while the race gives none
function innate(p: Actor) {
  const lib = getLibrary();
  const list = p.core.perks.filter((o) => o.source === 'race').map((o) => lib.perks[o.perkId]).filter((d): d is PerkDef => !!d);
  if (!list.length) return null;
  return h('section', { class: 'pk-inn', 'aria-label': 'Innate perks and quirks' }, h('h3', {}, 'Innate'),
    list.map((d) => h('div', { class: `pk-in${d.quirk ? ' quirk' : ''}` }, h('b', {}, d.name), h('span', { class: 'pk-tag' }, d.quirk ? 'Quirk' : 'Perk'), ...writeup(d))));
}

let redraw = () => {};

export function perksSection(api: GameApi): HTMLElement {
  const el = h('section', { class: 'pk', 'aria-label': 'Perks' });
  redraw = () => {
    const s = api.state();
    if (!s) { el.replaceChildren(); return; }
    const p = s.player;
    const trees = treesOf(p);
    if (!trees.some((t) => t.id === ui.tree)) ui.tree = trees[0]?.id ?? '';
    const tree = trees.find((t) => t.id === ui.tree);
    const pts = p.progression?.unspentPerkPoints ?? 0;
    const tt = (v: 'story' | 'rules', label: string) => h('button', { type: 'button', 'aria-pressed': String(ui.text === v),
      onclick: () => { ui.text = v; try { localStorage.setItem('perkText', v); } catch { /* not saved */ } redraw(); } }, label);
    const vt = (v: 'tree' | 'effect', label: string) => h('button', { type: 'button', 'aria-pressed': String(ui.view === v), onclick: () => { ui.view = v; ui.sel = null; redraw(); } }, label);
    const kids: (HTMLElement | null)[] = [
      h('div', { class: 'pk-h' }, h('h2', {}, 'Perks'), h('div', { class: 'hs-picker pk-vt' }, vt('tree', 'By tree'), vt('effect', 'By effect')),
        h('div', { class: 'hs-picker pk-vt', 'aria-label': 'Perk write-up' }, tt('story', 'Story'), tt('rules', 'Rules')),
        h('span', { class: 'pk-pts' + (pts ? '' : ' none') }, `✦ ${pts} point${pts === 1 ? '' : 's'}`)),
      // the two perk series, in the colours their milestones use everywhere
      h('ul', { class: 'pk-key', 'aria-label': 'Perk series' },
        h('li', { 'data-series': '20' }, h('i', { 'aria-hidden': 'true' }), h('b', {}, 'Breakthrough'), ` ${seriesList('20')}`),
        h('li', { 'data-series': '40' }, h('i', { 'aria-hidden': 'true' }), h('b', {}, 'Refinement'), ` ${seriesList('40')}`)),
      innate(p),
      linked(p),
      ...(ui.view === 'tree'
        ? [h('div', { class: 'pk-tabs', role: 'tablist' }, trees.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(t.id === ui.tree), onclick: () => { ui.tree = t.id; ui.sel = null; redraw(); } }, t.name))),
          tree ? h('div', { class: 'pk-board' }, ladders(p, tree.id, tree.skills), h('div', { class: 'pk-trk' }, tree.skills.map((k) => track(p, k, (_r, st) => st)))) : null]
        : [effectView(p)]),
      card(s, p, api)];
    el.replaceChildren(...kids.filter((x): x is HTMLElement => !!x));
    place();
  };
  // the card floats over the page: first beside the tapped milestone, then wherever it was dragged to
  function place() {
    const c = el.querySelector<HTMLElement>('.pk-card');
    if (!c || !ui.sel) return;
    const fit = (left: number, top: number) => ({ left: Math.max(8, Math.min(innerWidth - c.offsetWidth - 8, left)), top: Math.max(8, Math.min(innerHeight - c.offsetHeight - 8, top)) });
    let at = ui.pos ? fit(ui.pos.left, ui.pos.top) : null;
    if (!at) {
      const n = Array.from(el.querySelectorAll<HTMLElement>(`[data-k="${ui.sel.skill}:${ui.sel.milestone}"]`)).find((x) => x.offsetParent);
      const r = n?.getBoundingClientRect();
      at = r ? fit(r.right + 16 + c.offsetWidth > innerWidth ? r.left - c.offsetWidth - 16 : r.right + 16, r.top + r.height / 2 - c.offsetHeight / 2) : fit(innerWidth - c.offsetWidth - 32, 96);
    }
    c.style.left = `${at.left}px`; c.style.top = `${at.top}px`;
    const head = c.querySelector<HTMLElement>('.pk-card-head');
    head?.addEventListener('pointerdown', (ev) => {
      if ((ev.target as Element).closest('button')) return;
      const b = c.getBoundingClientRect(), dx = ev.clientX - b.left, dy = ev.clientY - b.top;
      const move = (m: PointerEvent) => { ui.pos = fit(m.clientX - dx, m.clientY - dy); c.style.left = `${ui.pos.left}px`; c.style.top = `${ui.pos.top}px`; };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sel && el.isConnected && el.querySelector('.pk-card')) { ui.sel = null; redraw(); } });
  redraw();
  return el;
}

export const refreshPerks = () => redraw();
