# History: XP, levels and ratings

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(Part 1 section 5: "What XP is: the Thread", "Defeats", "Skill groups as ratings", "Levels"); every number is in
`src/config.ts`. Question IDs name the owner's answers.

- **Early XP and skill progression (07-08/11/2026; X1-X23, SP1-SP13).** XP comes from defeats, achievements
  and quests. A rating by trial duels was turned down (X16): defeat XP is worked out from stats (#28). A skill
  learns from use against opposition inside a learning window, read from the difficulty or the other side's
  skill and never from the dice (#43). Skill tiers came in #74. Achievements are proposed by an agent, approved
  by the owner and then built as code (D-108); achievements made up by the Weaver were dropped; names are grand
  and say what was defeated (#31, #35). One reward-XP curve serves achievements and quests (#742).
- **The Thread (09/11/2026; XL1-XL3).** The lore of XP is backstory: no NPC or agent knows it and nothing in
  play shows it (#239). Its use is a test for any new XP source: does it overcome someone, or is it a deed big
  enough to count? If neither, the source gives skill marks, not XP. One exception: the names of the late
  level achievements hint at it.
- **Defeat XP rating (10/11/2026).** Skills are pooled by group with a factor per group; gear counts on both
  sides, the player's too; levels count through the XP curve, free and bonus levels included (#270, #277, #278,
  #338). The power number on the Character page reads the same function (D-273, #722).
- **XP curve (10-16/11/2026; XC1, XC2).** The first levels cost too much. A flat floor was built (#911) and
  turned down: every level must cost more than the last, by one continuous equation with no maximum and no
  pieces (#914). Quest XP reads the same level cost. Parked: the levels' share of the rating (D-195).
- **How long a playthrough is (12/11/2026).** The owner's yardstick for counts, chains and curves: a typical
  playthrough ends between character level 40 and 60, and the longest may reach 100.
- **Skill groups as ratings (18/11/2026; GR1-GR45).** From BW18: a skill group has a rating that some checks
  roll, strength first. One equation serves checks and the XP rating. What gear is worth comes from its own
  stats by math, never from its coin value and never set by hand. A rating check teaches nothing. The combat
  part was built on a fight model marked as a placeholder (#1056, #1057). Parked: body size in strength
  (D-392). Reach in fight factors is agreed and not built (D-393).
- **Combat level as one equation (18-19/11/2026; CE1-CE11; D-402).** The owner found the fight model too much
  computing and asked for an equation designed with no simulation at any point: derive it on paper and never
  fit numbers to trial fights. Weapon damage grows with the requirement by a multiplier, never by an added
  amount (#1073). Parked: the small things left out (D-400), fighters who win by breaking morale (D-401).
