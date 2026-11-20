### Map

The game rules for the full-screen Map, its World view and roads, and the minimap on the Play screen. Each rule starts
with a stable ID (MAP-nn) that code, tests and reviews cite; a number is never reused. The `rpg-map` skill
(`.agents/skills/rpg-map/SKILL.md`) holds the working method: stage data, then layout, then render, then check, then
look (MAP-01). Map animation follows [Play screen motion](play-screen-motion.md) (M-01 to M-74).

#### Geometry and layout

- **MAP-02** Claude agents never produce coordinates. Agent Weaver gives zone ids, sizes in metres, parent place and
  links; layout code turns that into positions.
- **MAP-03** Layout is deterministic: the same stage data gives the same map. Positions are stored with the zone and
  never moved once placed, so a stage extension adds zones at the edges and never reshuffles existing ones.
- **MAP-10** One grid, 1 cell = 1 m. Every zone size and position snaps to it. The scale bar is drawn from the same
  constant. A zone is only a title: a name plus an outline (any shape) between a floor and a top. The map draws every
  title where it lies on the floor plan, and its walls, openings and furniture come from the floor plan (state.walls,
  state.openings), never from zone links. There is no exit diagram and no force layout (PZ12 a; BG-313).
- **MAP-11** Zones never partially overlap. Only full containment is allowed (a zone inside its parent place). Any
  partial overlap is a violation.
- **MAP-12** Outdoor zones (streets, yards, roads) sit beside building footprints and never run through them. A building
  is one connected footprint.
- **MAP-13** A place's footprint is the bounding box of the seen ground of its zones plus padding, so it never tells how
  far unseen ground runs; the outline is padded only where it stays off other places' zones. Its title sits outside the
  footprint, above the top-left corner (a title wider than the place may run out past that corner).
- **MAP-14** Each doorway, gap, window or stair is drawn once, at its own point on its wall, never at the middle of a
  shared edge and never by a compass word: one mark per opening, with a barrier's padlock, bolt or cross in its place.
  An exit to somewhere not on the map is an arrow straight out of its own doorway, turned a little either way only when
  that spot is taken. There are no connector lines between titles (Opening.at).
- **MAP-15** Every zone is reachable from the player's zone through links (flood fill over the stage data). An
  unreachable zone is a finding, not a style choice (checkReach, src/ui/mapPlan.ts).
- **MAP-16** Fog: the map and the minimap draw a title's floor, walls and furniture only where the fog says the player
  has seen (journal.seenSquares; over the land, the land's cells). Unseen ground stays dark. A title seen none of shows
  no name; a name sits in the biggest seen part of its title. The minimap uses the same plan and the same fog, and only
  seen ground can be pointed at (PZ12 a).
- **MAP-17** The map is always drawn to scale: each zone at its real position and size in metres, so zones and places
  that adjoin touch along x and y and their shared side is the exit. The exit diagram, its force layout and its compass
  guessing are gone. Each inner place's outline is the box around the seen ground of its zones, padded as MAP-13 says,
  with square corners and its name above its north side (Ali, 14/11/2026, CO9; BG-313; WF8 a).
- **MAP-18** Code places every zone on the 1 m grid, with whole-metre sides and corners and the area's best whole-metre
  fit (MAP-10). It places a zone beside what it links to, never partly over another zone, and never inside another
  building's footprint (the box around a place's indoor zones), so a street runs beside a building and never through it
  (MAP-11, MAP-12). Among the free spots it takes the one that leaves room for the sides its exits name: "behind the
  counter, north" keeps the common room's north side clear.
- **MAP-19** A stored layout that breaks MAP-10, MAP-11 or MAP-12 is named in the load report, never moved. MR2's one
  re-placing, relayBroken, went with the zone rewrite: no save from before these rules loads (brokenLayouts,
  src/scenario/geometry.ts; PZ16 b).

#### Labels

- **MAP-20** A zone's name is drawn in bold letters inside its zone, centred, on up to three lines, as large as fit its
  box with at least 6 px padding (4 to 32 px). In a small zone the letters shrink to stay inside. A zone too small even
  for 4 px letters shows its name in its tooltip and accessible label only. The name never moves outside its zone
  (MZ2-MZ4).
- **MAP-21** A name is never cut with an ellipsis. It shrinks instead (MAP-20).
- **MAP-22** A zone's name is a background layer behind every mark. Tokens and icons may sit on it, and it takes no room
  from them, so it never pushes a mark aside (MZ2-MZ4).
