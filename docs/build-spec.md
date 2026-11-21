# Text RPG Framework — Build Spec

Nov 6, 2026 · @Ali

This spec started as v0.6 for the first build: the rules framework (Part 1), the turn engine with Explore mode, scenario setup and the actor-control review (Part 2), the HP and body-part system (Part 3), the save data model (Part 4) and gear (Part 5). It has been kept up to date by PR since: a PR that changes a rule updates it here. Open questions and deferred items wait for Ali's call; check-on-release items are settled for now and get reviewed once the game is played. The game is for personal use only: one player, published only as a Claude artifact, with no public release.

The spec lives in one file per topic under `docs/spec/`, listed below in reading order. Each topic file starts
with its heading as it stood here, so "the spec's ### Play screen" is `docs/spec/part-2-turn-engine/play-screen.md`.
Read only the topics a task needs: `npm run spec` lists every heading with its file and size, `npm run spec --
"<heading>"` prints one section, `npm run spec -- <ID>` prints one row or rule (BG-n, D-n, OQ-n, MAP-n …), and
`npm run spec -- --grep <text>` says which sections mention a term or a source file. `docs/systems.md` maps each
game system to its topics, code and tests. A new topic is a new file here plus its line below.

## Part 1 — Rules framework (from v0.1)

- [1. How to read this spec](spec/part-1-rules/how-to-read-this-spec.md)
- [2. Core principle](spec/part-1-rules/core-principle.md)
- [3. Character model](spec/part-1-rules/character-model.md)
- [4. Resolution](spec/part-1-rules/resolution.md)
- [5. Progression](spec/part-1-rules/progression.md)
- [6. Skill improvement algorithm](spec/part-1-rules/skill-improvement-algorithm.md)
- [7. Player commands [Proposed]](spec/part-1-rules/player-commands.md)

## Part 2 — Turn engine (rev. 2 + Explore mode + scenario setup + actor control)

- [Role, goal and hard rules](spec/part-2-turn-engine/role-goal-and-hard-rules.md)
- [Architecture: one turn](spec/part-2-turn-engine/architecture-one-turn.md)
- [Action economy](spec/part-2-turn-engine/action-economy.md)
- [Action time](spec/part-2-turn-engine/action-time.md)
- [Game state model](spec/part-2-turn-engine/game-state-model.md)
- [Information model](spec/part-2-turn-engine/information-model.md)
- [Who thinks for each actor](spec/part-2-turn-engine/who-thinks-for-each-actor.md)
- [Agent Parser](spec/part-2-turn-engine/agent-parser.md)
- [Agent Planner](spec/part-2-turn-engine/agent-planner.md)
- [Goal-driven uniques](spec/part-2-turn-engine/goal-driven-uniques.md)
- [Agent Responder](spec/part-2-turn-engine/agent-responder.md)
- [Agent Voice](spec/part-2-turn-engine/agent-voice.md)
- [Resolution engine](spec/part-2-turn-engine/resolution-engine.md)
- [Agent Narrator](spec/part-2-turn-engine/agent-narrator.md)
- [Hidden state persistence](spec/part-2-turn-engine/hidden-state-persistence.md)
- [Encounter modes](spec/part-2-turn-engine/encounter-modes.md)
- [Game clock](spec/part-2-turn-engine/game-clock.md)
- [Travel](spec/part-2-turn-engine/travel.md)
- [Land and regions](spec/part-2-turn-engine/land-and-regions.md)
- [Scenarios](spec/part-2-turn-engine/scenarios.md)
- [Vows](spec/part-2-turn-engine/vows.md)
- [Scenario setup](spec/part-2-turn-engine/scenario-setup.md)
- [Stage extension](spec/part-2-turn-engine/stage-extension.md)
- [World, tone and the power ladder](spec/part-2-turn-engine/world-tone-and-the-power-ladder.md)
- [Agent World builder](spec/part-2-turn-engine/agent-world-builder.md)
- [Agent Weaver](spec/part-2-turn-engine/agent-weaver.md)
- [Agent Chronicler](spec/part-2-turn-engine/agent-chronicler.md)
- [Agent Witness](spec/part-2-turn-engine/agent-witness.md)
- [Opening narration](spec/part-2-turn-engine/opening-narration.md)
- [Explore mode](spec/part-2-turn-engine/explore-mode.md)
- [Latency and cost](spec/part-2-turn-engine/latency-and-cost.md)
- [Leak prevention, validation and failure handling](spec/part-2-turn-engine/leak-prevention-validation-and-failure-handling.md)
- [Play screen](spec/part-2-turn-engine/play-screen.md)
- [Play screen motion](spec/part-2-turn-engine/play-screen-motion.md)
- [Map](spec/part-2-turn-engine/map.md)
- [Game sound](spec/part-2-turn-engine/game-sound.md)
- [Turn checker](spec/part-2-turn-engine/turn-checker.md)
- [Case tests](spec/part-2-turn-engine/case-tests.md)
- [Deliverables and acceptance criteria](spec/part-2-turn-engine/deliverables-and-acceptance-criteria.md)
- [Engine details (CS5, CS7)](spec/part-2-turn-engine/engine-details-cs5-cs7.md)

