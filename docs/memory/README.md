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
- [process-decisions.md](process-decisions.md): decision. How changes land, where long runs go, why the repo is public.
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
- [working-notes-code.md](working-notes-code.md): working note. Traps in the code that tests do not catch.
- [working-notes-git.md](working-notes-git.md): working note. Branching, merges and pushes in this repo.
- [working-notes-testing.md](working-notes-testing.md): working note. Checking behaviour, motion and playtests.

The `history-` files are topic histories: which questions each design topic answered, what replaced what, and
which PR built it. They move here from the Claude project's in-app memory slice by slice; two slices are in
(world and places; senses, stealth and action time). Until a topic's slice moves, the spec's "Deferred items"
table and the merged PRs on GitHub are its record.
