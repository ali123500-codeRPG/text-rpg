# History: NPC templates, generation, roles and agent-run NPCs

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Actor sheet" in Part 4 for templates; D-64, D-154 and the rows named here); ranks, roles, themes and presets
are library data, and every number is in `src/config.ts`.

- **NPC memory (08/11/2026; PM1-PM8).** Asked so the Planner keeps more. An NPC's memory became a capped list
  instead of one note; agreements are a stored record, between NPCs too; only deals with the player show on
  screen; the summary of earlier events is made by code, not by a model call (#93). Deferred: the Voice
  writing memory (PM7).
- **Template rules (08/11/2026).** Anyone with fighting experience and every villager has a minimum level,
  and any patrolling template has Keen Ear, enforced by a test (#123). Levers apply to existing copies too:
  copies are rebuilt from their template on load and undo (#125).
- **Generation by rank, role and theme (12-14/11/2026; NG1-NG21; D-64).** A review found capped skills, lost
  points, off-theme skills and level adding power with nothing spent. A preset is now a race, a role, a
  theme and a rank, with an optional class; skills come from bands, level only from rank, and copies vary by
  a seeded spread (#765). NPCs keep the player's training cap. Floors cover sight, hearing and other common
  skills. Milestone perks, rank traits and personality layers (#769); gear by role up to the theme's wealth;
  the Weaver may compose an NPC, and one no template fits is flagged in the GM view; cast power against the
  challenge grade is logged only, to become a rejection once playtests show the bands hold (#771). Parked: a
  background layer (D-309).
- **Agent-run NPCs measured (14/11/2026; NV1-NV11).** Asked what agents playing NPCs add. Blind judging put
  agents and code-run fights level and all-code far behind; many Planner calls went unused or came late.
  Decided: code runs fight deeds and the Planner is called on the first fight turn and at turning points;
  mute creatures get no talk call (#859). A blow out of reach runs on as a dash, for everyone (BG-255, #861).
  The owner wants performance kept, not token cuts (NV11).
- **Stale NPC words (14/11/2026; BG-253).** An NPC's words beside its deed rode on the deed, so earlier steps
  could make them stale. They are now said as its turn starts, before anyone's step (#860).
- **Roles (14-16/11/2026; NR1-NR46).** The owner's rules: every new role suggests class names and tiers; game
  first, so an NPC must give the player a challenge, a benefit or a story, and everyone else is crowd text;
  no trade skills, peasants use the Commoner line; bandits are a theme, not a class. Built in rounds: Hunter
  and Healer, themes (#875); Leader, Knight, Healing (#878); rosters and groups (#884); themes take only
  role kinds that fit (#888); Knight Trainee, Dire beasts, level from skills, grandeur (#900); rank levels
  are the owner's own set numbers, not derived from the XP curve (#907); city rosters and named presets
  (#935, #937). A training simulation found about half of all XP comes from achievements, and that a
  character with every skill at nothing never learns a weapon. Parked: what Heal costs (D-340), the Leader's
  class (CI-341), wares by role (D-346), Dire body size (D-354).
- **Cast power readings (21/11/2026; Questions hub "Cast power check" CK6, CK7, CK9, CK10; D-32).** The challenge
  grade stays the Weaver's declared severity, not a power measure; code logs danger to the player, local pressure
  against the place's usual hostile group and an exceptional rank beside it, and the off-band flag is gone. Bad luck
  promises meaningful harm of any kind, danger to life only where the world holds it, and the bad tiers lost their
  ways lean. Spec: SHEET-360 to SHEET-362.
