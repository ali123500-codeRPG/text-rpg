### Scenario setup

Runs inside the turn that calls scenarioBreak, after resolveTurn and before the save:

1. Resolve the player's place node.
2. Event roll: ruleset.eventRoll(player).
3. Agent Weaver returns a stage plan with the tier in its view: the event first, then the zones (each with its place, creating place nodes as needed) and frontiers, any new bands, the cast (each actor's band, routine set id and slot bindings, with an optional startAt, opening belief about the player, beliefs about other bands and personal stances), hidden seeds and reward refs. The tier shapes the event and cast; opening attention and beliefs are the Weaver's story choice.
4. Code validates the plan and instantiates the cast: templates, unique or copy, body types from the database.
5. Code checks the plan's challenge and gain grades against the tier, and nothing else, then applies it. Code computes each actor's anchorTurn (Anchors) and places the actor in its default routine's desired zone for the current turn, whose activity sets its attention. On open entry only, each opening belief about the player is written through updateBeliefs. New bands and personal stances (Mind.overrides) are installed; each belief about another band becomes one belief per member on the stage (lastKnownZone = that member's zone), written through updateBeliefs whatever the entry. A plan that fails gets one repair retry. After that, routine-only errors degrade the affected actors, and any other error gives the fallback stage (Agent Weaver: Failed stage plan).
6. Code installs each actor's routines list (its set's routines), slot bindings, current routine and anchor, then its knows facts (Mind.knows), plans, triggers and secrets. Each routine carries its one onAlert order; there are no onAlert triggers.
7. Arrival detection: if the player is stealthy, each observer in perception range runs the existing detection test against the player's last move; the plan sets no belief about the player for these observers.
8. Code builds the opening perception events (Opening narration), saves the turn (Part 4 §10) and computes the first turn (Architecture step 1).
9. The turn's Agent Narrator call narrates the arrival with the turn's other events.

Setup details (CS2):

- At story start the player has no zone on the stage yet. The Weaver's view says so (player.standsIn is null) and the plan's arriveAt names the zone the player starts in; with none, they start in the plan's first zone (PQ1 a). Starting outdoors, they stand at the door of the building beside them (BG-49). Their place has no node yet either: code makes a bare one so the Weaver's plan and the fallback can use its id. A newcomer arriving in a world that already has ground (HF26) is placed before the Weaver is called (WT16 a): at the start place's way in from outside (a gate, door or road end; Ali, 21/11/2026: "At the start place's way in"), at the free spot nearest a step (ENTER_M) inside it. The way joins a title of the place, or of a place inside it, to ground outside it; a frontier or an outdoor title is taken first, else the first in world order (arriveAtWayIn). A place with no such way: its first title (else the world's first), at a free spot there, at the door when outside (BG-49); the Weaver's view then says where they stand, and arriveAt applies only at a new world's story start.
- Someone the Weaver brings back (a cast entry naming an actor already in the world) keeps their names; a name in the plan is ignored.
- A seeded trigger whose owner has no plan gets an empty plan (no goal, no steps) to hold it.
- A stage extension keeps the scenario's challenge and gain; its event summary is added after the scenario's, and its hidden terms join the stage's.
- A scenario that starts at a place with no saved zones and no frontier gets one empty zone named after the place.

Story start has no triggering turn: setup runs alone, is saved as turn 0, and one opening Agent Narrator call narrates it. Until turn 0 is saved, the build is kept at pending/start; reopening the game with it there starts the opening again (Ali, 08/11/2026). Turn 0's premise and starting place come from the story's setting, chosen per story (D-1).

**First build:** the premise is the config value STORY\_PREMISE, "A swordsman arrives at a village troubled by slimes", and that bare place is STORY\_START\_PLACE (tavern), which the first plan fills in; where the player starts is the plan's choice, as above.

The player sees the event roll only on the Rolls line, with Show rolls on (ER5): the scenario's first line reads "Event roll d100 63 → Success" with its modifiers. With Show rolls off it stays hidden, and Agent Narrator never gets it.
