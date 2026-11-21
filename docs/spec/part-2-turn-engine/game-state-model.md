### Game state model

The in-memory game state, the floor plan everyone stands on, bodies in metres, routines and the views built from
state. Each rule starts with a stable ID (GSM-nn) that code, tests and reviews cite; a number is never reused.
Provenance (owner, date, question IDs, BG/D numbers) sits in one trailing parenthesis.

#### State and knowledge

- **GSM-10** The save is the set of pages defined in Part 4. On load, the engine builds one in-memory GameState from
  those pages; it is never saved as one document.
- **GSM-11** Everyone stands at a point in metres, and the title of that point is their zone (Titles and the floor
  plan, below). Each title belongs to one place, and the stage may hold zones from several places.
- **GSM-12** Knowledge lives on the observer: the guard's belief about the player is `guard.mind.knowledge.player`,
  and it can be wrong.

```ts
type Perception = 'full' | 'partial';
type Cue = 'sight' | 'sound' | 'smell' | 'touch';

// In-memory working state, built from Part 4's pages on load
type GameState = {
  storyId: StoryId;
  turn: number;
  mode: 'explore' | 'dialogue' | 'tactical';
  zones: Zone[];                // WI8 a: every built title in the world (the same objects as places[].zones)
  walls: Wall[]; openings: Opening[]; roofs: Roof[]; lights: LightSource[];   // PZ2, PZ5: the floor plan
  ground: ItemInstance[];       // PZ11: items lying on the ground, each at a point and floor (at)
  furniture: Furniture[];       // FR1, PZ1: furniture at points (pos, floor), each in the title it was drawn in (zone)
  player: Actor;                // Actor is defined in Part 4 §9
  actors: Actor[];              // NPCs and enemies
  bands: Band[];
  hidden: HiddenStore;          // never enters the Parser's, Narrator's or Voice's input
  events: GameEvent[];          // this turn's events; saved in the turn record
  agentLog: AgentTurnLog[];     // this turn's agent inputs and outputs; saved in the turn record
  rngSeed: number;
  rngState: number;
  pending: { turn: number; mode: 'explore' | 'dialogue' | 'tactical'; engaged: string[]; fired: string[] };
                                // computed after the previous turn is saved
};

type Band = {                   // a small group: a guard post, a gang, a household, the player's party
  id: string; name: string; goals: string; temperament: string;
  lethal: boolean;   // set when the band is made, default true; an existing band keeps it (Part 2, Agent Weaver)
  relations: Record<string, 'hostile' | 'opposed' | 'neutral' | 'friendly'>;  // default stance toward other bands
};
```

#### Titles and the floor plan

- **GSM-20** A zone is only a title: the name of a space. Walls, openings, light, clutter and walking paths live on
  the floor plan or at the point where someone stands, never on the zone (PZ1-PZ17, Ali, 18/11/2026, Questions hub page
  "Phase out zones"; built in one rewrite, PZ16 b).
- **GSM-21** The code keeps the word zone for the title's id (Zone, Actor.zone, move.toZone), so the agents' shapes
  barely change (PZ10 a).
- **GSM-22** A title has a name, a look and a kind, and the space it names: a footprint of any shape (Zone.outline, a
  polygon in metres, x east and y north, corners counter-clockwise) between a bottom and a top height (Zone.floor and
  Zone.top, metres above the ground outside), so each floor of a building can be named on its own (PZ1 a, as a 3D
  space).
- **GSM-23** A point's title is the smallest space that holds it: a booth drawn inside a hall reads as the booth
  (`src/plan/where.ts` zoneAt). A point on a wall that the title someone is in shares with another (a doorway) stays
  in the title they are in, so standing in a doorway never moves anyone into the room beside it (BG-1506).
