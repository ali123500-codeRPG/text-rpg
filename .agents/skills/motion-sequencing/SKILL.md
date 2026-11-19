---
name: "motion-sequencing"
description: "Library-free sequencing for web animation, borrowing GSAP's principles: one timeline with positioned steps, staggers, overwrite and cleanup, FLIP, performance, reduced motion."
---

# Motion sequencing without a library

Borrows the library-independent principles behind greensock/gsap-skills (MIT): timelines over chained delays, the position parameter, defaults, overwrite, cleanup and performance. Implements them with CSS and the Web Animations API. Do not add GSAP to a project that doesn't use it.

## Before starting

If the project has its own motion rules, read them first (in this repo: `docs/build-spec.md`, section "### Play screen motion"); their tokens, order of beats and skip rules win.

## Principles

- **MS-01 One timeline per moment.** Build a multi-step sequence as one timeline with explicit start positions, not `setTimeout` chains or hand-summed `animation-delay`s. Changing one step's duration must not require recomputing the others.
- **MS-02 Position, not delay.** Each step starts at an absolute time, relative to the end of the timeline (`"+=N"` gap, `"-=N"` overlap), or at a named label.
- **MS-03 Defaults on the timeline.** Duration and easing come from the timeline's defaults (which come from motion tokens); a step overrides only what differs.
- **MS-04 Explicit start and end states** (from-to). Don't read computed styles mid-flight to decide where to animate from.
- **MS-05 Overwrite before starting.** Before animating an element, `finish()` whatever is already running on it so two animations never fight over one property, and the element starts from its true final state.
- **MS-06 Everything is skippable and cleaned up.** Keep a handle to every animation a moment starts. Skip = `finish()` all of them. Unmount or new turn = cancel and clear. Avoid piling up `fill: forwards`: after an animation finishes, `commitStyles()` then `cancel()` (or set the final classes).
- **MS-07 Staggers are fixed and capped.** Per-item offset 30–60 ms; beyond about six items the rest share the last offset so long lists don't drag.
- **MS-08 Fade-outs also hide.** When opacity reaches 0, set `visibility: hidden` or `inert` so invisible elements can't be focused or clicked (GSAP's "autoAlpha").
- **MS-09 Layout changes use FLIP.** Measure First, apply the change, measure Last, Invert with a transform, then Play the transform back to none. Never animate width, height, top or left.
- **MS-10 Performance.** Transform and opacity only; read all measurements before any writes; add `will-change` just before a heavy animation and remove it after; drive procedural motion with one `requestAnimationFrame` loop, not many.
- **MS-11 Reduced motion is live.** Listen to `matchMedia('(prefers-reduced-motion: reduce)')` changes and the in-app toggle; under reduced motion a timeline jumps straight to its end state.

## A minimal timeline

```js
function timeline(defaults = {}) {
  const steps = [], labels = {}; let end = 0;
  const at = pos =>
    pos == null ? end :
    typeof pos === 'number' ? pos :
    pos.startsWith('+=') ? end + Number(pos.slice(2)) :
    pos.startsWith('-=') ? end - Number(pos.slice(2)) :
    labels[pos] ?? end;

  const api = {
    add(el, keyframes, opts = {}, pos) {
      const o = { ...defaults, ...opts };
      const start = at(pos);
      steps.push({ el, keyframes, o: { ...o, delay: start, fill: 'both' } });
      end = Math.max(end, start + o.duration);
      return api;
    },
    label(name, pos) { labels[name] = at(pos); return api; },
    play({ reduced = false } = {}) {
      steps.forEach(s => s.el.getAnimations().forEach(a => a.finish()));   // MS-05
      const anims = steps.map(s => s.el.animate(s.keyframes, s.o));
      const settle = () => anims.forEach(a => { try { a.commitStyles(); } catch {} a.cancel(); });
      const finished = Promise.all(anims.map(a => a.finished)).then(settle, () => {});
      const handle = {
        finished,
        skip()   { anims.forEach(a => a.finish()); },   // lands on the final state
        cancel() { anims.forEach(a => a.cancel()); }
      };
      if (reduced) handle.skip();
      return handle;
    }
  };
  return api;
}

// Usage: narration done → beat → part state, overlapping slightly.
const tl = timeline({ duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
  .add(chip, [{ opacity: 0 }, { opacity: 1 }])
  .label('beat')
  .add(target, [{ transform: 'scale(1.06, 0.94)' }, { transform: 'none' }], {}, 'beat')
  .add(part, [{ filter: 'brightness(1.3)' }, { filter: 'none' }], { duration: 200 }, '-=80');
const run = tl.play({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
```

## FLIP sketch

```js
function flip(el, mutate, opts = { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }) {
  const first = el.getBoundingClientRect();           // First (read)
  mutate();                                           // change the DOM
  const last = el.getBoundingClientRect();            // Last (read)
  const dx = first.left - last.left, dy = first.top - last.top;
  return el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], opts); // Invert + Play
}
```

## Checklist

- Durations and easings come from tokens.
- No `setTimeout` choreography; one timeline per moment.
- Skip, cancel and reduced motion all land on the same final state.
- No animation left running or filling after its moment ends.