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
- **What a kept vow gives besides Thread** (VW10 a, VW11 b, VW12 a, VW14, VW15). Each stake pays in a scenario band
  (CONFIG.VOW_STAKE_GAIN), whose BOON_BUDGET the reward fills. A kept vow draws from the library's reward tables
  (`rewardTables`, RW ids): one row of a table is picked by weight; a row naming another table rolls that one, so the
  first pick chooses a reward type and the next the actual reward. RW1 "Kept vow" holds the types: items (RW2, weight
  3) and Threadbound items (RW4, weight 1). Each type points to one shared table that every reward type draws from, so
  rewards balance in one place (VW16, the owner in the thread, 21/11/2026: "all items for now, it should point to a table
  that is used by all reward types as well, so we can balance rewards from a single source"; "add another reward type at
  a a weight of 1 (compared to items 3), which is threadbound items. I will balance it as I go."): RW3 Items, every item
  but Threadbound ones and the improvised bases, and RW5 Threadbound items. Weights are placeholders. Drawing goes on until the items' Boon (Part 5 §7's boon) reaches the band's budget; a draw may pass the budget
  by CONFIG.VOW_REWARD_MARGIN; one that would pass more is put back, and drawing stops once the total is within that
  margin below the budget. At most CONFIG.VOW_REWARD_DRAWS_MAX draws. The items go to the pack at once, and the turn's
  changes say so ("Vow kept: … in your pack"; a broken vow says what it took). The vow's panel lists what it gave.
  An item with no worth set is put back, as is a Threadbound item already in the world or already drawn (one of a kind).
- **Parked.** The lore of vows (VP-1637); Forsworn (VP-1632); pledges (VP-266).
