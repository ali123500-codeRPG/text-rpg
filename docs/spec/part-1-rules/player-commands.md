### 7. Player commands \[Proposed\]

Commands are handled by code and do not advance time. There is no /save: the story saves every turn (Part 4 §10), and a full export exists only in the GM debug view.

| Command | Effect |
| --- | --- |
| `/stats` | Show the character sheet |
| `/inv` | Show inventory |
| `/quests` | Show active quests |
| `/undo` | Rewind one turn: the head moves back to the previous bookmark; dice are not rolled back (Part 4 §6) |
| `/help` | Show the rules text and a recap of the events the player perceived; code only, no Claude call |
| /aim | Marks this turn's attack as aimed: a harder roll that, if it hits, lands on the body part the attack names; it never picks the target. The play screen's Aim toggle does the same. Code only; resets after the turn resolves. Goes in front of an attack command: `/aim /strike the guard at his left leg` |
| `/strike`, `/shoot`, `/throw` | Attack commands (Ali, 11/11/2026): `/strike <who> [at <body part>]`, `/shoot <who> [at <body part>]`, `/throw <what> at <who> [at <body part>]`. The words go to the Parser as "I strike …", so the Parser picks the weapon, mode and targetPart as for typed words; with no target they say how to use them |
