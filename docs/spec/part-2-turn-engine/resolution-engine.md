### Resolution engine

The engine is pure code: the same state, the same logged agent outputs and the same RNG state always give the same events, so any turn can be replayed. Player and NPC actions go through the same ruleset calls.

```ts
interface Ruleset {
  readonly TIERS: readonly Tier[];                                      // ordered best to worst
  initiative(actor: Actor, state: GameState, rng: Rng): number;
  contested(a: RollRequest, b: RollRequest, state: GameState, rng: Rng): ContestResult;
  roll(req: RollRequest, state: GameState, rng: Rng): RollResult;          // Part 1 §4 Layer 2b
  attack(req: AttackRequest, state: GameState, rng: Rng): AttackResult;    // Part 3, Damage flow
  eventRoll(actor: Actor, state: GameState, rng: Rng): EventRollResult;
  // Layer 1 (Part 1 §4): d100 + EVENT_BASE + modifiers from perks, gear and
  // statuses whose library entry names the event roll. No skill. Six tiers and
  // natural edges. Called once per scenario, at scenario setup step 2, always for the player.
  applyEffects(result: CheckResult | ContestResult | AttackResult, state: GameState): Effect[];
  recordUse(actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult, state: GameState): void;
  // improvement-roll timing is open; recordUse only records a use for now
}

type CheckRequest = { actorId: string; skill: string; target?: string; modifiers: { source: string; value: number }[] };
type CheckResult  = { actorId: string; skill: string; target: number; passed: boolean; modifiers: CheckRequest['modifiers'] };
type ContestResult = { a: RollResult; b: RollResult; gap: number; winner: 'a' | 'b' | 'tie' };   // a = the acting side; gap = b.tier − a.tier (Part 1 §4, Contests)
type EventRollResult = {
  actorId: string;                    // always the player
  roll: number;                       // natural d100
  tier: Tier;                         // one of the six TIERS
  modifiers: { source: string; type: 'perk' | 'gear' | 'status'; value: number }[];
};

type RollRequest = {
  actorId: string; skill: string;
  modifiers: { source: string; type: 'roll_perk' | 'wounds' | 'situational' | 'aim' | 'gear'; value: number }[];
  tierShifts: { source: string; value: number }[];      // tier perks; the natural edge is added by roll()
};
type RollResult = {
  actorId: string; skill: string; d100: number; margin: number;
  tier: Tier;                       // clamped to the table
  beyond?: number;                  // steps a shifted roll went past the end tier (+ above, − below); tierLevel() adds it
  natural: -1 | 0 | 1;
  modifiers: RollRequest['modifiers']; tierShifts: RollRequest['tierShifts'];
};
type AttackRequest = { attackerId: string; targetId: string; weaponId: string;
                       targetPart: string | null; aimed: boolean };
type AttackResult = {
  attack: RollResult; defense: RollResult | null;       // null when the attack floor missed
  defenseType: 'dodge' | 'block' | null;
  gap: number | null; gapShifts: { source: string; value: number }[];
  outcome: 'missed' | 'dodged' | 'grazed' | 'blocked' | 'full_hit' | 'heavy_hit' | 'crushing_hit';
  location: string | null;
  locationHow: 'rolled' | 'aimed' | 'redirected' | 'restricted' | 'shield' | null;
  multiplier: number; damage: number;                   // code only; never reaches an agent
  deciding: { attack: string[]; defense: string[]; gap: string[] };
};

type Order = {
  actorId: string;
  type: string; target: string | null; skill: string | null; intent: string;
  source: 'player' | 'agent' | 'trigger' | 'onAlert' | 'routine' | 'fallback';
};

function resolveTurn(state: GameState, playerIntent: Intent, dialogueOrders: Order[],
                     agentOrders: Order[], fired: Order[], rng: Rng) {
  const views = buildActorViews(state);            // active actors only; code minds never see GameState
  const actions = mergeOrders(fromIntent(playerIntent), fired, brokenOrders(views), dialogueOrders, agentOrders,
                              alertOrders(views), routineOrders(views), fallbackOrders(views));
  // one order per active actor: trigger > broken > agent (dialogue call, else Planner) > onAlert
  //                             > routine (desired state) (not engaged) or combat list (engaged)
  resolveExchange(actions, state, rng);            // dialogue turns: the player's speech, then spoken replies
  const ordered = orderActions(actions, state, rng);          // ruleset.initiative
  const events: GameEvent[] = [];
  for (const step of walk(ordered, state)) {                   // pairs hide/search, attack/defend, deceive/insight as it goes
    if (!isActive(step.actor)) continue;                       // downed: order dropped
    applyGearOps(step, state);                                  // free gear ops at this actor's initiative, before its action (Part 5 §4)
    if (isAttackOnUnaware(step, state)) resolveAmbush(step, state, rng);   // before the blow; see Explore mode
    const result = step.attack
      ? ruleset.attack(step.attackReq, state, rng)        // Part 3, Damage flow
      : step.contested
      ? ruleset.contested(step.a, step.b, state, rng)
      : ruleset.roll(step.req, state, rng);                   // Part 1 §4 Layer 2: an act on a thing, only when in doubt
    const effects = ruleset.applyEffects(result, state);
    ruleset.recordUse(step.actor, step.skill, result, state);
    const event = toEvent(step, result, effects);
    event.perception = computePerception(event, state, rng);   // at the moment it happens
    updateBeliefs(state, event, result);                        // still the ONLY writer of Belief
    if (event.actorId === 'player' && isMajorAction(event)) detectPlayer(state, event, rng);   // see Explore mode
    events.push(event);
    fireMidTurnTriggers(state, event, ordered);                 // see Hidden state persistence
  }
  applyBeliefDecay(state);
  checkSecrets(state, events);
  state.events.push(...events);
  return events;
}
```

