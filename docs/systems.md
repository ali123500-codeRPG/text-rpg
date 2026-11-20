# Systems map

Which files, spec sections, decision history and tests belong to each game system, so a task on one system reads only
that system. The code is layered by kind (`engine`, `ruleset`, `library`, `views`, `ui`) and each folder imports the
others, so a system cuts across folders: this map is how to find it.

How to use it for a task:

1. Find the system below; `npm run spec -- --file docs/systems.md gear` prints just one. Read its spec sections with
   `npm run spec -- "<heading>"`, or find where a term or file is ruled with `npm run spec -- --grep <text>`. Look up
   an ID with `npm run spec -- BG-12` (also D-n, OQ-n).
2. Read its history files only for why a rule is the way it is.
3. While working, run its nearest tests: `npm run test:near` (the files you changed) or `npm run test:near -- <key>`.
   Then run the full checks before pushing: `npm run typecheck`, `npm test`, `npm run build`.

A new source file goes on a system's Code list in the same PR (`tests/unit/systems-map.test.ts` fails until it
does). A file that serves two systems is listed under both. The Spec line names headings as `npm run spec` matches
them; the test checks each one still exists.

## foundations: shared ground every system uses

Config (every balancing number), ordered scales, typed IDs, the random roller, shared types, the library loader and its
one big data file, word helpers.

- Spec: "1. How to read this spec", "2. Core principle", "Game state model", "9. Types", "Appendix: library rows"
- History: [process-decisions.md](memory/process-decisions.md), [working-notes-code.md](memory/working-notes-code.md)
- Code:
  - `src/config.ts`
  - `src/ids.ts`
  - `src/library/data.ts`
  - `src/library/index.ts`
  - `src/library/tableIds.ts`
  - `src/rng.ts`
  - `src/ruleset/index.ts`
  - `src/scales.ts`
  - `src/types/actor.ts`
  - `src/types/core.ts`
  - `src/types/hidden.ts`
  - `src/types/index.ts`
  - `src/types/library.ts`
  - `src/types/ruleset.ts`
  - `src/types/state.ts`
  - `src/words.ts`

## turn: the turn engine

One turn from submitted intent to resolved events: the action dispatcher, effects, encounter modes, the order queue, the
turn checker, and what happened in a scenario.

- Spec: "Role, goal and hard rules", "Architecture: one turn", "Action economy", "Resolution engine", "Encounter modes",
  "Turn checker", "Engine details (CS5, CS7)", "Case tests"
- History: [history-code-checks-and-testing.md](memory/history-code-checks-and-testing.md),
  [working-notes-testing.md](memory/working-notes-testing.md)
- Code:
  - `src/agents/game.ts`
  - `src/engine/effects.ts`
  - `src/engine/happened.ts`
  - `src/engine/index.ts`
  - `src/engine/merge.ts`
  - `src/engine/mode.ts`
  - `src/engine/orderQueue.ts`
  - `src/engine/resolve.ts`
  - `src/engine/types.ts`
  - `src/save/turnCheck.ts`
  - `src/ui/deck.ts`

## time: the clock and action time

The game clock, how long each action takes, waiting and busy actors, sleep timing.

- Spec: "Action time", "Game clock"
- History: [history-clock-and-action-time.md](memory/history-clock-and-action-time.md)
- Code:
  - `src/engine/busy.ts`
  - `src/engine/comingNear.ts`
  - `src/engine/sleep.ts`
  - `src/ruleset/actionTime.ts`
  - `src/time.ts`
  - `src/ui/doing.ts`
  - `src/ui/timeOfDay.ts`

## combat: fights

Attacks and defences, the hit table, engagement, stance, feints, initiative, sparring, chases, combat rating.

- Spec: "4. Resolution", "Building the hit table", "Defense", "Damage flow and the roll packet"
- History: [history-stance-and-fights.md](memory/history-stance-and-fights.md),
  [history-defense-and-gear.md](memory/history-defense-and-gear.md)
- Code:
  - `src/engine/chase.ts`
  - `src/engine/combatLevel.ts`
  - `src/engine/engagement.ts`
  - `src/engine/feint.ts`
  - `src/engine/finish.ts`
  - `src/engine/flatFooted.ts`
  - `src/engine/held.ts`
  - `src/engine/ruses.ts`
  - `src/engine/spar.ts`
  - `src/library/contests.ts`
  - `src/ruleset/bane.ts`
  - `src/ruleset/expect.ts`
  - `src/ruleset/hits.ts`

