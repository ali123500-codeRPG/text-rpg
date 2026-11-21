### Map

The game rules for the full-screen Map, its World view and roads, and the minimap on the Play screen. Each rule starts
with a stable ID (MAP-nn) that code, tests and reviews cite; a number is never reused. The `rpg-map` skill
(`.agents/skills/rpg-map/SKILL.md`) holds the working method: stage data, then layout, then render, then check, then
look (MAP-01). Map animation follows [Play screen motion](play-screen-motion.md) (M-01 to M-74).

Everything on the map is placed, grouped, hidden and checked by geometry: points in metres, walls and outlines as
shapes. A zone (title) only names a space (AGENTS.md rule 8; ZR1 a; Ali, 21/11/2026, Questions hub page "One
continuous map (D-1558)"). Rules below that still lay marks out zone by zone are rewritten with the one-map build
(D-1558).

#### Geometry and layout

- **MAP-02** Claude agents never produce coordinates. Agent Weaver gives zone ids, sizes in metres, parent place and
  links; layout code turns that into positions.
- **MAP-03** Layout is deterministic: the same stage data gives the same map. Positions are stored with the zone and
  never moved once placed, so a stage extension adds zones at the edges and never reshuffles existing ones.
- **MAP-10** One grid, 1 cell = 1 m. Every zone size and position snaps to it. The scale bar is drawn from the same
  constant. The map is always to scale: zones and places that adjoin touch along x and y, and their shared side is the
  exit. A zone is only a title: a name plus an outline (any shape) between a floor and a top. The map draws every
  title where it lies on the floor plan, and its walls, openings and furniture come from the floor plan (state.walls,
  state.openings), never from zone links (PZ12 a; BG-313; RM7 a, RM8 a).
- **MAP-11** Zones never partially overlap. Only full containment is allowed (a zone inside its parent place). Any
  partial overlap is a violation.
- **MAP-12** Outdoor zones (streets, yards, roads) sit beside building footprints and never run through them. A building
  is one connected footprint.
- **MAP-13** A place's footprint is its own ground: the seen ground of its own zones, each padded, joined into one
  outline with square corners. It never tells how far unseen ground runs and never covers another place's zone. The
  drawn outline and the checker (`checkStage`, MAP-18) use this one shape: the outline is drawn from the ground seen, and the
  checker reads the whole ground of a building's indoor zones, where a zone of somewhere else that cuts the shape in two
  runs through it (MAP-12). Zone placement and the load report read the checker's shape too (MAP-18, MAP-19)
  (`footprint` and `buildingCheck`, src/plan/footprint.ts). Its title sits outside the footprint, above
  the top-left corner (a title wider than the place may run out past that corner) (CO9; WF8 a; RM5 a, RM7 a; Ali, 20/11/2026, Questions hub page "Map rules revision").
- **MAP-14** Each doorway, gap, window or stair is drawn once, at its own point on its wall, never at the middle of a
  shared edge and never by a compass word: one mark per opening, with a barrier's padlock, bolt or cross in its place.
  An exit to somewhere not on the map is an arrow straight out of its own doorway, turned a little either way only when
  that spot is taken. There are no connector lines between titles (Opening.at). Every opening is drawn at its own width
  along its wall (Opening.widthM; a way with none, a doorway's, CONFIG.DOORWAY_M) and at a wall's drawn thickness across
  it, to scale at every zoom as walls are, with no smallest size; a gap's dark fill cuts its wall's line. Open ground
  with no wall and no door or gate has no mark: its dotted edge is the way through (MAP-10; RM34 b); a gate or door there
  is its two posts and its badge. A door's click reaches across as far as a wall's does and along only its own width,
  with no smallest size (RM35 a). A barrier's badge sits
  on its door, scaling with it, its diameter the door's drawn width times CONFIG.MAP_DOOR_BADGE_SHARE (the 16 px badge of
  a 1 m door at zoom 1), with no smallest size, and may cover the door. A lock, a blocked way, and anything the same from
  both sides is centred on the door; a bar, opened only from the side its bolt is on, leans toward that side by
  CONFIG.MAP_BADGE_LEAN of the badge's diameter (0.5: the whole badge on that side, its edge on the door's line), a share
  and never pixels. The layout and the checker measure the door and its badge together (src/ui/mapPlan.ts; RM28 a; Ali,
  21/11/2026, Questions hub page "Map rules revision"; RM31 b, RM34 b, RM35 a; Ali, 21/11/2026, Questions hub page "Map rules
  revision").
- **MAP-15** Every zone is reachable from the player's zone through links (flood fill over the stage data). An
  unreachable zone is a finding, not a style choice (checkReach, src/ui/mapPlan.ts).
- **MAP-16** Fog: the map and the minimap draw a title's floor, walls and furniture only where the fog says the player
  has seen (journal.seenSquares; over the land, the land's cells). Unseen ground stays dark. A title seen none of shows
  no name; a name sits in the biggest seen part of its title. The minimap uses the same plan and the same fog, and only
  seen ground can be pointed at (PZ12 a).
- **MAP-17** Merged into MAP-10 and MAP-13 (RM7 a).
- **MAP-18** Code places every zone on the 1 m grid, with whole-metre sides and corners and the area's best whole-metre
  fit (MAP-10). It places a zone beside what it links to, never partly over another zone, never over another building's
  rooms and never cutting its footprint in two, and a new room never leaves its own building in pieces (MAP-11,
  MAP-12). The footprint is the checker's shape (MAP-13): the whole ground of the building's indoor zones, seen or not.
  So a street runs beside a building and never through it, and may fill its notches and courtyards. Among the free spots
  it takes the one that leaves room for the sides its exits name, with no zone of somewhere else along them: "behind the
  counter, north" keeps the common room's north side clear. Only new placement reads this; stored layouts never move
  (MAP-03, MAP-19) (placeZones, src/scenario/geometry.ts; RM5 a; RM19 b, RM21 a; Ali, 20/11/2026, Questions hub page
  "Map rules revision").
- **MAP-19** A stored layout that breaks MAP-10, MAP-11 or MAP-12 is named in the load report, never moved; MAP-12 is
  read on the checker's shape (MAP-13). No save from before these rules loads (brokenLayouts, src/scenario/geometry.ts;
  PZ16 b; RM8 a; RM19 b).

#### Labels

- **MAP-20** Every zone's name is drawn at one small size, the exit notes' 13 px (TEXT in src/ui/mapPlan.ts), in bold
  letters in a quiet colour (`--faint`), inside its zone, centred, with at least 6 px padding; a long name wraps at spaces
  to up to three lines. A zone too small for it at that size shows its name on hover and in its accessible name only. The
  name never moves outside its zone, and its box is the letters' as the font sets them (BG-346) (MZ2-MZ4; RM24 a; Ali,
  20/11/2026, Questions hub page "Map rules revision").