- **GSM-24** Actor.zone is that title, kept by code whenever a point moves; code that sets a title instead (a
  scenario's start zone, a test) gets a point in it from placeAll. A title's floor is the floor of everyone standing in
  it.

#### Walls, openings and roofs

- **GSM-30** GameState.walls are segments, each with two ends (a, b), a floor and a top height, a wall kind (library
  wallKinds, WK), a material and a thickness (PZ2 a, `src/plan`).
- **GSM-31** Wall kinds: WK1 wall (no walking, seeing or reaching across; loses SOUND_LOSS_DB.wall), WK2 open (no wall
  at all: an open side draws none), WK3 low (a counter or rail, LOW_WALL_M 1.1 m: seen and reached over, climbed), WK4
  glazed (a window side: seen through, never walked), WK5 fence (FENCE_M 1.2 m: seen through, climbed), WK6 arcade
  (arches on piers: seen through, never walked).
- **GSM-32** A new wall kind is a new row with walk, see, reach, climb, sound and heightM (none: a storey) columns.
- **GSM-33** GameState.openings are the ways: a doorway, gap, window, stairs, ladder or hatch at a spot (at, on a
  floor) along a wall or in a floor, with a width and height (a window its sill), the two titles it joins (joins) and
  how the way reads from each side (labels, "the north door", "behind the counter"), its barrier (the door, gate, grate,
  shutters or rubble record of SD3-SD5, GameState.barriers).
- **GSM-34** Sight and sound pass an opening by its barrier (shut, standing open, broken or seen through), else by its
  kind: an empty doorway, a gap or a window shows the far side (BG-312: no fixed flag).
- **GSM-35** A doorway holds a plain wooden door, shut and unlocked, unless its way names another barrier or is
  doorless (an open doorway, as into a hall; a curtain).
- **GSM-36** Stairs, ladders and hatches join two floors and carry their far end (to: a point on the other floor). A
  window over lower ground is a drop (SD7).
- **GSM-37** A frontier is an opening to ground not yet built (frontier; its second join is the frontier key) and is
  built like any frontier.
- **GSM-38** A title's ways out (waysOut) are the openings that join it, read from its side.
- **GSM-39** GameState.roofs are outlines at a height: a point is indoors when a roof is overhead (underRoof), and a
  roof is the floor of the storey above, so sight and sound cross it only through stairs and hatches.

#### Drawing

- **GSM-40** The Weaver names titles with a kind and a size and the ways between them; code, never Claude, draws them
  (PZ14 a, `src/plan/draw.ts`).
- **GSM-41** Title kinds (library zoneKinds ZK1-ZK10: room, corridor, stairs, cellar, street, square, gate, yard,
  field, woods) are drawing templates: a default size and aspect, whether a roof goes over it (roof), its default wall
  kind (indoors WK1 wall, outdoors none), its default light (a source, Light below) and its default furniture. They
  have no cover, light or outdoor columns.
- **GSM-42** Code first places each new title's footprint (placeZones, unchanged in method): a rectangle of its area
  at its kind's aspect touching the title it joins on the side its way's compass word names, else the first free side,
  in whole metres, never inside another building's footprint (MAP-10 to MAP-12). Of the free spots, one that touches
  more of the placed titles it joins wins first, so a yard between a lane and a back yard touches both and neither way
  needs a long connector on the Map (CO1 B).
- **GSM-43** Then code draws the plan (drawPlan): one wall along each side by its wall kind (a side two titles share
  gets one wall, the more closed of their two kinds), one opening per way at the middle of the shared wall (a doorway),
  a roof over each roofed title, its lights and its furniture at points (CO3).
- **GSM-44** Titles up or down stairs sit straight above or below, a STOREY_HEIGHT (3 m) apart: the way's kind says it
  (up, down), never its words; a story's first titles stand at 0.
- **GSM-45** Layouts are small floor plans of titles, their sides' wall kinds, ways and furniture, drawn the same way
  (CO7, CO17; LY1-LY5).
- **GSM-46** A Weaver title may name a wall kind for a side its template does not (walls: the smithy open to the
  street on its south side).
- **GSM-47** An unknown kind, size, wall kind or opening kind is a bad_zone.

#### Points and floors

- **GSM-50** Everyone stands at a point in metres (Actor.pos) on their title's floor; a ground item lies at a point
  with its floor (ItemInstance.at); a belief keeps the point and floor where the other was last made out
  (Belief.lastKnownAt) with its title for words (lastKnownZone) (PZ7 a).
- **GSM-51** Placement (placeAll, at scenario setup and each turn's start, and at once when a move puts someone in a
  new title with no point there: an NPC following the player through a frontier, the player's companions at a trip's
  end): anyone with no point, or one outside their title, gets the nearest free point to where placement starts, on a
  half-PLACE_SPACING_M grid whose body keeps PLACE_SPACING_M (0.75 m) from every other body (SZ6). It starts at the
  player's point for those who arrived with the player (frontier followers, travel companions; never the title's middle:
  Ali, 21/11/2026, decision card: Beside you), at an encounter's point on its road (TV4), at the player's point on a
  road the player stands on, else at the title's middle. So everyone always has a point, and every event carries its
  maker's (GameEvent.pos); an event with no point never erases where the player last perceived someone (BG-1528).
- **GSM-52** A point asked for outside a title (a minimap move, a spot past its walls) is kept a step in from every
  wall it is past (keepInside: from the nearest wall, then the next, so a point past a corner ends that far from both
  walls).

#### Sight and distance

- **GSM-60** Sight is a clear line from the viewer's eye (EYE_SHARE 0.94 of its height) to the target that no wall
  stops: a wall stops it where the line crosses below the wall's top, except through an opening that is seen through
  (an open gap, a window, a barrier standing open or seen through, PC4) within its span; a roof stops it except through
  a stairs or hatch hole (PZ3 a, `src/plan/line.ts` lineClear).
- **GSM-61** Through a doorway you see a slice of the next room. Every sight range (the sight table, SZ11) reads the
  line's metres.
- **GSM-62** Sight links are gone. A view's zones list, the perceived zones (perceivedZoneIds,
  `src/engine/relations.ts`), is the viewer's title, the titles it sees into through an opening, and those across a wall
  seen over or through (glazing, a low wall, a fence, an arcade); who is seen in them is the line of sight's.
- **GSM-63** Distance (distM) is the straight line between the bodies when the line is clear (sightDistM, which attacks
  use: a blow or shot never goes round a wall), else the walking path.

#### Walking

- **GSM-70** A walk goes straight where nothing is in the way, else round walls through their corners and openings:
  the shortest path over a visibility graph of the floor's wall corners (CORNER_CLEAR_M 0.4 m off each corner) and
  openings, with stairs, ladders and hatches joining floors (their climb added) (PZ8 a, `src/plan/path.ts`).