## body: bodies and health

HP, the health track, body parts and wounds, healing, body types, races, size and age, the 3D figure.

- Spec: "Part 3 — HP system", "Body type database"
- History: [history-bodies-size-and-age.md](memory/history-bodies-size-and-age.md)
- Code:
  - `src/engine/heal.ts`
  - `src/library/bodySize.ts`
  - `src/library/figureModels.ts`
  - `src/library/raceIds.ts`
  - `src/ruleset/age.ts`
  - `src/ruleset/body.ts`
  - `src/ui/fell.ts`
  - `src/ui/figure3d.ts`
  - `src/ui/healing.ts`

## gear: items, inventory and equipment

Items and their data, inventory, slots and grips, weapons, armor and shields, containers, loot, value and quality,
breaking things, Threadbound items.

- Spec: "Part 5 — Gear", "Weapons, armor and shields"
- History: [history-defense-and-gear.md](memory/history-defense-and-gear.md),
  [history-items-and-loot.md](memory/history-items-and-loot.md)
- Code:
  - `src/engine/breakThrough.ts`
  - `src/engine/breakage.ts`
  - `src/engine/containers.ts`
  - `src/engine/gear.ts`
  - `src/engine/handover.ts`
  - `src/library/gearScale.ts`
  - `src/library/itemIds.ts`
  - `src/ruleset/breaking.ts`
  - `src/ruleset/gear.ts`
  - `src/ruleset/quality.ts`
  - `src/ruleset/requirements.ts`
  - `src/ruleset/slots.ts`
  - `src/ruleset/threadboundItems.ts`
  - `src/ruleset/value.ts`
  - `src/ruleset/worn.ts`
  - `src/types/items.ts`
  - `src/ui/compare.ts`
  - `src/ui/itemIcons.ts`
  - `src/ui/loot.ts`

## skills: skills, XP and character growth

Skills and trees, access, functions, marks and skill gain, growth, XP and levels, ratings and power, classes and Starts,
character creation rules.

- Spec: "3. Character model", "5. Progression", "6. Skill improvement algorithm"
- History: [history-xp-and-ratings.md](memory/history-xp-and-ratings.md),
  [history-growth-and-skill-gain.md](memory/history-growth-and-skill-gain.md),
  [history-skill-trees.md](memory/history-skill-trees.md),
  [history-classes-and-starts.md](memory/history-classes-and-starts.md), [class-unlocks.md](memory/class-unlocks.md)
- Code:
  - `src/engine/growth.ts`
  - `src/engine/nonCombat.ts`
  - `src/engine/tacticsMarks.ts`
  - `src/engine/xp.ts`
  - `src/library/classIds.ts`
  - `src/library/functionIds.ts`
  - `src/library/functionNames.ts`
  - `src/library/skillIds.ts`
  - `src/library/skillNames.ts`
  - `src/library/startIds.ts`
  - `src/library/treeIds.ts`
  - `src/ruleset/access.ts`
  - `src/ruleset/burdenTotal.ts`
  - `src/ruleset/improve.ts`
  - `src/ruleset/levels.ts`
  - `src/ruleset/ratings.ts`
  - `src/ruleset/skillCap.ts`
  - `src/ui/classTree.ts`
  - `src/ui/creation.ts`
  - `src/ui/power.ts`

## perks: perks

Perk rows and ladders, perk moves, links, stacking, boost perks, the generated perks doc (docs/perks.md: edit its
source, then `npm run perks-doc`).

- Spec: "5. Progression"
- History: [history-perk-system.md](memory/history-perk-system.md),
  [history-perk-rounds.md](memory/history-perk-rounds.md), [history-all-x-perks.md](memory/history-all-x-perks.md),
  [perk-design.md](memory/perk-design.md)
- Code:
  - `src/engine/perkMarks.ts`
  - `src/engine/perkMoves.ts`
  - `src/engine/playDead.ts`
  - `src/library/allPerks.ts`
  - `src/library/boostPerks.ts`
  - `src/library/builtPerks.ts`
  - `src/library/perkIds.ts`
  - `src/library/perkLinks.ts`
  - `src/library/perkThemes.ts`
  - `src/library/perks.ts`
  - `src/ruleset/allSteps.ts`
  - `src/ruleset/perkLinks.ts`
  - `src/ruleset/perks.ts`
  - `src/ruleset/stacking.ts`
  - `src/ui/perkDoc.ts`
  - `src/ui/perks.ts`

