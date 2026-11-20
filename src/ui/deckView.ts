// The action deck on Play (AD1–AD16): the Aim toggle, the Defense row, and every action the code allows in
// its groups. Clicking an action asks what it still needs (whom, with what, which part) in a small pop-up, then plays
// the turn at once with no Parser call (AD6, AD7); a move planned on the minimap rides along (AD12). Actions that need
// your words wait for the Say box. No keys pick actions (AD10), so typing never plays one by mistake.
import type { DefenseKind, GameApi, GameState, PlayerView } from '../types';
import { canDefend, defenseValue, usableDefense } from '../ruleset/gear';
import { personalityOf } from '../ruleset/personality';
import { isBrokenLevel, isCoweringLevel, moraleLevel } from '../ruleset/morale';
import { buildPlayerView, findInstance } from '../views';
import { cap } from '../words';
import { hideTip, showTip } from './pages';
import { h, safe, viewSize, type boxOf } from './kit';
import { closePop, openPop } from './pop';
import { deck, thingActions, type Choice, type DeckAction, type DeckCtx, type MapThing, type Order, type Pick } from './deck';
import { openLoot } from './loot';
import { ICONS, instanceIcon } from './itemIcons';
import { AGAINST_NATURE } from './ideaLeans';
import type { MinimapPoint } from './minimap';

/** a thing's box on screen, in page pixels (kit boxOf) */
type Box = ReturnType<typeof boxOf>;

export type SayMode = { action: DeckAction; choice: Choice; to: string };

/** the Defense row: each standing defense, what it does, and what it needs when it can't be used now */
const DEFENSES: { kind: DefenseKind; tip: string; needs?: string }[] = [
  { kind: 'dodge', tip: 'Dodge: get out of the way of every blow and missile' },
  { kind: 'parry', tip: "Parry: turn melee blows with your weapon. It can't stop missiles: against those you use your best other defense", needs: 'a melee weapon in hand' },
  { kind: 'block', tip: 'Block: catch blows and missiles on your shield', needs: 'a shield in hand' },
];
const figure = (n: number) => String(+n.toFixed(2)); // fractions shown, as the Character page does

/** the order with the move planned on the minimap first (a way op takes the move itself, so it plays alone) */
export function withPlanned(o: Order, p: MinimapPoint | null): Order {
  if (!p || o.intent.move || o.intent.way) return o;
  const to = p.label.replace(/, [\d.,]+ k?m$/, ''); // the place without its distance
  return { line: o.line ? `Move to ${to}, then ${o.line.charAt(0).toLowerCase()}${o.line.slice(1)}` : `Move to ${to}`,
    intent: { ...o.intent, move: { toZone: p.zone, spot: { at: { x: p.x, y: p.y } } } } };
}

const NO_ORDER: Order['intent'] = { move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };
/** AD12: a walk to the point planned on the minimap, with nothing else (a dash) */
export const walkOrder = (p: MinimapPoint): Order => withPlanned({ line: '', intent: NO_ORDER }, p);