- **GSM-71** A walk never goes through a wall, a low wall or fence (those are climbed, not walked), a window, a way
  shut to the walker that it knows is shut (BG-69, FR5), or an opening too small for its body (SZ7).
- **GSM-72** A move walks along the path as far as its metres go (walkLeg), and the walker's title is the title of the
  point it ends at. A move to a title ends CONFIG.ENTER_M (1 m) past the way in, to the walker's near edge (GSM-173).
- **GSM-73** gateAhead is the first opening on the path whose barrier is not open to the walker; a walk up to it stops
  GATE_SHORT_M (0.1 m, a hand's breadth) short of it on the near side, since a walker standing in the doorway itself
  would be past it to every later walk.
- **GSM-74** walkRoute's metres are the walk's own, centre to point (no body's edge taken off).

#### Sound

- **GSM-80** A sound's level at the ear is the louder of the straight line (source − 20·log10(metres) − SOUND_LOSS_DB
  of each wall and shut opening it crosses, a roof or floor counting as a wall, a low wall or fence nothing) and the
  walking path through the openings (− 20·log10(its metres) − the loss of each shut opening on it) (PZ4 a,
  `perception/noise.ts`).

#### Light

- **GSM-90** Light sources are objects (GameState.lights: a kind from the library's lightKinds, a point and height, a
  brightness in candela, lit or not) (PZ5 a, D-391 unparked, `src/plan/light.ts`).
- **GSM-91** The light at a point is the brightest of the sky (CONFIG.SKY_LIGHT by time of day, where no roof is
  overhead) and each lit source with a clear line to it, at brightness ÷ metres² (the inverse-square law), read as the
  brightest LIGHT_LUX level it reaches (lightAt).
- **GSM-92** Source kinds (placeholders): candle 1 cd, oil lamp 10 cd, lantern 15 cd, torch 100 cd, hearth 300 cd.
- **GSM-93** A title's light word (the Weaver's, else its kind's) is drawn as a room-lights source at its middle,
  under its ceiling, bright enough that the word holds out to its far corner; a black title has none, and an outdoor
  title gets one only for a word brighter than moonlit. So a hall lit by one fire is bright by the fire and dim at the
  far end.
- **GSM-94** A roll reads the light where the roller stands. A title's light with no point (zoneLight) is its dimmest,
  read at its middle and at each corner CORNER_IN_M (0.5 m) in, so the title's word holds across it.
- **GSM-95** Fieldcraft's F3 judges the title it would go to by that light, not at the doorway, where the light it
  left spills in.

#### Clutter, search and fog

- **GSM-100** Outdoors, the cover at a point is its land cell's (REGION_CELL_M 100 m cells, landCovers cover and
  standsM, how high it stands); inside a settlement cell, the drawn plan's objects (carts, barrels, hedges as furniture
  with sizes, PC2) give it instead, as indoors (coverAt). Zone.cover and the kind's coverM are gone (PZ6 a).
- **GSM-101** A search covers the searcher's search area (SEARCH_AREA_M2 × skill ÷ 50) round the spot it searches,
  within its sight line; scenario ground and chase ranges stay as the titles a scenario built, with near in metres
  (PZ11 a).
- **GSM-102** Fog: the player's journal keeps the ground it has seen, in squares per floor (1 m under a roof,
  FOG_OPEN_SQUARE_M in the open where no land lies under it; chunks of FOG_CHUNK squares a side, one bit a square,
  journal.seenSquares), and over the land by its cells (journal.landSeen, WZ4); the Map draws the walls, openings,
  furniture and land it has seen, with titles as labels on their outlines (PZ12 a, `src/plan/fog.ts`). The squares in
  sight at the latest look are kept the same way (journal.sightSquares), replaced at each look (MAP-33). A save without
  them loads, its seen ground faded until the next look.
