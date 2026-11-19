# History: fatigue, strain and Stamina

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Fatigue and stamina" under "Health track" in Part 3; "Travel" and "Sleeping and keeping watch" in Part 2);
every number is in `src/config.ts`. The code is `src/ruleset/fatigue.ts` and `src/engine/fatigue.ts`.

- **Why fatigue (12-13/11/2026; NW12, NW16, FT1-FT28).** Wanted after all, to encourage sleeping. Stamina is
  the third Fortitude skill, in a group of its own with a low XP factor, so a player can build into Stamina
  and Endurance. The owner's own shape: a big long-term bar with a thin short-term line under it; the line
  moves fast, and once it is spent effort spills into the long term. The long-term part is called sleep debt
  and the short one strain. Only sleep clears sleep debt for now. Its treatments get their own table, beside
  heals and morale restores.
- **No roll on strain (FT24, FT25).** A roll multiplier and a bigger line would count skill twice. Actions
  cause strain by an effort tier that each action names; movement is included; free actions, walking and
  talking cost nothing.
- **The build (13/11/2026; FB1-FB7).** Built in #682. Reading choices made then and told to the owner: tiers
  for the actions the page did not list, and that a bed is a place with bed furniture. Answers after the
  build: every point of strain marks Stamina, with no filter by effort; hours awake are tracked apart from
  spill, so a spent actor still collapses once being awake alone fills the bar (#686).
- **Strain rebalance (14/11/2026; SR1-SR6; D-326).** Costs were realistic but strain was not felt: the line
  gave no penalty until empty, fights end in a few turns, breath refills fast, only spill reached the long
  term, and travel paid nothing. Decided: no penalty on the line and no change to costs or breath; a share of
  every strain point also goes to the long term; travel paces and the Forced March perk were removed, leaving
  one pace that adds long-term strain by the hour, with no armour multiplier (#845, #849). The perk slot
  Forced March held is empty, not parked.