- **MAP-21** A name is never cut with an ellipsis. It wraps instead, or shows on hover only (MAP-20).
- **MAP-22** A zone's name is a background layer behind every mark. Tokens and stairs may sit on it, and it takes no
  room from them, so it never pushes a mark aside; furniture never covers it (MAP-25), and things on the ground may sit on
  it as stairs do (MAP-86) (MZ2-MZ4; RM6 a).
- **MAP-23** When marks collide, yield in this order (first wins): player token, place titles, other tokens, exit notes,
  icons. Your pin and people never yield: each stands at their own point at their body's real size (MAP-25), and other
  marks keep clear of them. Your pin is drawn above every other mark, its facing tip scaling with it (OM4b a; Ali, 21/11/2026, Questions hub page "One continuous map (D-1558)"; RM33 a, on the
  owner's condition: "one thing to keep is the pin indicating the direction I am facing").
- **MAP-24** An exit's note is its target's name only, attached to its exit ("the gate to the lane"). Its state (not
  been through, locked, where it leads) is in its tip and the zone card: the dotted arrow already shows an exit not been
  through, and the badge a barrier (MAP-36) (RM2 a; Ali, 20/11/2026, Questions hub page "Map rules revision").
- **MAP-25** On a place's map your pin is placed first and furniture last. A mark inside a zone (furniture, stairs,
  and the player with no point of their own) is placed once, at the widest of a few set
  zooms that has room for it (PLACE_KS), and every zoom keeps it at the same share of its zone (inside the room its size
  leaves). You and anyone with a known point (MAP-68) are placed from that point at each zoom drawn (BG-356). A stair is placed once at its own end, nudged then only if another mark already sits there. After that,
  furniture and stairs never move at any zoom: zoomed out, where one would cover another mark, or a piece of furniture
  the zone's name, it is left off in its own spot (listed in the zone's card) and comes back there when you zoom in.
  A piece of furniture is placed clear of the names at its zoom and of the name each closer set zoom shows, at its own
  size, so zooming in never covers it (src/ui/mapPlan.ts). Zoomed out past where a piece or a thing on the ground was
  placed, it shows only where it covers nothing, after the ones placed at that zoom or wider. Furniture is also left off when its zone has no free spot, so in a very small zone it shows only in the card (RM20 a). The player and people are never hidden
  (BG-216; WF10 a; RM6 a, RM7 a; Ali, 20/11/2026, Questions hub page "Map rules revision"). People and your pin are drawn
  to scale, as walls and doors are (MAP-14), with no smallest size: far out they are specks, and they never shrink in
  steps, merge into a group or step aside. Each stands at their own point and may overlap another person, your pin or any
  other mark; the marks placed after them (exit notes, stairs, furniture, things on the ground) keep clear of them, and
  the checker (MAP-22, MAP-31) does not measure people or your pin against any mark. A click lands only on a person's own
  drawn shape; to click on someone small, you zoom in. Your pin is a disc as wide as your body (KnownMap.youWidthM), its
  facing tip, core and outline in proportion (pin in src/ui/map.ts) (OM4b a; Ali, 21/11/2026, Questions hub page "One continuous map (D-1558)": "a, I really like a. if I want to click on
  someone I will zoom in"; this replaces RM26 b, RM27 b, RM29 c and RM30 b).
- **MAP-26** To scale, a place's map is laid out by code at the zoom shown and drawn on one screen-pixel layer. No mark
  covers another at any zoom, people and your pin aside (MAP-25), and the first view fits the whole map with everything
  inside it (src/ui/mapPlan.ts).
- **MAP-27** Merged into MAP-13, MAP-25 and MAP-68 (RM7 a).

#### Symbols and states

- **MAP-30** One icon has one meaning. The key is a short list behind a Key button beside the Map's zoom buttons, and
  lists only the unusual marks the current map shows, in short words: out of sight now, low wall or
  counter, locked (and with your key), barred, blocked, not been through yet, opens another map, stairs, last seen here.
  The usual marks (walls, indoors, outdoors, doors, furniture, someone there now, your pin, the current zone's outline)
  are left out: each names itself when you point at it. The pin's tip says "You are here", and the card names where you
  are once. The Key button shows only when the map has an unusual mark. The World's key, beside its own zoom buttons,
  lists only what its look does not say: a settlement's size, one known by word and not seen, a landmark (keyTool,
  planKeyRows, src/ui/map.ts; SD8; WF12 a; RM1 b, RM7 a; Ali, 20/11/2026, Questions hub page "Map rules revision").
- **MAP-31** Icons never overlap each other or a wall corner. Doors sit at their own point on their wall (MAP-14).
- **MAP-32** Every exit arrow names its target. No arrow points at empty space without a note.
- **MAP-33** The map marks no zone states: a zone is only a name on ground (MAP-10). The fog (MAP-16) draws seen ground
  in two tones, square by square: ground in sight now is drawn full, ground the character only remembers is faded. No
  hatch, and no outline on the zone you stand in: your pin says where you are. Exits not taken keep their dotted arrow,
  and locked is shown on the door. In sight now is what the latest look saw (journal.sightSquares); a title with no
  squares of its own (over the land, or too big to mark) is in sight whole while it is in view. The zone you stand in
  has no outline even while its card is open (fogMask, src/ui/map.ts; RM11 a; Ali, 20/11/2026, Questions hub page "Map
  rules revision").
- **MAP-34** Every state is readable without colour: outline style plus an icon or text, never colour alone.
- **MAP-35** Merged into MAP-30 (RM7 a).
- **MAP-36** A barrier the character knows stops them sits as a badge on its exit: a padlock for locked (green when they
  hold its key), a door with its bolt across for barred, a cross for blocked. Locked or barred shows only once they have
  tried it, hold its key or see the bolt on their side. The zone card's exits name each barrier ("door, locked", "gate,
  standing open"), and the key lists the badges once one shows (MAP-30) (barrierView, src/engine/barriers.ts).

#### What the map may show

- **MAP-40** The map shows only what the player character knows: zones, exits and actors the player has perceived.
  The map is built from PlayerView and the Journal only, never the hidden store, so hidden Weaver fields never reach it
  (RM7 a). What it draws of someone in full sight comes from the player's view of them: the race they are
  (SeenActor.race, for MAP-69's icon) and, at their own point, where they stand, their size and facing
  (SeenActor.body, for MAP-68 and GSM-193).
- **MAP-41** Unperceived NPCs are not drawn. Perceived but unnamed NPCs use their stranger label.
- **MAP-42** Background stage extensions are invisible until the player perceives the new zone (matches the spec's
  motion rule M-04). No layout shift, no new outline, no indicator.
- **MAP-43** Merged into MAP-40 (RM7 a).
- **MAP-44** The map shows every title the character stood in or saw (journal.zonesSeen), plus exits not taken, and
  every person the character perceives at their own point (MAP-68), whether or not a title shown is there.
- **MAP-45** Light, cover and ground items show only for zones in view now. Remembered zones keep name, look and exits.
  People belong to no zone: each shows at their own point, someone out of sight where last seen or heard (MAP-68), and a
  zone's card names the people whose point lies in it (peopleIn, src/ui/mapData.ts).
- **MAP-46** The fog (journal.seenSquares) is kept in 1 m squares under a roof, FOG_OPEN_SQUARE_M squares in the open
  and the land's own cells over the land. Squares are marked from the player's eye when a plan is applied and on every
  turn; each marking also replaces the squares in sight now (journal.sightSquares, MAP-33) (seenRuns, src/plan/fog.ts;
  fogClip, src/ui/map.ts; PZ12 a; BG-313).

#### The Map screen

- **MAP-60** The Map is a big full-screen pop-up over the page, not a tab of its own. The minimap's expand button opens
  it (the Play header has no Map button), and ✕, Esc or leaving the page closes it. An old #map link opens Play with the
  map up (MQ2 a; Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors").
- **MAP-61** A zone's card (any zone but the one you stand in) has **Move to here**: it closes the map and types "I go
  to <the zone>" in the action box, unsent, for the player to send or change. A zone in another town or building than
  the one you are in names it: "I go to the village square in Thornbury" (moveOrder, moveHere, src/ui/map.ts; Ali: the
  bare name read as a spot nearby).
- **MAP-62** Unexplored exits have a card too: an exit's arrow or its note, or unexplored stairs. The
  card names the way and the zone it leaves, with **Move to here**, which types "I go <the way>": "I go back out to the
  road", "I go to the hut door" (exitOrder, src/ui/map.ts).
- **MAP-63** There is one map per top-level place (a village, say), with each inner place outlined as an area. A road to
  a known zone on another map is a stub naming that place, and clicking it opens that map. To change: one continuous map
  (D-1558).
- **MAP-64** The map has pan, zoom, find me, show the whole map and place crumbs. Right-clicking a zone (or an exit,
  MAP-62) opens its card (look, exits with a go button, people, items) beside the map, with the places list;
  on a touch screen a long press does. A left click on the ground plans a walk, as on the minimap (MAP-81) (MQ3, MQ7 a;
  Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors").
- **MAP-65** The zone card leaves out the usual: the place line only when it differs from the zone, light and cover only
  when indoors, short of bright or above none, and no Exits heading when there are none.
- **MAP-66** The map shows one height at a time. A vertical slider at the bottom left has one stop per height the map
  has (lowest at the bottom), each named ("Ground level", "3 m up"), with "· you" at yours; it is hidden when the map
  has one height. The slider shows heights below ground too (a cellar or dungeon, "3 m down") once one is known
  (mapHeights, src/ui/map.ts).
- **MAP-67** On the to-scale plan each piece of furniture is a small line glyph for its kind on a disc at its point,
  kept inside its walls, and left off where it would cover the zone's name (MAP-25). Hover names it and the zone card
  lists it under Furniture (src/ui/furnitureIcons.ts, one per FU kind; FR5; RM1 b, RM6 a).
- **MAP-68** People on the plan: everyone the character perceives is drawn at their own point in metres, on the map of
  their floor, whether or not seen ground or any title on the map is there: over the void too. The title they are listed
  in plays no part in where they are drawn (Ali, 21/11/2026, this thread: "why does it matter if it is seen or not, you
  can draw them over the void."). Everyone in full sight stands at their own point (SeenActor.body), as you do, drawn as
  their body's real footprint at the zoom shown: a capsule its length along the way they face and its width across
  (GSM-193), with no smallest size (MAP-25; OM4b a; Ali, 21/11/2026, Questions hub page "One continuous map (D-1558)"). Someone only heard or
  glimpsed, or last seen, is their dashed disc at the point where the character last saw or heard them (the journal's
  last spot, BG-125), inside a faint dashed 2 m "somewhere here" circle (2 m its radius, as the question's picture
  measured it: CONFIG.LAST_SEEN_RADIUS_M, a placeholder), with "somewhere here" on hover. They are drawn dashed at the
  size and facing of their body when the character last saw them clearly (journal.lastBody, GSM-105), a capsule as in
  full sight that scales with the zoom; someone never seen clearly is a dashed disc of a set size (14 px) that does not
  scale (RX1 a; Ali, 21/11/2026, Questions hub page "One continuous map (D-1558)"). Like everyone, they never shrink, merge or step aside (MAP-25).
  A zone's card names the people whose point lies in the title whose outline holds it (the smallest, MAP-11), found from
  the point and the outlines, never from the title listing them. The map of a place shows the people listed in it or in a place
  inside it (MapPerson.root), on the floor their point is on (MapPerson.height). Every actor has a point (BG-1528);
  someone the map still gets with no point (an old save) is not drawn, and only the card of the title listing them names
  them. How the circle should grow or change is parked (D-424) (Actor.pos, KnownMap.people, MapPerson.at and
  MapPerson.lastAt; Ali, 13/11/2026; RM4 a, RM7 a; Ali, 20/11/2026, Questions hub page "Map rules revision"; Ali,
  21/11/2026, this thread).
- **MAP-69** Each person's mark (their body's capsule, dashed out of full sight, or a dashed disc for someone never seen clearly) shows an icon for what the character can see on them first: what they hold or wear
  that stands out (a weapon, armour, a tool of their trade), else what they are (a person, a beast, a slime). It uses
  only what is seen, never a hidden role, and the set of icons has enough variety that people in one scene differ.
  The icon scales with the body, fitted inside its narrower side (WHO_ICON_SHARE in src/ui/mapPlan.ts, the share the icon
  took of the old disc). It is left off where it would be drawn smaller than CONFIG.MAP_WHO_ICON_MIN_PX (6 px, a
  placeholder), measured on the icon's drawn size, so far out a body shows without it (OM4b a; RX2 b; Ali, 21/11/2026, Questions hub page "One continuous map (D-1558)"). Pointing at it shows the name or description they are known by beside it. These marks sit above every tile, so a
  neighbouring zone never hides one. In order: what they hold (a weapon or tool), a shield, armour past plain clothes,
  wares they offer; else their race or body (a person, a dog, a wolf, a bear, a boar, a horse, a big cat, a lion, a
  hyena, a lizard, a snake, a spider, a dragon, a slime). A plain person follows what the screen already shows of them
  in full sight (SeenActor): an elder with a cane from the life stage they look (AG16) at CONFIG.MAP_ELDER_FROM (Old)
  or later, else a man or a woman figure from their pronouns (he, she), else the plain person. Someone not made out
  (glimpsed, heard, or out of sight now) shows a hooded figure (personIcon, src/ui/mapData.ts; RACE_ICON,
  src/ui/itemIcons.ts; RM12 b; RM15 c, RM16 a; Ali, 20/11/2026, Questions hub page "Map rules revision").

#### World view and roads

- **MAP-70** A World crumb, first in the crumbs, shows every top-level place you know as one tile, joined by the roads
  you know between them (drawn where they lie). Clicking a place opens its map.
- **MAP-71** The World view draws each top-level place as the box around all its known zones, still joined by the roads
  you know. Place names sit on a fixed-size layer so they stay readable when a road's kilometres zoom the World far out:
  it zooms out as far as the whole World needs, with room kept for the names. A scale bar of 10 m, 100 m or 1 km is
  drawn to suit. A settlement shows the icon for its size beside its name (a house for a hamlet, a cluster of houses for
  a village, a walled gate for a town), from the site it stands on, and the land's settlements seen but not yet a place
  show the same icon; the size is in its tip and accessible name (extentOf, src/ui/mapData.ts; Ali, 14/11/2026, CO9;
  Ali, 20/11/2026).
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

#### Minimap

- **MAP-80** The minimap sits in the Play screen's right column ([play-screen.md](play-screen.md), "The action deck and
  minimap") and shows only what the character knows (src/ui/minimap.ts; AD1–AD16). It starts centred on you, about
  25 m across; the Map starts fitted to the whole place. Both use the same zoom steps, pan and recentre (MQ5 a): 10, 25,
  50, 100, 250 and 500 m, 1, 2.5, 5, 10, 25 and 50 km across the view (CONFIG.MINIMAP_ZOOM_M), plus the Map's fitted
  width, fitted no closer than the closest step. Both show a scale bar fixed at the view's bottom left: the longest round
  length (1, 2.5 or 5 times a power of ten) up to a fifth of the view's width, with its paces under 1 km. Marks are drawn
  from a view origin kept near the view, so screen numbers stay small kilometres out (OM7 a; Ali, 21/11/2026, Questions
  hub page "One continuous map (D-1558)"; src/ui/planView.ts).
- **MAP-81** A click on the ground of either map plans a move to an exact point (MQ3). Enter, Just go or a double-click walks there
  (MoveSpot.at).
- **MAP-82** A move planned on the minimap rides along with the next clicked action.
- **MAP-83** The ring shows one move slot's reach with carried-over time, and a second, wider ring shows how far a dash
  runs: the move time walked, then the main time run. The view fits the dash ring (BF91 a).
- **MAP-84** The minimap and the Map are one map component in two sizes: every mark, click and rule lives once. Both
  show everything (exits and their notes, the walk and dash rings, the planned path and its footer); only the frame
  differs, the Map adding the crumbs, key, places list and cards. On both the pin's point shows the way you face, from
  which left and right are taken (BG-18; Ali, 20/11/2026; MQ2 a, MQ4 a; Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors").
- **MAP-85** A click on any thing drawn on either map (a door, a stretch of wall, furniture, an item, a person) opens a
  small list beside it of every action the action deck has for that thing, under the deck's own names (MQ6 a). A thing
  the character can reach on foot lists its actions wherever it is on the map: there is no "too far", and no limit to
  the title you stand in. Picking one walks there and does it: the walk to the thing's spot rides along with the action,
  as a move planned on the minimap does (MAP-82). An entry is greyed only for a reason the engine gives, its reason on
  hover ("needs its key") (MQ6 a, MQ8; Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors"). The list
  for a thing away from your title is the deck's list as it reads standing in the thing's title (that title as the
  character sees it now or remembers it: things on its ground only while in sight); a door is worked from the side whose
  doorway is nearer on foot, a wall from the side clicked, and the picked action plays with the walk there, which the
  engine carries to the thing and finishes there (ACT-334) (MQ15 a / MQ16 a; Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors"). A thing with no way to it on foot lists nothing. The
  greyed entries are the engine's own refusals: a lock you hold no key to (no_key, "Needs its key", with a padlock) and a
  bed full of sleepers you can see (bed_taken, "That bed is full"). Each mark
  carries the deck target it stands for: a doorway the two titles it joins, a stretch of wall the wall standing there,
  the title of that side and the stretch's middle, a person their id, a piece of furniture its id and kind (src/ui/planView.ts `data-thing`,
  src/ui/deck.ts `thingActions`). Furniture lists the deck's actions on its kind: a bed offers Sleep, which walks to the
  bed and sleeps there (MQ10 a; Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors"), on it and holding a place, or
  comes to nothing when it is full (MQ13 a, MQ18; Sleeping on a bed, in the Game clock topic). A thing the deck
  has nothing for opens no list, and the click plans a walk as on bare ground. Over the Map the list opens on top, and an
  action picked there plays from Play with the Map closed, as the Map's walk does (MAP-84).
- **MAP-86** The things on the ground the character sees now, containers too, are drawn on both maps at their own spot
  (MAP-40: PlayerView only), each its item's icon (src/ui/itemIcons.ts) on a disc in its kind's tint. They are placed
  after the furniture and as furniture is (MAP-25): one spot at every zoom, left off where there is no free spot and
  listed in the zone's card under "On the ground"; like stairs they may sit on a zone's name (MAP-22). A click on one
  opens its MAP-85 list: Pick up, Open, Pick a lock, Force open and Filch, as the deck has them for it (src/ui/mapPlan.ts,
  src/ui/planView.ts, src/ui/deck.ts `thingActions`) (MQ9 a; Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors").

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
  midden yard and its locked plank gate, and a cart horse in the lane, drawn as its capsule (GSM-193), and a locked chest and a rusty knife on the ground of the midden yard (MAP-86); (b) a single room with a straw cot (MAP-85); (c) a 12-zone stage with long zone names. Render each, take
  a screenshot, and look at it before reporting (bent-nail, one-room, long-names in src/ui/fakeStages.ts).
- **MAP-53** Report every finding verbatim. Never say all checks passed if any check reported something.
- **MAP-54** `bent-nail-saved` is not a MAP-52 stage. It is a negative fixture holding the live save's stored layout,
  which breaks MAP-10 and MAP-12 on purpose so that the load report must name it (MAP-19). tests/unit/map-plan.test.ts
  asserts it is caught (src/ui/fakeStages.ts; MR2; PZ16 b).
- **MAP-77** The fake page's Ashford sits at the far end of a 30 km west road (a day's walk) from Millbrook's square
  (RD1-RD3; RM9 a).
- **MAP-55** Dev views: `?fake=1&stage=bent-nail|bent-nail-saved|one-room|long-names` and `?mapcheck`. There, after
  every to-scale render, the Map runs `checkMap`, `checkReach` and the MAP-10/MAP-12 stage checks (`checkStage`), logs
  each finding to the console as "[map-check] …" and sets `window.__mapFindings`. The minimap, the same view (MAP-84),
  runs the same checks, logs "[minimap-check] …" and sets `window.__minimapFindings` (src/ui/planView.ts,
  src/ui/mapCheck.ts, src/ui/mapPlan.ts).
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


None.
