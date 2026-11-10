// Play screen motion (Motion Rules Review, M-01–M-74). Code has already resolved every value; this only animates the
// change from what the screen showed before a turn to what it shows now. Every element is drawn in its final state first
// and the animation plays on top of it (M-74), so finishing, skipping or a failed animation always leaves the right state
// (M-73). Durations come from the --m-* tokens in styles.css (M-50) and from what is on screen, never from how long the
// turn took or which agents ran (M-03). Motion off (the system's reduced-motion setting or the Motion switch) means
// nothing moves: values land at once and only their colour marks the change (M-72).

const KEY = 'motion'; // per viewer: 'on' or 'off'; unset follows the system setting
const sysCalm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const stored = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** whether motion is on: the viewer's Motion switch, else the system setting */
export const motionOn = (): boolean => { const v = stored(); return v ? v === 'on' : !sysCalm(); };
/** the Motion switch; also finishes anything still moving so turning it off never leaves a value half-way */
export function setMotion(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* kept for this page only */ }
  finishAll();
  applyMotion();
}
/** the root's calm class turns CSS transitions and keyframe animations off as well (styles.css) */
export function applyMotion(): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('calm', !motionOn());
}

/** a duration token in ms ('--m-beat' → 220) */
export function ms(name: string): number {
  if (typeof getComputedStyle !== 'function') return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : n) : 0;
}
const easeOf = (name: string) => (typeof getComputedStyle === 'function' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || 'ease-out';

// everything moving now, so one call can finish it all (M-12, M-73)
type Running = { finish(): void };
const running = new Set<Running>();
/** true while anything still animates */
export const moving = (): boolean => running.size > 0;
/** finishes every running animation and pending step at once, in the state a skip produces */
export function finishAll(): void { for (const r of [...running]) r.finish(); running.clear(); }

const canAnimate = (el: Element | null | undefined): el is HTMLElement => !!el && typeof (el as HTMLElement).animate === 'function' && motionOn();

/** one animation on top of an element's final state; before its delay the first frame holds (fill backwards) */
export function play(el: Element | null | undefined, frames: Keyframe[], o: { dur: number; delay?: number; exit?: boolean; pseudo?: string; done?: () => void }): void {
  if (!canAnimate(el)) { o.done?.(); return; }
  const a = el.animate(frames, { duration: Math.max(1, o.dur), delay: Math.max(0, o.delay ?? 0), easing: easeOf(o.exit ? '--m-ease-exit' : '--m-ease'), fill: 'backwards',
    ...(o.pseudo ? { pseudoElement: o.pseudo } : {}) });
  const r: Running = { finish: () => { try { a.finish(); } catch { a.cancel(); } } };
  running.add(r);
  const end = () => { running.delete(r); o.done?.(); };
  a.onfinish = end; a.oncancel = end;
}

/** a number counting from its old value to the final one already in the element (M-36); its text is final when skipped */
export function count(el: HTMLElement | null | undefined, from: number, to: number, fmt: (n: number) => string, delay: number): void {
  if (!el || !canAnimate(el) || from === to || typeof requestAnimationFrame !== 'function') return;
  const final = el.textContent ?? '';
  const dur = ms('--m-count');
  let raf = 0;
  const timer = setTimeout(() => {
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step); else r.finish();
    };
    raf = requestAnimationFrame(step);
  }, delay);
  const r: Running = { finish: () => { clearTimeout(timer); cancelAnimationFrame(raf); el.textContent = final; running.delete(r); } };
  running.add(r);
  el.textContent = fmt(from);
}

/** a small "+3" or "−12" that rises from a number and fades (M-36); tone is a colour token. It sits on the number's
 * parent, so a count rewriting the number's text never removes it. */
export function delta(num: HTMLElement | null | undefined, text: string, tone: string, delay: number): void {
  const host = num?.parentElement;
  if (!host || !canAnimate(host)) return;
  const d = document.createElement('span');
  d.className = 'm-delta'; d.textContent = text; d.setAttribute('aria-hidden', 'true'); d.style.color = `var(--${tone})`;
  host.classList.add('m-host'); host.append(d);
  const hold = ms('--m-count');
  play(d, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(-2px)', offset: 0.2 }, { opacity: 1, transform: 'translateY(-6px)', offset: 0.7 }, { opacity: 0, transform: 'translateY(-10px)' }],
    { dur: hold * 2, delay, done: () => d.remove() });
}

/** a bar moving from one fill to another, both as % of the track (M-36, M-70): a gain grows an overlay over the hidden
 * fill; a loss leaves a pale trail of the part lost that drains away. wrap: the bar filled up and started again (level-up). */
