# History: NPCs in the world, roads, travel and worlds

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("### Travel", "### Land and regions", "Routines through the day" under "### Game state model"); the numbers are
in `src/config.ts`. Question IDs name the owner's answers on the Questions hub.

- **NPCs stay in the world (10-13/11/2026; NW1-NW22, RT1-RT9).** There is no off-stage exit. An NPC always stands
  in a real place, and leaving a scene means its routine takes over from the agent. NPCs are never hidden from
  the planner to make a story hang together: what the planner is told gets fixed. Built in #541, #544, #547,
  #555, #559, #574 and #578: the planner sees the world by place, NPCs walk and never jump, routines run on the
  clock by six times of day, and people sleep and keep watch. Parked: alarm systems (D-230). Light Sleeper
  became a perk of its own (D-190, built).
- **Travel (11/11/2026; TV1-TV9).** A road is one long place with a length and a danger, and a trip along a known
  road is travel mode (#399, #400). The situation roll was renamed the event roll (#398). An encounter can be
  good or bad: the roll's tier decides which, and the road's danger decides only how often. Parked: mounts
  (D-201), who travels together and setting off at an agreed time (D-202), landmarks (D-203), walks off the
  road (D-245).
- **Roads on the map (14/11/2026; RD1-RD3).** The long road's strip map could not be read. A road is one line on
  the World view, and a place along it is a map of its own (#804). The review also found BG-225 and BG-226 (#806).
- **Road encounters (17/11/2026; RE1-RE8, IQ1-IQ7; BG-291).** Encounters almost never happened because the leg
  that arrives never rolled. Built in #978 to #995: road time carries over between trips, an encounter is an
  inner scenario and never ends the running one, the planner casts from the road's travellers and the wild table
  first, a trip runs on the world clock, an encounter starts where its people are first glimpsed, an encounter
  can open a side way, and a fight far below the player can be finished in one turn. Turned down: odds per
  kilometre (RE2 b) and the group's luck (IQ1 b). The review compared how encounters play out with the web
  serial Iliad Quest; its finding-the-way check is noted on D-245.
- **Carrying a world on (13/11/2026; WP1-WP6, from HF26, HF31, HF32).** A new character can start in a world
  whose last character's story has ended (#664, #671): a standing reset frees the world, worlds have titles, one
  Threadbound item per world, and standing foes loot the fallen. Parked: the old character staying on as an NPC
  (D-252), any NPC looting any body (D-253).
