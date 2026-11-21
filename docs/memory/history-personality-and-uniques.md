# History: personality, what provokes, unique NPCs and voice

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Personality" under "Actor sheet" in Part 4; "Goal-driven uniques" in Part 2; D-361); axes, values and
archetypes are library tables.

- **Flavor voice (08/11/2026; V1-V11).** Asked for an anime, edgy voice in all flavor text; the full sample
  was too dramatic. Settled on grounded dark fantasy with an edge, a touch of drama in the big moments,
  never over the top. Perk names stay measured; perks at 100 and up and All-50s may be more dramatic. Item
  looks, notices, labels and rules text stay plain (#118).
- **Personality lines (11-13/11/2026; PL1-PL29).** Asked for as ordered lines with tiers that shift as
  Resolve rises, with points so mixes give more types. Built as a Nerve line whose tier comes from Resolve,
  axes, values and named types; the words go to the Planner and Responder only and have no numeric effect.
  Points come from the template, the Weaver's cast, creation, and perks, class and achievements while held;
  acting in character moves nothing (#402, #404). A voice-tested prototype then replaced the line: named
  types became archetype targets where the nearest wins, with tensions and ranked drives, and signatures for
  unique NPCs (#649). Parked: Nerve by area of life (D-204), numeric effects (D-205), attachment and stance
  strength (D-206).
- **Personality should shift with actions (13/11/2026; open issue VT-OI1).** The owner's goal, not built: a
  test merge of two characters was not an average of them. Still to answer: whether actions can move points
  far enough to change the archetype, and how drives are added or reranked. New personality rules should be
  checked against this goal.
- **No cap on axes (14/11/2026; NX1-NX4; D-329).** The earlier rule of no more axes was withdrawn; an axis may
  be added where a case needs one, with no archetype target at first. Assertiveness was added (#848).
- **What provokes (13-16/11/2026; PV1-PV13; D-361).** One list of provocations served everyone, so a
  thick-skinned character turned colder at a taunt. Decided: a stance step is a lasting grudge, and answering
  in the moment needs none; each character takes words as its personality would; banter and challenge are
  not insults unless the character is touchy; an insult to a top drive cuts anyone; only a false accusation
  provokes the honest. Built as one stance rule shared by the agents, in the prompts only, after a test
  round passed (#931). Fading of grudges is folded into D-206.
- **Attachment and stance strength (21/11/2026; BN1-BN5; D-206).** Stances felt rigid and binary and a grudge
  never faded. Built: a regard score under each personal stance, so a deep bond or grudge takes a move without
  changing step; personal grudges fade back to the band's stance after a pause, an attack's grudge only to
  unfriendly, and bonds never fade; Attachment and Forgivingness axes scale moves on bonds and the fading; agents and
  the Insight read see how strong a stance is (slight, plain, strong). Code still acts on the step only. Moves keep
  their size from a step's middle, so several moves in a row now cover fewer steps than before (#1744).
- **Heroes into NPCs (12-13/11/2026; HF1-HF34).** A fallen character on the Hall of fame can be sent to the
  NPC templates as a unique: one specific saved character, kept in the code library and added by a PR.
  They return as echoes: they cannot train, their gear is soulbound copies, and they always drop an essence.
  Each story is a world under one Universe (#653, #655, #663, #664); its shared calendar was removed on 20/11/2026
  ("neat but not required": every new world starts on day 1). Still to do: the
  Universe record of where each unique is. Parked: echoes that grow (D-243), their lore (D-244), what
  happened in an empty world (D-251).
- **Goal-driven uniques (13/11/2026; UG1-UG17).** Unique NPCs act from goals, not strict routines: drives
  give a few goals, each worked a step at a time; the Planner thinks when a step ends or fails or the goal's
  target is perceived, never by time of day; long turns run queued steps by code (#669).
- **Voice acting (11/11/2026).** Asked for acted voices. A paid engine was chosen and parked (D-212), with
  two other routes (D-209, D-210); a free one was wired through a relay connector (#452, #467, #549) and then
  parked too, leaving Claude's voices only (#563). D-209, D-210 and D-212 closed (21/11/2026): "claude is the default choice
  and it's good so far." The relay's key and path are never committed.
