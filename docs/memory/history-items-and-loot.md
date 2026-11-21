# History: loot, items, accessories and Threadbound items

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(Part 5: "Item data" with Boon, and "Threadbound items"); items are library rows, and every number is in
`src/config.ts`.

- **Loot creation (07-08/11/2026; L1-L4, V7, V8).** A bad Weaver reward is repaired or dropped and never
  fails a plan (#9). Generic item bases and improvised weapons, which roll a new Improvisation skill; natural
  weapons are for creatures only (#11, #18). Instead of a flat cap, each reward has a numeric benefit value
  under a uniquely named table and a budget per plan, named Boon; only Weaver rewards count (#19). Deferred:
  crafting (D-90). Parked: alarm systems (D-230). A scenario does not always need a keeper of the peace.
- **Threadbound items (12-15/11/2026; TB1-TB12; D-218).** Soul-bound unique gear was parked (#477), then one
  item was asked for whose abilities unlock through achievements, built around event-roll variance (#480).
  Three names stay apart: the Threadbound item (the gear kind), the Threadbounded class and The Threadbound
  start; rank has no name that implies a ceiling (#481, #484). A Threadbound item is bound to the player,
  can be summoned, and nobody else can use it; one of a kind. Relics are unique items that are not
  Threadbound. Names are grand. Its actives are not moves: they fire by themselves on the essence quality
  roll (#584, #594). An end-to-end test found item abilities arriving late (BG-209, #707). The item became a
  charm that works from the pack and adds nothing to the rating (#881). Parked: the Weaver placing them
  (TI-220), more special loot (D-167). 21/11/2026: Threadbound ideas got their own list (TI-n,
  threadbound-ideas.md); the Weaver's rewards got a table of their own (RW6) drawn as a kept vow's, and some
  Threadbound items will level up (TI-1764).
- **Accessories (14/11/2026; AX1-AX7; D-95).** More accessory slots, spectacles and a charmed ring whose
  skill is rolled once, seeded and never stored, and shown in its name (#837). An accessory's bonus comes
  from its item level by one factor; ring skills are weighted by tree; every accessory worn adds in full,
  copies included; every body has the same slot count (#850).
- **Items deep dive (14-16/11/2026; IR1-IR33).** NPC gear is picked by role up to the theme's wealth. Equip
  levels continue past Masterwork on the one ladder past 100; priced gear has no hand-set value; armor has
  real coverage (#899). Weapons are priced by damage a second and reach (#902). Every gear class has its
  Superior and Masterwork piece (#905). Pieces with different reach or coverage are different types, read
  from a type table (#913). No head slot: any number of armor pieces may be worn as long as no body part is
  covered twice; helmets are armor pieces (#916). Gauntlets are coded like weapons that work unarmed (D-97,
  #921). The ordinary family is named Mundane and its numbers come only from level, which a test enforces;
  special families stand on a Mundane base with their own extras (#940). Parked: gear roles (D-356).
- **Loot pop-up (14/11/2026).** After a search, a chip opens a pop-up grouped by body, open container and
  ground; taking types an order into the action box unsent, so the turn rules still decide. Pop-ups close
  with the browser's Back (#818; BG-220).
