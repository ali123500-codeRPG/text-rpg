# Bug fix log

Every fixed bug (BG-n): what was wrong, and what was done to fix it. Newest first.

This is the one home of each bug's story: the Bug log row is one line and the PR links here. **Fixed by** names the
claim issue (`#n`). Entries up to BG-326, which name the PR, are in `docs/bug-fix-log-archive.md`. Where an older Bug log row held more than its entry (a question
ID, a PR, a code name), the entry ends with that row as filed, kept when the rows were cut to one line (#1160).

Every thread that fixes a bug adds its entry here in the fixing PR, newest at the top: every
fixed row in the spec's bug log, docs/spec/bug-log.md, has one. Entries up to BG-189 were filled in from that bug log: the fix as the log
words it, or, where the log only names a PR, that PR's title.

## BG-348

**What was wrong:** On `?fake=1&stage=bent-nail` the name "back yard" stood on dark, unseen ground: on the Map at the 40 m and 60 m zoom steps, on the minimap from its first 25 m view, and on the Map's fitted view in a 1100 px window. MAP-16 puts a name in the biggest seen part of its title, never on ground not seen. It happened on `main` before #1408 too.

**Root cause:** The layout fitted each name to its title's biggest seen rectangle (`zoneNames` in `src/ui/mapPlan.ts`, BG-313), but the view (`render` in `src/ui/planView.ts`) used that name only when the whole zone was in view and the name fitted. Otherwise it fitted the name again with `nameFit(z.name, c)`, `c` being the zone's whole box cut to the view: the seen part was never read. So a zone partly out of view, or a zone whose seen part is too small for its name, had its name centred on the zone's box, here on the back yard's unseen ground.

**What was done:** A zone's name keeps the room it was fitted to (`SLabel.room`, its biggest seen rectangle or the zone's box when it has no fog record), and the view fits a name partly out of view to that room's part in view, or shows none; a name that does not fit its seen room shows on hover only, as MAP-20 says. Checked by zooming every step in and out on the four fake pages (default, bent-nail, one-room, long-names), on both maps, in a 1600 px and an 1100 px window, sampling each drawn name against the fog: none on ground not seen.

**Fixed by:** #1416

## BG-346

**What was wrong:** Zooming the Map in once or twice on `?fake=1&stage=bent-nail` (60 m across, zoom 1.56) logged "MAP-20 label label:tavern.common does not fit zone tavern.common": the common room's name, drawn at 31.5 px in the part of the room in view, stood 5.8 px from that part's top edge, short of the 6 px MAP-20 asks. The smoke test checks only the first view, so it passed.

**Root cause:** The layout guessed how tall a name's letters are (1.3 times their size, the first baseline 0.36 times their size below the middle) and never measured it (`zoneNames` in `src/ui/mapPlan.ts` and its copy `nameIn` in `src/ui/planView.ts`), while the checker measures the drawn text's box, which the browser makes from the font's own ascent and descent: 34 + 10 px at 31.5 px for HISAB Round, 1.4 times the size. The widths were measured in the browser; the heights were not. So a name sized against its room's height stood up to 3 px taller than planned and sat about 0.7 px high. The 1 px of spare padding and the letters' 3 px edge hid it, except where the room's height bound the size at large letters, here at the in-view part of the common room. RM24's one 13 px size shrinks the gap to about 1 px, inside the spare room, so it would have hidden the fault, not removed it.

**What was done:** The map's measure gives a style's line height too, the font's ascent and descent from the canvas (`fontBoundingBoxAscent` and `fontBoundingBoxDescent`, which match the SVG text box to 0.02 px), and one function, `nameFit` in `src/ui/mapPlan.ts`, sizes and places every zone name from it for both the layout and the in-view part of a zone, the copy in planView gone. A name's first baseline is its box's top plus the ascent. Checked with the names forced to 31.5 px: no MAP-20 finding at any zoom on the three stages; at the 13 px of RM24 none either, zooming each stage in and out on both maps.

**Fixed by:** #1378

## BG-345

**What was wrong:** The sleep bonus (FT8, SLEEP_SPOT_MULT: bed 1, elsewhere 0.75) went to anyone asleep in a title with any bed in it, wherever in it they lay, so sleeping on the floor beside a bed and on the bed were the same: nearness by room, which `AGENTS.md` rule 8 rules out. Nothing held a bed, so two sleepers could share one, NPCs slept wherever they stood in their bed slot's title, and the player's Sleep on a bed (MAP-85) stopped short of the bed.

