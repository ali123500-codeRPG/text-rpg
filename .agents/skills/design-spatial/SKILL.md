---
name: "design-spatial"
description: "Use for any UI change, and whenever a screen looks off (overlap, off-centre icons, cramped or uneven spacing, something touching its neighbour): render it, run the layout audit, look at the annotated screenshot, and fix what it catches before calling the work done."
---

# Design — spatial composition

Trimmed from `deterministic-design/design-spatial` in github.com/connerkward/ckw-design-skill (MIT licence, (c) 2026
Conner K Ward, commit c8de7c8); its licence is kept beside it as `LICENSE-source.txt`, and `scripts/layout-audit.js` is
copied unchanged. Kept: render and look, the overflow gate, the audit, optical craft. Left out as not used here: the
"first idea is the average" and "don't prescribe a style" sections (taste comes from `interface-design`), task-order
layout and the balance maths.

A model cannot see what it made: UI is written as text, never as pixels, so it cannot perceive collisions, overlap,
imbalance or broken spacing. Render it and judge the image, not the code.

## 1. Render, audit, look

- **Render the built page, never the live game.** Use the smoke harness (`tests/smoke/play.smoke.ts` builds the page
  with a stand-in model and an in-memory save): a temporary `tests/smoke/zz-*.smoke.ts` that reuses its set-up,
  opens the screen, runs the audit and saves a screenshot, deleted before the PR. `?fake=1&stage=<stage>` works too.
  The live game page and the owner's saves stay off-limits (`AGENTS.md` rule 1).
- **Widths:** the play and creation pages are PC only (`docs/instructions.md` section 7): check at the dev width and
  at 1024 px. The library viewer also gets a phone width (about 390 px).
- **Run the audit** with `page.evaluate` on `scripts/layout-audit.js`'s text plus `return __audit({})`, then take the
  screenshot: every finding is drawn on it. Look at the picture before reading the numbers; a flag says where to
  look, never what to do. The script's file is read from disk, never into your context.
- **Scope it to the open layer.** With a pop-up or a full-screen panel open (Perks, the class tree), the page under it
  is still in the DOM and the default set counts it, so collisions flood the screen. Pass `contentSelector` for the
  open layer, e.g. `'.pk-full :is(h2, h3, button, b, small, .skico, .trico, .pk-rail, .pk-in)'`. The tap and contrast
  checks always scan the whole page: read only their marks inside the open layer.
- **Measure what the change is about** in the same pass: an icon's centre against what it labels, the gap between
  neighbours, a control against the one above it. Report the numbers ("0 px off its rail", "16 px clear").
- **A second pair of eyes, for big changes only.** For a new screen or a layout change (the "everything else" case in
  `docs/instructions.md` section 7), a subagent that did not write the change judges the screenshots and hunts for
  what is wrong: collisions, edges touching, ragged alignment, lopsided weight, no clear focal point, breaks at some
  width. Fix, re-render, re-judge. A small change is judged by its own author from the annotated screenshot.
- Name the audit's gates and any signal you acted on, with the screenshot, in the PR's Tests part.

## 2. Never ship horizontal overflow

A blocking gate: no UI is "done" until `document.documentElement.scrollWidth - document.documentElement.clientWidth`
measured `0` this turn, at the widths above. It recurs because rows grow after they were last checked: any element
added to a horizontal row re-arms the gate. Find the offender:

```js
document.querySelectorAll('*').forEach(el=>{const r=el.getBoundingClientRect();
  if(r.right>innerWidth+1||r.left<-1) console.log(Math.round(r.right), el);});
```

Fix the cause, not the symptom: anchor edge labels inward (`right:0; transform:none`), use `100%` not `100vw`, give
flex and grid children `min-width:0`, let long strings break (`overflow-wrap:anywhere`), and let header, nav and
toolbar rows wrap (`flex-wrap: wrap`). `overflow-x: clip` on `body` is a backstop, never the fix.

## 3. The audit: gates and signals

`scripts/layout-audit.js` measures, all from geometry, colour and pixels:

| check | how | tier |
|---|---|---|
| collision | content boxes overlapping ≥12% | near-gate: usually a bug, eye-confirm |
| contrast | WCAG luminance ratio of text vs its background (<4.5, large <3) | gate |
| tap | interactive targets under 44×44 | report only here (`docs/memory/ui-decisions.md`) |
| overflow | `scrollWidth − clientWidth` | gate |
| alignment | left edges 1–7 px off a shared line | signal |
| spacing | how uneven the gaps between a container's children are | signal |
| balance | ink-weighted centre of mass vs the optical centre (x 0.50, y 0.46) | signal |

Options: `{align: '<selector whose left edges should line up>', space: '<container>', contentSelector: '…',
draw: false}`. `__clearAudit()` removes the overlay.

- **Gates are correctness:** fix them. Passing them is the floor, not proof the layout is good.
- **Signals measure convention** (symmetry, even rhythm). Use them to catch accidents, such as a 3 px drift nobody
  meant; never "fix" a deliberate asymmetry or overlap toward evenness unless the eye judges it worse.
- Never act on a number you have not looked at on the screenshot.

## 4. Optical craft

The audit measures geometric edges; the eye reads perception. These are eye calls, not gates (from the Web Interface
Guidelines, `vercel-labs/web-interface-guidelines`).

- **Nudge ±1–2 px when it looks off though it measures centred.** Asymmetric glyphs and arrows often need it; text
  centred by box metrics often sits a hair low.
- **Balance icon and text lockups.** Match their visual weight through size, stroke, spacing or colour, so neither
  overpowers. Optical size, not equal pixel size.
