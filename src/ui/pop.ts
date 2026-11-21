// Pop-ups for the game screens (CP2). A partial pop-up (details): clicking an entry opens its details in a floating panel
// that can be dragged by its head and closed, and never blocks the page underneath (non-modal). One is open at a time;
// opening another replaces it. A full-screen pop-up covers the page for a board too big for a panel (Perks); partial
// pop-ups and the perk card still open on top of it. Both close with ✕ or Esc, focus goes back to what opened them, and
// each opens and closes with one short fade (exit faster than entrance, M-51; none with motion off, M-72).
import { boxOf, fitInView, h, iconMark, pointOf, viewSize } from './kit';
import { ICONS } from './itemIcons';

type Box = ReturnType<typeof boxOf>;
import { arrive, ms, moving, play } from './motion';

let current: { el: HTMLElement; opener?: HTMLElement | null; back?: true } | null = null;

/** closes the open details pop-up, if any. One opened with `back` added a step to the browser's history, so Back closes it;
 *  closing it any other way takes that step back off (as the full-screen pop-up does, BG-220) */
export function closePop(byBack = false): boolean {
  if (!current) return false;
  const { el, opener, back } = current;
  current = null;
  if (back && !byBack && history.state?.dpop) history.back();
  if (el.contains(document.activeElement) && opener?.isConnected) opener.focus();
  fadeOut(el);
  return true;
}

/** one short fade out, then gone; the pop-up stops catching clicks at once */
function fadeOut(el: HTMLElement): void {
  el.style.pointerEvents = 'none';
  el.style.opacity = '0';
  play(el, [{ opacity: 1 }, { opacity: 0 }], { dur: ms('--m-feedback'), exit: true, done: () => el.remove() });
}

let full: { el: HTMLElement; opener?: HTMLElement | null; shut: HTMLElement[]; onClose?: () => void } | null = null;

/** closes the full-screen pop-up, if any, and any partial pop-up over it. BG-220: opening it adds a step to the browser's
 * history, so Back (or the mouse's back button) closes it instead of leaving the page; closing it any other way takes that
 * step back off, so Back still goes where it went before. */
export function closeFull(byBack = false): boolean {
  if (!full) return false;
  const { el, opener, shut, onClose } = full;
  full = null;
  if (!byBack && history.state?.fpop) history.back();
  closePop();
  for (const x of shut) x.inert = false;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  fadeOut(el);
  onClose?.();
  return true;
}

/** opens a full-screen pop-up over the page: the page under it can't be reached until it closes (modal). The body
 * brings its own heading; `label` names the pop-up for screen readers. */
export function openFull(o: { label: string; body: (Node | string | null)[]; opener?: HTMLElement | null; cls?: string; onClose?: () => void }): HTMLElement {
  closeFull(true); // one replacing another keeps the history step
  closePop();
  const x = h('button', { type: 'button', class: 'hs-icon-btn fpop-x', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => closeFull() }, '✕');
  const el = h('div', { class: `fpop ${o.cls ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': o.label, tabindex: '-1' }, x, h('div', { class: 'fpop-body' }, ...o.body));
  const shut = Array.from(document.body.children).filter((c): c is HTMLElement => c instanceof HTMLElement && !c.inert && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE');
  for (const c of shut) c.inert = true;
  document.body.append(el);
  full = { el, opener: o.opener, shut, onClose: o.onClose };
  if (!history.state?.fpop) history.pushState({ fpop: true }, ''); // BG-220: Back closes it
  play(el, [{ opacity: 0 }, { opacity: 1 }], { dur: ms('--m-state') });
  el.focus({ preventScroll: true });
  return el;
}
/** the full-screen pop-up's element while one is open */
export const fullOpen = (): HTMLElement | null => full?.el ?? null;

if (typeof document !== 'undefined') {
  // Esc closes the partial pop-up first, unless something is still moving: then Esc only skips (M-12)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current && !moving()) { e.stopPropagation(); closePop(); } }, true);
  // then a card floating over the full-screen pop-up (the perk card closes itself and marks the key used), then the pop-up
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && full && !moving() && !e.defaultPrevented && !full.el.querySelector('.pk-card')) closeFull();
  });
  // Back closes it (BG-220); leaving the page closes it
  addEventListener('popstate', () => { if (current?.back) closePop(true); closeFull(true); });
  addEventListener('hashchange', () => { if (current?.back) closePop(true); closeFull(true); });
  // BG-357: a pop-up placed for one window size is moved back into view when the window changes size
  addEventListener('resize', () => { document.querySelectorAll<HTMLElement>('.dpop, .pk-card').forEach((el) => fitInView(el, parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0)); });
}

/** moves a floating box by its head, which gets a grip at its left; the box stays inside the window (fitInView).
 *  moved hears where it was left */
export function dragBy(el: HTMLElement, head: HTMLElement, moved?: (at: { left: number; top: number }) => void): void {
  head.prepend(iconMark(ICONS.drag, 'Drag to move', 'grip'));
  head.addEventListener('pointerdown', (ev) => {
    if ((ev.target as Element).closest('a, button')) return;
    const b = boxOf(el), p0 = pointOf(ev), dx = p0.x - b.left, dy = p0.y - b.top;
    const move = (m: PointerEvent) => { const p = pointOf(m); const at = fitInView(el, p.x - dx, p.y - dy); moved?.(at); };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
}

/** opens a details pop-up near its opener, or beside a map mark's box; tone names a colour token for its edge (scenario-mark, danger…) */
export function openPop(o: { title: string; body: (Node | string | null)[]; opener?: HTMLElement | null; beside?: Box; tone?: string; cls?: string; back?: true }): HTMLElement {
  closePop(!!(o.back && current?.back)); // one Back pop-up replacing another keeps the history step
  const tid = `dpop-t${Date.now()}`;
  const x = h('button', { type: 'button', class: 'hs-icon-btn dpop-x', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => closePop() }, '✕');
  const head = h('div', { class: 'dpop-head' }, h('span', { class: 'hs-label', id: tid }, o.title), x);
  const el = h('aside', { class: `dpop ${o.cls ?? ''}`, role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': tid, tabindex: '-1', style: o.tone ? `--pc: var(--${o.tone})` : undefined },
    head, h('div', { class: 'dpop-body' }, ...o.body));
  dragBy(el, head);
  // beside a map mark (left of it, else right), else above the opener (below where the top has no room), else near the top right
  document.body.append(el);
  const r = o.opener ? boxOf(o.opener) : undefined, b = o.beside, v = viewSize(), w = el.offsetWidth, hgt = el.offsetHeight;
  fitInView(el, b ? (b.left - w - 8 >= 16 ? b.left - w - 8 : b.right + 8) : r ? r.left + r.width / 2 - w / 2 : v.w - w - 32,
    b ? b.top : r ? (r.top - hgt - 12 >= 16 ? r.top - hgt - 12 : r.bottom + 12) : 96);
  current = { el, opener: o.opener, ...(o.back ? { back: true as const } : {}) };
  if (o.back && !history.state?.dpop) history.pushState({ dpop: true }, ''); // Back closes it
  arrive(el, 0, 6);
  el.focus({ preventScroll: true });
  return el;
}