**Root cause:** `sleepMult` in `src/engine/fatigue.ts` asked `furnitureIn(state, a.zone).some((f) => f.kind === FU.bed)`: the room, not the sleeper's point. FT8 (13/11/2026) was ruled as "in a zone with a bed", from when a bed was the title in an NPC's bed slot; beds now stand at a point with a footprint (FR1, PC1 `pieceBox`), but the bonus and NPC sleep (`settleSleepers`: asleep "where it stands" in the title) were never moved onto them, and nothing recorded who lay on a bed. The player's walk to a bed used the generic furniture spot, `inset` a body's width toward the room's middle, so it ended about 0.8 m off the bed.

**What was done:** The owner's MQ13 a (Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors"): "a, if I find an NPC sleeping, I expect them to be physically located at the bed." A bed holds one sleeper. Someone falling asleep within BED_REACH_M (1 m, placeholder) of a free bed's footprint lies down on it (`fallAsleep`: the point moves to the bed's middle) and holds it while asleep (`Actor.asleep.bed`); waking frees it. `sleepMult` gives the bed's speed only to one holding a bed (awake, to one beside a free bed, for the sleep length and Catnap). An NPC going to sleep is walked by the clock (`catchUp`) to a free bed of its sleep title, and falls asleep once beside it (`settleSleepers`); with none free it sleeps where it stands there, without the bonus. A walk to a bed (`spotPoint`) ends on it. The player's Sleep on a bed someone else lies asleep on comes to nothing (`wait_blocked`, `bed_taken`); in a shared night the player lies down first. A collapse (FT10) still drops where it stands. Old saves: a sleeper saved before this holds no bed and sleeps at the elsewhere speed until it wakes; no migration. Spec: Game clock (Sleeping on a bed, Sleeping NPCs), FT8 in the Health track, MAP-85's open discrepancy removed, GSM-242.

**Fixed by:** #1377

## BG-343

**What was wrong:** An ambush (an attack on someone unaware of the attacker, OQ-4) rolled the attacker's weapon skill (`ambushSkill` in `src/minds/state.ts`: the weapon's mode skill, else the body's fallback attack skill) against one perception roll per watcher, by the event's single best cue. ST2 (08/11/2026) says Combat Stealth is the skill for an attack, and the stealth contests per sense (D-40) never reached the ambush. So a fighter with no stealth ambushed as well as a trained sneak, a sneak with a weak weapon ambushed badly, and a shot from hiding rolled twice: the ambush, then its own Combat Stealth notice contests (BG-263).

**Root cause:** `resolveAmbush` was written with the first prototype (07/11/2026), when the spec left the ambush skill as a stub ("Which skill makes the ambush roll is a ruleset matter (stub)", Explore mode, Ambush step 1). ST2 settled Combat Stealth for an attack the next day, but it was built only into `stealthDetect`; the stub and `ambushSkill` were never revisited.

**What was done:** The ambush rolls nothing of its own (Ali, 20/11/2026: "combat stealth obviously. and they should roll as any combat stealth roll and not something special, the only special thing should be the outcome"; decision card AQ1–AQ4, all a). `resolveAmbush` runs the attack's own stealth contests (`stealthDetect`: Combat Stealth with light, cover and the hide tag, one contest per detection sense that reaches each unaware watcher, once per turn) before the blow, from hiding or not. They decide who notices and the surprise: the target is caught off guard only when it rolled and every sense lost (a win or a tie on any sense is no surprise), and a later blow in the same turn keeps that result. Against the Odds counts once for the act (CS25). A winner against an attacker who isn't hidden is alarmed at once, as before. `ambushSkill` is gone. The library's Actions tab shows the ambush as Combat Stealth against sight, hearing and smell (its senses list had also missed smell since D-40). Spec: Explore mode's Ambush steps, NS6, ST2, the Contests line.

**Fixed by:** #1304

## BG-341

**What was wrong:** Eight case tests ran at a distance other than the one they named, and CI stayed green. `beside()` (`tests/harness/village.ts`) stands an actor `m` metres east, else west, of another, who usually stands in the title's middle. When neither side fit (any gap over about half the title's width), it left the actor outside the title. A spot outside its title reads as the title's middle, and the next `placeAll` (the start of `resolveTurn`) stood it near the middle: 5 m in the 8 m common room, or 10 m in the 20 m square, became about 0.8 m. Affected: s323 (5 tests), s321's shot from hiding, s270 AT11c/AT47, and s221 SE14 (meant to be outside the search area, it ran inside it). A second fixture slip of the same kind: `tinyArea()` in s221 set `CONFIG.SEARCH_RADIUS_AT_0_M` and then called `makeVillage()`, whose `resetConfig()` put the default back, so LX5 b and LX7 a ran at the default radius. LX7 a's comment ("searchReach … a radius of 6.2 m") was wrong too: no perk or achievement gives searchReach.

