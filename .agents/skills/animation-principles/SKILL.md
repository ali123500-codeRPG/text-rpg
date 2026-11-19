---
name: "animation-principles"
description: "Disney's 12 animation principles applied to web interfaces and game UI, with plain-CSS examples such as anticipation before an attack and squash on impact."
---

# Animation principles for interfaces

Condensed from dylantarre/animation-principles (MIT), which splits the 12 principles across 144 small skills; this keeps the principles plus the CSS and game-UI angles in one place. Source: Johnston and Thomas, *The Illusion of Life* (1981).

## Before starting

If the project has its own motion rules, read them first (in this repo: `docs/build-spec.md`, section "### Play screen motion"); their durations, caps and bans win. Use this skill to decide what a motion should *express*, then fit it inside those limits.

## Quick map

| # | Principle | Interface use | Guardrail |
|---|---|---|---|
| 1 | Squash & stretch | impact, pressed buttons, landing | conserve volume; text ≤ 4% |
| 2 | Anticipation | wind-up before an attack, hold before a reveal | short (60–120 ms); same length whatever follows |
| 3 | Staging | one focal motion at a time | dim or freeze the rest |
| 4 | Straight ahead / pose to pose | keyframes for authored beats; rAF/physics for shake | don't keyframe what should be procedural |
| 5 | Follow through / overlap | children settle after the parent | stagger 30–60 ms, total capped |
| 6 | Slow in / slow out | eased motion, never linear for movement | enter ease-out, exit ease-in |
| 7 | Arc | items flying to an inventory slot | split X and Y easing |
| 8 | Secondary action | glow after a badge lands | must support, never compete |
| 9 | Timing | duration conveys weight | tokens, not literals |
| 10 | Exaggeration | strength scales with importance | tie to the event's tier |
| 11 | Solid drawing | consistent shape and origin | same transform-origin per element |
| 12 | Appeal | restraint and consistency | fewer, better motions |

## Timing reference

- One frame at 60 fps ≈ 16.7 ms. Hit-stop: 2–5 frames (≈ 35–85 ms).
- Micro feedback 100–150 ms · small state change 150–250 ms · medium 250–400 ms · large/authored 400–700 ms.
- Exits run at about 70% of the entrance duration.
- Input feedback starts within 100 ms.
- Game frame data (startup / active / recovery at 60 fps): light attack 3–6 / 2–4 / 8–12 f; heavy 12–20 / 4–8 / 16–24 f. A heavier action gets a longer wind-up and recovery, not a slower strike.

## Examples (plain CSS)

### Anticipation before an attack (2, 6, 9)

Pull back slowly, strike fast, settle.

```css
@keyframes strike {
  0%   { transform: translateX(0);                  animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1); }
  30%  { transform: translateX(-6px) scale(0.98);   animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }  /* wind-up */
  45%  { transform: translateX(10px) scale(1.02);   animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); } /* strike */
  100% { transform: translateX(0); }                                                                              /* settle */
}
.attacker.is-striking { animation: strike 320ms both; }
```

### Squash on impact (1, 11)

```css
@keyframes impact-squash {
  0%   { transform: scale(1.08, 0.92); }
  100% { transform: scale(1, 1); }
}
.target.is-hit {
  transform-origin: 50% 100%;            /* squash toward the ground */
  animation: impact-squash 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Follow through and overlap (5)

```css
.panel.is-entering > * {
  animation: rise 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(min(var(--i), 6) * 40ms);   /* cap the stagger */
}
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
```

### Arc (7)

Nest two wrappers and ease X and Y differently, or use `offset-path`.

```css
.fly-x { animation: fx 420ms cubic-bezier(0.3, 0, 0.7, 1) both; }
.fly-y { animation: fy 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes fx { to { transform: translateX(var(--dx)); } }
@keyframes fy { to { transform: translateY(var(--dy)); } }
```

### Secondary action (8)

```css
.badge.is-earned::after {
  content: ""; position: absolute; inset: -4px; border-radius: inherit;
  box-shadow: 0 0 0 2px var(--accent);
  animation: ring 500ms 120ms ease-out both;        /* starts after the badge lands */
}
@keyframes ring { from { opacity: 0.8; transform: scale(0.95); } to { opacity: 0; transform: scale(1.25); } }
```

### Slow in / slow out tokens (6)

```css
:root {
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);   /* decelerate into place */
  --ease-exit:  cubic-bezier(0.7, 0, 0.84, 0);   /* accelerate away */
  --ease-move:  cubic-bezier(0.65, 0, 0.35, 1);  /* on-screen to on-screen */
}
```

## Rules

- Animate `transform` and `opacity` (colour for state). Never layout properties.
- Anticipation must be a fixed length that doesn't change with the outcome, or it gives the result away early.
- Exaggeration follows the event's importance; rare events get more, routine events less.
- Every animation can be skipped and ends in the same state a skip produces.
- `prefers-reduced-motion: reduce`: drop squash, arcs, wind-ups and staggers; keep instant state and colour.