---
name: "rpg-map"
description: "Working method for the text-rpg artifact app's stage map; the map's rules (MAP-nn) are in docs/spec/part-2-turn-engine/map.md: layout by geometry (a zone only names a space, AGENTS.md rule 8), labels, tokens, door/exit symbols, fog of what the player knows, plus a mandatory render-and-check pass. Use whenever building, changing, reviewing or debugging the game map, even small fixes, and whenever a builder prompt for the map is being written."
---

# RPG map

How to work on the stage map in the text-based RPG artifact app. Code controls the numbers, and that includes
coordinates: the map is laid out by code from stage data, then checked by code, then looked at.

The map's rules (MAP-nn) live in `docs/spec/part-2-turn-engine/map.md`, the one home for them; this skill holds only the
working method. When the owner asks for something that a rule blocks, follow `docs/instructions.md` section 7, which
holds that rule.

## Before starting

Lay out, place, group and hide marks by geometry only: points in metres, walls, and outlines as shapes. A zone
(title) is a name and never decides where a mark goes or what it is grouped with (AGENTS.md rule 8).

Read `docs/spec/part-2-turn-engine/map.md`. Use the design skills `docs/instructions.md` section 7 requires for any UI
change, and, for any map motion, the spec's Play screen motion rules
(`docs/spec/part-2-turn-engine/play-screen-motion.md`, M-01 to M-74). If any of them conflicts with a map rule, the map
rule wins for the map.

## Pipeline (highest priority)

- **MAP-01** Stage data, then layout, then render, then check, then look. Never skip a step and never reorder.

## Check, then look

1. Render each MAP-52 test stage in a dev view (`?fake=1&stage=bent-nail|one-room|long-names`, or `?mapcheck`). The
   checker runs after every render and logs every finding (MAP-51, MAP-55).
2. `tests/smoke/map.smoke.ts` asserts zero findings on the Map and the minimap for the three stages, and the PR's run
   on GitHub is the judge (MAP-56). Run it locally only to debug a failure (`npm run smoke -- tests/smoke/map.smoke.ts`);
   do not write your own Playwright script.
3. Run `tests/unit/map-plan.test.ts` for the layout's own checks (MAP-57).
4. Take a screenshot of each stage and look at it before reporting (MAP-52).
5. Report every finding verbatim (MAP-53). A map change ships only under MAP-04.

The checker is code, not a copy kept here: `checkMap` in `src/ui/mapCheck.ts`, and `checkReach` and `checkStage` in
`src/ui/mapPlan.ts`. The elements it reads are tagged as MAP-50 says.

## Credits

Ideas adapted from community skills: containment-or-no-overlap and verify-before-merge (cathrynlavery/diagram-design),
detect-fix-revalidate loop (metabench/svg-collisions), deterministic generation and flood-fill connectivity
(gamedev-skills roguelike), and report-every-warning plus look-at-every-render (agent-sprite-forge generate2dmap).
