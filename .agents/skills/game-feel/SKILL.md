---
name: "game-feel"
description: "Game feel for web/CSS game UIs: decaying screen shake, hit-stop, squash, health-bar drains and feedback tiers scaled by event rarity (hits, level-ups, achievements)."
---

# Game feel (web, no animation library)

Adapted from the `game-feel` skill in gamedev-skills/awesome-gamedev-agent-skills (Apache-2.0), rewritten for DOM, CSS and the Web Animations API. Engine code (time scale, camera nodes) is replaced with browser equivalents.

## Before starting

If the project has its own motion rules, read them first (in this repo: `docs/build-spec.md`, section "### Play screen motion"). Their caps, durations, easing bans and timing-leak rules win over every number in this skill. This skill decides *how much* feedback an event gets; the project's rules decide the limits.

## Core idea

- Feedback is layered: a strong event is several small responses firing within about 100 ms (tint, shake, hold, pop, sound if the app has any). Each is cheap; together they read as impact.
- Exaggerate briefly, then return to rest. Juice is never a new resting state.
- Scale feedback to importance and rarity. A routine event gets almost nothing; a rare one gets the most.

## 1. Tiers (decide before animating)

- **GF-01** Assign every event a tier before writing any motion:

| Tier | Typical events | Channels | Max duration |
|---|---|---|---|
| T0 routine | miss, dodge, menu click | none or one tint | 120 ms |
| T1 common | graze, block, small heal, minor drain | 1–2 | 200 ms |
| T2 notable | full hit, HP threshold crossed, item found | 2–3, small shake allowed | 300 ms |
| T3 rare | heavy or crushing hit, part destroyed, death | 3–4, shake + hit-stop allowed | 400 ms (or the project's lower cap) |
| T4 milestone | level-up, achievement, boss down | authored moment | 800 ms, skippable |

- **GF-02** Rarity sets the tier. If an event happens on most turns it cannot sit above T1, however dramatic it sounds. Re-check tiers when the game's balance changes how often things happen.
- **GF-03** Feedback never stacks into noise: two T2+ events in the same 300 ms window merge into one response at the higher tier (shake trauma adds and clamps; hit-stop plays once).

## 2. Screen shake (decaying trauma)

- **GF-10** Shake a visual wrapper with `transform`, never layout properties, never the input box, and never text the player is still reading.
- **GF-11** Keep a `trauma` value from 0 to 1. Events add to it (clamped); it decays linearly every frame; displacement uses `trauma²` so small hits barely move and big ones punch. Drive it with smooth sine/noise, not a new random offset each frame (that buzzes).
- **GF-12** Maximum offsets are project tokens. For text-heavy UIs default to 6 px / 4 px / 0.5°, and lower them if the project's motion rules cap offsets (this repo's do: see the spec section above).

```js
const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  document.documentElement.dataset.motion === 'reduced';

const shake = (() => {
  let trauma = 0, t = 0, last = 0, raf = 0, el = null;
  const MAX_X = 6, MAX_Y = 4, MAX_ROT = 0.5, DECAY = 1.6; // px, px, deg, trauma per second
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    trauma = Math.max(trauma - DECAY * dt, 0);
    const s = trauma * trauma; t += dt * 30;
    el.style.transform = s
      ? `translate(${MAX_X * s * Math.sin(t * 1.7)}px, ${MAX_Y * s * Math.sin(t * 2.3)}px) rotate(${MAX_ROT * s * Math.sin(t * 1.1)}deg)`
      : '';
    raf = trauma > 0 ? requestAnimationFrame(frame) : 0;
  }
  return {
    add(target, amount) {            // T2 ≈ 0.3, T3 ≈ 0.6
      if (reduced()) return;
      el = target; trauma = Math.min(trauma + amount, 1);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    },
    stop() {                          // skip: jump to rest
      trauma = 0; if (raf) cancelAnimationFrame(raf); raf = 0;
      if (el) el.style.transform = '';
    }
  };
})();
```

## 3. Hit-stop (the browser version)

Browsers have no global time scale. Hit-stop here means: the struck element snaps to its impact pose (squashed, tinted) and **holds** briefly before settling.

- **GF-20** T3+ only, 60–100 ms hold (2–5 frames at 60 fps), once per impact.
- **GF-21** Time it with real time (`performance.now`, the animation's own duration), never by waiting on other animations.
- **GF-22** Input is never blocked during the hold. A skip calls `finish()` and lands on the rest state.

```js
function impact(el, { squash = 0.06, hold = 80, settle = 200 } = {}) {
  el.getAnimations().forEach(a => a.finish());           // no overlapping tweens
  if (reduced()) {
    return el.animate([{ filter: 'brightness(1.35)' }, { filter: 'none' }], { duration: 160 });
  }
  const pose = `scale(${1 + squash}, ${1 - squash})`;
  return el.animate([
    { transform: pose, filter: 'brightness(1.35)', offset: 0 },
    { transform: pose, filter: 'brightness(1.35)', offset: hold / (hold + settle),
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    { transform: 'none', filter: 'none', offset: 1 }
  ], { duration: hold + settle });
}
```

## 4. Squash and pop

- **GF-30** Deform instantly on the event, then ease back. Conserve volume: stretch one axis as much as the other squashes (e.g. 1.06 / 0.94).
- **GF-31** Deform icons, chips, portraits and bars freely; deform text blocks by 4% at most so they stay readable.
- **GF-32** Overshoot (back/elastic) only if the project allows it. If it bans bounce (this repo does: rule M-71), settle with a strong ease-out such as `cubic-bezier(0.16, 1, 0.3, 1)`.

## 5. Health drains

- **GF-40** Two-layer bar. The fill jumps to the true value at once; a trailing "ghost" layer holds 150–300 ms, then drains with ease-out. For healing, reverse it: the ghost jumps ahead in the heal colour and the fill catches up.
- **GF-41** Animate `transform: scaleX()` with `transform-origin: left`, never `width`.
- **GF-42** Tier by size of the change relative to the maximum: under 10% → T1, 10–30% → T2, over 30% → T3.

```css
.bar { position: relative; overflow: hidden; height: 8px; }
.bar > * { position: absolute; inset: 0; transform-origin: left; }
.bar-fill  { background: var(--hp); transform: scaleX(var(--v, 1)); }
.bar-ghost { background: var(--hp-loss); transform: scaleX(var(--g, 1));
             transition: transform var(--m-state) var(--m-ease) var(--ghost-hold, 250ms); }
@media (prefers-reduced-motion: reduce) { .bar-ghost { transition: none; } }
```

## 6. Level-ups and achievements (T4)

- **GF-50** One authored moment: a short anticipation (80–120 ms dim or hold), the reveal (scale 0.92 → 1 plus fade), then settle. One glow or ring pass, never a loop.
- **GF-51** Queue them after the turn's combat feedback, one at a time, each skippable, none blocking input.
- **GF-52** Announce once through a polite live region; motion is never the only signal.

## Always

- Animate `transform`, `opacity` and colour/filter only.
- `prefers-reduced-motion: reduce` and an in-app "Reduce screen shake" toggle: no shake, no hold, no scale; keep colour and text.
- No more than three flashes per second, and no full-screen white flashes; tint the element instead.
- State must be readable without motion.

## Verify

Trigger each tier ten times quickly. Confirm everything decays to rest, merged events don't run away, input still registers during holds, skip lands on the final state, and the reduced-motion path shows colour only. Report what you observed.