# History: doors, obstacles, cover, light, walls and the Map

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("### Reach, range, cover and light"; "Breaking walls and barriers" under "### Scenarios"; "Layer 2" in Part 1
section 4 for obstacles; "### Play screen" for the Map); the numbers are in `src/config.ts` and the library.
Question IDs name the owner's answers on the Questions hub.

- **Doors open and shut (12/11/2026; BG-70).** Opening a door takes a move slot and lets sight and sound through
  without going in (#527, #528).
- **Obstacle difficulty (13-15/11/2026; OD1-OD15; D-7).** Each obstacle carries its own grade, and the scenario's
  number no longer sets difficulty (#885, #889, #893). OD7 was withdrawn and not parked. An act that no skill fits
  is filed as `skill_gap`, and a thing with no grade as `grade_gap` (#887, #893): both are input for design, not
  code bugs. Parked: the size of the gate (D-343).
- **Cover and light (17-18/11/2026; CV1-CV10, ZO1-ZO3, LT1-LT4, PC1-PC5).** Five cover levels by the share of a
  person hidden, six light levels by real lux, and cover from real objects and windows. Built in #1043 (BG-293 to
  BG-297), #1045, #1047, #1048 and #1052. Parked: moon phases (D-389), hit locations under cover (D-390). ZO3 b
  (move away from zones toward real positions and sizes) led to the titles rewrite; fixed light sources came
  with it (D-391, partly built: a light carried in the hand is not).
- **Breaking walls (18/11/2026; BW1-BW26).** The owner turned down a realistic model (SD6): walls break by the
  breaker's strength, and a mortal wall hardly exists for the strongest. The grade model was dropped (BW2-BW7 and
  BW15 withdrawn). Lifting by strength doubles with no top, an accepted exception to "nothing in play doubles"
  (TL17). Built in #1062, #1065 and #1066. Parked: other ways past a wall (D-394), repair (D-89), sound through
  walls by material (D-199).
- **The Map (10-19/11/2026).** A Map (first a tab, now a pop-up) drawn from what the character knows (#357, #360,
  #362); drawn to scale (#728); the stage map rework MR1-MR3 as BG-214 (#755); marks keep their spot at every
  zoom, with big names behind them, MZ1-MZ4 as BG-216 (#770); redrawn from the floor plan under the fog as
  BG-313 (#1096). The map rules are `docs/spec/part-2-turn-engine/map.md` (the `rpg-map` skill holds the working
  method); `ui-decisions.md` says how firmly they bind.
