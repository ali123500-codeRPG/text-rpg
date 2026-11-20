### Leak prevention, validation and failure handling

Every model output is checked before it touches state or the screen, and every failure has a fallback so the game never stalls. All checks are code; none adds a Claude call except the single regeneration or repair retry.

| Check | What it catches | On failure |
| --- | --- | --- |
| JSON schema on Parser, Planner, Responder, Voice, Narrator, Weaver | Malformed JSON or a missing required field (a missing optional field reads as empty and the answer stands, CS9) | One repair retry with the error; then the fallback for that agent |
| Legality on the Parser | Targets, items or skills not in PlayerView (a speech action's skill is set by code from its type, so the Parser's is dropped) | Turn stops; ask the Parser's clarify question, else a question about the failed part ("Who do you mean? I can see …", "Which item do you mean?", "Where do you want to go?"), else a generic "What do you do?" (provisional, see D-21) Exception (Q16, Ali 07/11/2026): when the intent has a legal move and only its addressees or action target are out of sight, the move resolves this turn, the action and words are dropped into deferred (logged deferred\_to\_arrival), and the Play screen offers them in the empty action box after the turn |
| Legality on Planner, Responder, Voice | An order targeting something the actor has no belief about | Drop the order: the Planner's actor uses its combat list; a Responder or Voice uses the fallback reply. Log view\_leak if the id is real but outside the view; log invalid\_target if it doesn't exist |
| Gear legality on Parser, Planner, Responder, Voice | An item the actor doesn't hold or can't see, a mode the item lacks, a gear op on an item out of reach | Drop that op or field; the action stands if still legal; log invalid\_gear |
| Planner timing | A Planner call not back by BACKGROUND\_WINDOW | Combat list this turn; discard the whole output; log planner\_late |
| Reveals on the Responder \[Proposed\] | A secret id the actor doesn't hold | Drop that reveal; log invalid\_reveal |
| Barks in NPC views | A bark's words in the view of an NPC that did not hear them | Build-time error: a bark's words reach only those who heard them and the speaker's said list (BF67, unit test) |
| Facts on the Voice | A shares id not in knows, or a name or fact in line outside the NPC's view | Regenerate once; then a neutral line from the NPC's sheet |
| Leak scan on the Narrator | Names, ids, leakTerms of unrevealed secrets, or facts from unperceived events that are not in NarrationView; the active stage's hiddenTerms; names of actors not in namesKnown | Regenerate once with a note; then the fallback narration |
| Fact check on the Narrator | An id in narrated that isn't in NarrationView; a full event that changes the player's condition, inventory or position missing from narrated; a full presence event missing from narrated; names of characters or items outside the view | Same as the leak scan |
| Stage-plan validation on the Weaver | Unresolved ids, caps, broken links, dead ends (NW4: a street, square, gate, field, woods or road must link somewhere besides the way in, to a zone or a frontier; the zone kinds table marks these onward; yards and indoor zones may be dead ends), unparseable triggers, grades that don't fit the tier, hiddenTerms or leakTerms in public text, over-long text, unresolved routine sets, missing or invalid slot bindings, unreachable bound zones, a bad startAt | One repair retry with the errors; then the flagged fallback stage; after it, routine-only errors degrade those actors to idle\_here |
| Routine switch (Planner, Responder, Voice, calm bandmates) | An id not in the actor's routines list, or a routine reading a slot the actor has not bound | Drop the switch; keep the current routine; log invalid\_routine (bandmates: routine\_skip) |
| Routine bank import (designer tool, not play) | Unresolved ids; a schedule with no steps, or steps on follow or wait; a slot read but not declared in every set that lists the routine; a shared routine reading a non-standard slot; an alert id not in the same set; a $slot target not declared | Entry not promoted; errors shown to the designer. The library never holds a failing entry |
| Call failed: upstream\_error \[Proposed\] | A transient service or connection failure | That agent's fallback this turn; no automatic retry; log call\_failed |
| Call failed: rate\_limited \[Proposed\] | Too many calls, or the viewer's usage limit | Fallbacks this turn; skip background Planner and Weaver calls until the next player action; show a short notice; log rate\_limited |
| Call failed: refused \[Proposed\] | Claude declined the input | The agent's fallback; never resend unchanged; log refused |
| truncated: true, or no parseable JSON in the reply \[Proposed\] | An answer cut by the length or time limit, or no parseable JSON | Same as malformed JSON: one repair retry, then the fallback |
| Call failed: not\_granted, sampling\_disabled, session\_expired \[Proposed\] | The viewer can't use Claude in this view | Stop play with a message to allow Claude or sign in again; no fallback play |
| Call ended: cancelled | The page aborted the call itself, such as a Planner call cancelled on a dialogue intent | Not an error; log as unused |

Every retry is single and changes its input. The runtime docs forbid retrying from a loop and treat only upstream\_error as transient. Error codes are the runtime's own.

Limit: code can't catch an invented unnamed figure ("another guard"). The prompt rule and playtests cover that.

The fallback narration's form is still open (D-23). Until then, build it from the events with plain templates.

Each actor type's combat list (Fallback behavior) keeps the game playable even if every Planner call fails, and covers actors beyond the call cap.

**GM debug view.** A toggle that shows full state, hidden plans, rolls, each actor's beliefs, and each agent's exact input and output for the turn. It's the fastest way to spot a leak. Its **People** table lists everyone with their exact age, who runs them (Player, Agent for mind.control agent, or Code) and the agent calls made for them this turn. Clicking a name opens a movable pop-up with that person's last GM\_AGENT\_CALLS\_SHOWN (5) agent calls, newest first: turn, agent, status, model, errors, the exact input, and the output folded under it. Older calls come from the kept turn records (TURN\_RECORDS\_KEPT), whose large inputs are trimmed (GameApi.agentHistory).