export function deckView(api: GameApi, o: {
  planned(): MinimapPoint | null; clearPlan(): void;
  /** before a turn is sent: the gains panel closes and motion finishes (M-12) */
  before(): void;
  /** an action waits for words: the Say box takes them (null: it no longer waits) */
  sayMode(m: SayMode | null): void;
}) {
  let aim = false, sayMode: SayMode | null = null;
  let groups: ReturnType<typeof deck> = [], ctx: DeckCtx | null = null, disabled = false;
  const ctxOf = (s: GameState, pv: PlayerView): DeckCtx => ({ pv, s, aim, broken: isBrokenLevel(moraleLevel(s.player)), cowering: isCoweringLevel(moraleLevel(s.player)), self: personalityOf(s.player) });

  async function play(order: Order, aimed: boolean) {
    if (disabled || api.busy()) return;
    o.before();
    const full = withPlanned(order, o.planned());
    o.clearPlan();
    setSay(null);
    await api.act(full, { aimed });
  }

  const pickLabel = (a: DeckAction, c: Choice) => {
    const st = a.steps.find((x) => x.key === 'target');
    return st && st.key !== 'words' && c.target !== undefined ? st.picks(c).find((p) => p.id === c.target)?.label : undefined;
  };
  /** how the thing already chosen in its first step reads (a person, a door, a thing on the ground) */
  const chosenLabel = (a: DeckAction, c: Choice) => {
    const st = a.steps[0];
    return st && st.key !== 'words' && c[st.key] !== undefined ? st.picks(c).find((p) => p.id === c[st.key])?.label : undefined;
  };
  function setSay(m: SayMode | null) { sayMode = m; o.sayMode(m); }

  /** asks the action's next missing step; with nothing missing, plays it */
  function run(a: DeckAction, c: Choice = {}, opener: HTMLElement | null = null) {
    if (disabled) return;
    if (a.kind === 'loot') { const s = api.state(), pv = ctx?.pv; if (s && pv) openLoot(pv, opener, (line, gear) => void play({ line, intent: { ...NO_ORDER, gear } }, false), (id) => instanceIcon(s, id, 'iico lico'),
      (id, at) => { const it = at && findInstance(s, id); if (it) showTip(s, it, at!); else hideTip(); }); return; }
    const next = a.steps.find((st) => !(st.key in c));
    if (!next) { closePop(); void play(a.play(c), !!c.part); return; }
    if (next.key === 'words') { closePop(); setSay({ action: a, choice: c, to: (pickLabel(a, c) ?? '').replace(/^(A|An|The) /, (x) => x.toLowerCase()) }); return; }
    const picks = next.picks(c);
    // a step with one choice is taken for you, except whom: that is always asked (AD10)
    if (picks.length === 1 && next.key !== 'target') { run(a, { ...c, [next.key]: picks[0].id }, opener); return; }
    openPop({ title: next.title, opener, cls: 'deck-pick', body: [h('div', { class: 'dk-picks', role: 'list' }, picks.map((p: Pick) =>
      h('button', { type: 'button', class: 'dk-pick' + (p.hot ? ' hot' : ''), role: 'listitem', onclick: () => run(a, { ...c, [next.key]: p.id }, opener) },
        h('b', {}, p.label), p.note ? h('small', {}, p.note) : null)))] });
  }

  /** AD14, MAP-85: a click on someone in Who's here, or on a thing on either map: every deck action for it, the thing
   *  already chosen; one that can't be done now greyed, what it needs on hover. False when the deck has none for it */
  function thingMenu(t: MapThing, anchor: HTMLElement | Box): boolean {
    if (disabled || !ctx) return false;
    const list = thingActions(groups, ctx, t);
    if (!list.length) return false;
    const opener = anchor instanceof HTMLElement ? anchor : null, first = list.find((e) => 'a' in e);
    const title = (first && 'a' in first ? chosenLabel(first.a, first.c) : undefined) ?? (t.kind === 'person' ? 'Them' : 'There');
    const pop = openPop({ title, opener, cls: 'deck-pick', body: [h('div', { class: 'dk-picks', role: 'list' }, list.map((e) => 'a' in e
      ? h('button', { type: 'button', class: 'dk-pick' + (e.a.hot ? ' hot' : ''), role: 'listitem', title: actTip(e.a), onclick: () => run(e.a, e.c, opener) }, h('b', {}, e.label))
      : h('button', { type: 'button', class: 'dk-pick dk-lim', role: 'listitem', 'aria-disabled': 'true', title: `Needs ${e.needs}`, 'aria-label': `${e.label}, needs ${e.needs}` }, h('b', {}, e.label, lockMark(e.needs)))))] });
    // beside the thing: to its left, or to its right where the left has no room
    if (!(anchor instanceof HTMLElement)) {
      const w = pop.offsetWidth, v = viewSize();
      pop.style.left = `${anchor.left - w - 8 >= 16 ? anchor.left - w - 8 : Math.min(anchor.right + 8, v.w - w - 16)}px`;
      pop.style.top = `${Math.max(16, Math.min(anchor.top, v.h - pop.offsetHeight - 16))}px`;
    }
    return true;
  }

  // ---- the parts on screen ----
  const aimBtn = h('button', { type: 'button', class: 'dk-tog', 'aria-pressed': 'false', title: 'When on, an attack asks which body part to aim at', onclick: () => { aim = !aim; repaint(); } }, 'Aim');
  // the Defense row: free, no turn; a choice that can't be used now stays chosen and the note names the fallback
  const defBtns = DEFENSES.map((d) => h('button', { type: 'button', 'data-def': d.kind, onclick: () => {
    const s = api.state();
    if (!disabled && s && canDefend(s, s.player, d.kind)) api.setDefense(d.kind);
  } }));
  const defNote = h('span', { class: 'dk-defnote', hidden: true });
  const mods = h('div', { class: 'dk-mods' }, aimBtn, h('span', { class: 'hs-label', id: 'dk-def-h' }, 'Defense'),
    h('span', { class: 'dk-seg dk-def', role: 'group', 'aria-labelledby': 'dk-def-h' }, ...defBtns), defNote);
  function paintDefense(s: GameState) {
    const p = s.player, chosen = p.core.standingDefense, used = safe(() => usableDefense(s, p, false)) ?? chosen;
    DEFENSES.forEach((d, i) => {
      const b = defBtns[i], can = canDefend(s, p, d.kind), v = can ? safe(() => defenseValue(s, p, d.kind)) : null;
      b.replaceChildren(h('span', {}, cap(d.kind)), can ? h('span', { class: 'dv' }, v === null ? '' : figure(v)) : lockMark(d.needs!));
      b.setAttribute('aria-pressed', String(d.kind === chosen));
      if (can) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
      b.title = can ? d.tip : `Needs ${d.needs}`;
    });
    const why = DEFENSES.find((d) => d.kind === chosen)?.needs;
    defNote.hidden = used === chosen;
    defNote.textContent = used === chosen ? '' : `${cap(chosen)} needs ${why}, so you ${used} for now`;
  }
  const cols = h('div', { class: 'dk-groups' });
  const el = h('div', { class: 'deck' }, mods, cols);
  let html = '', wasLimited = new Set<string>();
  const actOf = (b: HTMLElement) => groups[Array.from(cols.children).indexOf(b.closest('.dk-col')!)]?.actions[Number(b.dataset.i)];

  function repaint() {
    aimBtn.setAttribute('aria-pressed', String(aim));
    aimBtn.textContent = aim ? '✓ Aim' : 'Aim';
    update(true);
  }

  /** rebuilt from the game each redraw; a redraw that changes nothing keeps the old buttons (M-74) */
  function update(force = false) {
    const s = api.state();
    if (s) paintDefense(s);
    const pv = s ? safePv(s) : null;
    ctx = s && pv ? ctxOf(s, pv) : null;
    groups = ctx ? deck(ctx) : [];
    if (sayMode && !groups.some((g) => g.actions.some((a) => a.kind === sayMode!.action.kind))) setSay(null);
    const kids = groups.map((g) => h('div', { class: `dk-col g-${g.group}` }, h('p', { class: 'dk-h' }, g.name),
      ...g.actions.map((a, i) => h('button', { type: 'button', class: 'dk-act' + (a.hot ? ' hot' : '') + (a.limit ? ' dk-lim' : ''), 'data-kind': a.kind, 'data-i': String(i),
        ...(a.limit ? { 'aria-disabled': 'true', 'aria-label': `${a.label}, ${a.limit.tip}` } : {}), title: actTip(a) },
        h('span', { class: 't' }, limitMark(a), a.label, freeMark(a), natureMark(a))))));
    const now = kids.map((k) => k.outerHTML).join('');
    if (now === html && !force) return;
    html = now;
    cols.replaceChildren(...kids);
    // A3: a move whose limit ran out since the last redraw pulses once
    const limited = new Set(groups.flatMap((g) => g.actions.filter((a) => a.limit).map(keyOf)));
    cols.querySelectorAll<HTMLButtonElement>('.dk-act:not(.dk-lim)').forEach((b) => { const a = actOf(b); if (a && wasLimited.has(keyOf(a))) b.classList.add('dk-ready'); });
    wasLimited = limited;
    // the buttons find their action by group and place, so a rebuilt list never keeps a stale handler
    cols.querySelectorAll<HTMLButtonElement>('.dk-act').forEach((b) => {
      const a = actOf(b);
      if (a && !a.limit) b.onclick = () => run(a, {}, b);
    });
    lock();
  }
  /** M-06: while a turn runs every action is off, with nothing rebuilt */
  function lock() { el.querySelectorAll<HTMLButtonElement>("button").forEach((b) => { b.disabled = disabled; }); }

  return {
    el, mods, update, thingMenu,
    aimOn: () => aim,
    toggleAim() { aim = !aim; repaint(); },
    /** the first action of this kind, with what is already chosen (the heal slot uses it) */
    runKind(kind: DeckAction['kind'], c: Choice, opener: HTMLElement | null) { const a = groups.flatMap((g) => g.actions).find((x) => x.kind === kind); if (a) run(a, c, opener); },
    /** disables every action while a turn runs or play is stopped */
    setDisabled(d: boolean) { if (d !== disabled) { disabled = d; lock(); } },
    /** the Say box's words for an action waiting on them: builds and plays it; false when nothing waits */
    sendWords(words: string): boolean {
      if (!sayMode || !words.trim()) return false;
      const m = sayMode;
      run(m.action, { ...m.choice, words: words.trim() });
      return true;
    },
    cancelSay() { setSay(null); },
  };
}

