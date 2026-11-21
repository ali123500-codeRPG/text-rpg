### Defense

- A defense is a free reaction with the actor's standing defense (dodge or block).
- Dodge takes Move-role penalties and armor weight; Parry takes armor weight too (LG23 a).
- Block needs a working Grip arm holding a shield or weapon.
- Against missiles: dodge gets +10 situational; block works as against melee.
- Outnumbered: each defense after the first in a turn takes a situational penalty (*placeholder*).
- Unaware: the defense roll takes a situational penalty (*placeholder*).
- Heavy weapons against block: gap shift −1.

The gap ladder is binding (gap = defense tier − attack tier). Each defense's damage multiplier per gap is CONFIG.GAP\_LADDER (dodge, block, parry; placeholders), from −10 to +5. A gap past +5 uses the +5 entry; past −10 each further step adds GAP\_PAST\_STEP with no top (CS10). The numbers live only in config (PQ15 a); the shape is:

- **Lost (gap below 0):** the blow lands, at least in full; a lost dodge or parry lands harder at every step, a lost block from −4 down.
- **Tie (0):** the blow lands in full.
- **Won (above 0):** a dodge at +1 grazes and from +2 avoids the blow; a block cuts it more at every step; a parry cuts it at +1 and stops it from +2 (D-170).

Where the hit lands, by gap:

| Gap | Dodge | Block |
| --- | --- | --- |
| −3 and below | hit moves to the named part anywhere | hit moves to the named part anywhere |
| −2 | hit moves to the named part if adjacent | hit moves to the named part if adjacent |
| −1 | no location limit | no essential parts |
| 0 | no essential parts | Non-essential parts only, else general area |
| +1 | graze; never an essential part, like the tie (settles OQ-17) | blocked |

At −4 and −5 the named-part move also applies, anywhere **\[Proposed\]**. A part forbidden by the defense sends the hit to the general area. Off the shield, a block or parry from +1 up keeps the 0 row's limit: Non-essential parts only, else the general area (CS2).

The outcome and location thresholds live in CONFIG.HIT\_GAPS beside GAP\_LADDER (CS3): a dodge that wins by +1 is grazed; a block or parry from +1 is blocked (a shield from 0, and it takes the hit); a hit at −4 is a heavy hit and at −5 or worse a crushing hit; the named-part move works at −2 if adjacent and at −3 or worse anywhere; essential parts are off limits from 0 up for a dodge and from −1 up for a block or parry.