**What was done:** `beside()` throws when neither side fits, and `byDoor()` throws when its spot falls outside the title. A new `westEdge()` stands the reference person at the west edge first, so the gap fits; the eight tests use it and pass at the distance they name. `tinyArea()` became `smallVillage()`, which sets the radius after `makeVillage()`, and the file resets CONFIG after each test. LX5 b now checks that the radius is the 2 m floor, and LX7 a checks that ring two's shift was taken. LX7 a's comment is corrected. Found with the balance probe (`npm run measure`), which checks the gap of every trial.

**Fixed by:** #1275

## BG-340

**What was wrong:** A crossbow shot did not lock movement and paid base strain instead of Hard, against ACT-33 and ACT-114. `attackRowIds` (`src/ruleset/actionTime.ts`) lists a crossbow's spanning row before its shot row, and `orderCost` (`src/engine/resolve.ts`) took the first row as the one that governs the action (lock, focus, effort). That was right while spanning took time; since TP8 a made every spanning instant (0 s), the 5 s shot ran under a row with no `locksMove`, no `focus` and effort `base`. A crossbow shooter who also moved walked 8.4 m that turn instead of the 1.4 m the shot's lock leaves.

**What was done:** `orderCost` takes the first row that takes any time as the governing row, so an instant spanning leaves the shot's row in charge, and a spanning that takes time (none today; `tests/cases/s270` stands one in) is still one long action under its own row. The seconds are unchanged (the rows summed). `tests/cases/s113` now checks a crossbow shot's lock through a whole turn. The stale HOSTILE\_NEAR\_M comment in `src/config/clock.ts` names hostileNearM.

**Fixed by:** #1291

## BG-338

**What was wrong:** `/undo` could say "there is no turn to undo" and keep the undone turn on screen while the save had already gone back a turn. `undoTurn` (`src/save/index.ts`) writes the head first (that is the commit), then deletes the undone turn's record and cleans up. All three steps ran in one `guard` marked not committed, so a failed delete after the head write came back as an uncommitted `SaveError`. The `/undo` command (`src/agents/game.ts`) read every uncommitted error as "nothing to undo" and returned without reloading. Reproduced with the whole-turn harness: two turns, then `/undo` with the delete of turn 2's record failing. The head was on turn 1 while the screen stayed on turn 2 with the "no turn to undo" line.

**What was done:** `undoTurn` runs the steps after the head write in their own `guard(..., true)`, as `saveTurn` already does. `/undo` reloads on a committed error, since the turn is undone, and says "no turn to undo" only for `nothing_to_undo` and `no_save`. Any other failure before the commit says the undo could not be saved and that nothing changed. The test store's `failNext` now covers deletes too. Case 407 fails that delete and checks that the head and the screen both go back; it failed before the fix. Siblings checked: `saveTurn` already marks its after-head steps committed. `amendHead` and `loadStory` write the head last. `restoreBackup` and `useBookmark` only reload after their head write, which is reworked with the refused-load recovery (YS1).

**Fixed by:** #1225

## BG-327

**What was wrong:** Someone the player saw earlier but cannot see now was never drawn on the Map or listed in a zone card, against MAP-45; on the default fake page the slime last seen in the field was missing. PlayerView's `lastSeen` gave each person's zone as the zone's name (`src/views/index.ts`), while every other `zone` in PlayerView, and every reader of it, is the zone's id. The Map filed people under that value and looked them up by id, so no last-seen person was ever found. The same mix-up showed in the action deck: a seller last seen elsewhere was compared by id against a name, and a "last seen in" note fell back on whatever string it got.

**What was done:** `lastSeen[].zone` is now the zone's id, as everywhere in PlayerView, with its name beside it as `zoneName` (the shape `cameFrom` already has), so the Parser still reads where someone was last seen. The deck's "last seen in" note reads `zoneName`; the Parser's rule names both fields. A whole-turn test has the player look round the tavern and step out, and checks that the barkeep and the patron left behind show in their rooms on the Map, with no point; it failed before the fix. The BG-28 scenario test now checks the id and the name. Siblings checked: every reader of `lastSeen[].zone` (the Map, the deck's talk and buy lists, the Parser's legality check, the agents' wrappers, the save check).

**Fixed by:** #1156

## BG-337

