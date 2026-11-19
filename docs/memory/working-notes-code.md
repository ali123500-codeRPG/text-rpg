# Working notes: code traps

Kind: working note. Written by agents, each with how it was checked. Not the owner's decisions.

- **The player has no mind.** The player holds no stances, overrides or knowledge, and the player's band relations
  are often empty in generated stories. So `hostile(player, x)`, `wary(player, x)` and `foe(player, x)` are false, and
  a rule written from the actor's side silently skips the player. Check both directions (`foe(a, b) || foe(b, a)`) or
  use `isEngaged` in `src/engine/relations.ts`, which handles the player. The fixed village used by many tests hides
  this, because there the player's band is hostile to the monsters. Checked: BG-1 (fears never charged to the
  player), found 11/11/2026 and fixed by auditing every caller of the function.
- **Every typed roll modifier is listed in `MOD_SOURCES`** (`src/ruleset/modSources.ts`). A unit test fails
  otherwise. Checked: the test exists on `main` (19/11/2026).
- **IDs only through the constant tables** (`SK`, `PK`, `CL` and so on), never as literals. A skill is never the same
  thing as a function or a group: sight and hearing rolls roll the function. Checked: `tests/unit/typed-ids.test.ts`.
- **Ordered scales compare positions, saves store keys.** Every ordered scale has stable keys in one names table,
  `src/scales.ts`. Display names live only there. Checked: spec section "Scale keys".
- **The equations prose is not tested.** `src/ruleset/equations.ts` describes rolls and gains for the library viewer.
  A PR that changes how one works must update it by hand. Checked: no test reads it (18/11/2026).
- **Markdown is not type-checked.** Conflict markers once reached `main` inside a doc with every check green.
  `tests/unit/no-conflict-markers.test.ts` now covers `docs`, `src`, `tests` and `scripts`. Checked: PR #1087.
