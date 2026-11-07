// Character page perks (Part 2 Play screen, Perks; Ali, 07/11/2026, K1–K4, S1, S7). Two views: By tree (a ladder per
// skill, tracks on narrow screens) and By effect (tracks grouped by what the perks do, each group folds). Sealed rungs
// show only their number and nothing hints at what comes next (K4). A small card beside the tapped rung takes or undoes.
import type { Actor, GameApi, GameState, PerkEffect } from '../types';
import { getLibrary } from '../library';
import { MASTERY_STEPS, RUNGS, canUndo, rungPerk, rungState, trueSkill, type RungState } from '../ruleset';
import { h } from './kit';
import { skillName, TREE_VIEW } from './creation';

const EFFECTS: [PerkEffect, string][] = [['attack', 'Attack'], ['defense', 'Defense'], ['health', 'Health'], ['speed', 'Speed'], ['senses', 'Senses'], ['speech', 'Speech']];
const TOP = 150;
const LOCKED = new Set(['unarmed_natural']);
const ui = { view: 'tree' as 'tree' | 'effect', tree: '', sel: null as null | { skill: string; rung: number }, folded: new Set<string>() };
type Show = RungState | 'other';
const pct = (v: number) => `${Math.min(100, (v / TOP) * 100).toFixed(2)}%`;

function treesOf(p: Actor) {
  const lib = getLibrary();
  return TREE_VIEW.filter((t) => lib.trees[t.id]).map((t) => ({ id: t.id, name: lib.trees[t.id].name, skills: lib.trees[t.id].skills.filter((k) => !LOCKED.has(k) && p.core.skills[k] !== undefined) }))
    .filter((t) => t.skills.length);
}

function node(skill: string, rung: number, st: Show, label: boolean) {
  const d = st === 'own' || st === 'open' ? rungPerk(skill, rung) : undefined;
  const sel = ui.sel?.skill === skill && ui.sel.rung === rung;
  return h('button', {
    type: 'button', class: `pk-n ${st}${sel ? ' sel' : ''}`, 'data-k': `${skill}:${rung}`, disabled: st === 'sealed',
    'aria-label': st === 'sealed' ? `${skillName(skill)} ${rung}, sealed` : `${skillName(skill)} ${rung}${d ? ', ' + d.name : ''}`,
    onclick: () => { ui.sel = sel ? null : { skill, rung }; redraw(); },
  }, h('span', {}, String(rung)), label && d ? h('em', {}, d.name) : null);
}

function ladders(p: Actor, skills: string[]) {
  return h('div', { class: 'pk-lad' },
    MASTERY_STEPS.map((m) => h('div', { class: 'pk-mb', style: `bottom:calc(${m / TOP} * var(--rh))` }, h('b', {}, `♛ ${m}`), h('small', {}, `${skills.filter((k) => trueSkill(p, k) >= m).length} of ${skills.length}`))),
    skills.map((k) => {
      const v = trueSkill(p, k);
      return h('div', { class: 'pk-col' },
        h('div', { class: 'pk-ch' }, h('b', {}, skillName(k)), h('span', {}, String(v))),
        h('div', { class: 'pk-rail' }, h('i', { class: 'pk-fill', style: `height:${pct(v)}` }),
          RUNGS.map((r) => h('div', { class: 'pk-at', style: `bottom:${pct(r)}` }, node(k, r, rungState(p, k, r), true)))));
    }));
}

function track(p: Actor, k: string, show: (r: number, st: RungState) => Show) {
  const v = trueSkill(p, k);
  return h('div', { class: 'pk-tr' },
    h('div', { class: 'pk-tl' }, h('b', {}, skillName(k)), h('span', {}, String(v))),
    h('div', { class: 'pk-tt' }, h('i', { class: 'pk-tf', style: `width:${pct(v)}` }),
      MASTERY_STEPS.map((m) => h('b', { class: 'pk-tm', style: `left:${pct(m)}` })),
      RUNGS.map((r) => h('div', { class: 'pk-ta', style: `left:${pct(r)}` }, node(k, r, show(r, rungState(p, k, r)), false)))));
}