**What was wrong:** A save counts once its head is written (save flow, step 5), but `finishTurn` (`src/agents/game.ts`) did two things after a failed head write as if the turn had been saved. It saved the turn's story text, and it raised the Universe day. Play goes on from memory after a failed save, so nothing showed until a reload: the save was a turn back while the story column still held the turn that was never saved. Replaying it then put two different narrations of the same turn in the column, with no "Undone" fold between them. The Universe day could also move past every saved world. Reproduced with the whole-turn harness: with the head write failing on turn 3, the head stayed on turn 2 and the saved story text held turns 1 to 3.

**What was done:** `finishTurn` notes whether the save committed. The story text and the Universe day follow the commit. A turn the save does not hold keeps its lines in memory, so the next good turn saves them along with its own (that turn's pages carry the unsaved turn's changes too). A reload finds the story text and the save on the same turn. Case 406 fails a head write and checks both. Siblings checked: everything else `finishTurn` writes after the save. Bug filing and the background planning run from memory, and their results are saved with the next turn. Restore already cuts story text (BG-161). Undo keeps the undone turn's text on purpose (PS-210).

**Fixed by:** #1218

## BG-336

**What was wrong:** `saveTurn` writes the story meta (`stories/<id>`) together with the pages, before the head. It has to, because a load needs both. But the story lists (`listStories`, the free-world list and the Hall of fame, all through `allMetas` in `src/save/index.ts`) took any meta as a story. So when the first head write of a new story failed, a story with no save existed. In a carried-on world that meant someone still lived there: on every reopen the kept build tried to start the opening again and was refused with "that world is no longer free". The world could never be carried on again. Reproduced through `createGame` with the opening's head write failing.

**What was done:** `allMetas` skips an unarchived meta whose story has no head, because a story exists once its head is written. Only unarchived stories need the extra read: one or two per list in play. A reopen now starts the interrupted opening again in the same world. The unit test fails the first head write of a story carrying a world on and checks that the story is not listed and the world is still free. Siblings checked: `storySaved` already reads the head; the Hall of fame lists only archived stories.

**Fixed by:** #1218

## BG-335

**What was wrong:** When a turn landed, the story jumped to the very bottom of the new turn, past its prose to the last results row (the wound card, coin, skills), so the narration was already off the top of the pane while it was still revealing sentence by sentence. The cause was the play screen's stick-to-the-foot scroll (`src/ui/play.ts`, `update`): while a turn runs it keeps the waiting line in view, and the same line ran again when the turn landed, setting the scroll to the whole story's height. The turn is drawn in its final state at once (M-74), results included, so "the foot" was the end of the results. The story pane is short beside the action deck, so most combat turns are taller than it.

**What was done:** A turn that lands now opens at its start: the order the player gave, then the prose (PS-214); the story keeps to its foot only while a turn runs, and later redraws leave the scroll where the player put it. The browser smoke test plays a turn into a short story pane and checks that the order line is in view; it fails with the old scroll.

**Fixed by:** #1209

## BG-334

**What was wrong:** Body parts reached the player as ids: "Your right_leg is Damaged" in the turn's changes, "crushing hit, right_leg" on the roll line and the strike card, and the same in the line the Narrator is given for each blow, which it can repeat in the prose. Two places in the views (`src/views/index.ts`) wrote the part's id into text: the combat packet's location and the "is Damaged" condition change. Every other place already used the part's name (`partName`). A scan of the text of every code-built story line over all scenario and soak tests found no other id.

**What was done:** Both places now give the part as words through `partName` ("right leg"), so the roll line, the changes row, the hit cards, the "You fell" screen and the Narrator's packet all read words. The play screen's result rule for a blow is now one function for the player's roll line, the rolls against the player and the hit cards. A whole-turn test aims a blow at a leg and checks that no id reaches the line's text; it fails without the fix.

**Fixed by:** #1209

## BG-333

**What was wrong:** The play page's header showed the turn of the last story line (the last turn played, the number its turn record and replay use). The GM page's Turn readout showed `state.turn`, which the pipeline moves on to the next turn as soon as a turn is saved, so in play it was always one ahead. A reload put them back in step until the next turn, which is why it looked random. It was not tied to carrying a world on.

**What was done:** The turn shown is the last turn played. One function, `turnShown` in `src/ui/kit.ts`, gives it, and both the play header and the GM page's Turn readout (and its "Start a new save" warning) read it. The carry-on test checks it: after the opening of turn 13 the state names turn 14 and both pages show 13.

**Fixed by:** #1206

## BG-332

