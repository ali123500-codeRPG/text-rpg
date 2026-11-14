// The action deck on Play (AD1–AD16): the suggested action, the Aim and Stance rows, and every action the code allows in
// its groups. Clicking an action asks what it still needs (whom, with what, which part) in a small pop-up, then plays
// the turn at once with no Parser call (AD6, AD7); a move planned on the minimap rides along (AD12). Actions that need
// your words wait for the Say box. No keys pick actions (AD10), so typing never plays one by mistake.
import type { GameApi, GameState, PlayerView } from '../types';
import { personalityOf } from '../ruleset/personality';
import { moraleLevel } from '../ruleset/morale';
import { buildPlayerView } from '../views';
import { h } from './kit';
import { closePop, openPop } from './pop';
import { deck, actionsOn, type Choice, type DeckAction, type DeckCtx, type Order, type Pick } from './deck';
import { suggestions, type Suggestion } from './suggest';
import { openLoot } from './loot';
import { instanceIcon } from './itemIcons';
import type { MinimapPoint } from './minimap';

export type SayMode = { action: DeckAction; choice: Choice; to: string };
type Stance = 'careful' | 'normal' | 'reckless';
const STANCES: [Stance, string][] = [['careful', 'Careful'], ['normal', 'Normal'], ['reckless', 'Reckless']];

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
  let aim = false, stance: Stance = 'normal', sugAt = 0, sayMode: SayMode | null = null;
  let groups: ReturnType<typeof deck> = [], sugs: Suggestion[] = [], ctx: DeckCtx | null = null, disabled = false;
  const ctxOf = (s: GameState, pv: PlayerView): DeckCtx => ({ pv, s, stance, aim, broken: moraleLevel(s.player) === 'broken', self: personalityOf(s.player) });

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
  function setSay(m: SayMode | null) { sayMode = m; o.sayMode(m); }

  /** asks the action's next missing step; with nothing missing, plays it */
  function run(a: DeckAction, c: Choice = {}, opener: HTMLElement | null = null) {
    if (disabled) return;
    if (a.kind === 'loot') { const s = api.state(), pv = ctx?.pv; if (s && pv) openLoot(pv, opener, (line, gear) => void play({ line, intent: { ...NO_ORDER, gear } }, false), (id) => instanceIcon(s, id, 'iico lico')); return; }
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

  /** AD14: clicking someone on the minimap or in Who's here: what you can do to or with them */
  function personMenu(id: string, anchor: HTMLElement | DOMRect) {
    if (disabled) return;
    const acts = actionsOn(groups, id);
    if (!acts.length) return;
    const opener = anchor instanceof HTMLElement ? anchor : null;
    const pop = openPop({ title: pickLabel(acts[0], { target: id }) ?? 'Them', opener, cls: 'deck-pick', body: [h('div', { class: 'dk-picks', role: 'list' }, acts.map((a) =>
      h('button', { type: 'button', class: 'dk-pick' + (a.hot ? ' hot' : ''), role: 'listitem', onclick: () => run(a, { target: id }, opener) }, h('b', {}, a.label), a.note ? h('small', {}, a.note) : null)))] });
    if (!(anchor instanceof HTMLElement)) { pop.style.left = `${Math.max(16, anchor.left - pop.offsetWidth - 8)}px`; pop.style.top = `${Math.max(16, anchor.top)}px`; }
  }

  // ---- the parts on screen ----
  const sugBtn = h('button', { type: 'button', class: 'dk-go' });
  const sugWhy = h('p', { class: 'dk-why' });
  const altBtn = h('button', { type: 'button', class: 'hs-btn-text dk-alt', title: 'Show the next best idea', onclick: () => { sugAt = (sugAt + 1) % Math.max(1, sugs.length); paintSug(); } }, '↻ Another');
  const sugEl = h('section', { class: 'dk-sug', 'aria-label': 'Suggested action' }, h('p', { class: 'hs-label dk-sl' }, 'Suggested'), sugBtn, altBtn, sugWhy);
  function paintSug() {
    const x = sugs[sugAt];
    sugEl.hidden = !x;
    if (!x) return;
    const who = pickLabel(x.action, x.choice);
    sugBtn.textContent = who && !x.action.label.includes(who) ? `${x.action.label} ${who}` : x.action.label;
    sugBtn.onclick = () => run(x.action, x.choice, sugBtn);
    sugBtn.disabled = disabled;
    sugWhy.textContent = x.reason;
    altBtn.hidden = sugs.length < 2;
  }

  const aimBtn = h('button', { type: 'button', class: 'dk-tog', 'aria-pressed': 'false', title: 'When on, an attack asks which body part to aim at', onclick: () => { aim = !aim; repaint(); } }, 'Aim');
  const stanceBtns = STANCES.map(([k, name]) => h('button', { type: 'button', 'data-stance': k, 'aria-pressed': String(k === stance), onclick: () => { stance = k; repaint(); } }, name));
  const mods = h('div', { class: 'dk-mods' }, aimBtn, h('span', { class: 'hs-label' }, 'Stance'), h('span', { class: 'dk-seg', role: 'group', 'aria-label': 'Stance' }, ...stanceBtns));
  const cols = h('div', { class: 'dk-groups' });
  const el = h('div', { class: 'deck' }, mods, cols);
  let html = '';

  function repaint() {
    aimBtn.setAttribute('aria-pressed', String(aim));
    aimBtn.textContent = aim ? '✓ Aim' : 'Aim';
    for (const b of stanceBtns) b.setAttribute('aria-pressed', String(b.dataset.stance === stance));
    update(true);
  }

  /** rebuilt from the game each redraw; a redraw that changes nothing keeps the old buttons (M-74) */
  function update(force = false) {
    const s = api.state();
    const pv = s ? safePv(s) : null;
    ctx = s && pv ? ctxOf(s, pv) : null;
    groups = ctx ? deck(ctx) : [];
    const before = sugs[sugAt]?.reason;
    sugs = ctx ? suggestions(groups, ctx) : [];
    if (!sugs.some((x) => x.reason === before)) sugAt = 0; // a new moment starts from the best idea again
    if (sayMode && !groups.some((g) => g.actions.some((a) => a.kind === sayMode!.action.kind))) setSay(null);
    paintSug();
    const kids = groups.map((g) => h('div', { class: `dk-col g-${g.group}` }, h('p', { class: 'dk-h' }, g.name),
      ...g.actions.map((a, i) => h('button', { type: 'button', class: 'dk-act' + (a.hot ? ' hot' : ''), 'data-kind': a.kind, 'data-i': String(i) },
        h('span', { class: 't' }, a.label), a.note ? h('span', { class: 'n' }, a.note) : null))));
    const now = kids.map((k) => k.outerHTML).join('');
    if (now === html && !force) return;
    html = now;
    cols.replaceChildren(...kids);
    // the buttons find their action by group and place, so a rebuilt list never keeps a stale handler
    cols.querySelectorAll<HTMLButtonElement>('.dk-act').forEach((b) => {
      const gi = Array.from(cols.children).indexOf(b.closest('.dk-col')!);
      const a = groups[gi]?.actions[Number(b.dataset.i)];
      if (a) b.onclick = () => run(a, {}, b);
    });
    lock();
  }
  /** M-06: while a turn runs every action is off, with nothing rebuilt */
  function lock() { el.querySelectorAll<HTMLButtonElement>("button").forEach((b) => { b.disabled = disabled; }); sugBtn.disabled = disabled; altBtn.disabled = disabled; }

  return {
    el, sugEl, mods, update, personMenu,
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

const safePv = (s: GameState): PlayerView | null => { try { return buildPlayerView(s); } catch { return null; } };