A defense is a free reaction: it costs the defender no action and uses its standing defense. Each defense after the first in a turn takes the outnumbered situational modifier (value *placeholder*).

An act on a thing rolls against its grade, never the scenario's (Part 1 §4, Layer 2). Ambush, detection and stealth rolls run as before. A event roll's result is saved in the turn record; replay feeds it back with the logged Weaver output, so a replayed scenario start makes no Claude call.

Perception rules:

- **Perception per event.** Computing perception after the loop gave a guard killed in step 2 knowledge of step 3, and gave a moved actor sight of events from its new zone.
- **One belief writer.** Stealth contests return results; updateBeliefs alone writes Belief, so the stealth result and the perception result can't overwrite each other.
- **Passive perception.** Every event is checked against every actor in range, whether or not that actor ordered a search. The player's own events are the exception: an observer unaware of the player perceives them only through detection (Explore mode).

**Active actors.** isActive(actor) is false while the actor is incapacitated. An inactive actor gets no order of any kind and an order it hasn't resolved is dropped. It skips desired-state evaluation, its triggers stay armed but don't fire, it counts on neither side of engagement, and it gets no dialogue call when addressed. A revived actor is active from the next turn.

Rules for simultaneous orders, because the Parser and the Planner worked without seeing each other:

- **Target moved first.** An attack resolves against where the target stands now if it is still within the weapon's reach; otherwise it becomes a wasted-action event ("swings at empty air"). **A stale NPC blow (TP2, Ali 14/11/2026):** turns stay simultaneous (TP1 a); an engaged NPC whose agent-given blow can no longer happen when its turn comes (no target, target dead, or out of reach or no room after closing in) does its combat-list action from what it perceives then instead, closing in on its new target with the move time left, as an engaged NPC's unwalkable walk already does (order\_dropped). A free follow-up strike, a fallback order, a yield, a truce or a held spar blow is still wasted, and so is the player's (TP3 open). Reach comes from the attack mode, in metres with sight (Part 5 §5).
- **Closing in (ZP3).** A melee attack on someone out of reach, with no other move planned before it (none, or a move to the target's zone), walks at the target on the move slot first and stops just inside the weapon's reach (a move event with `target` and no fromZone). Still out of reach, the striker runs on at the target on its main time, exactly as a dash (AE2: same pools, same clock), and strikes next turn; no blow is swung this turn (BG-255, Ali NV9 b: the player, an agent's blow, a code-run fighter's combat-list blow, and an agent blow gone stale that code takes over, src/engine/resolve.ts runOn, logged `ran_on`). Only a run that gets no nearer (no way there) still loses the blow (a wasted action). A ranged attack never closes in.
- **Spots in a zone (BG-12).** A player's move can name a spot in its zone, the player's own zone included (Parser `move.spot`): `near` someone there (stops PLACE\_GAP\_M from them) or a way out of it (its doorway, or a frontier's side); `awayFrom` someone or a way out (the far edge straight across from it through the zone's middle; a way out at the middle, such as stairs straight down, keeps to the side the walker is on); or `side`, a compass word (the middle of that side). It walks there on move slots like any move, stopping ENTER\_M (a step) inside the edge (position.ts spotPoint). A spot that names nothing there makes the Parser's turn ask where. A move with no spot to the player's own zone is still no move.
- **Far moves (BG-15).** A player's move names where the player means to end up, not the first step: any zone the player knows (PlayerView `known`: zones stood in, seen across a sight link or left, and the ways out of them it has seen, named by the exit's words for a zone never entered). The walk finds the way through the zones between, slot by slot, as any move. A move-only turn is just the move: no hold event follows it unless words go with it (BG-16).
- **Ways out, the back, left and right (BG-18 to BG-20).** Walking *to* a way out ("to the cellar steps") is a spot near it in the zone it leaves from; walking *through* it is a move to the zone beyond. "The back" of a zone with no way named is away from the way the player came in. Everyone walking faces the way it last walked (Actor.facing); the player's view gives each person in sight a `side` from that (ahead, left, right, behind, each a quarter turn), and when words fit several people equally (two at the same distance), the Parser picks one and never asks.
- **Moves in the narration (BG-22).** Each move event the player sees says how it went: a leg that leaves a zone gives the zone it left (`from`) and the one it entered (`where`); a leg inside a zone is `within` it, and when it is on the way to another zone, names that zone (`heading`). The Narrator tells a turn's legs in order as one walk.
- **Moves.** A move resolves at its actor's initiative like any other action. Provisional: how many actions a turn holds is part of the action-economy discussion.
- **Same target or object.** Earlier initiative acts first; the later actor gets a contested check or a wasted action.
- **Stealth.** A hide or sneak is contested once per observer in perception range. Each result sets that observer's belief separately. A hide or sneak also sets the player's posture to stealthy.
- **Speech.** Talking is an action. A talk action resolves at the speaker's initiative and is perceived by volume and zone links, except addressed speech in a dialogue turn, which resolves in the exchange slot at the top of the turn, followed by the spokespeople's spoken replies. A bark rides on its action's event: perceived and narrated, but it copies no belief. An NPC's bark is the exception (BG-253): its words were picked at the turn's start, so they are said as its turn starts, before anyone's step, on an event of their own; words it keeps for after a walk (speakAt end, or a walk up to its target) and a late starter's (AT58) still come at its step.
- **Numbers.** Tier tables, caps, perk effects and skill gains come only from the ruleset module. Do not invent or tune them here.

