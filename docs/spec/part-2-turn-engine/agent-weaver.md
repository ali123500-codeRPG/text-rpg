### Agent Weaver

Agent Weaver plans what a scenario is about and who is in it. It runs at scenario setup (inside the turn) and for stage extensions (in the background). It is hidden-side, like Agent Planner: it may see the hidden store, and none of its hidden output ever reaches Agent Parser, Agent Narrator or Agent Voice.

**WeaverView** (built deny-by-default, like every view):

- the tier and its stakes group;
- the place or frontier being planned, by id and name, and its ancestors' headlines;
- where the player stands (player.standsIn: place id, place name, zone; null at story start, where the plan's arriveAt says where they start, PQ1 a);
- the ground near the player and the target sorted by place (NW6; WI8 a: every zone of the settlement or road over the target's place and the player's, and every zone within PLAN\_VIEW\_M (200 m, placeholder) of the player's zone and the frontier's edge by the walking path (BG-305); an NPC agent's map is bounded the same way around it): each place by name, kind and parent, with its zones and the actors in them, each actor with its plans and secrets. Nobody there is hidden, so far-off people can turn up when the story fits; sorting by place is what keeps the Weaver planning in the right town (the flat zone and actor lists made it lose the thread in tests);
- quests; the bands on the stage, with their goals and relations;
- the player's level, current class and health-track level;
- the previous Weaver note;
- catalogs: the library and blueprint ids it may use (templates, body types, routine sets with their brief, tags and slot hints, items). Catalogs change only with libraryVersion and sit right after the fixed instructions as a stable prefix (OQ-11).

Never in WeaverView: skill growth, Burden or Potential (Part 1 §2); this turn's player text.

Output shape (notation, not literal JSON):

```
{
  event:       { summary: hidden text, challenge: grade, gain: grade },
  places:      [ { key, name, kind, parent: placeKey | placeId } ],   // new place nodes only
  zones:       [ { key, place: placeKey | placeId, kind?: title kind id (none for a road, PZ9), name, look: public text,
                   light?: a LIGHT key (PZ5: the word its lights are drawn to; default from the kind),
                   size? | area?, walls?: { [side]: wall kind id (WK) }, length?, danger?, furniture?,
                   ways: [ { to: zoneKey | zoneId | frontierKey | land id, label,
                             kind?: open | door | window | up | down, barrier? } ] } ],   // PZ10, PZ14: no cover, height, edges or sight
  frontiers:   [ { key, label } ],
  bands:       [ { key, name: public text, goals: hidden text, temperament: hidden text,
                   lethal: true | false,   // no tactics word: each NPC's comes from its own Battle Sense (TC4 a)
                   relations: { [bandKey | bandId]: hostile | opposed | neutral | friendly } } ],
                                    // new bands only; may also set relations toward existing bands
  cast:        [ { template: templateId | actor: actorId | compose: { race, role, theme, rank, class? },   // NG15: catalog IDs; code builds the sheet
                   templateGap?: hidden text,        // NG15: who it wanted when no template or composition fit; flagged in the GM view
                   label: public text, name, appearance: public text, pronouns: he | she | they | it,   // public; stored on the actor and shown to every agent that sees them (run 14 Q3)
                   knownOnSight?: true, knows?: [ { id, text: public text } ],   // facts this actor may share (Agent Voice); capped
                    key, band: bandKey | bandId, routineSetId,
                   slots: { <slot>: zoneKey | zoneId | [zoneKey | zoneId, ...] },   // every slot the set lists
                   startAt?: <slot>,                 // where in the loop to start; code computes the anchor
                   routineGap?: hidden text,         // what it wanted when no set fit; capped; GM view only (Wanted list, D-53 a)
                   awarenessOfPlayer: unaware | suspicious | aware,      // what this actor knows of the player
                   awarenessOfBands?: [ { band: bandKey | bandId, awareness: unaware | suspicious | aware } ],
                                                                         // about every member of that band
                   overrides?: [ { actor: castKey | actorId, stance: hostile | opposed | neutral | friendly } ],
                   motive: hidden text } ],   // agenda is derived from seeded plans and secrets
  seeds:       { plans: [Plan], triggers: [Trigger], secrets: [Secret] },
  rewards:     [ { item: itemId | { base: libraryItemId, quality: 1 | 2 | 3 | 4, boosts: string,
                                    name: public text, look: public text },   // minted variant
                 qty?: number,
                 place: { carriedBy: castKey | actorId } | { groundIn: zoneKey | zoneId } } ],
  hiddenTerms: [ string ],     // words that must not appear in public text
  weaverNote:  hidden text     // replaces the previous note; keep it short
}
grade = none | minor | moderate | major | extreme
```

**Lethal.** Each entry in bands carries lethal: true | false, default true. It is saved on the band, and an existing band keeps its value. Agent Weaver sets false only for a conflict nobody means to end in death, such as a hostage-taking; monsters such as slimes are lethal. A spar is not a band setting: it has its own engagement kind (Sparring). Code reads lethal when the player goes down (D-54, built 09/11/2026): if any active actor hostile to the player belongs to a lethal band and perceives the player by any sense (Ali, 13/11/2026: a foe that can't sense you can't finish you), the story ends on the "You fell" screen, unless a foe is asked for mercy (D-239, below). Otherwise (bands marked not lethal, a spar, or nobody left standing to finish the job) the player makes one survival roll, roll() with no skill and no modifiers: Near Miss or better wakes at Critical and the scenario breaks (cause knocked\_out); the Weaver gets target.wake and plans a new place whose first zone is where the player wakes, somewhere safe. Failure or worse ends the story the same way. A wake plan with no new zone fails validation (wake\_needs\_zone).

**Mercy once down** (D-239, Ali 13/11/2026, OE5 b and OE7; built). When the player goes down in a lethal fight, each of those lethal foes (all of them perceive the player) that is run by Claude, of an Intelligent race, is asked instead: its next output answers spare (true spares, false finishes; no answer finishes), shown to it as self.playerAtMercy. The others finish. Sparing covers the sparer's bandmates together with it that were asked too (YD2). The game plays that next turn by itself while the player lies there, as a sleeper's turn. The player is spared only when someone spared and no one is left to finish (a finisher downed meanwhile no longer counts): spared works like a won survival roll, waking at Critical somewhere safe (cause knocked\_out). The fight counts as lost, and for the stronger-foe survive chains, never the win chains. Otherwise the story ends on the "You fell" screen. Codes: mercy\_asked, mercy\_spared, mercy\_finish, player\_spared, player\_fell.

**Challenge and gain grades.** A stage plan declares a challenge grade (how hard the situation is to come through well, not how strong the foes are: a real challenge is meaningful harm of any kind, life, loss, time, standing or someone the player protects, and danger to life comes only where the world holds it; CK6 a, CK7 a; code logs power readings beside it, SHEET-360) and a gain grade (what it can pay out: loot, XP, information, allies, quest progress). Code accepts the pair only if it fits the tier:

| Tier | Challenge | Gain |
| --- | --- | --- |
| Critical Failure | Major or extreme | None or minor |
| Failure | Moderate or higher | None or minor |
| Near Miss | Minor to major | One step below challenge, none to moderate |
| Success | Minor to major | Within one step of challenge |
| Great Success | Moderate to major | One or two steps above challenge (major or extreme) |
| Critical Success | Major or extreme, the same as Critical Failure | Extreme |

A Critical Success is as dangerous as a Critical Failure (D-247): what sets it apart is the opportunity inside the danger, not a milder danger. **Every tier has a real conflict** (D-339, SW1 b and SW2 a on the "Scenario event rolls" page, Ali, 14/11/2026): no tier allows challenge none, and good tiers differ by the opportunity, never by a milder danger. Each new scenario's plan names its **stake** (scenario.stake, hidden: what is lost if the player does nothing); a plan without one gets a repair error (scenario\_stake). The stake is kept on the scenario, shown to the Weaver at its check-ins so it can judge an ending against it, and a check-in may change it.

Grades are hidden-side and never reach Agent Narrator. A computed cross-check (cast and rewards against the declared grades) is a stub that passes for the cast; rewards are held to the gain's Boon budget (Part 5 §7, loot V8).

**Validation.** Code checks every stage plan before it touches state:

- every id resolves (story blueprints first, then the library); an unknown body type fails (Part 3);
- caps on cast size, zones and frontiers (placeholders); every cast entry names a band, every band reference resolves (the plan's new bands, then the story), and relations and stances use only hostile, opposed, neutral or friendly;
- every zone link points to a zone in the plan, a zone built anywhere in the world, or a frontier;
- triggers use the trigger vocabulary and hold one order each, of a type the engine knows (ORDER_TYPES); every secret has leakTerms; a check\_passed secret names a library skill;
- the grades fit the tier;
- no public field contains a hiddenTerm or a secret's leakTerm, matched as whole words (as the Narrator's leak scan matches);
- public text respects TEXT\_CAP (placeholder). Hidden-only notes (event summary, band goals and temperament, motive, routineGap, plan goal, secret fact, Weaver note) are not rejected for length: code trims them to NOTE\_CAP at a word boundary.
- rewards never fail a plan; code repairs them and logs each repair (reward\_repaired): a reward with an unknown item, base or place, or one that would take the plan over its Boon budget (Part 5 §7), is dropped; a bad qty becomes 1; a minted variant past the per-scenario cap, at a gain that allows none, or whose name or look is too long or uses a hidden term is placed as its plain base item; a quality above what the gain allows (Part 5 §7) is lowered to it; a weapon's boosts other than hitAdj or damageAdj becomes hitAdj (loot L1, V7);
- every routineSetId resolves; a player-band entry names the companion set and binds no slots;
- every slot the set lists is bound: a zone slot to one zone, a route slot to 1 to MAX\_ROUTE\_ZONES zones (one zone: the actor stays there); bound keys are zones in the plan or on the stage, never frontiers; startAt names one of the set's slots;
- every bound zone is reachable from the actor's other bound zones through zone links;
- routineGap respects its length cap (placeholder).
- every knows fact is public text: it respects its length and count caps (placeholders) and is scanned like other public fields;

**Defaults filled before validation.** A trigger inside an NPC plan with no ownerId belongs to the plan's owner; a trigger with no once fires once; a place with no parent (missing or null) is top-level, and a new place may name another new place as its parent; a plan with no steps gets an empty list. Validator errors are listed once each, with a hint where the Weaver mixes fields up (a stance in an awareness field; a secret in knows). The repair retry sends the rejected plan back with its errors and asks for only those fixes.

**Failed stage plan.** A plan that fails validation gets one repair retry with the validator's errors. If it fails again, or the call fails, or (scenario start only) it passes WEAVER\_TIMEOUT (config; on a new world's first story it starts once the first region is drawn, which has its own REGION\_TIMEOUT, BG-311), code builds a fallback stage: the place's saved zones, or one empty zone per frontier label; no new cast; grades none/none. The fallback is flagged so it cannot be missed:

1. The stage record carries fallback: { reason, turn } until the next scenario start.
2. The turn record logs weaver\_fallback with the validator's errors.
3. The GM debug view shows a red banner while any fallback area is on the stage.
4. The play screen shows a small out-of-character marker ("Scenario planning failed: placeholder area"), with no details, until the next scenario start.

**Routine-only failures \[Proposed\].** After the repair retry, a plan whose only errors are routine errors still applies, minus those errors. Routine errors are an unresolved set, a missing or invalid slot binding, an unreachable bound zone or a bad startAt. Each actor with an error gets the library routine idle\_here: a wait routine with activity rest, here bound to its first valid bound zone, else the plan's first zone. Code logs routine\_fallback with the validator's errors, and sets the same four flags as a fallback stage.

**Model.** Agent Weaver runs on Claude Opus 5.5 for both scenario setup and stage extensions: model "claude-opus-5-5", with modelTier "complex" as the fallback, and effort always set explicitly (Opus 5.5 defaults to medium). The artifact runtime (contract 0.2.96) accepts only low, medium and high, so the build sets the Weaver's effort to "high" (config AGENT\_MODELS), never max (D-33 closed). The agent log records modelApplied for every Weaver call.

Fixed instructions **\[Proposed\]**: the exact text is WEAVER_INSTRUCTIONS in src/agents/prompts.ts, the one copy (CS6; the spec no longer copies it, a test keeps it so). In short, it decides what is happening at a place and who is there so the scenario fits the dealt tier, as a stage plan within the plan caps. Never narrates, never decides outcomes, never rolls dice. The check-in has its own text, WEAVER_CHECKIN_INSTRUCTIONS. The region brief (Land and regions) belongs to the World builder (WORLD_BUILDER_REGION_INSTRUCTIONS): it describes a region in words for code to draw, and never gives coordinates. In plans the Weaver sees the land in words (WEAVER_VIEW.land: sites, roads, landmarks, what lies beyond) and may stand a top-level place on a free site (`site`) or a road zone along a road (`road`).