export function bar(track: HTMLElement | null | undefined, fill: HTMLElement | null | undefined, from: number, to: number, delay: number, wrap = false): void {
  if (!track || !fill || !canAnimate(track) || (from === to && !wrap)) return;
  const dur = ms('--m-trail');
  const seg = (left: number, width: number, cls: string) => {
    const s = document.createElement('span');
    s.className = 'm-bar ' + cls; s.setAttribute('aria-hidden', 'true');
    s.style.left = `${left}%`; s.style.width = `${width}%`;
    track.append(s);
    return s;
  };
  if (to < from && !wrap) {
    // the fill already shows the new value; the trail covers what was lost, holds a beat, then drains toward it
    const t = seg(to, from - to, 'trail');
    play(t, [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.3 }, { transform: 'scaleX(0)', opacity: 0.6 }], { dur, delay, done: () => t.remove() });
    return;
  }
  // gains: an overlay of the full track grows from the old fill to the new one while the real fill waits underneath
  const o = seg(0, 100, 'grow');
  o.style.background = getComputedStyle(fill).backgroundColor;
  const f = (x: number) => `scaleX(${Math.max(0, Math.min(100, x)) / 100})`;
  const frames: Keyframe[] = wrap
    ? [{ transform: f(from) }, { transform: f(100), offset: 0.45 }, { transform: f(100), opacity: 0, offset: 0.6 }, { transform: f(0), opacity: 0, offset: 0.61 }, { transform: f(0), opacity: 1, offset: 0.65 }, { transform: f(to) }]
    : [{ transform: f(from) }, { transform: f(to) }];
  const total = wrap ? dur * 2 : dur;
  play(fill, [{ opacity: 0 }, { opacity: 0 }], { dur: total, delay });
  play(o, frames, { dur: total, delay, done: () => o.remove() });
}

/** a word that changed: the old word stays until its beat, then the new one lands with a short drop and fade (level words,
 * coin); no overshoot (M-71). Skipping shows the new word at once. */
export function stamp(el: HTMLElement | null | undefined, delay: number, old?: string): void {
  if (!el || !canAnimate(el)) return;
  const final = el.textContent ?? '';
  const land = () => play(el, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { dur: ms('--m-beat') });
  if (delay <= 0) { land(); return; }
  // until its beat the old word stays readable; skipping shows the new one at once
  if (old !== undefined) el.textContent = old;
  const timer = setTimeout(() => { done(); land(); }, delay);
  const done = () => { clearTimeout(timer); el.textContent = final; running.delete(r); };
  const r: Running = { finish: done };
  running.add(r);
}

/** one short pulse on an element: scale and back, strength 1–3 (M-20, M-30); shift adds a small sideways jolt (≤3 px) */
export function pulse(el: Element | null | undefined, delay: number, strength = 1, shift = false): void {
  const s = 1 + 0.06 * strength;
  const x = shift ? Math.min(3, strength) : 0;
  play(el, [{ transform: 'none' }, { transform: `translateX(${x}px) scale(${s})`, offset: 0.35 }, { transform: `translateX(${-x}px) scale(${1 + (s - 1) / 3})`, offset: 0.65 }, { transform: 'none' }],
    { dur: Math.min(290, ms('--m-beat') + 20 * strength), delay });
}

/** something new arriving: fade and a small rise (rows, cards, chips) */
export function arrive(el: Element | null | undefined, delay: number, rise = 4): void {
  play(el, [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'none' }], { dur: ms('--m-state'), delay });
}

/** a chip landing hard: in from slightly larger, no bounce (M-30: a part becomes Crippled or Destroyed) */
export function slam(el: Element | null | undefined, delay: number): void {
  play(el, [{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'scale(1)' }], { dur: ms('--m-beat'), delay });
}

/** a run of steps that each start a fixed gap after the last, capped: past the cap the rest start together (M-11, M-21) */
export function timeline(start: number, gap: number, cap: number): () => number {
  let i = 0;
  return () => Math.min(start + gap * i++, start + cap);
}

/** splits narration into sentences for the paced reveal (M-10); the text itself is unchanged */
export function sentences(text: string): string[] {
  // a sentence ends at . ! ? or …, maybe with a closing quote, before a space and a capital (so “Stop!” he said stays one)
  const out = text.split(/(?<=[.!?…]["”’)\]]*)\s+(?=["“‘(\[]?\p{Lu}|\d)/u).map((x) => x.trim()).filter(Boolean);
  return out.length ? out : [text];
}