const keyOf = (a: DeckAction) => `${a.kind}|${a.label}`;
/** the hover line of a deck action: its wait, its time, then what the old sub-line said (SD6: no line under the name) */
const actTip = (a: DeckAction) => [a.limit?.tip, a.time, a.note].filter(Boolean).join(' · ');
/** a padlock after a defense that can't be used now; its name says what it needs (SD14) */
function lockMark(needs: string): HTMLElement {
  const el = h('span', { class: 'dk-mk dk-lock', role: 'img', title: `Needs ${needs}`, 'aria-label': `Needs ${needs}` });
  el.innerHTML = ICONS.locked;
  return el;
}

/** a lightning bolt after the name of a free action (beside your action, not instead of it): only free ones are marked */
function freeMark(a: DeckAction): HTMLElement | null {
  if (!a.free) return null;
  const el = h('span', { class: 'dk-mk dk-free', role: 'img', title: 'Free', 'aria-label': 'Free' });
  el.innerHTML = ICONS.free_action;
  return el;
}

/** a cracked mask after the name of an action the character is pulled away from; its name says so on hover and to a screen reader */
function natureMark(a: DeckAction): HTMLElement | null {
  if (!a.against) return null;
  const el = h('span', { class: 'dk-mk', role: 'img', title: AGAINST_NATURE, 'aria-label': AGAINST_NATURE });
  el.innerHTML = ICONS.against_nature;
  return el;
}

/** A3: a used move's hollow mark with a slash; a waiting one's ring, filled by the share of the wait gone */
function limitMark(a: DeckAction): HTMLElement | null {
  if (!a.limit) return null;
  return 'used' in a.limit ? h('span', { class: 'dk-mark used', 'aria-hidden': 'true' })
    : h('span', { class: 'dk-mark wait', 'aria-hidden': 'true', style: `--share:${+a.limit.share.toFixed(2)}` });
}

const safePv = (s: GameState): PlayerView | null => { try { return buildPlayerView(s); } catch { return null; } };