- **GSM-103** journal.zonesSeen keeps every title the player has stood in or looked into (its name is known) and
  journal.zonesVisited the titles stood in (the turn's new places).
- **GSM-105** journal.lastSpot keeps the point (and floor) where the player last saw or heard each actor (BG-125), and
  journal.lastBody, beside it, the body the player last saw clearly of each: its floor size in metres and the way it
  faced, as SeenActor.body gives them. It is written whenever the player sees them clearly: a full sight of what they
  do, a look that shows them, and everyone seen clearly as a turn ends. The Map draws someone out of full sight at
  lastSpot at that size (MAP-68). A save without it loads, and the people in it are drawn as never seen clearly
  (RX1 a; Ali, 21/11/2026, Questions hub page "One continuous map (D-1558)").
- **GSM-104** The titles the player has entered (progression.zonesSeen) count for the titles chain (PZ13 a, ACH
  zones_1 to zones_300) and the land cells it has stood in (progression.cellsStood, '<x>:<y>' on the world's
  REGION_CELL_M grid) for the new-ground chain (New ground, below).

#### New ground

- **GSM-110** Each distinct REGION_CELL_M (100 m) land cell the player stands in counts once, noted at each turn's end
  (`src/engine/feats.ts`). The chain is ACH ground_1 to ground_2500, rule ground, under the Areas entered head with the
  titles and places chains: exploration, XP only (PZ17 a).
- **GSM-111** Its ranks: New Ground 1 (level minus 1), Footloose 25 (zero), Far Afield 100 (I), Long Roads Behind 500
  (II), Map in the Bones 2500 (III); each from Footloose on adds Curiosity +1.

#### Roads

- **GSM-120** A road is its line on the land (RoadLine: points, length, danger, crossings). Its title runs along the
  line, ROAD_WIDTH_M (4 m) wide (Zone.road names the land line, Zone.line keeps its points in the world's frame and
  Zone.danger its danger word), and a traveller stands at a point on it; travel walks the line (PZ9 a).
- **GSM-121** A road with no land line under it (a story with no region) gets a straight line of its length
  (ROAD_LENGTHS words: a short walk 0.5 km, half an hour 2, an hour's walk 4.5, half a day 15, a day's walk 30, two days
  60, CONFIG.ROAD_LENGTH_KM; or km) and a danger (ROAD_DANGERS: safe, quiet, wild, dangerous;
  CONFIG.ROAD_ENCOUNTER_PCT 5/10/20/35 % per hour, RE3, placeholders); left out: an hour's walk, quiet.
- **GSM-122** The road kind (ZK11) is gone.

#### Saves

- **GSM-130** The floor-plan rewrite is schema 10; older saves are refused (no old saves are kept, prototype rule)
  (PZ16 b). Schema 11: a doorway its old fixed flag kept shut gets the plain door it stood for (BG-312).

#### Drops and falls

- **GSM-140** A window or ledge over lower ground is seen through but never walked: paths and pursuit go round, and
  the Weaver never joins back up it (SD7).
- **GSM-141** The player takes it only by saying they jump (Parser move.jump, Order.jump): they land on the lower
  ground below it and take a fall.
- **GSM-142** The fall is flat damage by the drop in metres (the two floors), from CONFIG.FALL_BANDS (over 2 m 15, over
  5 m 40, over 9 m 80, and past the human range over 15 m 120, over 30 m 160, over 50 m 200, about terminal speed,
  after which it stays; placeholders, real-life injury heights: under about 2 m rarely hurts, a storey or two breaks
  bones, past about 9 m is often fatal for a person).
- **GSM-143** Being flat, tough or supernatural bodies can power through it. It lands on a random leg through the
  normal damage step.
- **GSM-144** A Dodge roll on landing moves it a band (CONFIG.FALL_LANDING_STEP: failures one band worse, Great or
  Critical Success one band better; each tier past Critical Success, CONFIG.FALL_LANDING_PAST_STEP, one more band
  better, so a supernatural dodger lands a tower jump unhurt; past Critical Failure reads Critical Failure's row).
- **GSM-145** The move event carries fall and landing from it. NPCs do not jump yet.

#### Metres

- **GSM-150** The range unit is the pace, CONFIG.PACE_M (1 m, about one stride) (CO1-CO19, Ali, 11/11/2026).
- **GSM-151** A title's area is m²: the Weaver gives a size word (ZONE_SIZES cramped 9, small 25, room 60, hall 225,
  yard 400, open 1,600, vast 10,000; CONFIG.ZONE_SIZE_M2, placeholders) or area in m², else the kind's default size.
- **GSM-152** Each library zoneSizes row names a real or fantasy reference.
- **GSM-153** The narration and views carry metres (a move's `metres`, a seen actor's distanceM).

#### Body size

- **GSM-160** Every body type has a size in metres (BodyType.size: length nose to rump without the tail, width at the
  widest point, height standing: stature upright, shoulder height for beasts; cited, estimates marked), and a race
  multiplies each measure (RaceDef.sizeMult, written from its cited metres) (SZ1-SZ6, SZ9, SZ10, SZ15, Ali 17/11/2026,
  Questions hub page "Body size and edge-to-edge reach").
- **GSM-161** actorBody works out an actor's size: the one place it is read, so perks and other things can change it
  later (SZ15).
- **GSM-162** A body takes up a capsule on the floor: radius half its narrower side, spine along its longer side,
  turned by its facing (the way it last walked, north before; it turns to face whom it strikes or speaks to; turning
  never collides).
- **GSM-163** Every distance between two people (distM, sightDistM, pathM, hearing, smell) is the gap between their
  bodies, each standing from its floor to its height (a height gap only where they do not overlap); to a spot (a
  doorway, an item, a point) it is from the body's edge.
- **GSM-164** The first one measured from turns to face the other; the other keeps its facing.
- **GSM-165** An event is seen and heard from its maker's body while the maker still stands where it happened.
- **GSM-166** Reach (weapons, grips, natural attacks) is metres past the body's edge. A natural attack's reach is
  re-measured from the edge (SZ9: a horse bites 0.5 m past its nose and kicks 1.8 m behind its rump); a body type
  part's reach × the race's factor on the shape's longest measure (SZ10).
- **GSM-167** Placing keeps PLACE_SPACING_M between bodies (GSM-51); a walk's end keeps PLACE_GAP_M from everyone but
  the one it closes in on, a walk up to someone stops PLACE_SPACING_M short of them, and a walk closing in to strike
  stops where the bodies are its reach apart (SZ6, BF71). Tails: D-366.

#### Body size, round 2

- **GSM-170** An arm reaches (height × CONFIG.ARM_SPAN_SHARE − width) ÷ 2 past the body's edge (half the arm span less
  half the shoulders: 0.625 m for a person, 1.25 m for a 3.5 m ogre a metre wide; library/bodySize armReachM); it
  replaces SZ10's factor for arms (SZ8, SZ18, SZ19).