function effectView(p: Actor) {
  const lib = getLibrary();
  const groups = EFFECTS.map(([id, name]) => {
    const skills = [...new Set(Object.values(lib.perks).filter((d) => d.effect === id && d.ladder && ['own', 'open'].includes(rungState(p, d.ladder.skill, d.ladder.rung))).map((d) => d.ladder!.skill))];
    return { id, name, skills };
  }).filter((g) => g.skills.length);
  if (!groups.length) return h('p', { class: 'empty' }, 'No perks taken or open yet.');
  return h('div', { class: 'pk-eff' }, groups.map((g) => {
    const open = !ui.folded.has(g.id);
    return h('section', { class: 'pk-g' },
      h('button', { type: 'button', class: 'pk-gh', 'aria-expanded': String(open), onclick: () => { if (open) ui.folded.add(g.id); else ui.folded.delete(g.id); redraw(); } }, g.name),
      open ? g.skills.map((k) => track(p, k, (r, st) => (st === 'sealed' ? st : rungPerk(k, r)?.effect === g.id ? st : 'other'))) : null);
  }));
}

function card(s: GameState, p: Actor, api: GameApi) {
  if (!ui.sel) return null;
  const { skill, rung } = ui.sel;
  const st = rungState(p, skill, rung);
  if (st === 'sealed') return null;
  const d = rungPerk(skill, rung);
  const pts = p.progression?.unspentPerkPoints ?? 0;
  return h('aside', { class: 'pk-card', role: 'dialog', 'aria-label': d?.name ?? `${skillName(skill)} ${rung}` },
    h('p', { class: 'k' }, `${skillName(skill)} · ${rung}`),
    d ? [h('h4', {}, d.name), d.text ? h('p', {}, d.text) : null] : h('p', {}, 'No perk is written for this rung yet.'),
    st === 'open' ? h('button', { type: 'button', class: 'hs-btn-main pk-take', disabled: pts < 1 || api.busy(), onclick: () => api.takePerk(d!.id) }, pts < 1 ? 'No perk point' : 'Take · 1 point') : null,
    st === 'own' && d && canUndo(s, p, d.id) ? h('button', { type: 'button', class: 'hs-btn-text', onclick: () => api.undoPerk(d.id) }, 'Undo') : null,
    st === 'open' && pts > 0 ? h('p', { class: 'tiny' }, 'You can undo until you play the next turn.') : null);
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
    const vt = (v: 'tree' | 'effect', label: string) => h('button', { type: 'button', 'aria-pressed': String(ui.view === v), onclick: () => { ui.view = v; ui.sel = null; redraw(); } }, label);
    const kids: (HTMLElement | null)[] = [
      h('div', { class: 'pk-h' }, h('h2', {}, 'Perks'), h('div', { class: 'hs-picker pk-vt' }, vt('tree', 'By tree'), vt('effect', 'By effect')),
        h('span', { class: 'pk-pts' + (pts ? '' : ' none') }, `✦ ${pts} point${pts === 1 ? '' : 's'}`)),
      ...(ui.view === 'tree'
        ? [h('div', { class: 'pk-tabs', role: 'tablist' }, trees.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(t.id === ui.tree), onclick: () => { ui.tree = t.id; ui.sel = null; redraw(); } }, t.name))),
          tree ? h('div', { class: 'pk-board' }, ladders(p, tree.skills), h('div', { class: 'pk-trk' }, tree.skills.map((k) => track(p, k, (_r, st) => st)))) : null]
        : [effectView(p)]),
      card(s, p, api)];
    el.replaceChildren(...kids.filter((x): x is HTMLElement => !!x));
    place();
  };
  // the card sits beside the tapped rung; on narrow screens CSS drops it below the board
  function place() {
    const c = el.querySelector<HTMLElement>('.pk-card');
    if (!c || !ui.sel) return;
    const n = Array.from(el.querySelectorAll<HTMLElement>(`[data-k="${ui.sel.skill}:${ui.sel.rung}"]`)).find((x) => x.offsetParent);
    if (!n || getComputedStyle(c).position !== 'absolute') return;
    const box = el.getBoundingClientRect(), r = n.getBoundingClientRect();
    const left = r.right - box.left + 12, top = Math.max(0, r.top - box.top - c.offsetHeight / 2);
    c.style.left = `${left + c.offsetWidth > box.width ? r.left - box.left - c.offsetWidth - 12 : left}px`;
    c.style.top = `${top}px`;
  }
  redraw();
  return el;
}

export const refreshPerks = () => redraw();