**First-build ruleset.** Build TIERS, eventRoll(), roll() and attack() as Parts 1 and 3 define them, and contested() as Part 1 §4 sets out. The rest works like this:

- initiative(): d100 + SKILL\_WEIGHT × the best skill with the Initiative function (full value, like a function roll; 0 when none) + roll modifiers naming initiative (rollMod roll `initiative`). No skill has the function yet, so it is a plain d100 for now (Dodge joins the Speed group directly, without the function). Higher acts first. An actor unaware of anyone attacking it this turn takes INIT\_UNAWARE (placeholder), so it acts last. Ties go to the seeded RNG.
- applyEffects(): attacks as Part 3 sets out. A check or a contest changes beliefs (through updateBeliefs) and reveals secrets. Objects and places change through their own actions, each with its own rules: picking a lock and breaking through a barrier or wall (Scenarios; BA2, BW8–BW26) and filching (FL1–FL7). A new way to change a thing is its own question (OQ-22, closed 21/11/2026).
- recordUse(): writes the use to the agent log and changes nothing, so no skill changes in the first build.
- The morale roll (Part 3, Morale) is moraleRoll(): roll() on Resolve with renown and rally; morale lost is saved in Condition.moraleLost and a break in Mind.moraleState until the scenario ends. No new interface method.

**Replay.** Each turn record (Part 4 §6) holds the RNG state before the turn, each agent's exact output and any event roll. Replay feeds the logged outputs, not the player's text, back through the engine, and is exact only under the library version that record names. Merge Planner outputs in actor-id order, never in the order calls returned.
