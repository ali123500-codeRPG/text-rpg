// Details pop-ups for the game screens: clicking an entry opens its details in a floating panel that can be dragged by
// its head and closed, and never blocks the page underneath (non-modal). One is open at a time; opening another
// replaces it. Esc closes it and focus goes back to what opened it.
import { h } from './kit';
import { arrive, moving } from './motion';

let current: { el: HTMLElement; opener?: HTMLElement | null } | null = null;

/** closes the open details pop-up, if any */
export function closePop(): boolean {
  if (!current) return false;
  const { el, opener } = current;
  current = null;
  if (el.contains(document.activeElement) && opener?.isConnected) opener.focus();
  el.remove();
  return true;
}

if (typeof document !== 'undefined')
  // Esc closes the pop-up, unless something is still moving: then Esc only skips (M-12)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current && !moving()) { e.stopPropagation(); closePop(); } }, true);

/** opens a details pop-up near its opener; tone names a colour token for its edge (scene-mark, danger…) */
export function openPop(o: { title: string; body: (Node | string | null)[]; opener?: HTMLElement | null; tone?: string; cls?: string }): HTMLElement {
  closePop();
  const tid = `dpop-t${Date.now()}`;
  const x = h('button', { type: 'button', class: 'hs-icon-btn dpop-x', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => closePop() }, '✕');
  const head = h('div', { class: 'dpop-head' }, h('span', { class: 'hs-label', id: tid }, o.title), x);
  const el = h('aside', { class: `dpop ${o.cls ?? ''}`, role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': tid, tabindex: '-1', style: o.tone ? `--pc: var(--${o.tone})` : undefined },
    head, h('div', { class: 'dpop-body' }, ...o.body));
  // beside the opener when there is room, else near the top right
  const r = o.opener?.getBoundingClientRect();
  document.body.append(el);
  const w = el.offsetWidth || 360, hgt = el.offsetHeight || 200;
  const left = r ? Math.min(innerWidth - w - 16, Math.max(16, r.left + r.width / 2 - w / 2)) : innerWidth - w - 32;
  const top = r ? (r.top - hgt - 12 > 16 ? r.top - hgt - 12 : Math.min(innerHeight - hgt - 16, r.bottom + 12)) : 96;
  el.style.left = `${left}px`; el.style.top = `${Math.max(16, top)}px`;
  // drag by the head
  head.addEventListener('pointerdown', (ev) => {
    if ((ev.target as Element).closest('a, button')) return;
    const b = el.getBoundingClientRect();
    const dx = ev.clientX - b.left, dy = ev.clientY - b.top;
    const move = (m: PointerEvent) => {
      el.style.left = `${Math.max(0, Math.min(innerWidth - 80, m.clientX - dx))}px`;
      el.style.top = `${Math.max(0, Math.min(innerHeight - 40, m.clientY - dy))}px`;
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
  current = { el, opener: o.opener };
  arrive(el, 0, 6);
  el.focus({ preventScroll: true });
  return el;
}
