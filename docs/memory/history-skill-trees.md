# History: skill trees, functions and the Tactics tree

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Skill functions and groups" in Part 1, "Skill tree access" in Part 4, D-17); `docs/skill-tags.md` lists each
skill's functions and tags.

- **Functions and groups (08/11/2026; F1-F8).** A skill lists narrow functions, which stand-ins read, and each
  function sits in one broad group, which the 40 perk's group bonus and XP read (#115, #132). An untrained
  sense has no floor (F5). Gear boosts the skills tied to its equip requirement, so the held weapon's bonus
  does not follow a stand-in.
- **Tree access (08/11/2026; TA1-TA11).** Every tree carries its own rule: Must, Either of, Blocked by. A block
  wins. Any source can open or close a tree: race, body type, class level, perk or quirk. It replaced the
  per-skill "open to the player" flag (#100, #102). Deferred: the extras TA7 and TA11 (D-113).
- **Small-tree Focus: dropped (10/11/2026).** A free perk for trees of one or two skills was asked for and
  closed the same day; tree ratings replaced it. Do not revive it.
- **Fortitude and Resolve (10/11/2026; MB and MR answers).** Endurance left the Defense tree for a new
  Fortitude tree with a new Resolve skill, and top morale grows with Resolve as health does with Endurance
  (#289, #290). Fearless is a high morale value, not immunity. Overwhelm is Resolve 100 (#358, D-182). The
  options once drafted for Resolve 20 are kept as banked perks (D-188, #365); Resolve 20 is Grit Your Teeth
  (D-397).
- **Tactics tree (17-18/11/2026; TC1-TC59; D-17, built).** One rule for the player and NPCs. Four skills:
  Battle Sense, Command, Fieldcraft and Stratagem; Guile joined Trickery. A fight rule is a row in
  `src/library/fightRules.ts`, and every distance in a row is metres. Built in #1021 to #1049, with Play Dead
  and NPC perk moves in #1036, feigned flight in #1038 and code-run NPCs using perk moves in #1042. Parked:
  D-370, D-371, D-372, D-373, D-375, D-380, D-381, D-382, D-384.
- **Falsehood and Guile (19/11/2026; BF103, BF104, GU1, GU2; BG-320, BG-321).** Falsehood (once Lying) is for
  spoken lies and Guile for lies told with the body. Cause of the bugs: Guile arrived a day after size-up, and
  nobody re-sorted the existing rolls. Size-up now rolls Guile, and a guard test keeps retired skill names out
  (#1088).
