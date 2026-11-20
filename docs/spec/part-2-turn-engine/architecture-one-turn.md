### Architecture: one turn

Only code ever sees every agent's input and output. Planner calls run in the background between turns, before the player submits. In dialogue turns the addressed actors' dialogue calls run after the Parser, because spoken words are meant to be heard. Speech is an action: talking takes the turn's main action, for the player and for every NPC.

#### Tactical and explore turn

1. After turn N is saved, code computes turn N+1: its mode, the triggers that fire at its start, and its engaged significant actors (state.pending). If the player's zone links to a frontier with no held extension, code also starts that frontier's background Agent World builder call (Stage extension).
2. Each engaged significant actor's Planner call starts at once, in the background, with that actor's OppositionView built from saved state, up to MAX\_PLANNER\_CALLS. Explore has no engaged actor, so it runs no Planner.
3. On submit, Agent Parser receives the player's text and PlayerView. Resolution starts once the Parser returns, and never before the previous display plus BACKGROUND\_WINDOW, in every mode. An actor whose Planner call isn't back by then uses its type's combat list this turn (Fallback behavior).
4. Code validates every output. If the Parser returns a clarify question, the turn stops and turn is unchanged. Planner outputs are kept, because state hasn't changed, and apply once, when this turn resolves.
5. The engine builds every active actor's ActorView, then merges the Parser's intent with one order per actor, in this priority: fired triggers, surrendered actors' hold orders (Part 3, Morale), agent orders (dialogue call, else Planner), onAlert orders, routine orders (not engaged) or combat-list orders (engaged); rolls, applies effects, and records who perceived each event at the moment it happens.
6. If this turn called scenarioBreak, or the player moved into a frontier, scenario setup or stage extension runs now, before the save (Scenario setup).
7. The story is saved (Part 4 §10), including plan updates and this turn's logged agent inputs and outputs.
8. Code builds NarrationView from the events the player perceived.
9. Agent Narrator writes the full narration and lists the events it covered; the leak scan and fact check run; then the text is shown. No streaming.

#### Dialogue turn

A turn is a dialogue turn when the Parser's main action is a speech action (talk, persuade, deceive, intimidate, barter) addressed to one or more NPCs.

1. The Parser parses the player's text and lists the addressees: named actors, a band, or everyone in earshot.
2. Code picks one spokesperson per addressed band: the member the words are aimed at (the action's target, BG-122); else the named member; else the sticky partner (the NPC the player last spoke with this scenario) if it is an active member of that band in reach; else the band's nearest addressed member, ties by actor id. When a band is addressed without a name, no partner of it is in reach and the player can see more than one of its members, code asks "Who do you speak to: A or B?" naming only people the player can see, with no Claude call and no turn spent (OQ-27, answered 07/11/2026). At most MAX\_SPOKESPEOPLE (config, placeholder) bands get one, in the order the player's words name them; members of other bands only hear the words. Inactive actors are never picked.
3. Exchange slot, part 1: the engine resolves the player's speech. A speech check is the speaker against the other side: one roll by the player with the action's speech skill, contested separately against each spokesperson's roll with the same skill (read by tier difference, Part 1 §4, Contests). Talk and persuade use persuasion; deceive uses Falsehood, answered with Insight; intimidate uses intimidation; barter uses barter. Each earlier try of the same kind at the same listener this engagement costs the speaker −15 (D-154). Any of them may be substituted by another speech skill (Part 1 §3, Skill substitution). The speech event is perceived like any other event. Winning counts toward check\_passed secret reveals, sets prices with a seller (D-93), and leaves the listener Shaken or Swayed (D-154). NPCs speak to the player with a roll the same way, through persuade, deceive, intimidate or barter (D-154).
4. One dialogue call per spokesperson runs in parallel: the Responder if that spokesperson has an agenda, else the Voice. Each receives its own view plus only this turn's spoken words and its impression (Dialogue input, below). Each returns its one action for the turn: a reply (a talk action) or any other main action.
5. Exchange slot, part 2: spoken replies resolve right after the player's speech, in initiative order. A spokesperson that chose another action resolves it at its own initiative in step 6.
6. resolveTurn runs for every other actor and for the spokespeople's other actions, as in step 5 of the tactical turn; then steps 6 to 9 of that turn run.

Rules for dialogue turns:

- **Planner calls:** an addressed spokesperson's background Planner call is cancelled once the Parser returns a dialogue intent, never on a clarify question; a result that arrives anyway is logged as unused. Engaged actors elsewhere keep their Planner calls.
- **Triggers:** a turn-start trigger fired for a spokesperson is shown to its dialogue call as already committed. The trigger's order is its action, and the call's line is kept only as a bark. A mid-turn trigger may replace a spokesperson's other action before it resolves; a reply already spoken stands.
- **Barks:** words spoken alongside a non-speech main action are a bark, not speech, and make no dialogue turn.
- **Calm bandmates \[Proposed\]:** when a spokesperson's output switches its routine, calm, code-run bandmates who perceived the exchange switch to the same routine next turn. A bandmate switches only if that routine id is in its own routines list and every slot the routine reads is bound for it; otherwise it keeps its routine and code logs routine\_skip. Engaged bandmates decide through their own Planner or combat list. Calm means not engaged, no alarm armed, and no attack or alarm perceived within DECAY\_AWARE\_S (CS2).
- **Timing:** dialogue results are shown no earlier than DIALOGUE\_WINDOW (config) after submit, set at or above the Responder's usual latency, so guarded and ordinary NPCs answer in the same time.

#### Dialogue input

A dialogue call receives, from this turn, only the words the player spoke and one impression per speech action: how convincing it sounded (talk, persuade, deceive, barter) or how threatening it felt (intimidate). It never receives the player's action type, any non-speech check, the player's move, approach, stance or deferred actions. The impression comes from the player's tier; the listener's roll decides only who wins the contest. Code maps the tier to fixed words (table below; wording is a placeholder). No tier names, no numbers.

| Player's tier | Convincing (talk, persuade, deceive, barter) | Threatening (intimidate) |
| --- | --- | --- |
| Critical Failure | insulting, plainly false | laughable |
| Failure | unconvincing | unimpressive |
| Near Miss | doubtful but possible | unsettling |
| Success | convincing | threatening |
| Great Success | very convincing | frightening |
| Critical Success | completely convincing | terrifying |

The tier names are the six tiers of Part 1 §4; the ruleset still owns them.