- **GSM-171** A mode wielded in a grip (a held weapon, fists, a grapple) has a length past the hand (AttackMode.lengthM;
  a melee gear type's lengthM: knife 0.3, short 0.6, sword 0.9, great 1.6, pole 2.1, fist 0; a grapple −0.1, an
  improvised strike 0.5) and reaches the wielder's grip reach plus that (ruleset/gear inGrip). Its library reachM is
  what a standard person reaches, for item value and the viewer.
- **GSM-172** A body's volume is its size's box, length × width × height (actorVolumeM3), for perks and achievements.
- **GSM-173** The gaps between bodies (Hall's proxemics): PLACE_GAP_M 0.15, PLACE_SPACING_M 0.75. A move into a title
  stands ENTER_M past the way in to its body's near edge (half its length more), and a spot by a wall ENTER_M from it
  to the body's edge (half its widest side more).
- **GSM-174** A hostile is near the shooter within HOSTILE_NEAR_STEP_M (0.75) plus its own melee reach (hostileNearM),
  which also sets when someone coming closer interrupts a long action.

#### Body size, round 3

- **GSM-180** A body is seen as far again as a person by sightFactor = √(seen area ÷ a person's from level ground), seen
  area = its longer floor side × (height × cos θ + shorter side × sin θ), θ the look-down angle from higher up (0 on
  level ground; library/bodySize) (SZ11-SZ13).
- **GSM-181** Every sight range reads the metres ÷ that factor (seeingM, seenSizeFactor): a horse is seen about twice
  as far as a person, a slime at 0.41 of it.
- **GSM-182** Cover is set for a person and scales smoothly with height: what shows = (1 − hidden) × height ÷ 1.75 for a
  smaller body, × height ÷ the clutter's height (standsM) for a taller one (coverShown; Reach, range, cover and light),
  for hiding and for shots at it (CV3, CV4).
- **GSM-183** The range penalty reads the shot's metres ÷ the target's factor; a shot still needs the weapon's reach.

#### Ways and bodies

- **GSM-190** A doorway is CONFIG.DOORWAY_M 0.9 × 2 m unless its barrier kind has its own opening (a gate 3 × 2.5 m, a
  grate a door's, a hatch 0.7 × 0.7 m gone through upright); a way between two outdoor titles is as wide as the ground
  they share (SZ7).
- **GSM-191** A body goes through when the narrower of its length and width fits the width (it turns sideways) and its
  height ducked to DUCK_SHARE (0.5) fits the height; ducking costs no time; crawling is parked (D-369).
- **GSM-192** A walk never plans through a way too small for the walker (fitsThrough).
- **GSM-193** On the map and minimap, someone seen clearly at their own point is drawn as their body's own size and
  shape at the zoom shown: a capsule, its length along the way it faces and its true width across, with nothing outside
  it and no smallest size; its icon (MAP-69) scales with it, fitted inside it, and is left off below
  CONFIG.MAP_WHO_ICON_MIN_PX (RX2 b). Out of full sight they keep the size and facing last seen clearly, dashed (MAP-68,
  GSM-105; RX1 a). A click lands only on the drawn capsule
  (MAP-25) (SZ16; RM13 c, RM17 b: "you can narrow the icon no?", Ali, 20/11/2026, Questions hub page "Map rules
  revision"; OM4b a, Ali, 21/11/2026, Questions hub page "One continuous map (D-1558)", which drops RM17 b's wider hit
  area; capsule in ui/mapPlan; MapPerson.body).

#### State shapes

```ts
type Pt = { x: number; y: number };                                       // metres, x east, y north
type Zone = { id: string; placeId: PlaceId; name: string; look: string;   // a title (PZ1); look: public text
              kind?: string;                                             // the title kind (ZK) it was drawn from
              outline: Pt[]; floor: number; top: number;                 // its space: footprint between two heights
              area?: number;                                             // CO16 m² it was drawn at
              road?: string };                                           // PZ9: the RoadLine it runs along
type Wall = { id: string; a: Pt; b: Pt; floor: number; top: number; kind: string; material?: string; thicknessM: number };
type Opening = { id: string; kind: string; at: Pt; floor: number; wall?: string; widthM: number; heightM: number;
                 sillM?: number; to?: { at: Pt; floor: number };          // stairs, ladders, hatches, drops: the far end
                 joins: [string, string]; labels: [string, string];      // the titles either side, read from each
                 barrier?: string; seeThrough: boolean; frontier?: true; drop?: true };
type Roof = { id: string; outline: Pt[]; h: number };                    // indoors under it (PZ5)
type LightSource = { id: string; kind: string; at: Pt; h: number; candela: number; lit?: false };

type Belief = {
  status: 'unaware' | 'suspicious' | 'aware' | 'tracking' | 'hunting' | 'engaged';   // AWARENESS keys (src/scales.ts)
  lastKnownZone?: string;       // the title of lastKnownAt, for words (PZ11)
  lastKnownAt?: { x: number; y: number; floor: number };   // PZ11: where it was last made out
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  closedTurn?: number;          // YD6: last turn either side attacked or closed in, which keeps hunting and engaged alive
  revealed: string[];           // facts learned about the other actor, e.g. 'has_crossbow'
};

type Fact = { id: string; text: string };

type GameEvent = {
  id: string; turn: number; actorId: string;
  kind: string;                 // 'attack', 'move', 'vanish' (Strike and Fade), 'speak', 'call_help', 'alarm', 'arrival', 'presence', ...
  zone: string; target?: string;
  tier?: Tier;                  // absent for actions with no check, such as a plain move or speech
  effects: Effect[];            // structured; text is built per view, never stored
  noise: NoiseKey; visibility: VisibilityKey;   // NOISE / VISIBILITY keys (src/scales.ts); hearing: perception/noise.ts hearingOf (CONFIG.NOISE_DB, real metres, losses, background), CONFIG.SIGHT_M metres from the maker's body while it still stands at `pos`, else from `pos` (perception/index.ts madeAt)
  pos?: { x: number; y: number };               // where it happened: the actor's point (GSM-51: everyone always has one)
  perception: Record<string, { level: Perception; cue: Cue }>;   // absent = not perceived
  bark?: boolean;               // words beside a deed: copy no belief, but are real speech (BF67): listeners who hear them get the words, and the speaker's said list has them
};

type Effect = { kind: string; actorId: string; data: Record<string, unknown> };
```

#### Actor fields and agendas

- **GSM-200** The actor fields Part 2 relies on live in Part 4's sheet: control, morale, knowledge, knows, overrides,
  routine, routines and alarm in Mind; bandId, posture and label on the Actor itself; secretsKnown and namesKnown in
  Journal.
- **GSM-201** hasAgenda is derived, never stored: an actor has an agenda when it holds a secret, has a plan or has a
  memory note. It is computed when a dialogue call is routed, from turn-start state.

#### Routines

- **GSM-210** Routines, routine sets, activities and durations are library content, not saved state.
- **GSM-211** The routine bank is the only source of routines. Claude drafts entries offline from a brief the designer
  sets; the designer edits and approves them; the import validator checks them; only the designer promotes them to the
  library.
- **GSM-212** Agent Weaver picks one routine set per actor by id and binds its slots to zones; it never writes
  routines.
- **GSM-213** An actor's saved state holds its set's routine ids, its slot bindings, and its current routine with its
  anchor (Part 4 §9).

```ts
type RoutineSet = {                       // the bank entry Agent Weaver picks
  id: string;
  brief: string;                          // one line for the Weaver
  tags: { place: string[]; role: string[]; time: ('day' | 'night' | 'any')[]; event: string[] };
  slots: Record<string, { kind: 'zone' | 'route'; hint: string; optional?: true }>;   // hint: one line for the Weaver; optional: may be left unbound (RT)
  routines: string[];                     // [default, ...others]; becomes Mind.routines
};
type Routine = {
  id: string;
  brief: string;                          // one line for the Planner, Responder and Voice
  kind: 'schedule' | 'follow' | 'wait' | 'head';   // head (NW2): walk to slot 'dest', then back to the routine before it
  loop: boolean; steps: RoutineStep[];    // schedule only; NW10: the steps at any time of day `times` does not name
  times?: { at: TimeOfDay[]; steps: RoutineStep[] }[];   // NW10, NW13: the steps at some times of day
  activity?: string;                      // follow, wait and head only
  posture?: 'stealthy';                   // NS: the actor keeps stealthy while on this routine (the thief's prowl)
  alert?: string;                         // this routine's alert variant; listed in the same set
  onAlert: OrderTemplate | null;          // one order, fired once on alarm
};
type RoutineStep = { slot: string; duration: DurationId; activity: string };
                                          // a route slot expands to one stop per bound zone
type DurationId = 'brief' | 'short' | 'medium' | 'long';   // game minutes per id: DURATIONS (config, placeholders 5 / 30 / 120 / 360; NW10)
type ActivityDef = {
  id: string;
  look: string;                           // public text, e.g. 'dozing on a stool'
  attention: 'alert' | 'normal' | 'distracted' | 'asleep';   // a situational tag; the ruleset owns its value
  noise: NoiseKey; visibility: VisibilityKey;
};
// Tag values come from the library tag catalog. Slot names: see Slots, below.
```

- **GSM-214** A routine is a desired-state function: from the turn number and the actor's own ActorView it gives a
  desired zone and activity.

#### Schedule

- **GSM-220** A schedule routine runs on the clock (NW10). Its steps may differ by time of day: `times` is a list of
  entries, each naming one or more times of day (`at: ['evening', 'night']`) and the steps for them, so one entry can
  cover several times; no time of day is named twice (NW13). `steps` serves every time no entry names (the barkeep
  tends the bar from morning to evening and sleeps at night).
- **GSM-221** Code takes the steps for the time of day now and expands them: a step that reads a route slot becomes
  one stop per zone bound to that slot, in order, each with the step's duration and activity.
- **GSM-222** The desired step is found from the game minutes since the routine started (its `at`) through the
  expanded steps' lengths in minutes (DURATIONS), looping if loop is true, else holding the last step.
- **GSM-223** A loop starts at a random point along it; a startAt step starts there.
- **GSM-224** The desired zone is the actor's binding for the step's slot. A routine runs at the same speed however
  long a turn is.

#### Routines through the day

- **GSM-230** Every routine set says what its people do at each time of day, and none is for one half of the day only
  (RT1–RT9, NW17).
- **GSM-231** Gate and patrol guards are on duty from dawn to dusk, drink in the evening and sleep at night; night
  gate and night patrol guards are the mirror (on duty from dusk to dawn, asleep in the morning and afternoon).
  Careful patrol guards keep the same hours as patrol and night patrol guards (SE16).
- **GSM-232** The barkeep tends the bar from morning to evening and sleeps at night and dawn (the tavern closes when
  the night starts).
- **GSM-233** A patron sleeps at home from night to morning, is out in the afternoon and drinks from dusk.
- **GSM-234** A guest sleeps at night and dawn, eats in the morning, goes out in the afternoon and drinks from dusk.
- **GSM-235** A street worker walks to work at dawn, works through the day, packs up at dusk, rests at home in the
  evening and sleeps at night.
- **GSM-236** A thief sleeps at its refuge at dawn and in the morning and prowls from the afternoon on.
- **GSM-237** A field slime settles for the evening and the night. A companion follows at all hours.
- **GSM-238** Bandits have two sets: **bandit\_camp** (keep\_camp: idles and talks at the camp by day, drinks in the
  evening, sleeps at night; on alert it stands to at the camp, defend\_camp\_alert, and calls for help) and
  **bandit\_ambush** (ambush\_road: lies hidden at a spot beside the road from dawn to dusk, stealthy, activity
  lie\_in\_wait; on alert it rushes out onto the road slot, spring\_ambush\_alert, and calls for help; back at camp in
  the evening) (NR24 a).
- **GSM-239** A camp's lookout takes the gate\_guard set, posted at the camp's edge. Whether bandits strike or talk
  first is their band's stance, as for everyone.
- **GSM-240** Beds, seats and ways out (bed, seat, exit) are optional slots (`optional` on the set's slot): the Weaver
  may leave them unbound, and the actor then stays where it is at the times that read them.
- **GSM-241** A bed is never left blank: placed with a set that has a bed slot and none given, an NPC gets the nearest
  real bed within BED\_NEAR\_M (30 m, placeholder) of its own spots by the walking path, else its refuge, else its
  work spot (`withBed` in src/scenario/apply.ts) (BF68, BG-303).
- **GSM-242** One still without a bed in play sleeps where it stands when its routine says sleep (on a bed with room in that
  title if there is one, MQ13 a, MQ18), and the gap is filed once as a bug (bed_missing).

#### Time moves everyone

- **GSM-260** At the end of every turn, each NPC not in a fight, held, broken or surrendered, and not moved by its own
  agent or a trigger this turn, goes toward where its routine puts it at the new time, as far as it could walk in the
  time the turn took at the travel speed (travelSpeed, the road travel rule), less what its own move already walked
  (NW11, BG-151).
- **GSM-261** It is one jump, with no Claude calls; it stops at a way that is not simply open and at an unbuilt
  frontier, and a road is walked by its length.
- **GSM-262** A way it can open itself (its key turns the lock, or it is on the bolt's side) it opens and walks
  through when it happens out of the player's sight (no clear line from the player to the way within the glimpse range
  of someone walking, SIGHT\_M normal), and leaves it as it was where it can: the key locks it again from either side,
  but a bar slid back from its own side can't be drawn again from the far side, so it stays open (BG-316, BF85 a; CS11,
  Ali 13/11/2026).
- **GSM-263** Those travelling with the player spent the turn on the road.
- **GSM-342** \[Placeholder, to be tested\] Activity tiers (NP1 a, CONFIG.ACTIVITY\_TIERS): each turn only the NPCs
  relevant to the player are simulated in full: they get an order, act and make events. An NPC is relevant when (1) it
  is in the player's senses or has the player in its own; (2) its mind is on the player: it follows them, believes in
  them at Tracking or above, heads to where it thinks they are, or holds a goal or a plan trigger that names them; (3)
  it is in a fight or within sense range of a foe; (4) it is within sense range of anyone under 1 to 3; or the player's intent names it (its target, whom it speaks
  to, walks near or buys for); or something
  other than its routine takes its turn (a trigger, its agent, an alert, flight, a long action, a hold, a suspicion, a
  draw); or it stands at the edge of unbuilt ground, where its step in starts the building (NW3) and the catch-up
  stops. The rest get no order that turn: their routines move them at the turn's end by the catch-up above, and they
  still perceive what relevant actors do. Worked out afresh every turn (src/engine/tiers.ts); nothing about it is
  saved.
- **GSM-264** On a turn that took one action's time, each leg of the catch-up is a move event like any walk, perceived
  by the normal rules, so whoever sees or hears it (the player or an NPC) sees them go, and where to while in sight; a
  leg nobody perceives stays silent (BF2a-d).
- **GSM-265** Every jump is logged caught_up.
- **GSM-266** On a longer turn (a trade, a rest, a wait), every NPC's move, its own and the catch-up's, is perceived by
  the same rules and summed up for the Narrator as cameAndWent: one line per person the player noticed, legs in order,
  at most LONG_TURN_LINES lines and the rest "others came and went"; asleep, the player notices none (BF2e1 a, BF2e2 a,
  BF2e3 a, BF2e4 c).
- **GSM-267** A doorway right underfoot is crossed in 0 m and is still a leg (BG-151).
- **GSM-268** An NPC its own agent moved somewhere stays there for AGENT_STAY_S (config, placeholder 180 game seconds)
  before its routine or the catch-up moves it, unless its agent decides again (BF11). A head_to walk that gets there
  goes back to its routine.
- **GSM-269** Healing already counts minutes. After an 8-hour sleep, everyone is where their day has taken them. A
  sleep is stepped (see Sleeping and keeping watch), so it stops when someone hostile arrives.

#### Follow and wait

- **GSM-280** **Follow.** The zone where the actor believes the player is (its lastKnownZone, never the truth), with the
  routine's activity. In that zone, with the player believed there, it keeps after them at its own distance (a move near
  the player with follow set, BF35; `src/minds/routines.ts` routineOrder).
- **GSM-281** **Wait.** The zone bound to the actor's here slot, with the routine's activity. Code writes here when the
  actor switches to a wait routine.
- **GSM-282** Nothing is resumed: when control returns, the actor reads its desired state for the current turn.

#### Slots

- **GSM-290** Slot names belong to the actor, not to a routine: one binding per name, shared by every routine in the
  actor's routines list.
- **GSM-291** A zone slot holds one zone id; a route slot holds 1 to MAX\_ROUTE\_ZONES (config, placeholder) zone ids;
  the here slot is written only by code.
- **GSM-292** Shared routines, used by more than one set, read only the standard slots post, route, refuge, exit and
  here. A set may add its own slot names for its own routines.

#### Anchors

- **GSM-300** Code sets every anchorTurn; no agent sets one:

```
At install, with the Weaver's startAt:
  anchorTurn = currentTurn − (turns of the expanded steps before the first step that reads the startAt slot)
At install, without startAt:
  looping schedule: anchorTurn = currentTurn − rng.int(0, loopLength − 1)   // seeded; replay is exact
  otherwise:        anchorTurn = currentTurn
On a switch to another routine: anchorTurn = currentTurn
On a calm return:               the anchor saved in returnTo (Explore mode: Alarm)
```

#### Companions

- **GSM-310** Every player-band member uses the library set companion: follow (the default) and wait, each with an
  alert variant.
- **GSM-311** All four have onAlert null, so an alert never makes a companion shout during stealth play.
- **GSM-312** A player-band cast entry names this set and binds no slots.

#### Tiers and health

- **GSM-320** Tier comes from the ruleset. Health and body parts are Part 3's health track and per-body-type parts
  (SavedCondition, Part 4).

```ts
type Tier = 'critical_failure' | 'failure' | 'near_miss' | 'success' | 'great_success' | 'critical_success';   // keys of TIERS (src/scales.ts), worst first; names only via tierName()
```

#### Views

- **GSM-330** Six views are built from state:

| View | Sent to | Contains | Never contains |
| --- | --- | --- | --- |
| PlayerView | Agent Parser | Player sheet, current zone, zones and actors the player perceives | Hidden store, NPC beliefs, unperceived actors |
| ActorView | Code minds: routines, combat lists | The same fields as OppositionView, as structured data | The same as OppositionView |
| OppositionView | Agent Planner and Agent Responder, one per actor | That actor's condition and position, its beliefs, events it perceived (including the last few exchanges it heard), what it was told, its own last few spoken lines, passing remarks beside a deed too (SAID_LINES, so it does not repeat itself; BF67), its plan and memory note, its own secrets, its band's goals and relations; the brief of each routine in its routines list | This turn's player input (a Responder gets only the dialogue input), other actors' private knowledge, the player's true zone unless perceived, the player sheet beyond revealed, place facts and headlines, barks |
| DialogueView | Agent Voice | ActorView minus plan, memory list and agreements, plus its knows facts and the dialogue input | Hidden store, other actors' knowledge, place facts and headlines, barks |
| NarrationView | Agent Narrator | This turn's events the player perceived, with level and cue; player condition; visible surroundings; NPC lines the player heard; public stage text only; a label for each actor whose name the player does not know, and where each seen actor stands (zone, side, distance), half-seen ones too; the activity look of each actor in a presence event | Hidden store, NPC plans and beliefs, unperceived events, any number from a roll, damage, a pool or HP (code shows them in the mechanics panel); the tier, grades and hidden stage-plan fields; any tone hint from the tier |
| WeaverView | Agent Weaver | Tier and stakes group; the place or frontier being planned and its ancestors' headlines; the zones near the player and the target (WI8 a) and the actors in them, with their plans and secrets; quests, band goals; player level, current class, health-track level; the previous Weaver note; catalog ids, including routine sets with their brief, tags and slot hints | Skill growth, Burden, Potential; this turn's player text |

- **GSM-331** OppositionView is ActorView plus prompt formatting. It serves allies and companions as well as enemies;
  the name is kept for continuity.
- **GSM-332** Place facts and headlines (Part 4 §5) go only to PlayerView, NarrationView and WeaverView.
- **GSM-333** NPCs learn only through perception, communication events and their knows list.
- **GSM-334** Build every view deny-by-default: copy whitelisted fields into a new object. Never copy full state and
  delete fields from it, because a field added later would leak silently.

#### Gear in views

- **GSM-340** Gear in views follows Part 5 §8: each actor sees its own inventory by name, kind, slot and mode ids; on
  actors it perceives fully it sees held items, shield and armor by public look, accessories only when tagged visible,
  concealed items only once revealed, and never stowed items; it sees ground items in perceived zones.
- **GSM-341** No view holds a gear number.