## essences: essences

Essence rows, template lists, the appearance and quality rolls, slots, offers and removal. The rules are the
**Essences** item under "6. Skill improvement algorithm".

- Spec: "6. Skill improvement algorithm"
- History: [history-essences.md](memory/history-essences.md)
- Code:
  - `src/engine/essence.ts`
  - `src/engine/extract.ts`
  - `src/library/essenceIds.ts`
  - `src/ui/essences.ts`

## achievements: achievements

Achievement chains, the grant check, rewards, scars, the report card, banes.

- Spec: "5. Progression"
- History: [history-achievements.md](memory/history-achievements.md),
  [history-achievement-rounds.md](memory/history-achievement-rounds.md),
  [achievement-design.md](memory/achievement-design.md)
- Code:
  - `src/engine/feats.ts`
  - `src/library/achievementIds.ts`
  - `src/ruleset/achChains.ts`
  - `src/ruleset/achRewards.ts`
  - `src/ruleset/bane.ts`
  - `src/ruleset/reportCard.ts`
  - `src/ui/achievementThreads.ts`

## morale: morale and fatigue

The morale bar, nerve, fear and yielding, auras and Battle Cry, steadying, fatigue, stamina and sleep debt.

- Spec: "Health track"
- History: [history-morale-and-yield.md](memory/history-morale-and-yield.md),
  [history-fatigue-and-stamina.md](memory/history-fatigue-and-stamina.md)
- Code:
  - `src/engine/auras.ts`
  - `src/engine/fatigue.ts`
  - `src/engine/morale.ts`
  - `src/engine/nerve.ts`
  - `src/engine/steady.ts`
  - `src/engine/yield.ts`
  - `src/library/auras.ts`
  - `src/ruleset/fatigue.ts`
  - `src/ruleset/morale.ts`

## senses: perception and stealth

Sight and hearing in metres, noise, making out, stealth, searching, alarms, suspicion, secrets, hunches, trails,
filching.

- Spec: "Explore mode", "Information model"
- History: [history-senses-and-search.md](memory/history-senses-and-search.md),
  [history-stealth-and-theft.md](memory/history-stealth-and-theft.md)
- Code:
  - `src/engine/filch.ts`
  - `src/engine/hunches.ts`
  - `src/engine/makeOut.ts`
  - `src/engine/secrets.ts`
  - `src/engine/suspicion.ts`
  - `src/engine/trail.ts`
  - `src/engine/warnings.ts`
  - `src/land/sight.ts`
  - `src/minds/state.ts`
  - `src/perception/index.ts`
  - `src/perception/madeOut.ts`
  - `src/perception/noise.ts`
  - `src/perception/sight.ts`
  - `src/ui/stealth.ts`

## social: speech, trade and relations

Speech rolls, offers and standing down, trade and paying, relations, personality, gods, blessings.

- Spec: "Dialogue turn", "Dialogue input"
- History: [history-speech-and-trade.md](memory/history-speech-and-trade.md),
  [history-personality-and-uniques.md](memory/history-personality-and-uniques.md)
- Code:
  - `src/engine/offer.ts`
  - `src/engine/relations.ts`
  - `src/engine/speech.ts`
  - `src/engine/trade.ts`
  - `src/library/godIds.ts`
  - `src/library/serviceIds.ts`
  - `src/ruleset/blessings.ts`
  - `src/ruleset/personality.ts`
  - `src/ruleset/pressure.ts`
  - `src/ui/ideaLeans.ts`
  - `src/ui/personality.ts`

## space: positions, plans and the map

Positions in real metres, floor plans and their drawing, walls, doors and barriers, cover, light, paths, heights,
furniture, ground items; the Map and minimap screens (see the `rpg-map` skill).

- Spec: "Reach, range, cover and light", "Game state model"
- History: [history-positions-land-titles.md](memory/history-positions-land-titles.md),
  [history-doors-cover-walls-map.md](memory/history-doors-cover-walls-map.md)