## Part 3 — HP system with partial-damage penalties

- [Chosen design: health track + body parts](spec/part-3-health/chosen-design-health-track-body-parts.md)
- [Total HP](spec/part-3-health/total-hp.md)
- [Health track](spec/part-3-health/health-track.md)
- [Body parts](spec/part-3-health/body-parts.md)
- [Building the hit table](spec/part-3-health/building-the-hit-table.md)
- [Body type database](spec/part-3-health/body-type-database.md)
- [Weapons, armor and shields](spec/part-3-health/weapons-armor-and-shields.md)
- [Defense](spec/part-3-health/defense.md)
- [Reach, range, cover and light](spec/part-3-health/reach-range-cover-and-light.md)
- [Damage flow and the roll packet](spec/part-3-health/damage-flow-and-the-roll-packet.md)

## Part 4 — Save data model

How the game saves and loads. Part 4 replaces the single GameState document as the saved shape. Items marked \[Proposed\] follow the convention above: built as written, easy to change. Values marked placeholder are config, not constants. This part changes no ruleset number. A scenario start saves inside its triggering turn's normal save: one commit, no new save path. Backups (section 11) are unchanged.

- [1. Principles](spec/part-4-save/principles.md)
- [2. What is saved](spec/part-4-save/what-is-saved.md)
- [3. Raw and derived fields](spec/part-4-save/raw-and-derived-fields.md)
- [4. Actor sheet](spec/part-4-save/actor-sheet.md)
- [5. Locations and story memory](spec/part-4-save/locations-and-story-memory.md)
- [6. Persistence](spec/part-4-save/persistence.md)
- [7. Versioning and migration](spec/part-4-save/versioning-and-migration.md)
- [8. Integrity](spec/part-4-save/integrity.md)
- [9. Types](spec/part-4-save/types.md)
- [10. Save and load flow](spec/part-4-save/save-and-load-flow.md)
- [11. Backups and playing from several PCs](spec/part-4-save/backups-and-playing-from-several-pcs.md)

## Part 5 — Gear

- [1. Principles](spec/part-5-gear/principles.md)
- [2. When an effect is active](spec/part-5-gear/when-an-effect-is-active.md)
- [3. What an effect can do](spec/part-5-gear/what-an-effect-can-do.md)
- [4. Slots, grips and gear ops](spec/part-5-gear/slots-grips-and-gear-ops.md)
- [5. Weapons](spec/part-5-gear/weapons.md)
- [6. Armor, shields and the damage step](spec/part-5-gear/armor-shields-and-the-damage-step.md)
- [7. Item data](spec/part-5-gear/item-data.md)
- [8. Agents](spec/part-5-gear/agents.md)
- [9. Threadbound items (D-218)](spec/part-5-gear/threadbound-items-d-218.md)

## Logs and appendix

- [Deferred items](spec/deferred-items.md); finished rows: [archive](spec/deferred-items-archive.md); parked perk ideas: [Perk ideas](spec/perk-ideas.md); parked achievement ideas: [Achievement ideas](spec/achievement-ideas.md); parked vow and pledge ideas: [Vow and pledge ideas](spec/vow-ideas.md)
- [Bug log](spec/bug-log.md); closed rows: [archive](spec/bug-log-archive.md)
- [Check on release](spec/check-on-release.md)
- [Open questions](spec/open-questions.md)
- [Appendix: library rows](spec/library-rows.md)
