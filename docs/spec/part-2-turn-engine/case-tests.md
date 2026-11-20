### Case tests

One hundred and three tests: the original eight, updated, eight for the rev. 2 changes, ten for Explore mode, twenty for scenario setup, fourteen for the actor-control review, one for scenario-plan bands, thirteen for the routines review, ten for the hit roll, fourteen for gear and five for fallback behavior. Each runs against logged agent outputs, so it is repeatable.

| # | Test | Passes when |
| --- | --- | --- |
| 1 | Ambush stays hidden | A guard's ambush trigger is set on the bridge; over the turns before it springs, the Narrator's text contains none of its terms |
| 2 | Simultaneous turns | A Planner call's logged input has no trace of that turn's player text; a dialogue call's logged input has only that turn's spoken words and impressions |
| 3 | Stealth, per observer | The player hides from guard 1 (success) and guard 2 (failure); guard 1's next view shows suspicious with the old zone and its orders target that zone; guard 2's shows aware |
| 4 | Partial perception | An enemy moves out of sight noisily; the Narrator describes the sound only, with no name |
| 5 | Plan persistence | A trigger written on turn 3 fires on turn 7 without the Planner ordering it again |
| 6 | Malformed Planner output | The game continues with combat lists and routines and logs the failure |
| 7 | Mode switch | Explore turns make no Planner call; the first hostile actor who becomes suspicious switches the next turn to Tactical, and only that actor gets a Planner call |
| 8 | Replay | The same saved state, RNG state and logged agent outputs reproduce the same events, run under the library version the turn record names |
| 9 | Knowledge isolation | Guard 1 sees the player; guard 2, out of earshot, has no belief about the player until it perceives guard 1's shout, and then holds suspicious with source: 'told' |
| 10 | NPC hears the question | In a dialogue turn, each spokesperson's logged input contains that turn's spoken words and never the player's action type, move or approach |
| 11 | Same dialogue shape | An ordinary and a guarded conversation make the same number of calls in the same order, and show results at the same time |
| 12 | Voice can't invent facts | A Voice output sharing a fact outside knows is rejected and replaced |
| 13 | Clarify keeps Planners | After a clarify question: turn unchanged, no events; when the player answers, the turn resolves with the Planner outputs logged before it, within one session |
| 14 | Trigger fires once | A once trigger whose condition holds at turn start and mid-turn fires exactly once |
| 15 | Perception at the moment | A guard downed in step 2 perceives step 1's event and not step 3's |
| 16 | Same roll code | Player and NPC attacks pass through the same ruleset.roll and ruleset.attack path (unit test) |
| 17 | Patrol is heard | A patrol crosses a zone linked to the player's; NarrationView has a partial move event with cue sound and no name |
| 18 | Sneaking persists | The player sneaks on turn 1 and moves on turns 2 and 3 without saying "sneak"; detection on turn 3 uses the contested roll |
| 19 | Open player is seen | An open player's major action in view of an unaware guard makes the guard aware with no check or roll; at partial perception the guard becomes suspicious |
| 20 | Detection is individual | Guard 1 detects the player; guard 2 elsewhere stays unaware, keeps its routine and gets no Planner call until it perceives a communication event |
| 21 | Successful ambush | The target's order source is routine and no Planner call is made that turn; next turn only engaged actors get Planner calls |
| 22 | Failed ambush | The target is aware before the blow; its order that turn is its onAlert order; no Planner call that turn; next turn its Planner order is used |
| 23 | Silent kill | Nobody perceives the attack; the next turn is Explore |
| 24 | Same shape after submit | Explore and Tactical make the same sequence of calls after submit, and resolution never starts before the previous display plus BACKGROUND\_WINDOW |
| 25 | Late Planner | A Planner call not back by BACKGROUND\_WINDOW gives that actor its type's combat list, discards the whole output and logs planner\_late |
| 26 | Code minds read ActorView only | Routine and combat-list functions can't receive GameState (type-level test) |
| 27 | Story start | Turn 0 makes one event roll, one Weaver call and one Narrator call, and is saved as turn 0 |
| 28 | Place change is not a scenario | The player walks from the bar's zone to the street's zone (two places, one stage): no event roll, no Weaver call |
| 29 | The fight spills outside | An engaged NPC follows the player from the bar into the street; its placeId changes with its zone, and the turn stays Tactical |
| 30 | Background extension | With the player in a zone linked to a frontier, one Weaver call starts after the save, is logged, and is not applied before the player crosses |
| 31 | Crossing reuses the tier | Crossing applies the held extension with the scenario's tier; no event roll is made |
| 32 | Late extension | The player crosses before the extension returns; the turn waits for it, and no fallback is used |
| 33 | Grades must fit the tier | A Failure-tier plan with gain major fails validation, gets one repair retry with the errors, and the corrected plan applies |
| 34 | Fallback is flagged | A plan that fails twice yields the fallback stage, and all four flags appear: stage record, weaver\_fallback log, GM banner, play-screen marker |
| 35 | Stakes only | A Failure-tier plan whose threats are unaware and unalert passes validation |
| 36 | Event-roll modifiers | A perk naming the event roll changes its total; a Wounded health level and a terrain bonus do not |
| 37 | Natural edge | A natural 01 on the event roll lowers the tier by one, never two; only the lowest and highest NATURAL\_EDGE results shift a tier |
| 38 | Hidden terms | A public zone description containing one of the plan's hiddenTerms fails validation |
| 39 | Opening narration covers who is seen | Every full presence event appears in the Narrator's narrated list; a narration that omits one fails the fact check |
| 40 | Nothing hidden in the opening | The logged NarrationView at scenario start holds no tier, grade, event summary, Weaver note or opening belief |
| 41 | Labels until names are known | The opening uses the stranger label; after a line in which the speaker says their name, the next NarrationView uses the name. A bandmate named in front of the player is learned too; a false name, or someone named out of sight, is not. An NPC who hears the player give their name keeps it (BG-95). A name said of someone out of sight is heard of and attaches when they answer to it (NM2); a believed false name is what the player calls them, a caught one is not; a passing remark still teaches a name (NM3, NM6) |
| 42 | Sneaking arrival | A sneaking player crossing a frontier triggers detection tests; the plan's opening beliefs are not applied to those observers |
| 43 | One belief writer | Opening beliefs on open entry are written through updateBeliefs only (unit test) |
| 44 | Undo rerolls the hand | Undoing the scenario-start turn and redoing it makes a new event roll and a new Weaver call |
| 45 | Replay of a scenario start | Saved state, RNG state and the logged Weaver output reproduce the same stage, with no Weaver call |
| 46 | Built ground stays live (WI8 a) | A save whose way into built ground carries the old re-entry mark loads it as a plain way, with no Weaver call; every built zone is live; the planners see the village around the player and ground within PLAN\_VIEW\_WAYS ways, not past it |
| 47 | Words beside an attack | The player speaks while attacking: the words are a bark, no dialogue call runs, and only those who heard them have the words (BF67) |
| 48 | Barks copy nothing | An NPC shouts a warning while attacking; listeners' beliefs are unchanged |
| 49 | Deed instead of a reply | An addressed Responder attacks instead of answering: no line is spoken, and the attack resolves at its own initiative |
| 50 | Addressee's Planner | On a dialogue intent the addressee's background Planner call is cancelled; on a clarify question it is kept |
| 51 | Impression only | A deceive check reaches the dialogue call as an impression; the logged input contains no action type |
| 52 | Two bands addressed | Two spokesperson calls run in parallel, each with its own impression; replies resolve in initiative order |
| 53 | Calm bandmates \[Proposed\] | A Voice spokesperson switches to a leave routine; a calm bandmate who heard follows next turn; one who didn't keeps its routine |
| 54 | Allies engage | Guards hostile to bandits engage them without the player present; the guards get Planner calls, and with the player away the turn stays Explore (BF14) |
| 55 | Companion follows | The player moves two zones; a following companion walks one link per turn toward its believed zone, never jumping |
| 56 | Back to the post | A guard pulled off its post walks back and takes up the zone and activity its routine gives for the current turn (from its anchorTurn) |
| 57 | Inert when down | An incapacitated guard gets no order, its ambush trigger doesn't fire, it isn't engaged, and addressing it makes no dialogue call |
| 58 | Derived agenda | An NPC voiced by the Voice gains a plan; next turn the Responder voices it; no save field holds hasAgenda |
| 59 | Place facts stay player-side | No OppositionView, DialogueView or ActorView contains a place fact or headline |
| 60 | Secret slips | A persuade check that meets a check\_passed reveal sets SLIPS; the secret is revealed and the Narrator's leak scan passes |
| 61 | Bands from the plan | A plan creates a smugglers band hostile to the guards' band and sets the guards suspicious of it; each guard gets a suspicious belief about every smuggler on the stage, written through updateBeliefs, and one guard's personal stance overrides its band's relation |
| 62 | Slots per actor | A gate guard's default routine and its alert variant both read its one post binding; the plan binds post once |
| 63 | Route expands | A patrol bound to a three-zone route desires each zone in order, each for the step's duration, then loops |
| 64 | Anchor from startAt | A cast entry with startAt: route places the actor at the first route stop; the logged plan holds no anchorTurn |
| 65 | Phase from the RNG | Two gate guards on one set without startAt get anchors from the seeded RNG; replay reproduces them |
| 66 | Durations are ids | Changing DURATIONS.short changes every step that uses short, with no bank edit |
| 67 | Routine-only degrade | A plan with an unbound route slot fails, gets one repair retry, fails again: only that actor gets idle\_here, the rest applies, all four flags appear |
| 68 | No frontier bindings | A slot bound to a frontier key fails validation |
| 69 | Invalid switch | A Voice output naming a routine outside the actor's list is dropped; the current routine is kept; invalid\_routine is logged |
| 70 | Wait binds here | A companion told to wait stays in the zone it was in when it switched; told to follow, it follows again |
| 71 | Alert keeps the wait | A waiting companion that hears a fight switches to wait\_alert in the same zone, and returns to wait after DECAY\_TURNS |
| 72 | Calm return in phase | A worker alarmed on turn 10 and calm on turn 16 returns to its work routine with its original anchor |
| 73 | Bandmate skip | A calm bandmate whose list lacks the spokesperson's new routine keeps its own routine; routine\_skip is logged |
| 74 | Import rejects | A shared routine that reads slot counter is not promoted, and the error names the slot |
| 75 | Attack floor | An attack whose shifted tier is Failure or worse logs a miss and makes no defense roll |
| 76 | Gap ladder | With forced dice, gap +1 against dodge gives 0.8×, and gap 0 against block lands on a Non-essential part or the general area |
| 77 | No clamp | Critical Success plus a natural 00 gives Critical Success with beyond 1; the packet shows Critical Success+ |
| 78 | Ladder ends | A gap of +6 or −6 uses the ±5 entry |
| 79 | Named part | At gap −2 a hit rolled on the general area moves to the named left leg; one rolled on an arm stays |
| 80 | Aim is code-set | The Parser output never carries aimed; /aim sets it for one turn only |
| 81 | Forbidden part | An aimed head attack against a dodge tie lands in the general area |
| 82 | Shield routing | A block with a shield at gap 0 damages the shield's pool and not the health track |
| 83 | Cover | A ranged attack into a cover-2 zone adds +2 to the gap |
| 84 | No numbers to the Narrator | The combat packet in NarrationView holds no roll, margin, damage, pool or HP value (unit test) |
| 85 | Packed sword does nothing | A sword stowed in the inventory adds no skill bonus to a melee hit roll; drawn, it does |
| 86 | One copy counts | Two identical lucky charms give the same event-roll modifier as one |
| 87 | Carried charm | A charm whose entry names the event roll and is active when carried modifies the roll at scenario setup; one without the event roll never does |
| 88 | Tool auto-pick | A lockpick action with two lockpick kits carried uses the better one; with both hands full, the off-hand item is stowed and no action is spent on it |
| 89 | Crippled arm holds | A shield arm goes Crippled: the shield stays held, no block is offered, the hit table gains no change |
| 90 | Destroyed arm drops | A Destroyed sword arm puts the sword on the zone's ground; an observer perceives an item\_dropped event; pick up returns it |
| 91 | Free gear ops | A turn with draw, swap and pick up plus an attack resolves one main action; armor on or off beside an attack still lets the blow come, for the player and an NPC alike |
| 92 | Reach | A spear (2.8 m) can't reach the next zone; a shortbow (50 m) hits a target one linked zone away with sight; the same shot through a link without sight becomes a wasted action |
| 93 | Thrown | A thrown dagger ends on the ground of the target's zone, hit or miss |
| 94 | Uncovered part | A hauberk covering general area and arms: an aimed head hit takes no armor, a torso hit does |
| 95 | Stacked armor | An actor whose race has natural armor wearing armor takes damage reduced by worn, then natural, floor 0, not rounded |
| 96 | Armor pool | A head hit on a piece with a helm pool drains it before the head pool; the health track ignores the helm pool (no Mundane piece has one, IR31: the case uses a stand-in) |
| 97 | Concealed blade | An NPC's view omits a concealed blade until the NPC perceives an attack with it; after that its belief keeps it |
| 98 | Minted reward cap | A quality-3 variant on a moderate-gain scenario is lowered to quality 2, and a weapon boosts of "keen edge" becomes hitAdj; the plan applies with no repair call |
| 99 | Fallback attack | An engaged slime with the player in its zone attacks the player with unarmed\_natural, targetPart null; the order's source is fallback |
| 100 | Fallback target | An engaged minor actor that a companion hit last turn attacks the companion, even with the player in the same zone |
| 101 | Fallback close in | An engaged minor actor whose belief puts the player two links away moves one link along the shortest path, never into a frontier; in that zone with nobody there, it searches |
| 102 | Late Planner fights on | A significant engaged actor whose Planner call is late runs its type's combat list that turn instead of holding |
| 103 | Broken flees (BF79) | s302: a broken actor keeps an allowed action and may walk away, never toward a foe; with nothing allowed it flees one link, and cowers when cornered; s345: Cowering below Broken at MORALE\_COWER\_AT, no flight |
| 104 | Improvised weapon | The Parser's improvised chair leg becomes a held improvised\_medium story item with hitAdj IMPROVISED\_HIT\_ADJ and no kit bonus, and the attack uses it |
| 106 | XP and levels | Rating: a slime's is the worth of its one offensive skill, a guard's is higher, misc skills add nothing; defeat XP applies the taper and DEFEAT\_XP\_MULT; a slime the player hit and downed pays its defeat XP once, plus the first-defeat achievement; ten defeats of slimes earn first\_defeat:slime, defeats\_10:slime and defeats\_10 once each, named for the slime; a foe with a race also earns its first race defeat; a foe downed by someone else or broken pays nothing, a surrender pays; the next level's XP + 5 levels into the chosen unlocked class, which becomes current, with a perk point at level 2 |
| 105 | Story pacing | Quiet turns count up and an attack resets them; a quiet\_turns 2 beat fires on the third turn start and, with endsScenario, marks a break; rest never ends the scenario; a stall marks one only with no live beat left; the director then starts a new scenario with one Weaver call |
| 107 | Opposed standoff | An opposed guard who notices the player is alarmed (its onAlert fires) but not engaged, so the turn stays Explore; made hostile, it engages |
| 108 | Look around | Someone sitting still one zone away is a shape; a successful look shows them clearly and they stay seen while they stay put; a move the player can't see clearly forgets them; looking is a sight roll, not a check |
| 109 | Skill progression | A use marks a skill only when the opposition is within MARK\_WINDOW of raw or true skill, once, and only for the player; a hit that costs health marks Endurance when the attacker's true skill is inside its window; at the scenario's end a marked skill's paid roll gains by its tier (SG1 C) and shows "Eyesight 38 → 40" plus "New perk unlocked" past a milestone; a failed roll shows nothing; raw never passes its cap (100, 125 tagged, 75 flawed); marks clear |
| 110 | Healing | Rest heals HP and working parts but not a Crippled part; a clinic lifts it; a bandage heals its row in the turn it is used, is used up, and shows "Bandage: Hurt → Bruised"; with nothing to heal it stays in the pack and says so (Q3, 08/11/2026) |
| 111 | Game clock | Each action costs its durations row; waiting until dawn moves the clock to dawn, keeps the scenario and shows "Time passes: 11 h (Day 2 · Dawn)"; a hostile in the zone blocks it; outdoor zones are dark at night unless lit; the Narrator sees the day and time of day; the Weaver picks the hour only at story start; a night-only routine set by day is a routine error; rest cools down in game minutes; natural recovery heals 0.5% an hour at endurance 50, never a Crippled part, fights included |
| 113 | Action economy | A ranged attack in reach drops the move; out of reach the move stands and the attack is dropped; a move two links away with no action is a dash, stopped by a Crippled leg; "after" resolves the action before the move |
| 117 | Closing during the opening | The player's build is kept until turn 0 is saved; a game closed during the opening starts that opening again when reopened, instead of returning to character creation |
| 118 | Opening roll growth waits (BG-272) | s346: an event roll made with no scenario running holds what it earns until the scenario it opens ends, with no achievement\_outside\_end flag |
| 119 | A newcomer finds the village (BG-273) | s347: a new character in a fallen character's world: the Weaver's view lists the settlement and its people and says they arrive; a copy is refused; arriveAt puts them in an existing area; no place or area is doubled |
| 120 | Opening turn end (BG-275) | s348: a new character's opening turn records its end at its own time, and a fight still going in that world is not flagged stale after a long first turn |
| 121 | Half-seen lying still (BG-278) | s349: a body half seen in the dark is lying still with no health shown; the deck offers no talk against it but offers Attack and Look at; the narrator sees the mark; a sleeper lies still, someone standing does not |
| 122 | Look, beasts, walk label (BG-279/280/281) | s350: a good look keeps a moving slime seen that turn with no new roll; a slime seen clearly or last seen elsewhere gets no talk, trade, gift or search (Threaten stays) while a guard does; a walk up to someone is named by them |
| 123 | Threats at beasts (BF88) | s351: a threat at a wolf rolls Intimidation against its own, a win shakes it and costs morale, never "does not understand"; a slime ignores a threat; a Battle Cry still shakes a slime |
| 124 | Grab rolls show (BG-282) | s352: a Restrain puts its contest on its event and shows a roll line; a try to break free carries its contest |
| 125 | No weapon in a useless hand (BG-283) | s353: an axe in a crippled right hand is marked cantSwing and left out of the attack deck's With what? |
| 126 | A take runs to the body like a dash (BG-284) | s354: a body 15 m off is taken in one turn; one 100 m off is run toward as far as a dash, says how far short, files no bug, and is taken on later turns |
| 127 | One way in from a built frontier (BG-285) | s355: a built frontier whose zone names its way back leaves one way in with the frontier's label; a save with the twin keeps only the named way |
| 128 | An arrival along a frontier builds it (BG-286) | s356: an opening zone keyed as a frontier is accepted, leaves one way in (the frontier's, no longer a frontier) and the hero arrives on it |
| 129 | A clear ending (BG-287) | s357: clear is met once every foe standing in the place is down or broken, whatever their band; never for a place no foe stood in |
| 130 | New ground joins built ground (BG-288) | s358: a plan linking to built ground is accepted and that ground gets its way back, with no copy; a second zone for a built road of the land is refused (road\_built) |
| 131 | Sizing someone up is a contest; beats carry a difficulty (BG-290) | s359: an Insight look at a person rolls Insight against their Guile (BG-320; Falsehood plays no part) with no grade and no grade\_gap; a win reads mood, feelings and hiding (a secret or a lie lately), for the Narrator and on an NPC's belief; a loss reads nothing; a better Guile is read less often; out of clear sight it is wasted with no roll; a beat keeps a grade on the scale and its fall and drops one off it; Parser, Planner and Responder share one difficulty sentence naming every graded act; every beat shape has grade and fall |
| 132 | A place or area is built once (WI1 a) | s361: an extension declaring an area already built anywhere is refused (zone\_exists, the message says to link to it); a built place is refused (place\_exists); a new key is accepted; the bare start place is still filled in (BG-32) |
| 133 | The land's ways are made by code, once (WI2 a, WI5 a) | s362: a settlement on its site gets one way to new ground per land road, keyed by the road and labelled from the land, and running it again adds none; crossing it builds that road's zone (any other first zone is refused, land\_entry) whose far end is new ground keyed by the junction; the junction keeps its zone and joins its roads; a second zone on a built road or junction is refused (road\_built); a settlement built at a road's end is joined to the built road by one way; a plan's link to a land road's id reaches its zone; the fallback still builds the road's zone; a road over a region edge runs on into the next region's road; one join keeps an end already there (the WI7 a mend and its test went with the zone rewrite, PZ16 b) |
| 134 | The world check (WI9 a, WI10 a) | s363: a world built by the rules passes, and a second door between the same two areas is fine; a second area on a road, new ground to a built road, a second settlement on a site and an indoor junction area are each named; a plan the copy shows would break a rule gets a world\_check error for repair, and the real world is untouched; a save that breaks a rule loads with a warning and a world\_check bug report |
| 135 | Titles on a floor plan (PZ1-PZ17) | s386: a point's title is the space that holds it; one opening is the way, read from either side; a wall stops sight and a gap is seen through only within its span, a doorway's shut door not at all; a line through an exact corner of the walls' look-up grid still meets the wall; a walk goes round the wall through the way; a shut door loses more sound than a gap; light falls off from its source, a title's light with no point is its dimmest, and no line (or a roof under the midday sky) is no light; clutter is the land cell's cover in the open and none under a roof; ground items lie at points; the Map's fog keeps squares by floor; a point past a corner is kept a step in from both walls; a title joined to two placed titles touches both; each 100 m land cell stood in counts once for the new-ground chain (PZ17 a) |
| 136 | Doorways hold real doors (BG-312) | s404: a drawn doorway holds a plain door, shut and unlocked: shut it costs a shut door's 30 dB and hides the far side, open it costs nothing; a doorless doorway is seen and heard through like a gap; every doorway in the test village holds a door and the cottage's curtains are doorless; a v10 save's doorway that its old flag kept shut gets its door. s385 BG-308: a normal voice 0.7 m off through the shut front door is muffled, clear once it stands open |