- Code:
  - `src/engine/barriers.ts`
  - `src/engine/breakThrough.ts`
  - `src/engine/follow.ts`
  - `src/engine/furniture.ts`
  - `src/engine/ground.ts`
  - `src/engine/position.ts`
  - `src/engine/speed.ts`
  - `src/library/layouts.ts`
  - `src/plan/clutter.ts`
  - `src/plan/draw.ts`
  - `src/plan/fog.ts`
  - `src/plan/geom.ts`
  - `src/plan/holes.ts`
  - `src/plan/light.ts`
  - `src/plan/line.ts`
  - `src/plan/path.ts`
  - `src/plan/stamp.ts`
  - `src/plan/walls.ts`
  - `src/plan/where.ts`
  - `src/ruleset/objectCover.ts`
  - `src/scenario/geometry.ts`
  - `src/scenario/heights.ts`
  - `src/ui/map.ts`
  - `src/ui/mapCheck.ts`
  - `src/ui/mapData.ts`
  - `src/ui/mapPlan.ts`
  - `src/ui/minimap.ts`

## world: land, roads and travel

Land generation, regions and ways, roads and travel, the people of the world, world lore.

- Spec: "Land and regions", "Travel", "World, tone and the power ladder", "Agent World builder"
- History: [history-roads-travel-worlds.md](memory/history-roads-travel-worlds.md),
  [lore-canon.md](memory/lore-canon.md)
- Code:
  - `src/agents/worldLore.ts`
  - `src/engine/travel.ts`
  - `src/land/brief.ts`
  - `src/land/edge.ts`
  - `src/land/generate.ts`
  - `src/land/roster.ts`
  - `src/land/sight.ts`
  - `src/scenario/ways.ts`
  - `src/ui/landSvg.ts`

## scenarios: scenarios and quests

The scenario director, stages and triggers, quests, scenario setup and validation, the scenario end and its gains.

- Spec: "Scenarios", "Scenario setup", "Stage extension", "Agent Weaver", "Opening narration"
- History: [history-scenarios-and-quests.md](memory/history-scenarios-and-quests.md)
- Code:
  - `src/engine/quests.ts`
  - `src/engine/scenarioEnd.ts`
  - `src/engine/triggers.ts`
  - `src/scenario/apply.ts`
  - `src/scenario/checkin.ts`
  - `src/scenario/director.ts`
  - `src/scenario/fixtures.ts`
  - `src/scenario/index.ts`
  - `src/scenario/stage.ts`
  - `src/scenario/triggers.ts`
  - `src/scenario/validate.ts`
  - `src/ui/gains.ts`

## npcs: NPCs and their minds

NPC minds, routines and goals, memory, templates and spawning, uniques and echoes, NPC perk moves, fight rules.

- Spec: "Who thinks for each actor", "Goal-driven uniques", "Routines"
- History: [history-npc-generation-and-roles.md](memory/history-npc-generation-and-roles.md),
  [history-personality-and-uniques.md](memory/history-personality-and-uniques.md)
- Code:
  - `src/engine/goals.ts`
  - `src/engine/memory.ts`
  - `src/engine/npcPerkMoves.ts`
  - `src/library/echo.ts`
  - `src/library/fightRules.ts`
  - `src/library/npcLayerIds.ts`
  - `src/library/spawn.ts`
  - `src/library/templateIds.ts`
  - `src/library/uniques.ts`
  - `src/minds/bank.ts`
  - `src/minds/index.ts`
  - `src/minds/routines.ts`
  - `src/minds/state.ts`
  - `src/views/tactics.ts`

## agents: the game's AI agents

Prompts, schemas and calls for the Parser, Planner, Responder, Voice, Narrator, Weaver and director; the views each
agent is given; leak prevention; autopilot.

- Spec: "Agent Parser", "Agent Planner", "Agent Responder", "Agent Voice", "Agent Narrator", "Hidden state persistence",
  "Latency and cost", "Leak prevention, validation and failure handling"
- History: [history-agent-play-and-tone.md](memory/history-agent-play-and-tone.md),
  [history-reviews-and-models.md](memory/history-reviews-and-models.md)
- Code:
  - `src/agents/answering.ts`
  - `src/agents/autopilot.ts`
  - `src/agents/call.ts`
  - `src/agents/client.ts`
  - `src/agents/clock.ts`
  - `src/agents/crossroads.ts`
  - `src/agents/director.ts`
  - `src/agents/format.ts`
  - `src/agents/game.ts`
  - `src/agents/index.ts`
  - `src/agents/legality.ts`
  - `src/agents/narration.ts`
  - `src/agents/prompts.ts`
  - `src/agents/schema.ts`
  - `src/agents/wrappers.ts`
  - `src/types/agents.ts`
  - `src/types/views.ts`
  - `src/views/index.ts`

