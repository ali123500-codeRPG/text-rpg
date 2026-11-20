# Glossary

The IDs, names and abbreviations used across the repo, the PRs and the owner's questions, each in one or two lines
with where its full meaning lives. A term's rules are never defined here.

## Item IDs

- **D-n**: a parked ("deferred") item. One row each in the "Deferred items" table (`docs/spec/deferred-items.md`),
  with its options and a status. The table doubles as the decision log.
- **BG-n**: a bug. One row each in the spec's "Bug log" (`docs/spec/bug-log.md`). The fix is described in
  `docs/bug-fix-log.md`.
- **OQ-n**: an open question from the original build. In the spec's "Open questions".
- **Question IDs** (RH3, TL8, BF45): two letters and a number. The letters name one questionnaire the owner answered;
  "TL8 a" means option a of question TL8. They appear in the spec as the source of a decision. Some share their
  letters with a library prefix (ST, SK, IT): the context tells which is meant. Pick new letters that are free of
  both.
- **M-nn**: a play screen motion rule. Spec, "### Play screen motion".
- **MAP-nn**: a map rule. `.agents/skills/rpg-map/SKILL.md`.
- **GF-nn**: a game-feel rule. `.agents/skills/game-feel/SKILL.md`.
- **Numbers are never reused.** An answered question or a retired item keeps its ID.

## Library IDs

Every library entry's ID is a type prefix and a number. Code names them only through constant tables in
`src/library/*Ids.ts`. The common ones: **SK** skill, **FN** function, **GR** group, **TR** skill tree, **CL** class,
**PK** perk, **AC** achievement, **IT** item, **ES** essence, **GD** god, **RC** race, **BT** body type, **TP** NPC
template, **SV** service, **ST** start, **RL** body-part role, **AM** attack mode, **DU** clock row, **ZK** zone kind.
The full list is in the spec under "Typed IDs".

## Rolls and scales

- **Tier**: the outcome of a roll. By name only, never by number: Critical Failure, Failure, Near Miss, Success,
  Great Success, Critical Success. Past either end a tier takes a plus or a minus.
- **Scale key**: the stable key of one level on an ordered scale (light, cover, noise, stance and so on). All scales
  are in `src/scales.ts`. Code compares positions, saves store keys, and display names live only in that table.
- **True skill, effective skill**: a skill's lasting value, and its value after the moment's modifiers.
- **50 / 75 / 100**: the reference points of the skill scale. `docs/instructions.md` section 3.
- **Function, group**: a skill lists narrow functions (what it can be rolled for); each function sits in one broad
  group. A skill is never the same thing as its function or group.
- **Stand-in**: a skill used in place of the one a check asks for, at a share.
- **Time factor**: what multiplies an action's seconds for one actor. Spec, "Time factor".
- **Posture, Stealthy**: an actor is Open or Stealthy. "Sneaking" in everyday speech can mean the Stealthy posture,
  the sneak action or the Sneaking skill; ask which when a request does not say.

## Character words

- **Tag / Flaw**: a skill the character is gifted in / struggles to improve. Chosen at creation.
- **Perk**: a gain bought with a perk point. "20 perk", "40 perk": the perk at that milestone of a skill's ladder.
- **All-50**: a perk for having several skills of one tree at 50.
- **Capstone**: the perk at a class's top level.
- **Quirk**: a negative perk.
- **Curse**: a harmful status. **Bane**: the bonus an achievement gives against one race or body type. **Scar**: a
  negative achievement. Flaw, quirk, curse, bane and scar are taken; do not use them for anything else.
- **Burden**: the brake on skill growth, one number that rises with the character's Total of skill.
- **Essence**: a package of true skill taken from a bested foe and slotted into the character. Not part of the
  Thread (`docs/memory/lore-canon.md`).
- **Threadbound**: a kind of item bound to its bearer. It never breaks, and it has its own unlocks.
- **Body type**: the shape of a body and its parts (was "creature"). **Role**: what a body part does (grip, move,
  sense). Code reads parts and roles; it never assumes hands.
- **Health levels**: Unhurt to Dead. There is no "Down": use Incapacitated.
- **Defeated**: down, yielding, morale broken or fleeing. Same meaning for the player and for foes.

## World words

- **The Thread**: the lore of XP. XP is "Thread".
- **Echo**: a past hero who walks the world again as an NPC.
- **Universe, world, story**: the save's layers. A world outlives its characters; a story is one playthrough.
- **Zone, title**: a named place. Since the floor plan, a zone is only the title of a place; code and older text
  still say `zone`. Never a measure of distance.
- **Scenario**: one planned stretch of play (was "scene").
- **Stance**: how one side stands toward another, from hostile upward.

## The game's agents

- **Parser**: reads what the player typed into an action.
- **Narrator**: tells what the code resolved.
- **Voice**, **Responder**: speak for a character who is addressed; the Responder for one with an agenda.
- **Planner**: decides what an NPC tries next.
- **Weaver**: plans stories and scenarios. **World builder**: makes the world's land and places.

Which model each uses is in `CONFIG.AGENT_MODELS`. None of them decides a number or a fact.

## Working words

- **The owner**: the project's designer and only player. In game rules text, "owner" can also mean whoever holds a
  perk or an item; the sentence tells which.
- **[Proposed]**: built as written, not yet confirmed by the owner, and kept easy to change.
- **Placeholder**: a balancing value expected to change. Marked as such in `src/config.ts`.
- **Lever**: a named balancing setting.
- **Parked**: put off by the owner, with a D-n. **Banked**: content written into the library but kept out of the
  game until its parked item is decided (for a perk, `bankedAs` on its write-up).
- **Sibling**: another action, actor kind or code path that follows the same rule as the one being changed.
- **Completeness rows**: rows in the test tables that list every action and actor kind; a new one must add its row
  or the checks fail. **Guard test**: a test that bans an old pattern after a change of meaning. **Whole-turn
  test**: one full turn through the game with stand-in agents, for a change to a view, an agent call or narration.
  All three are asked for by the PR template; spec, "TQ5".
- **Replay set**: recorded agent answers from playtests, played again through today's code (`tests/replay`).
  **Soak**: long runs on saved test worlds (`tests/soak`). **Parser test set**: real-model checks of the Parser
  (`tests/parser-eval`).
- **The hub**: the owner's Questions hub. `tools/questions-hub/README.md`.
- **Decision card**: a one-question prompt with options, in the Claude app.
- **Thread** (lower case, in process notes): one piece of work in the Claude app. Not the lore word.
  **Coordinator**: the Claude that talks with the owner in the project chat and starts threads.
- **Round**: one batch of questions added to a questionnaire. **Kind**: a questionnaire's own label for a question
  (shown as a small pill), with a colour.
- **AGG**: "A Geek's Guide", the web serial whose d100 roll-high tiers the roll system started from.
- **Library viewer**: the page that shows the game's libraries as the code sees them.
