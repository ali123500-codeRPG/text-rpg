### Encounter modes

Code picks the mode each turn; agents run only when someone needs a mind. Ordinary and guarded dialogue now share one pipeline, so the mode no longer shows whether an NPC has a secret.

**Engagement** (Ali, 07/11/2026, E1). An engagement is one encounter from an actor's point of view: a fight, a negotiation, or both. It starts when any actor becomes engaged with that actor, either in a fight (active, hostile to it, and the two engaged, on a turn either attacks or closes in; YD6, see Hunting and engaged) or in talk (the two speak to each other in a dialogue exchange). It ends once no actor has been engaged with it, in either way, for ENGAGEMENT\_END\_TURNS turns in a row (config, 3; Ali, 11/11/2026), or at once when everyone who heard the player's yield has taken it (YD3). A negotiation that turns into a fight, or a fight that turns into talk, stays one engagement (Ali, 07/11/2026): once-per-engagement effects and the improvement rolls at its end happen once. A scenario can hold several engagements. Effects that work once per engagement reset when a new one starts, and other rules may count engagements too. Code keeps the current engagement's start turn per actor, and which kinds it has held so far (talk, fight, spar).

**Sparring** (Ali, 09/11/2026, SP1–SP12; src/engine/spar.ts). A spar is its own kind of engagement: a pact between sides that lets fighters hit each other while nobody's stance changes. The fighter who is hit does not turn hostile, nor do its bandmates or onlookers; no alarm goes up (SP11), and NPC views and the Narrator see each sparring blow marked spar. Sides: one against one is two sides of one fighter; groups and free-for-alls (every fighter on its own side) work the same way (SP3); fighters on one side are not opponents.
- **Start (SP2).** Agreed aloud in talk: an NPC's agent output gives spar {sides, cruel?}, with itself on a side, and every other fighter must have heard its line this turn (like a deal). Or the Weaver's stage plan lists spars by cast key or actor id; the validator checks the sides (bad\_spar, unresolved\_actor). A fighter is in one spar at a time.
- **Fighting.** Spar opponents count as foes for fighting rules (engaged, tactical mode, morale, crowding, rest and heal blocks, fallback attacks, Volley), but stance, hostility and XP rules see no change. Blows do their normal damage, with no exceptions (SP6).
- **Out (SP4, SP5).** A fighter is out once it reaches SPAR\_LIMIT on the health track (config, Critical) or yields. A cruel spar, which every fighter must accept, runs to Incapacitated instead. The player yields by saying so (the Parser's yields: true), applied after the turn's blows; an NPC yields in its output (yields: true), or when its morale bar reaches Broken while it has no real foe: it just leaves the spar, with no yielded stance and no flight.
- **End (SP7).** The last side with a fighter still in wins. A spar also ends on a scenario break, after ENGAGEMENT\_END\_TURNS turns with no blow between sides, or when a fighter and someone outside the spar attack each other (that attack is real and follows the normal rules). Fighters may be in different zones (a ranged fighter against a melee one). A blow on or by a fighter who went out earlier in the same turn is held back (the order was made before; spar\_blow\_held); from the next turn on such a blow is a real attack.
- **Rewards (SP8, SP9).** A spar pays no defeat XP (no one is really defeated) and counts toward no defeat achievements; skills still learn from the rolls, and the engagement's improvement rolls happen as usual. Each spar the player's side wins adds to the spar\_wins tally for spar achievements (D-144).
- **After (SP10).** A spar changes no stance; NPCs may still step friendlier or colder in talk.

| Mode | When code enters it | Pipeline | Claude calls per turn |
| --- | --- | --- | --- |
| Explore | No fight concerns the player, and no one is being spoken to | Parser → engine → Narrator, plus background Planners for engaged actors | 2 |
| Dialogue | The Parser's main action is speech addressed to NPCs | Parser → speech check → one Responder or Voice call per spokesperson, in parallel → engine → Narrator | 2 plus one per spokesperson (at most MAX\_SPOKESPEOPLE), plus background Planners for engaged actors |
| Tactical | A fight concerns the player (BF14): someone fighting them knows they are there, or they can perceive a fight (blows traded, or a spar) | Background Planner per engaged significant actor; Parser → engine → Narrator | 2 plus one per engaged significant actor, capped by MAX\_PLANNER\_CALLS |

Engaged is side-neutral: an actor is engaged when it believes in an active actor it is hostile to, so allies facing bandits get Planner calls too. Whether the turn is Tactical follows the player only (BF14, Ali, 13/11/2026): a standoff or a fight the player cannot perceive keeps normal turns.

Modes are chosen per turn inside a scenario (Scenarios); a scenario can open in any mode.

Mode is computed after the previous turn is saved, from saved state; Dialogue is still decided after the Parser returns. There is one resolveTurn: mode only decides which agents ran.

An attack from Explore resolves in the same turn (Explore mode, Ambush). Tactical no longer has an "or the player attacks" condition **\[Proposed\]**: observers of the attack become engaged anyway, and a kill nobody perceives leaves the game in Explore.

Belief decay still returns actors to unaware. Planner calls follow engagement per actor, so encounter mode doesn't change which calls run. Triggers are checked in every mode, so an ambush can start a tactical turn by itself.

Every mode takes the same time after the player submits, except turns that start a scenario or cross a frontier (Latency and cost).