## save: saves and stored data

Save and load, the store, world and universe saves, replay, bug reports the game files, the hall of fame. The owner's
saves are off-limits (AGENTS.md rule 1).

- Spec: "Part 4 — Save data model"
- History: [process-decisions.md](memory/process-decisions.md)
- Code:
  - `src/agents/fame.ts`
  - `src/save/bugs.ts`
  - `src/save/checks.ts`
  - `src/save/index.ts`
  - `src/save/pages.ts`
  - `src/save/replay.ts`
  - `src/save/sends.ts`
  - `src/save/store.ts`
  - `src/save/universe.ts`
  - `src/save/world.ts`
  - `src/ui/fame.ts`

## play-ui: the play and creation screens

Every page of the game page: layout, the sheet and Character page, the action deck, pop-ups, motion, sound, creation,
styles, the fake game the smoke tests drive. Any UI change uses the five design skills (docs/instructions.md section 7).

- Spec: "Play screen", "Play screen motion", "Game sound"
- History: [history-play-screen-and-motion.md](memory/history-play-screen-and-motion.md),
  [ui-decisions.md](memory/ui-decisions.md),
  [history-look-viewer-sound-and-lore.md](memory/history-look-viewer-sound-and-lore.md)
- Code:
  - `src/library/names.ts`
  - `src/types/game.ts`
  - `src/ui/achievementThreads.ts`
  - `src/ui/app.ts`
  - `src/ui/audio.d.ts`
  - `src/ui/autopilot.ts`
  - `src/ui/bugs.ts`
  - `src/ui/charsheet.ts`
  - `src/ui/classTree.ts`
  - `src/ui/compare.ts`
  - `src/ui/creation.ts`
  - `src/ui/deck.ts`
  - `src/ui/deckView.ts`
  - `src/ui/doing.ts`
  - `src/ui/essences.ts`
  - `src/ui/fakeGame.ts`
  - `src/ui/fakeStages.ts`
  - `src/ui/fame.ts`
  - `src/ui/fell.ts`
  - `src/ui/figure3d.ts`
  - `src/ui/furnitureIcons.ts`
  - `src/ui/gains.ts`
  - `src/ui/gm.ts`
  - `src/ui/healing.ts`
  - `src/ui/iconArt.ts`
  - `src/ui/ideaLeans.ts`
  - `src/ui/itemIcons.ts`
  - `src/ui/kit.ts`
  - `src/ui/landSvg.ts`
  - `src/ui/loot.ts`
  - `src/ui/main.ts`
  - `src/ui/map.ts`
  - `src/ui/mapCheck.ts`
  - `src/ui/mapData.ts`
  - `src/ui/mapPlan.ts`
  - `src/ui/minimap.ts`
  - `src/ui/motion.ts`
  - `src/ui/pages.ts`
  - `src/ui/perks.ts`
  - `src/ui/personality.ts`
  - `src/ui/play.ts`
  - `src/ui/pop.ts`
  - `src/ui/power.ts`
  - `src/ui/republish.ts`
  - `src/ui/rpgVoice.ts`
  - `src/ui/sfx.ts`
  - `src/ui/sheet.ts`
  - `src/ui/sound.ts`
  - `src/ui/stealth.ts`
  - `src/ui/styles.css`
  - `src/ui/suggest.ts`
  - `src/ui/timeOfDay.ts`
  - `src/ui/voiceSamples.ts`

## library-viewer: the library viewer

The second page: the game's libraries as the code sees them, the equations prose, the Actions and Stacking tabs. Must
also work on phones.

- Spec: "Appendix: library rows"
- History: [history-look-viewer-sound-and-lore.md](memory/history-look-viewer-sound-and-lore.md),
  [ui-decisions.md](memory/ui-decisions.md)
- Code:
  - `src/library/actions.ts`
  - `src/ruleset/equations.ts`
  - `src/ruleset/modSources.ts`
  - `src/ui/libraryTones.ts`
  - `src/ui/libraryViewer.css`
  - `src/ui/libraryViewer.ts`
  - `src/ui/perkDoc.ts`