- **MAP-23** When marks collide, yield in this order (first wins): player token, place titles, other tokens, exit notes,
  icons.
- **MAP-24** Exit notes use one format, attached to their exit: `→ target · state` (for example `→ the plank gate ·
  unexplored`). The note reads "→ its name · unexplored" (or "· to Ashford", ", locked").
- **MAP-25** A mark inside a zone (furniture, stairs, the player, people) is placed once, at the widest of a few set
  zooms that has room for it (PLACE_KS), and every zoom keeps it at the same share of its zone (inside the room its size
  leaves). A stair is placed once at its own end, nudged then only if another mark already sits there. After that,
  furniture and stairs never move at any zoom: zoomed out, where one would cover another mark it hides in its own spot
  (listed in the zone's card) and comes back there. The player and people are never hidden; they step aside only then
  (BG-216; WF10 a).
- **MAP-26** To scale, a place's map is laid out by code at the zoom shown and drawn on one screen-pixel layer. No mark
  covers another at any zoom, and the first view fits the whole map with everything inside it (src/ui/mapPlan.ts).
- **MAP-27** On a place's map your pin is placed first and furniture last. Place titles sit above their outline's
  top-left corner; people sit in the bottom band or at their own point; a stair is placed once at its own end on this
  floor, nudged then only if another mark already sits there, and after that never moves at any zoom (MAP-25).
  Furniture is left off (and still listed in the zone's card) when its zone has no free spot (WF10 a).

#### Symbols and states

- **MAP-30** One icon has one meaning. The legend is always available and lists every icon on the current map except
  your pin (MAP-35; WF12 a).
- **MAP-31** Icons never overlap each other or a wall corner. Doors sit at their own point on their wall (MAP-14).
- **MAP-32** Every exit arrow names its target. No arrow points at empty space without a note.
- **MAP-33** Zone states are fixed: where you are (current, highlighted); explored (stood in: journal.zonesVisited, each
  zone once as you stand in it; a save without the list starts it from its trail); seen but never stood in (hatched);
  and exits to somewhere unknown. Locked is shown on the door, not on the zone.
- **MAP-34** Every state is readable without colour: outline style plus an icon or text, never colour alone.
- **MAP-35** The key lists exactly what the map shows, except your own pin and the current zone's outline. The pin's tip
  says "You are here", and the card names where you are once (SD8).
- **MAP-36** A barrier the character knows stops them sits as a badge on its exit: a padlock for locked (green when they
  hold its key), a door with its bolt across for barred, a cross for blocked. Locked or barred shows only once they have
  tried it, hold its key or see the bolt on their side. The zone card's exits name each barrier ("door, locked", "gate,
  standing open"), and the key lists the badges once one shows (barrierView, src/engine/barriers.ts).

#### What the map may show

- **MAP-40** The map shows only what the player character knows: zones, exits and actors the player has perceived.
  Hidden Weaver fields never reach the map.
- **MAP-41** Unperceived NPCs are not drawn. Perceived but unnamed NPCs use their stranger label.
- **MAP-42** Background stage extensions are invisible until the player perceives the new zone (matches the spec's
  motion rule M-04). No layout shift, no new outline, no indicator.
- **MAP-43** The map is built from PlayerView and the Journal only, never the hidden store.
- **MAP-44** The map shows every title the character stood in or saw (journal.zonesSeen), plus exits not taken.
- **MAP-45** Light, cover, people and ground items show only for zones in view now. Remembered zones keep name, look and
  exits; people out of sight show where last seen.
- **MAP-46** The fog (journal.seenSquares) is kept in 1 m squares under a roof, FOG_OPEN_SQUARE_M squares in the open
  and the land's own cells over the land. Squares are marked from the player's eye when a plan is applied and on every
  turn (seenRuns, src/plan/fog.ts; fogClip, src/ui/map.ts; PZ12 a; BG-313).

#### The Map screen

- **MAP-60** The Map is a big full-screen pop-up over the page, not a tab of its own. The Map button in the Play header
  opens it, and ✕, Esc or leaving the page closes it. An old #map link opens Play with the map up.
- **MAP-61** A zone's card (any zone but the one you stand in) has **Move to here**: it closes the map and types "I go
  to <the zone>" in the action box, unsent, for the player to send or change. A zone in another town or building than
  the one you are in names it: "I go to the village square in Thornbury" (moveOrder, moveHere, src/ui/map.ts; Ali: the
  bare name read as a spot nearby).
- **MAP-62** Unexplored exits are clickable too: an exit's arrow or its "· unexplored" note, or unexplored stairs. The
  card names the way and the zone it leaves, with **Move to here**, which types "I go <the way>": "I go back out to the
  road", "I go to the hut door" (exitOrder, src/ui/map.ts).
- **MAP-63** There is one map per top-level place (a village, say), with each inner place outlined as an area. A road to
  a known zone on another map is a stub naming that place, and clicking it opens that map.
- **MAP-64** The map has pan, zoom, find me, show the whole map and place crumbs. Clicking a zone opens its card (look,
  exits with a go button, people, items) beside the map, with the places list and the key.
- **MAP-65** The zone card leaves out the usual: the place line only when it differs from the zone, light and cover only
  when indoors, short of bright or above none, and no Exits heading when there are none.
- **MAP-66** The map shows one height at a time. A vertical slider at the bottom left has one stop per height the map
  has (lowest at the bottom), each named ("Ground level", "3 m up"), with "· you" at yours; it is hidden when the map
  has one height. The slider shows heights below ground too (a cellar or dungeon, "3 m down") once one is known
  (mapHeights, src/ui/map.ts).
- **MAP-67** On the to-scale plan each piece of furniture is a small line glyph for its kind on a disc at its point,
  kept inside its walls, with a piece in the middle stepped below the zone's name. Hover names it, the zone card lists
  it under Furniture, and the key shows the mark once the plan draws any (src/ui/furnitureIcons.ts, one per FU kind;
  FR5).
- **MAP-68** People on the plan: everyone in full sight stands at their own point, as you do. Someone only heard or
  glimpsed, or last seen, has no point, so they sit in a row under the zone's name, with "somewhere in here" on hover
  (Actor.pos, MapPerson.at; Ali, 13/11/2026).
- **MAP-69** Each person's disc shows the initial of what you know them by, a learned name or a description ("a lean
  man" shows L), and pointing at it shows that full name or description beside it. The discs sit above every tile, so a
  neighbouring zone never hides one (whoInitial, src/ui/map.ts).

#### World view and roads

- **MAP-70** A World crumb, first in the crumbs, shows every top-level place you know as one tile, joined by the roads
  you know between them (drawn where they lie). Clicking a place opens its map.
- **MAP-71** The World view draws each top-level place as the box around all its known zones, still joined by the roads
  you know. Place names sit on a fixed-size layer so they stay readable when a road's kilometres zoom the World far out:
  it zooms out as far as the whole World needs, with room kept for the names. A scale bar of 10 m, 100 m or 1 km is
  drawn to suit (extentOf, src/ui/mapData.ts; Ali, 14/11/2026, CO9).
- **MAP-72** A road that is a place of its own (kind road) has no map of its own. It is one dashed line in the World
  along its length, whatever the zoom, with its name and length centred above its middle, and the World card lists it
  once as that road between the places at its ends (RD1-RD3).
- **MAP-73** A place along a road (a waystation inside the road place) is a World place and a map of its own: a mark
  beside the road that opens its map (rootPlace, src/ui/mapData.ts; RD1-RD3).
- **MAP-74** On a road outside any town the map opens on the World zoomed to that road with the places at its ends, your
  pin at your own point on it, and the road's card: its length, "You are here · 1 km from its west end", its look, where
  it goes and the places along it, each with a button that opens its map (RD1-RD3).
- **MAP-75** Clicking the road in the World shows that card. A town's arrow onto the road, a place's road crumb or the
  road in the places list opens the World on that road (RD1-RD3).
- **MAP-76** To scale, the World shows your pin wherever you are, and a place too small on screen to hold its name has
  it just under its south side (RD1-RD3).
- **MAP-77** The fake page's Ashford sits at the far end of a 30 km west road (a day's walk) from Millbrook's square
  (RD1-RD3).

#### Minimap

- **MAP-80** The minimap sits in the Play screen's right column ([play-screen.md](play-screen.md), "The action deck and
  minimap") and shows only what the character knows (src/ui/minimap.ts; AD1–AD16).
- **MAP-81** A click on the minimap plans a move to an exact point. Enter, Just go or a double-click walks there
  (MoveSpot.at).
- **MAP-82** A move planned on the minimap rides along with the next clicked action.
- **MAP-83** The ring shows one move slot's reach with carried-over time, and a second, wider ring shows how far a dash
  runs: the move time walked, then the main time run. The view fits the dash ring (BF91 a).
- **MAP-84** The minimap's marks are the full Map's own, your pin included. On both maps the pin's point shows the way
  you face, from which left and right are taken (BG-18; Ali, 20/11/2026).

#### Checks and test stages

- **MAP-04** A map change ships only when the checker reports zero findings on each of the three MAP-52 test stages:
  bent-nail, one-room and long-names.
- **MAP-50** The renderer tags every map element with `data-role` (`zone`, `place`, `label`, `token`, `icon`, `exit`)
  and `data-id`. Labels also carry `data-for` (the zone id) and `data-placement` (`inside` or `outside`). Zone names
  carry `data-layer="back"`. Zones carry `data-parent` when they sit inside a place. Exits carry `data-target`.
- **MAP-51** After every render, run `checkMap` on the live SVG: it measures real text sizes, so it must run after the
  browser lays out the text. Run `checkReach` on the stage data. Any finding fails the change (checkMap,
  src/ui/mapCheck.ts; checkReach, src/ui/mapPlan.ts).
- **MAP-52** Test stages: (a) the Bent Nail (kitchen, common room, behind the counter) beside the high lane with the
  midden yard and its locked plank gate; (b) a single room; (c) a 12-zone stage with long zone names. Render each, take
  a screenshot, and look at it before reporting (bent-nail, one-room, long-names in src/ui/fakeStages.ts).
- **MAP-53** Report every finding verbatim. Never say all checks passed if any check reported something.
- **MAP-54** `bent-nail-saved` is not a MAP-52 stage. It is a negative fixture holding the live save's stored layout,
  which breaks MAP-10 and MAP-12 on purpose so that the load report must name it (MAP-19). tests/unit/map-plan.test.ts
  asserts it is caught (src/ui/fakeStages.ts; MR2; PZ16 b).
- **MAP-55** Dev views: `?fake=1&stage=bent-nail|bent-nail-saved|one-room|long-names` and `?mapcheck`. There, after
  every to-scale render, the Map runs `checkMap`, `checkReach` and the MAP-10/MAP-12 stage checks (`checkStage`), logs
  each finding to the console as "[map-check] …" and sets `window.__mapFindings`. After every render the minimap runs
  `checkMap` and `checkReach`, logs "[minimap-check] …" and sets `window.__minimapFindings` (src/ui/map.ts,
  src/ui/minimap.ts, src/ui/mapCheck.ts, src/ui/mapPlan.ts).
- **MAP-56** The automated check is `npm run smoke`: tests/smoke/map.smoke.ts builds the page and asserts zero findings
  on the minimap and on the Map for the three MAP-52 stages, with no page errors. Agents reuse it and do not write their
  own Playwright scripts. The run in the PR's checks is the judge: a finding that only a local browser shows, where
  text measures differently (BG-325), does not hold a change back (WF1 c). If a finding ever reaches `main`, D-412
  says what follows.
- **MAP-57** The layout's unit checks are in tests/unit/map-plan.test.ts: for each MAP-52 stage at zooms 0.6, 1 and 1.6
  the checkMap rules on the scene's own boxes, `checkStage` and `checkReach` find nothing; `bent-nail-saved` is caught
  (MAP-54); and a stored layout is named, never moved (MAP-19). tests/unit/zone-placement.test.ts checks that footprints
  come out in whole metres (MAP-10).

#### Open discrepancies

Where the old copies of these rules disagreed, this file keeps the spec's wording and marks the point here. The owner
moved these four to a revision of the map's rules, recorded as D-413 (questionnaire "Workflow proposals", WF9, WF11,
WF13, WF14). Until then, the code decides what the game does (`AGENTS.md`, Order of authority).

- **MAP-27 and MAP-68:** people out of full sight sit "in the bottom band" (MAP-27) or "in a row under the zone's name"
  (MAP-68).
- **Footprint:** "one connected footprint" (MAP-12), "the bounding box of the seen ground … plus padding" (MAP-13),
  "the box around a place's indoor zones" (MAP-18, which `checkStage` uses).
- **MAP-24:** one format `→ target · state`, but a locked exit's note reads ", locked".
- **MAP-33 and MAP-84 on the minimap:** a zone seen but never entered is hatched on the Map (MAP-33), but has a dashed
  edge on the minimap (src/ui/styles.css), whose marks are meant to be the Map's own (MAP-84).