**What was wrong:** Carrying a world on (`carryOn`, `src/save/world.ts`) built the new story's state from the fresh one and copied over a hand-kept list of the world's fields. The floor plans (walls, doorways, roofs, light sources, furniture; PZ2, PZ5, FR1) and the items lying on the ground (PZ11) came after that list was written and were never added to it, so a carried-on world kept its places, people and facts but lost every wall, doorway, roof, lamp, piece of furniture and dropped item. The slime: the lamps were gone and the roofs with them, so at night a room was only moonlit, which counts as dark, and in the dark everyone is seen only partly. The minimap draws people seen partly; Who's here lists, and attacks target, only those seen in full. Measured on the test village at night: with the floor plan lost, everyone in the tavern was seen only partly; with it kept, in full. A plain save and load was never affected: its round trip keeps every field.

**What was done:** `carryOn` now starts from the whole world and replaces only the new story's own fields (who plays, the story id and meta, settings, seed, mode, quests, the per-turn logs), drops the last story's fight and per-turn state as before, and moves the turn, pending turn, stage and plans on as before. World state added later stays by itself. A carry-on test saves a furnished, lit world at night with an item on the ground, carries it on through the real new-story flow, loads it, and checks that every saved field is in one of three lists (kept as it was, kept and moved on, the new story's own), that every kept-as-it-was field matches the saved world, and that the newcomer sees everyone in the lit tavern in full. It fails on the old code (walls lost).

**Fixed by:** #1206

## BG-331

**What was wrong:** The Character page's Perks tile showed "1" for a new character, but the Perks board it opens showed no perk at all. The tile and the board each had their own rule. The tile counted every perk held and awake except the race's and the essences'. The board drew only three kinds: perks on a skill's ladder (Innate for the race's, Linked for links). A class perk, such as Swordsman's Blade Against Blade or Unwritten Legend's Any Road Will Do, which a classed Start gives at level 1, sits on no ladder, so it was counted and drawn nowhere. The same held for a Start's blessing, an achievement's perk, a Threadbound item's, an All-step's and Hollowed.

**What was done:** One rule, heldPerks in src/ui/perks.ts, is now what the tile counts. The board adds a Granted list beside Innate, in the same look, for every held perk that the ladders and Linked do not show, each tagged with where it came from (Class, Start, Achievement, Threadbound, All-step, Inflicted) and with its Story / Effect write-up. A test checks that every perk the tile counts shows in exactly one place on the board (spec PS-256).

**Fixed by:** #1208

## BG-330

**What was wrong:** The browser smoke test "BF66: a landed blow shows the strike card…" failed now and then on `main` (twice on 20/11/2026): the Send click timed out, the button first "not stable", then "not visible". The test sets up a straw dummy to hit, made as a copy of the player with its weapon taken away. Standing, it still had the player's skills and fought back with its fists, and the test keeps attacking for up to eight turns until one blow lands. When the player's first blows missed, the dummy's took about 45% of the player's health a turn (measured: 0, 48 and 91% lost over three turns), and the player fell. The fall shakes the play screen (not stable) and then hides it behind "You fell" (not visible). The game was right; the test's dummy was not a straw dummy.

**What was done:** The dummy starts down. It never acts, so it cannot strike back, and its defence fails outright, so the first blow nearly always lands. The test still checks the same things: the strike card shows as the turn lands, it is animated, and a click on the story keeps it. Measured locally before the fix: 1 failure in 6 runs, the same fall. After it: 13 of 13 runs passed, the player unhurt in every one, and the whole play smoke file passed.

**Fixed by:** #1202

## BG-329

**What was wrong:** A perk move's list of targets (which the action deck offers, and which an NPC's agent is shown) left out only those out of range. The engine refuses more than that: Bluff works only on a foe, so an ally in reach was offered and then refused as not a foe.

**What was done:** The list now also leaves out anyone the engine would refuse as not a foe, using the engine's own check; a move already spent this fight still lists its targets. A scenario test puts a foe and an ally in reach and checks that only the foe is offered for a bluff.

**Fixed by:** #1193

## BG-328

**What was wrong:** The save check required exactly one current class whenever an actor knew any class. That rule dates from the first prototype, before classless starts (CC6 b): a Start with no class begins with Commoner open but no current class (SHEET-50, SHEET-95), so its save would have been reported broken. No Start is classless today (SHEET-97), so no player met it; it was found while settling the actor-sheet discrepancies.

**What was done:** The check now allows at most one current class, as SHEET-50 says, and still reports an actor with two. A scenario test builds a classless player and runs the save checks on it, and checks that two current classes are still caught.

**Fixed by:** #1175
