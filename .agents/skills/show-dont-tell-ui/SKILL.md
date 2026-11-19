---
name: "show-dont-tell-ui"
description: "Use for any UI change: show instead of tell. Mark only the exception with an icon, put words in tooltips and aria-labels, and cut hints the styling already gives."
---

# Show, don't tell (UI default)

Based on `minimal-ui-design` from github.com/castle-x/skills-x (MIT licence, (c) 2026 castle-x), with the rules the owner set on the game's play page added on top.

The screen shows; it does not explain itself. Every visible word must earn its place.

## The default rules

1. **The normal case gets no label.** Assume every control does the usual thing. Never write words that say so ("your action", "click to open").
2. **Mark only the exception, with an icon.** When one control differs from the rest (a free action, an action against the character's nature, a used-up move), give it one small icon after its name. Do not add words for the exception either.
3. **Words go in the tooltip and the accessible name.** Each icon or mark gets `title` and `aria-label` (or `role="img"` + `aria-label`) with its meaning. Screen readers and hover still get the full words.
4. **Don't describe what the look already says.** An underline, a pointer cursor, a chevron or an open state already says "this opens". No hint text beside it.
5. **No sub-line unless a player would miss it.** Before adding a description under a button, ask: would the player choose differently without it? If not, cut it.
6. **State is shown, not named,** where the screen already shows it (a bar, a number, a colour). Don't add the state's name beside it unless asked.
7. **One cue per thing.** Never show the same hint in two places.

## Minimal UI pass (from the source skill)

1. **Delete redundancy:** repeated labels, empty-state descriptions, duplicate headers.
2. **Collapse controls:** merge similar actions into one toggle or icon button.
3. **Replace text with icons** where the meaning survives; keep the words in `aria-label`/`title`.
4. **Re-add minimal guidance:** choose ONE of placeholder, tooltip or keycap row.
5. **Check clarity:** can a new player pass a 10-second scan?

## Never

- An icon with no `title` and no accessible name.
- Shrinking text to look minimal (keep the project's text floor).
- A settings switch just to show labels.
- Multi-line help blocks inside a panel.
- Unicode glyphs or emoji instead of real icons: use the project's icon set (for the text RPG, add a pick in scripts/icons.mjs and run npm run icons).

## Examples (text RPG play page)

- "51.9 Power · click for its parts" becomes "51.9 Power": the dotted underline already says it opens.
- "Persuade · against your nature" becomes "Persuade" + a cracked-mask icon; hovering it says "Against your nature".
- "Search · your action" becomes "Search"; only free actions get a lightning bolt. Hovering any action shows its time ("Takes 3 s").
- "Go to · runs there (a dash) · or click the minimap" becomes "Go to".
