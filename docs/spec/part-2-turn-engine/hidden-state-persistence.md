### Hidden state persistence

Plans and secrets live in state.hidden, so they survive between turns even when no agent is called. Triggers use a small, machine-checkable vocabulary; the Planner and the Weaver may only write triggers from this list, and the engine drops any it can't parse.

```ts
type HiddenStore = {
  plans: Record<string, Plan>;       // actorId -> plan
  memory: Record<string, MemoryEntry[]>; // actorId -> memory list { turn, text }, at most MEMORY_ENTRIES (PM1)
  agreements?: Agreement[];          // PM3: { id, parties: [a, b], text, madeTurn, madeBy }, kept until done or broken
  secrets: Secret[];
  firedLog: { triggerId: string; turn: number }[];
  weaverNote: string;                // Agent Weaver's rolling note; replaced each call
  stage: { eventSummary: string; challenge: Grade; gain: Grade; hiddenTerms: string[] };
};

type Plan = { goal: string; steps: string[]; triggers: Trigger[]; createdTurn: number };

type Trigger = {
  id: string;
  ownerId: string;                   // the actor whose beliefs the condition reads
  when:
    | { type: 'player_seen_in_zone'; zone: string }   // the owner's own perception, not truth
    | { type: 'turn_reached'; turn: number }
    | { type: 'actor_down'; actorId: string }
    | { type: 'alarm_heard' }                          // the owner perceived an alarm event
    | { type: 'quiet_turns'; turns: number };          // a beat: the scenario has been quiet this many turns in a row (Scenarios)
  then: OrderTemplate;               // exactly one order; the validator rejects lists
  once: boolean;
  endsScenario?: true;                  // a beat that ends the scenario when it fires (Scenarios)
};

type OrderTemplate = Omit<Order, 'source' | 'target'> & {
  target: string | '$player' | '$lastKnownZone' | '$triggerZone' | `$slot:${string}` | null;
                       // bound when the trigger or onAlert fires; $slot reads the owner's binding
                       // (a route slot gives its first zone)
};

type Secret = {
  id: string;
  holderId: string;                  // the actor who keeps it
  fact: string;                      // e.g. 'the captain is the informant'
  leakTerms: string[];               // words and phrases the leak scan looks for, e.g. ['informant', 'sold you out']
  revealWhen:
    | { type: 'event_in_zone'; kind: string; zone: string }
    | { type: 'check_passed'; skill: string; minTier: Tier; againstActorId: string };
};
```

Per turn:

1. **Turn start.** The engine checks every trigger once, after the previous turn is saved (Architecture step 1). Fired triggers become orders this turn and are written to firedLog; a once trigger is removed from its plan at that moment, so it can never fire twice. Triggers of inactive actors stay armed but don't fire.
2. **Mid-turn.** After each event, player\_seen\_in\_zone and actor\_down triggers are checked again. One that fires while its owner hasn't acted yet replaces that owner's order this turn; otherwise it fires next turn. An ambush springs while the player is still on the bridge.
3. **One order per actor.** A fired trigger's order replaces the agent's order for the same actor. When several of an owner's triggers fire in one turn, the first in its plan's order wins; the others stay armed unless they are once triggers.
4. **Next view.** The owner's next OppositionView lists its fired triggers under "already happened", so the Planner doesn't order the same thing twice.
5. **Plan updates.** A non-null planUpdate replaces that actor's plan. memory edits the actor's memory list on its own, with no plan update (PM1): drops by number first, then adds; past CONFIG.MEMORY\_ENTRIES (8, a placeholder) the oldest entries go (PM2). An older output's memoryNote is read as one added entry. Updates from a turn that stopped on a clarify question are kept and apply when that turn resolves. A late Planner output is discarded whole, planUpdate included (interim; D-43).
5a. **Memory and agreements** (PM1–PM8, Ali 08/11/2026, schema v6).
   - An agreement is recorded only when the other party (the player or an NPC) perceived a line spoken by its maker this turn; otherwise it is logged invalid\_agreement. The Planner and the Responder make deals with anyone (PM4); the Voice only with the player. Only a party can end a deal (done or broken).
   - Both parties' views list the deal (AgreementView: with, withId, text, madeTurn). The PlayerView lists the player's deals for the screen (PM5; the panel is the designer's).
5b. **Quests** (OQ-28 and D-105, settled by Ali 09/11/2026, QT1–QT28; src/engine/quests.ts).
   - A quest is a deal with a job in it; the giver is always an NPC and only the player takes quests (QT1, QT16). The giver's Planner, Responder or Voice offers the job in talk; the Weaver seeds givers only through an actor's plan (QT2). The deal's agreement carries the job; it becomes a quest only when the giver heard the player speak this turn (QT3). Unaccepted offers are not stored.
   - The job's line is one short line of what was asked. It goes through the narration leak scan; a refused line keeps the deal but makes no quest (QT4). One open quest per giver: a second is refused and logged (QT5).
   - Goals (QT6/QT7): defeat (N of a body type or race, or one named actor), deliver (an item, or one item instance, handed to someone), reach (a zone or place), find (see a named person clearly). Givers offer only these four (BF61: the job schema has no "other", and the giver's rule says never a chore code can't check, and never to say a tool or thing is somewhere its view doesn't show). A job code still can't read (a target not in the world) is refused (quest\_refused, unchecked\_goal), logged quest\_goal\_gap and filed in the play page's bugs/ list (QT27). A job of kind "other" made before BF61 stays so, and its giver's agent judges it done at report-back. Doable chores (mend, chop, carry at furniture with placed tools) are a feature for later. Goal kinds and quest states are unordered: their names are their IDs (QT21).
   - States (QT11, QT22): active, ready (goal met), done, failed, abandoned, called\_off. A ready quest is done when the player next talks to the giver in person, if the giver perceived the deed that met it (BF6: the counted foes' fall, the hand-over, the player getting there); otherwise the giver learns it only by judging the player's report, and its agent marks it done in questEnd (code ends it only if the goal is really met; a believed false report is logged quest_report_believed); handing a delivery to the giver finishes it at once (QT8). Code fails a quest when the giver dies, a named target dies, a delivery item no longer exists, or the goal is not met by the deadline.
   - The deal is locked: code refuses (quest\_deal\_locked) any endAgreements on it, and ends it with the quest. The giver may call the job off only in words the player hears (called\_off, no stance change). The player abandons on the Quests page or by telling the giver (QT12).
   - Payment (QT10/QT23): the promise is data (coin and/or a library item and count). Anything the giver gives the player afterwards counts toward it. Still owed when the player's engagement ends after hand-in: the promise is broken, logged quest\_unpaid, the giver remembers it, and the quest shows Unpaid.
   - Deadlines (QT25): in N days, optionally by a time of day, as a clock time; without a time of day, the end of that day. Only the goal must be met by then.
   - Stance (QT13): done, one step friendlier; abandoned or failed by a missed deadline, one step colder.
   - Linked quests (QT24): a quest may name the quest it follows (after). A job from the same giver after a hand-in in the same engagement links on its own. Each quest keeps one goal and pays its own XP.
   - Views: an NPC's view lists in jobs the player's quests it gave or that send the player to it (a ready quest shows as active until hand-in). The Quests page shows giver, goal and progress, reward level, payment, due time and state, linked quests folded under one head row; the Play screen's quest line shows the pinned or newest open quest. A quest ready to hand in shows by marks, not new words (C7): a gold check on its Quests row (State) and on the Play quest line, a gold dot on the rail's Quests item, and a gold check beside its giver on Who's here when in view; the turn it becomes ready the quest line and the giver's row get their one change beat (M-36). Any words ("a quest is ready to hand in") are only in the tip and for screen readers.
   - PM8: an agent-controlled NPC in an open deal gets a Planner call each turn even when not engaged, so a companion can act on the deal instead of only following.
   - PM6: when events an NPC perceived fall out of its RECENT\_EVENTS window, code writes one short line for each into Mind.earlier (no Claude call): "turn 12: player attack you (hit)". A line that repeats the one before it becomes a count (turn 12–14: … ×3). Only the last CONFIG.EARLIER\_LINES (6, a placeholder) stay. Every NPC view shows them as earlier.
   - Deferred (PM7): the Voice writing memory entries.
6. **Secrets.** A secret becomes player knowledge only when a resolved event meets revealWhen: minTier is a tier key and the check must reach at least that tier (the Weaver writes the tier's name; code keeps the key), and a check\_passed reveal needs the check aimed at againstActorId. A secret is also revealed when its holder's Responder lists it in reveals; code accepts only secrets that actor holds **\[Proposed\]**. When the player wins a speech contest against a spokesperson with one of its check\_passed reveals' skills, at that reveal's minTier or better, its Responder is told so (SLIPS) before it answers. A search aimed at the holder reveals check\_passed secrets of a sight or hearing skill when its roll reaches minTier (SE17, Searching). A revealed secret is added to the player's Journal (secretsKnown); only then can it appear in NarrationView.
7. **Save.** After resolution, the story is saved as described in Part 4 §10. Hidden fields are saved but shown only in the GM debug view.

**onAlert** is not a trigger. Code fires a routine's onAlert order once, when its owner first leaves unaware of a wary actor or first perceives an attack or alarm: this turn if the owner hasn't acted and has no agent order, otherwise next turn unless an agent order exists by then. An armed flag resets when the owner is calm again: unaware of every wary actor, and DECAY\_TURNS turns with no attack or alarm perceived.
