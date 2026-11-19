# History: Parry, the defense row, equip requirements, armor and breaking things open

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(Part 3 "Defense"; Part 5 "Item data"; "Breaking a container open" and "Guards and locked containers" under
"Action economy" in Part 2); every number is in `src/config.ts`.

- **Equip requirements and the armor tree (08-10/11/2026; EQ1-EQ16, AR1-AR9, QE1-QE6).** Gear has skill
  requirements that read true skill, based on equipment levels the owner asked for; a shortfall worsens the
  outcome by steps (#135). The inventory shows a requirement red when short (#137). A new armor tree holds
  Light, Medium and Heavy Armor (#131); an armor skill grows when its armor stops part of a hit near the
  wearer's level (#143, #147). The design rule from this round: gear stats scale with their needs, for all
  gear from then on (#179, #251). Templates get the armor skill their kit needs.
- **Parry (10/11/2026; PA1-PA13; D-170).** A new defense skill. Block is for shields only; Parry works with
  every weapon, and barehanded through a perk. Parry stops less than Block at low gaps and, at high gaps,
  stops the blow and earns a strike back. Riposte augments Parry; the weapon and Block perks moved to Parry;
  missiles cannot be parried; NPCs without shields moved from Block to Parry (#309).
- **Strike-back limit (15/11/2026; D-336, D-337).** No limit was built first (#873) and replaced the same day
  by a limit per round, which named perks raise or lift; a strike back never earns another (#874). Parked:
  the limit by speed (D-338).
- **Breaking things open (14/11/2026; BK1-BK6).** A break action on locked containers (#751). Items carry a
  fragility tier, each breaking only on a worse roll; a broken item gets a broken version that does nothing.
  One roll checks everything inside. Breaking a guarded container is theft seen; a downed or yielded owner
  does not guard, and leave to search does not cover breaking (#753). Parked: a perk for safer breaking
  (D-305).
- **Guards and locked containers (14/11/2026; GD1-GD6).** A guard whose search finds a locked container
  suspects it, steps colder and asks to see inside, until it is opened in sight or the guard is talked round
  or the scenario ends; NPCs are held to the same (#761). Parked: noticing one on sight (D-306).
- **Melee damage against armor (15-17/11/2026; MD1-MD4; D-368).** A check found damage per second nearly
  equal across weapon weights and flat as skill grew. Decided: armor's flat soak grows with its weight and
  comes off after the share (#985). Found on the way: NPCs punched while holding a weapon (BG-258, #894).
  Parked: what drives each action's speed (D-248).
- **The defense row (18-19/11/2026).** The player could never change the standing defense. The flavour-only
  attack stance was removed (#1075), and the action deck got a row to pick dodge, parry or block; a pick
  takes effect at once and is free (#1077).
