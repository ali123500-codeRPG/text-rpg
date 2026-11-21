# History: morale, auras, yielding and mercy

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Morale" under "Health track" in Part 3; "Steady yourself" under "Action economy" and "Mercy once down" in
Part 2); every number is in `src/config.ts` and the library's fears and composure tables.

- **The morale bar (10/11/2026; MB1-MB43).** Asked for as a second, mental health bar. Every actor has one,
  the player too, and its size comes from Resolve, a new skill in a new Fortitude tree beside Endurance (#289,
  #290). Fears cost morale by a library table; downing a foe gives some back. At Broken an actor cannot
  attack, grab, filch or walk toward a foe; walking away, talking, begging and yielding still work. A new
  character starts with no Resolve, and doing badly there is intended. Slimes stopped being fearless (#296).
  Deferred then closed (21/11/2026): a Shattered level (D-161, built as Cowering) and other morale effects such as encouragement (D-162, covered by the rally perks and steadying).
- **The player's yield (10/11/2026; D-147, D-186).** A yield command in real fights: foes of an Intelligent
  race run by an agent answer, and no answer means refused. A taken yield is a truce for the scenario and
  counts as defeated. Attacking after yielding must be impossible, so attacks are blocked both ways (#291).
  Parked: what a taker does with the one who yielded (D-186).
- **Auras and Battle Cry (10-11/11/2026; I1-I9, MB19, MB36-MB39; D-169, D-178).** An aura checks each opposed
  or worse target once per engagement; several auras check and apply one by one. The target resists with
  Resolve, and a failed check costs morale. Dread Presence was the first (#308). Aura reach is in metres.
  Battle Cry carries to every foe that hears it, even half hears it, and allies who hear it get morale back
  and shake off Shaken (#334). It rallies the one who roars too and never costs them morale (#364). Parked:
  merging Battle Cry and Rally (D-384).
- **Morale has its own restore table (11/11/2026; D-183).** Rest can restore both bars while each is tuned
  on its own: a composure table, named by the healing row. Every morale restore goes through one pair of
  functions in `src/engine/heal.ts`, which a test enforces; a new morale-restoring perk calls the perk one
  (#368).
- **Who a yield reaches (11/11/2026; YD1-YD7; BG-4, BG-5).** A yield had been put to a hostile in another
  room who never fought, and a fight never ended after the player left it. The owner's view of the root
  cause: awareness needed more states. Two were added, hunting and engaged; fighting means hostile and
  engaged; both drop back after a quiet stretch. A yield reaches those who can perceive it by any sense. A
  taken yield covers the taker's bandmates who are together, not the whole faction; band members who perceive
  each other are together, and apart they are only a faction (#387). Affiliations and groups (D-196) are decided since, as D-1768.
- **Warning as nerve breaks (13/11/2026; NB1-NB6, MW1-MW4, SY1).** Playtests showed nothing warned as morale
  fell, nor said what Broken stops, for how long, or what still works. Built as words and layout (#623) and
  as motion, a violet edge (#621). For the player Broken means all morale is gone, so any morale back lifts
  it: it lasts until the fight is behind them, not until the scenario ends. Steady yourself is a main action
  in a fight, never while Broken, where the choices stay yield and flee.
- **Mercy once down (13/11/2026; OE5, OE7; D-239).** A downed player in a lethal fight may be spared: agent-
  run foes of an Intelligent race who perceive the player decide, the rest finish. Sparing mirrors the yield
  rules (#641). Only lethal foes who perceive the downed player count as finishers, for mercy and for the
  survival roll alike (#644).
