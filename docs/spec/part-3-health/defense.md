### Defense

- A defense is a free reaction with the actor's standing defense (dodge or block).
- Dodge takes Move-role penalties and armor weight; Parry takes armor weight too (LG23 a).
- Block needs a working Grip arm holding a shield or weapon.
- Against missiles: dodge gets +10 situational; block works as against melee.
- Outnumbered: each defense after the first in a turn takes a situational penalty (*placeholder*).
- Unaware: the defense roll takes a situational penalty (*placeholder*).
- Heavy weapons against block: gap shift −1.

The gap ladder is binding (gap = defense tier − attack tier). A gap past +5 uses the +5 entry. Below −5 the rows run on to −10 in CONFIG.GAP\_LADDER (placeholders, +0.5 a step), and past −10 each further step adds GAP\_PAST\_STEP (0.5) with no top (CS10). The Dodge rows −1 to −3 follow CONFIG.GAP\_LADDER.dodge (PQ5 a):

| Gap | Dodge | Block |
| --- | --- | --- |
| −5 | 2× | 2× |
| −4 | 1.5× | 1.5× |
| −3 | 1.375×; hit moves to the named part anywhere | 1×; hit moves to the named part anywhere |
| −2 | 1.25×; hit moves to the named part if adjacent | 1×; hit moves to the named part if adjacent |
| −1 | 1.1×, no location limit | 1×, no essential parts |
| 0 | 1×, no essential parts | 1×, Non-essential parts only, else general area |
| +1 | 0.8× (graze; never an essential part, like the tie: settles OQ-17) | 0.75× |
| +2 | 0× | 0.5× |
| +3 | 0× | 0.25× |
| +4 | 0× | 0.2× |
| +5 | 0× | 0.15× |

At −4 and −5 the named-part move also applies, anywhere **\[Proposed\]**. A part forbidden by the defense sends the hit to the general area. Off the shield, a block or parry from +1 up keeps the 0 row's limit: Non-essential parts only, else the general area (CS2).

The outcome and location thresholds live in CONFIG.HIT\_GAPS beside GAP\_LADDER (CS3): a dodge that wins by +1 is grazed; a block or parry from +1 is blocked (a shield from 0, and it takes the hit); a hit at −4 is a heavy hit and at −5 or worse a crushing hit; the named-part move works at −2 if adjacent and at −3 or worse anywhere; essential parts are off limits from 0 up for a dodge and from −1 up for a block or parry.
