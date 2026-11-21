### Vows

Vows (D-141; the owner, Questions hub page "Vows: goals you set with an agent (D-141)", 21/11/2026, VW1–VW13;
src/engine/vows.ts, src/ui/vows.ts). The owner asked for "resolutions"; the system is called vows, because resolution
already names how a turn is settled (VW1 a). Pledges, things given up for power, are a separate system, parked as VP-266.

- **What a vow is.** A goal the player sets for their character by talking it over with Agent Witness (VW2 a). The
  Witness only fills a vow form; code reads it into a goal it can check, and the player swears it on the Witness's card.
  Nothing is set until they press Swear, and the form is read again against the game as it stands then.
- **What it can ask** (VW3 c), each read by code:
  - a quest goal (QT7): defeat a number of a race or body type, or one person; deliver an item to someone; reach a place;
    find a person. The same goal checks as quests (goalProgress, src/engine/quests.ts);
  - a growth goal read from the sheet: a skill's true skill reaching a value, a character level, an achievement earned,
    or an essence taken (the essences_taken tally passing its count when sworn);
  - a restraint: never do one act until the deadline: kill (someone the player defeats is dead), or any of the Parser's
    action types (the player's order this turn, when they acted). VOW_ACTS lists them.
- **Refused.** A form code cannot check (a target it does not know, an unknown act or skill), a goal already met (a
  skill or level at or below today's, an achievement held, a place stood in, a person already found), a stake not in
  CONFIG.VOW_STAKES, a deadline outside CONFIG.VOW_DAYS_MIN to CONFIG.VOW_DAYS_MAX game days, or a vow past
  CONFIG.VOW_MAX_ACTIVE active ones (VW7 a). The Witness is told why once and passes it on.
- **Stake and Thread** (VW4, VW5 a). A vow is sworn at a stake from CONFIG.VOW_STAKES (rows of REWARD_LEVELS, I to III).
  Kept, it pays that reward level's Thread as an achievement of that level does (rewardXp, share of a level included);
  broken, it takes the same Thread from the bar, into debt if need be, as giving up an essence does: new Thread pays the
  debt first. The amount is measured when the vow ends.
- **Ending** (VW6 a, VW8 a). Code checks every active vow each turn, after the quests. A goal met keeps the vow at once.
  A restraint's act breaks it at once. A goal vow whose person dies or whose one item is gone is broken (QT11's rule).
  The deadline is in game days with an optional time of day, as a quest's (QT25): at it, a restraint is kept and a goal
  not met is broken. Renouncing a vow breaks it.
- **Shown** (VW9 a). The Quests page (the rail's Quests item) has a Vows section under the quests: Swear a vow (off at
  the cap, its tip says why), then one row per vow: the vow, its goal and progress, its stake and Thread, when it is due
  and its state. A row opens the vow's panel, with Renounce vow on an active one, which asks once. A kept or broken vow
  is its own row in the scenario's Thread sum (XpPart kind vow), plus for kept and minus for broken.
- **Still open.** VW10 a: stake I pays in the minor band, II moderate, III major; VW12 a: an item reward goes to the
  pack at once. What the item is waits for VW11. The lore of vows is parked (VP-1637); Forsworn too (VP-1632).
