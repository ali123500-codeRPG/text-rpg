# Memory index

One line per topic file. Each file holds one topic, stays under 4 KB, and says what kind it is: **context** (how
things stand), **decision** (what the owner decided, with date and reason) or **working note** (something an agent
found and checked, with how it was checked). Game rules are not here: they are in `docs/build-spec.md`. Balancing
numbers are never here: a file names the setting and where it lives.

- [achievement-design.md](achievement-design.md): decision. Fewer, more distinct achievements; the first time counts.
- [class-unlocks.md](class-unlocks.md): decision. Classes unlock by class level, never by a capstone perk.
- [lore-canon.md](lore-canon.md): decision. What gods, the Thread and essences may and may not be written as.
- [perk-design.md](perk-design.md): decision. What a 40 perk's extra must change; how perks are named.
- [playtest-known-intended.md](playtest-known-intended.md): decision. Playtest outcomes confirmed as intended.
- [process-decisions.md](process-decisions.md): decision. How changes land, where long runs go, why the repo is
  public.
- [ui-decisions.md](ui-decisions.md): decision. Details panels, viewer search, the look, the map rules.
- [history-positions-land-titles.md](history-positions-land-titles.md): context. From linked zones to metres,
  land and titles on a floor plan.
- [history-roads-travel-worlds.md](history-roads-travel-worlds.md): context. NPCs in the world, travel, road
  encounters, carrying a world on.
- [history-doors-cover-walls-map.md](history-doors-cover-walls-map.md): context. Doors, obstacle grades, cover,
  light, breaking walls, the Map.
- [history-senses-and-search.md](history-senses-and-search.md): context. Noise and sight scales, hearing in
  metres, search, senses that grow unasked.
- [history-stealth-and-theft.md](history-stealth-and-theft.md): context. The Stealth tree, Vanish, warnings
  between foes, containers and filching.
- [history-clock-and-action-time.md](history-clock-and-action-time.md): context. The clock, action time, split
  turns, talk time, the order queue.
- [history-perk-system.md](history-perk-system.md): context. Perks on ladders, the early perk rounds, linked
  perks, perk names from the library.
- [history-perk-rounds.md](history-perk-rounds.md): context. Stamina, high, link and payoff perks; the missing
  20 and 40 perks.
- [history-classes-and-starts.md](history-classes-and-starts.md): context. Classes, capstones, learning from
  use, Starts.
- [history-skill-trees.md](history-skill-trees.md): context. Functions and groups, tree access, Fortitude, the
  Tactics tree, Falsehood and Guile.
- [history-xp-and-ratings.md](history-xp-and-ratings.md): context. XP sources, the XP curve, ratings and power,
  group ratings, the combat XP equation, playthrough length.
- [history-growth-and-skill-gain.md](history-growth-and-skill-gain.md): context. Skill marks, growth at
  scenario end, values past 100, augment kinds, burden, flaws at creation.
- [history-all-x-perks.md](history-all-x-perks.md): context. The All-X tree passives and their rounds.
- [history-achievements.md](history-achievements.md): context. Achievements and scars: chains, IDs, tags,
  rewards by type, the grant check, personality points.
- [history-achievement-rounds.md](history-achievement-rounds.md): context. Finds by searching, the novel study
  answers, the trim, the page as threads, XP-only rewards, the level share.
- [history-morale-and-yield.md](history-morale-and-yield.md): context. The morale bar, auras and Battle Cry,
  who a yield reaches, the nerve warning, mercy once down.
- [history-fatigue-and-stamina.md](history-fatigue-and-stamina.md): context. Sleep debt, strain, the Stamina
  skill, the strain rebalance.
- [history-stance-and-fights.md](history-stance-and-fights.md): context. The stance scale, sparring, initiative,
  Dead, wound penalties as percentages.
- [history-defense-and-gear.md](history-defense-and-gear.md): context. Parry, equip requirements, armor,
  breaking things open, guards, the defense row.
- [history-bodies-size-and-age.md](history-bodies-size-and-age.md): context. Body types and races, animals,
  real size and reach, the 3D figure, age.
- [history-npc-generation-and-roles.md](history-npc-generation-and-roles.md): context. NPC memory, templates,
  generation by rank, role and theme, agent-run NPCs, roles.
- [history-speech-and-trade.md](history-speech-and-trade.md): context. Speech rolls, names, asides, talking a
  foe down, speech in character, paying and selling.
- [history-personality-and-uniques.md](history-personality-and-uniques.md): context. Flavor voice, personality
  lines, what provokes, heroes into NPCs, goal-driven uniques, voice acting.
- [history-scenarios-and-quests.md](history-scenarios-and-quests.md): context. Quests, the event roll, scenes
  becoming scenarios, free roam, stakes and Episodes.
- [history-agent-play-and-tone.md](history-agent-play-and-tone.md): context. The autoplay agent, guided mode,
  tone, land and the power ladder, the rank preset check.
- [history-items-and-loot.md](history-items-and-loot.md): context. Loot and Boon, Threadbound items, accessories,
  the items deep dive, the loot pop-up.
- [history-essences.md](history-essences.md): context. Passing essences on, template essences, bested foes and
  extraction, an essence for every NPC.
- [history-play-screen-and-motion.md](history-play-screen-and-motion.md): context. First displays, the play
  screen review, motion, the Character page, the action deck.
- [history-look-viewer-sound-and-lore.md](history-look-viewer-sound-and-lore.md): context. The library viewer,
  class flavor and lore, narration length, icons, sound, the look, show don't tell.
- [history-code-checks-and-testing.md](history-code-checks-and-testing.md): context. Scale keys, bug reports,
  code scans, the review of past fixes, test safety nets, the ten-slice code check.
- [history-reviews-and-models.md](history-reviews-and-models.md): context. The first playtest review, speed,
  which model each agent uses, the rule reviews, open parked items.
- [working-notes-code.md](working-notes-code.md): working note. Traps in the code that tests do not catch.
- [working-notes-git.md](working-notes-git.md): working note. Branching, merges and pushes in this repo.
- [working-notes-testing.md](working-notes-testing.md): working note. How `npm test` runs; checking behaviour, motion and playtests.

The `history-` files are topic histories: which questions each design topic answered, what replaced what, and
which PR built it. They moved here from the Claude project's in-app memory in twelve slices. What stays in
that memory is provider-only: page links, thread names, publishing notes and study notes on novels. Where a
topic has no history entry, the spec's "Deferred items" table and the merged PRs on GitHub are its record.
