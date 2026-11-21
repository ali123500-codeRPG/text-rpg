## Bug log: archive

Closed rows of the "Bug log" (`bug-log.md`): fixed, won't fix or duplicate. A row moves here unchanged in the PR that closes it; a new BG-n is one past the highest in either file.

| BG | Bug | Found | Status | Fixed by |
| --- | --- | --- | --- | --- |
| BG-1 | One-way fight checks (health fears, crippled-part fear, crowded shots) skipped the player, and spars didn't count as engaged | Thread | Fixed | PR #361 |
| BG-2 | A sparring blow struck from hiding raised the alarm (SP11) | Thread | Fixed | PR #363 |
| BG-3 | "I await the outcome" after a yield got a clarify ("Nothing is pending"): the Parser had no way to let a moment pass | Play | Fixed | PR #375 |
| BG-4 | "I yield" asked a hostile who never fought the player (waiting in another room), and the sheet's "Deciding" list revealed him; he also counts in the fight log | Play | Fixed | PR #387 |
| BG-5 | The player's fight never ended after they left it, so the end-of-engagement skill-up rolls never came (playtest run 31) | Playtest | Fixed | PR #387 |
| BG-6 | Zone placement read "down the street" and "up the road" as stairs, so level street zones were stacked on top of each other | Thread | Fixed | PR #395 |
| BG-7 | The player couldn't walk out of the tavern front door: places sat 36 m apart with no doorway, and a partial leg was reset (runs 34, 35) | Playtest | Fixed | PR #408 |
| BG-8 | Scenario planning failed: the Weaver used a tavern layout's zone keys without naming the layout, so no zones were built (play) | Play | Fixed | PR #412 |
| BG-9 | The Weaver's repair of BG-8 failed the same way, so the scenario fell back to a placeholder area (play) | Play | Fixed | PR #412 |
| BG-10 | BG-8 again on a new story (play) | Play | Fixed | PR #412 |
| BG-11 | BG-9 again on a new story (play) | Play | Fixed | PR #412 |
| BG-12 | The player couldn't move to a spot inside their zone ("the back of the cellar"): moves named only a zone, so the turn passed (run 36) | Playtest | Fixed | PR #415 |
| BG-13 | The Parser aimed attacks at a slime listed as Dead while a live one kept attacking (playtest run 36) | Playtest | Fixed | PR #415 |
| BG-14 | A level tunnel was laid on top of the cellar on the same floor, so a slime from it stood 0 m from the player (playtest run 36) | Playtest | Fixed | PR #415 |
| BG-15 | A multi-zone move stopped at its first step: moves could only name a zone next to the player (playtest run 37) | Playtest | Fixed | PR #418 |
| BG-16 | A move-only turn was narrated as "You hold your ground and wait" (playtest run 37) | Playtest | Fixed | PR #418 |
| BG-17 | A guard's shout four rooms away reached the player word for word: any sound heard, even partly, carried its words (run 36) | Playtest | Fixed | PR #418 |
| BG-18 | With two slimes at arm's length, "the nearest" and "the one on the left" both got a clarify two turns running (playtest run 38) | Playtest | Fixed | PR #422 |
| BG-19 | "Walk to the back of the cellar" still gave move.spot away from the player's own zone after PR #415 (playtest run 38) | Playtest | Fixed | PR #422 |
| BG-20 | "Walk to the cellar steps" went down into the cellar: a move to a way out was parsed as a move through it (playtest run 38) | Playtest | Fixed | PR #422 |
| BG-21 | A doorway right underfoot was crossed in 0 m with no move event or trail entry, so "go back" had nothing to read | Test | Fixed | PR #422 |
| BG-22 | Move events said only where each leg ended, so a walk through a door was narrated as leaving and coming back (playtest run 39) | Playtest | Fixed | PR #425 |
| BG-23 | A barkeep who fled through a door was only heard, dropped from lastSeen, and "cut down the barkeep" asked who that was | Ali | Fixed | PR #434 |
| BG-24 | "Wrench my sword out and strike" drew the sword already in hand, logged as invalid gear | Ali | Fixed | PR #444 |
| BG-25 | Blows at someone lying Incapacitated were refused in silence, and the Narrator invented why they missed | Ali | Fixed | PR #444 |
| BG-26 | The autopilot agent kept stopping to check its wounds with /stats instead of acting | Ali | Fixed | PR #445 |
| BG-27 | Report bug only saved the report; open bugs reached Claude only through a separate send button | Ali | Fixed | PR #446 |
| BG-28 | "Strike the innkeeper behind the counter" struck no one: she had only been heard leaving, which wiped her from the player's sightings | Ali | Fixed | PR #453 |
| BG-29 | Who's here showed a mood (Terrified) for a dead woman: others' morale showed even when they were Down | 11/11/2026 | Fixed | PR #450 |
| BG-30 | Autoplay run: the agent tried to go through a cellar door it had made up from the story lines, and the game answered "You don't see a cellar door from here" | 11/11/2026 | Fixed | PR #514 |
| BG-31 | A move to another zone with a spot that couldn't be checked asked "Where in common room?" twice (playtest run 40) | 11/11/2026 | Fixed | PR #458 |
| BG-36 | The Weaver's layouts, spots, looks and zone sizes never reached the game: the plan schema copied only the keys it named | 11/11/2026 | Fixed | PR #460 |
| BG-37 | On the Map two places' outlines overlapped: the force layout placed zones, not places | Ali | Fixed | PR #459 |
| BG-32 | Run 40 had two taverns: the bare start place and the Weaver's tavern of the same key became two places | 11/11/2026 | Fixed | PR #462 |
| BG-33 | The Narrator called Maud "he": her pronouns were missing once she was out of sight by the turn's end | 11/11/2026 | Fixed | PR #462 |
| BG-34 | Brannoc agreed to walk back with the player, but no NPC could follow, so he stayed put while narrated walking along | 11/11/2026 | Fixed | PR #462, #468 |
| BG-41 | The Weaver check-in couldn't see what happened, so it kept adding a beat for a bout already won (playtest run 42) | 12/11/2026 | Fixed | PR #491 |
| BG-38 | A hidden thief could never be found on purpose: searches and Look around rolled nothing against anyone hiding (run 40) | 12/11/2026 | Fixed | PR #598 |
| BG-39 | The scenario ending moment never showed: resolveTurn cleared the closed scenario before the pipeline looked for it | 12/11/2026 | Fixed | PR #476 |
| BG-35 | The Narrator's JSON left out a comma before "narrated" (one call in 244), so the turn fell back | 11/11/2026 | Fixed | PR #462 |
| BG-40 | The Weaver's plans were refused when a band named its chase by name ("Ground") instead of key, costing a retry (run 42) | 12/11/2026 | Fixed | PR #489 |
| BG-43 | Following the hidden thief into the back yard ended the scenario as left: the yard was not on the scenario's ground (run 43) | 12/11/2026 | Fixed | PR #493 |
| BG-44 | The Weaver's ending "the player leaves the tavern" fired on one step into a lane on the scenario's ground (run 43) | 12/11/2026 | Fixed | PR #493 |
| BG-42 | All six Weaver check-ins were spent by turn 36, so the over-time check-in never came (playtest run 42) | 12/11/2026 | Fixed | PR #493 |
| BG-45 | The Narrator's JSON closed a bracket it never opened, so the turn showed bare code narration (playtest run 44) | 12/11/2026 | Fixed | PR #494 |
| BG-46 | "I knock on the tavern door and call out" walked the player inside and the words were never said (playtest run 45) | 12/11/2026 | Fixed | PR #495 |
| BG-47 | A move that stopped short of the tavern door was narrated as arriving at the threshold (playtest run 46) | 12/11/2026 | Fixed | PR #497 |
| BG-48 | A walk toward a person in another zone stopped short with no toGo, so it read as arriving (playtest run 47) | 12/11/2026 | Fixed | PR #499 |
| BG-49 | A story started the player 20 m from the tavern door while the opening put them at it (playtest runs 46, 47) | 12/11/2026 | Fixed | PR #500 |
| BG-50 | A scenario talk beat at the player spoke an empty line unless the player had addressed that NPC (playtest run 48) | 12/11/2026 | Fixed | PR #502 |
| BG-51 | The Equations tab showed a literal "${n(CONFIG.GRIT_SHARE)}" instead of the Grit share | 12/11/2026 | Fixed | PR #503 |
| BG-52 | The Equations tab said the attack gap is kept between −5 and +5; code clamps it to GAP_MIN..GAP_MAX (−10..+5) | 12/11/2026 | Fixed | PR #503 |
| BG-53 | The Equations tab said Every Fall a Lesson comes at A Nobody level 20; it is the level 15 capstone | 12/11/2026 | Fixed | PR #503 |
| BG-54 | "Open the hatch and climb down" left the player still: a dropped way op also skipped the move (playtest run 49) | 12/11/2026 | Fixed | PR #504 |
| BG-55 | A reply that named no one went to nobody, so the NPC who had offered the job stood silent (playtest run 50) | 12/11/2026 | Fixed | PR #505 |
| BG-56 | The tavern landing spoke of let rooms that the layout never built, so trying a door got "no such door" (run 51) | 12/11/2026 | Fixed | PR #506 |
| BG-57 | A whisper from behind the counter never reached the player a metre away: it was the next zone (playtest run 51) | 12/11/2026 | Fixed | PR #506, #528 |
| BG-58 | "Walk over to them and say..." spoke from where the player started, before the move (playtest run 53) | 12/11/2026 | Fixed | PR #507 |
| BG-59 | An NPC forgot being handed coin when the player spoke while handing it: the bark dropped the deed (playtest run 54) | 12/11/2026 | Fixed | PR #508 |
| BG-60 | An NPC called Wren "he": NPC views gave pronouns only for people in sight, never in beliefs (playtest run 55) | 12/11/2026 | Fixed | PR #509 |
| BG-61 | Answering Dobb through the barred door got "Who do you mean?": unseen speakers were not in talkingWith (run 56) | 12/11/2026 | Fixed | PR #510 |
| BG-62 | Walking over to talk to someone ended in the wrong zone (behind the counter) | 12/11/2026 | Fixed | PR #511 |
| BG-63 | Switching stories while one was still being written landed that turn on the other story | 12/11/2026 | Fixed | PR #513 |
| BG-64 | Spotting a sneaking NPC gave achievements but the story never said whom you spotted | 12/11/2026 | Fixed | PR #512 |
| BG-65 | Checking a door said nothing about whether it was locked | 12/11/2026 | Fixed | PR #515 |
| BG-66 | A step already taken was also offered as 'put off to next turn' | 12/11/2026 | Fixed | PR #516 |
| BG-67 | 'Tell her' went to the barkeep instead of the woman you were talking to | 12/11/2026 | Fixed | PR #517 |
| BG-68 | Parser split a spoken line into deferred actions (asks to the listener are speech) | 12/11/2026 | Fixed | PR #521 |
| BG-69 | The player's walk went round a door barred out of sight (through the yard gate, sliding its bar) before ever trying it; knocking on a door became a move inside | 12/11/2026 | Fixed | PR #524 |
| BG-70 | Opening a door just to look in did nothing (no door state): doors now open and shut, and an open one is seen through (Ali chose this) | 12/11/2026 | Fixed | PR #527 |
| BG-71 | The player could not shout: every player line was a normal voice, so a shout through a barred door went unheard | 12/11/2026 | Fixed | PR #529 |
| BG-72 | Words said to the player from out of sight counted as touch, so narration had the gate shudder | 12/11/2026 | Fixed | PR #530 |
| BG-73 | Crossing a frontier built that turn left the player's move event in the old zone, so narration and screen disagreed | 12/11/2026 | Fixed | PR #532 |
| BG-74 | Talking to the barkeep 6.1 m off in the busy tavern: a normal voice was not clear there, so his reply came without words | 12/11/2026 | Fixed | PR #533 |
| BG-75 | The Weaver's view gave the player's level as the sum of class levels only, leaving out bonus levels | 12/11/2026 | Fixed | PR #535 |
| BG-76 | The library viewer's Stacking tab listed morale levels by their code keys instead of their names | 12/11/2026 | Fixed | PR #535 |
| BG-77 | Following the watchman into the tavern while talking turned the move through the door into a step beside him in the lane | 12/11/2026 | Fixed | PR #540 |
| BG-78 | Renting a bed from the barkeep across the busy tavern was refused as "not here" and narrated as not sold there | 12/11/2026 | Fixed | PR #543 |
| BG-79 | "Order a drink, then take a table by the hearth": the Parser deferred the move though the move slot was free | 12/11/2026 | Fixed | PR #548 |
| BG-80 | Nearness was fixed action by action: NPCs never stepped up, and give needed the same zone though a counter is reachable | 12/11/2026 | Fixed | PR #551 |
| BG-81 | A walk that reached its spot still told the Narrator "toward" it, so the gate stayed "a stretch away" | 12/11/2026 | Fixed | PR #551 |
| BG-82 | Entering the kitchen to find the cellar, the narration never named the cellar hatch among the kitchen's ways out | 12/11/2026 | Fixed | PR #553 |
| BG-83 | The player's words were always said at a normal voice: the speak event ignored the Parser's volume | 12/11/2026 | Fixed | PR #561 |
| BG-84 | Someone the player names gets their exact words and answers even when they cannot hear them; only "everyone" checked hearing | 12/11/2026 | Fixed | PR #572 |
| BG-85 | Hand reach meant "same zone", not metres: items were handed 38 m along a street or picked up anywhere in the zone | 12/11/2026 | Fixed | PR #579 |
| BG-86 | Doors and gates were worked from anywhere in the zone, from 19 m away without walking to them | 12/11/2026 | Fixed | PR #579 |
| BG-87 | Stepping up to talk to someone seen through a doorway stopped inside the way in, not beside them | 12/11/2026 | Fixed | PR #561 |
| BG-88 | The "hears it clearly" checks for trade, stepping up and "everyone" left out Keen Ear and leaning in to whisper | 12/11/2026 | Fixed | PR #561 |
| BG-89 | Anything aimed at someone that wasn't words was felt as touch: a silent walk, a wasted action, a refused sale | 12/11/2026 | Fixed | PR #561 |
| BG-90 | NPCs who followed the player through a frontier arrived with no move event, so nobody seemed to walk along | 12/11/2026 | Fixed | PR #561 |
| BG-91 | The Stacking tab still showed part-state keys for wound penalties instead of their names | 12/11/2026 | Fixed | PR #561 |
| BG-92 | A figure half seen 2.5 km south was narrated as resolving into the man beside the player (run 74b) | 12/11/2026 | Fixed | PR #562 |
| BG-93 | An NPC wrote a stage direction inside its spoken line ("*She's already got half of it in her mouth* Mmf.") | 12/11/2026 | Fixed | PR #564 |
| BG-94 | Hobb called for help mid-talk three turns after his alarm rose: the queued onAlert shout waited for a turn (run 74c) | 12/11/2026 | Fixed | PR #566 |
| BG-95 | NPCs named each other aloud in front of the player, yet no name was learned, and NPCs never kept the player's name | 12/11/2026 | Fixed | PR #569 |
| BG-96 | "Pick up the draught, then ask the tinker" deferred the question, though gear takes no slot (run 74d) | 12/11/2026 | Fixed | PR #567 |
| BG-97 | The narration called the player "a boy of thirteen" though her pronouns are she: no player view carried pronouns | 12/11/2026 | Fixed | PR #570 |
| BG-98 | A hostile counted as closing in only by zone links, not by metres walked nearer | 12/11/2026 | Fixed | PR #571 |
| BG-99 | One-Two's free punch needed only the same zone, so it was thrown at a foe out of fist reach | 12/11/2026 | Fixed | PR #571 |
| BG-100 | A parry's strike back needed only the same zone, so a dagger "struck back" at a spearman 2 m away | 12/11/2026 | Fixed | PR #571 |
| BG-101 | Bluff aimed at any foe in the zone and none outside it, even through an open doorway | 12/11/2026 | Fixed | PR #571 |
| BG-102 | The visibility table still gave sight in zone links, and three perk texts still said "one zone" while code used metres | 12/11/2026 | Fixed | PR #571 |
| BG-103 | Who answers a band or "everyone" was ranked by zone hops, not nearest in metres | 12/11/2026 | Fixed | PR #571 |
| BG-104 | Zone review: a hold (A8) lasts while holder and held share a zone, at any distance in it | 12/11/2026 | Fixed | PR #579 |
| BG-105 | Dirt in the Eyes could be thrown at any foe in the zone and none outside it | 12/11/2026 | Fixed | PR #581 |
| BG-106 | Zone review: Cover Ally can step in front of an arrow for an ally anywhere in the zone. Fixed (ZR2): only within the coverer's grip reach of the ally | 12/11/2026 | Fixed | PR #581 |
| BG-108 | Spotter told only band-mates in the same zone | 12/11/2026 | Fixed | PR #581 |
| BG-109 | The unseen-moves feat counted only watchers in the zone the player sneaked into | 12/11/2026 | Fixed | PR #581 |
| BG-110 | Everyone in the player's zone or a zone in sight was shown in full at any distance, a face 100 m away known | 12/11/2026 | Fixed | PR #581 |
| BG-112 | Every NPC planned its walk around every barred or locked way in the world without having tried it | 12/11/2026 | Fixed | PR #580 |
| BG-111 | Oswin's whispered replies from 2.9 m were never heard: the exchange dropped a spokesperson's step-up spot (run 75) | 12/11/2026 | Fixed | PR #576 |
| BG-114 | The common room's look said three people sat dicing after they had gone, and the Narrator retold them (run 77) | 13/11/2026 | Fixed | PR #582, #585 |
| BG-115 | "Come tell the guard in Hound Lane with me" walked the player out before Oswin could answer (run 75d) | 13/11/2026 | Fixed | PR #582 |
| BG-113 | "Perceives now" checks and Never Surprised measured from a zone's centre, not where the person stands | 13/11/2026 | Fixed | PR #581 |
| BG-116 | Buying and selling was always a spoken order, even for someone who cannot speak | 13/11/2026 | Fixed | PR #583 |
| BG-117 | "I grab his wrist and ask..." made the gesture the main action, so Wick never answered (run 78) | 13/11/2026 | Fixed | PR #585 |
| BG-118 | Wren's lines while fleeing were never seen or heard: a move that waited at a frontier left no event (run 75e) | 13/11/2026 | Fixed | PR #585 |
| BG-119 | Run 79, turns 1 to 2: three NPCs changed zones between turns with no move event, so the player watched them vanish | 13/11/2026 | Fixed | PR #604 |
| BG-120 | A whisper from 1.00008 m was not heard: every reach check failed by a hair once closing in stopped exactly at reach (run 77b) | 13/11/2026 | Fixed | PR #585 |
| BG-122 | Thanking Hobb then asking Marta: Hobb took the band's one spokesperson slot, so Marta never answered (run 82) | Playtest | Fixed | PR #585 |
| BG-123 | The GM view never listed the story's backups, and its Restore button threw "restore is not available" | 13/11/2026 | Fixed | PR #589 |
| BG-124 | "Let's go out the front together" lost the player's move with no log, and the counter side faced the street (run 77c) | Playtest | Fixed | PR #591 |
| BG-126 | Run 78b, step 28: crash "zone north_road has no rectangle". A frontier whose build fell back got an empty zone with no kind, size or rectangle (ZR8). | Playtest | Fixed | PR #591 |
| BG-127 | "I'm going to check your pockets" at hidden Wren was narrated as the player searching their own pockets (run 75f) | Playtest | Fixed | PR #591 |
| BG-125 | "Walk over to Wren", hidden along the wall, asked "Where in common room?" four turns running (run 75f) | Playtest | Fixed | PR #591 |
| BG-128 | The Weaver's trigger "pick $player" fired as a lock pick at the player and was told as a meaningless lock attempt (run 85) | Playtest | Fixed | PR #591 |
| BG-130 | Run 85b, step 17: the Parser deferred "ask Wren why she followed Arden out here"; Wren is he. He was out of sight, and PLAYER_VIEW.lastSeen carried no pronouns. | Playtest | Fixed | PR #593 |
| BG-131 | Wennick walked to where the player had been, not where they went that turn, so they crossed (run 77e) | Playtest | Fixed | PR #597 |
| BG-120 (part 2) | Run 81: Maud whispered three answers from behind her counter to the player about 5 m back; a whisper carries about 1 m, so none was heard. | Playtest | Fixed | PR #602 |
| BG-121 | Run 80: Marda said "follow me round to the kitchen", walked there and went straight back to her counter as the player came in. | Playtest | Fixed | PR #602 |
| BG-129 | Run 86: the slime job closed as handed in when the player spoke to Marta, though she never saw the kill; she refused to pay for a job the game called done. | Playtest | Fixed | PR #602 |
| BG-132 | Run 77f, turn 33: Wennick's whispered reply rode on a dropped move as two hold barks with no listener, so the player 1 m away heard nothing. | Playtest | Fixed | PR #602 |
| BG-133 | Dov's refuge routine kept him "cowering" while he sat in the open talking, so the Narrator hid him in thorns (run 90) | Playtest | Fixed | PR #604 |
| BG-134 | The Parser wrote "deferred" in its own words, and that text was offered back to the player (runs 91, 92) | Playtest | Fixed | PR #604 |
| BG-135 | "Turn toward the back door to see what moved" looked at the room behind the shut door, not the someone by it (run 75h) | Playtest | Fixed | PR #604 |
| BG-136 | Runs 77g and 91: an NPC who agreed to go with the player never came along; road trips took only bandmates | 13/11/2026 | Fixed | PR #604 |
| BG-137 | A believed lie still came with how convincing it was, so it read differently from the truth (run 90) | Playtest | Fixed | PR #604 |
| BG-138 | Run 89b, turn 33: the Narrator wrote "lift" (the chest lid), a stage hidden term, twice, so the turn fell back to a bare template. | Playtest | Fixed | PR #604 |
| BG-139 | Run 91, turns 38-40: Osric said "follow me out" and stepped into the street; next turn his routine took him back inside as the player came out. | Playtest | Fixed | PR #604 |
| BG-140 | NPC lines voiced deeds their action did not do: a drink poured with talk, "I'll stand aside" with no move | Playtest | Fixed | PR #604 |
| BG-142 | Runs 93, 89b: a search that found nothing carried no effect, so the story never said whether anything turned up. | Playtest | Fixed | PR #604 |
| BG-144 | "Unbar the plank gate and slip out" stopped short of the gate, and the dropped unbar was only logged (run 95) | Playtest | Fixed | PR #604 |
| BG-150 | A crossing onto fallback ground or a saved zone kept the player's point from the old zone, outside the new one | Playtest | Fixed | PR #609 |
| BG-159 | A 1.2 km walk never became a trip because two far slimes still knew of the player, so it took about 40 turns (run 95b) | 13/11/2026 | Fixed | PR #670 |
| BF2a-d | Ali's answers on catch-up moves (BG-119). | Catch-up legs on an action's turn are move events, perceived by the normal rules; caught_up logged. | Built in PR #604 |
| BF8, BF10 | Ali's answers on lie hints. | A lie seen through by LIE_PLAIN_GAP (2) tiers or more is plainly a lie, a one-tier win gives the hint, Plain as Day makes any win plain; a lie the player ties with leaves the hint (doubt). Since LG25 c (D-405) any win is plain for everyone and LIE_PLAIN_GAP is gone; a tie still leaves the hint. | Built in PR #604 |
| BF9, BF11 | Ali's answers on followers and agent-chosen places. | Followers together with the player travel with it; a place an NPC's agent moved it to holds AGENT_STAY_TURNS (3). | Built in PR #604 |
| BG-145 | Run 97, turn 9: "I pay the barkeep four copper for Wen's bread and stew" gave a buy with no ware, so the barkeep refused and the coins sat on the counter. | Playtest | Fixed | PR #607 |
| BG-146 | Run 100, turns 4 and 7: Marta's Weaver beat had her speak to the player, but she was code-run, so no Responder wrote her words and the speak carried no line. | Playtest | Fixed | PR #607 |
| BG-141 | Run 94, turn 5: one zone that was not a road kind had a length, which sank the Weaver's whole extension and left a bare, dead-end square. | Playtest | Fixed | PR #607 |
| BG-143 | Words to one man that mentioned "the two strangers" went to the band, so code asked "Who do you speak to?" twice (run 96) | Playtest | Fixed | PR #607 |
| BG-149 | Run 91b, turn 46: paying Hadley 3.5 m away behind a barred way came to a wasted event with no reason, narrated as pushing the grate. | Playtest | Fixed | PR #607 |
| BG-151 | The end-of-turn catch-up walked Pell straight back out of the kitchen a trigger had sent him to, unseen (run 86c) | Playtest | Fixed | PR #612 |
| BG-152 | Run 90b, turns 40 to 42: searching a dead slime 1 m away stayed at 1 m, past a hand's 0.7 m, and read "needs a hold on them" three times. | Playtest | Fixed | PR #612 |
| BG-153 | A spot by the yard gate walked 30 m the wrong way: the lane and yard don't touch, so the way's point fell back (run 92b) | Playtest | Fixed | PR #612 |
| BG-154 | Runs 100b turn 9 and 95 turn 4: a whisper across a counter to Marta, named only as its addressee, was never raised to reach her. | Playtest | Fixed | PR #612 |
| BG-148 | Run 89c, turn 39: the gate to the lane was locked (tried before), so the walk went round through the common room without a word. | Playtest | Fixed | PR #612 |
| BG-156 | The turn checker said a broken guard was still engaged with a slime, while the engine keeps a fight alive from either side | Playtest | Fixed | PR #612 |
| BG-147 | Words to someone known to be about but out of sight were refused or put off until the player went to them (runs 98, 99) | Playtest | Fixed | PR #612 |
| BG-155 | Run 97b: the barkeep, half seen across the room, listed no wares, so a buy from her was asked about again and again and never happened. | Playtest | Fixed | PR #612 |
| BG-158 | "I walk over the counter to Harl's table" kept the player behind the counter four turns running (run 81b) | Playtest | Fixed | PR #612 |
| BG-157 | Varo's Loop was drawn as a weapon and narrated "on your finger": the player's gear reached agents by name only, not look | 13/11/2026 | Fixed | PR #613 |
| BG-161 | After restoring a backup, the header kept the later turn number and the story kept the dropped turns | Playtest | Fixed | PR #619 |
| BG-162 | Closing in skipped anyone down, so fists struck at a downed slime 1 m away out of reach (run 90c) | Playtest | Fixed | PR #619 |
| BG-163 | "Walk up to the gate and lift the latch" from 9.4 m stopped a metre short, and the story called the gate a way off (run 85d) | Playtest | Fixed | PR #619 |
| BG-164 | Wren slipped out unseen; the player spoke to his last-seen spot three turns running with no word he was gone (run 98b) | Playtest | Fixed | PR #619 |
| BG-165 | Replay run 95b step 8: "I try the shed door on this side of the weir" crashed the turn (null reach): the way named was not out of the player's zone. | Playtest | Fixed | PR #619 |
| BG-166 | "Step out into Mill Lane" from the shared edge took no step, but the story put the player in Mill Lane (run 97c) | Playtest | Fixed | PR #619 |
| BG-160 | Ness kept saying she was fetching bandages and nothing happened: healing items healed only their user (run 79b) | Playtest | Fixed | PR #619 |
| BG-167 | Run 91b (BF12): paying Hadley 3.5 m away across a barred way came to nothing; and hands passed a locked solid door when both stood at it. | Playtest | Fixed | PR #619 |
| BG-168 | The Narrator was refused for everyday nouns ("sack", "chest"), so the template said "You use item" (run 100c) | Playtest | Fixed | PR #619 |
| BG-169 | "Go up toward the square" was refused, though the street's way toward it was in sight (replay run 77d) | Playtest | Fixed | PR #619 |
| BG-170 | "Walk out into Mill Lane and grab Wen's arm" ended the walk at a 0 m doorway leg, 0.3 m short (run 97d) | Playtest | Fixed | PR #625 |
| BG-171 | Ness ordered use_item with no item, and "walk over to Wren and grab his wrist" after he left was all deferred (runs 79c, 98c) | Playtest | Fixed | PR #625 |
| BG-172 | "I open the side gate and check behind it": a 0.3 m step took the move slot, so opening it failed (run 98c) | Playtest | Fixed | PR #625 |
| BG-173 | Ness was told to open her chest, but open was missing from the NPC action list, so she kept sending use_item (run 79d) | Playtest | Fixed | PR #628 |
| BG-174 | "Walk east with Wen" at the lane's dead east end took no step five tries running, silently (run 97e) | Playtest | Fixed | PR #628 |
| BG-175 | Ness's shut chest showed as `container: {}`, and her wasted actions reached her with no reason (run 79e) | Playtest | Fixed | PR #631 |
| BG-176 | Runs 81c t34-40 and 97c: the purse read "coin ×16" in /inv and the gear line the agents read, so a player kept trying to pay four silver. | Playtest | Fixed | PR #631 |
| BG-177 | A held NPC's "I yield" only left a spar, so the fight went on and Bram killed him (run 97f) | Playtest | Fixed | PR #633 |
| BG-178 | Searching Wen's body again found nothing though the key and coin were still there (run 97f) | Playtest | Fixed | PR #633 |
| BG-179 | Brenn drinking near hostiles in another building put the game into fight turns, dropping the player's words (run 79f) | Playtest | Fixed | PR #635 |
| BG-180 | Ness walked to her chest and stood silent: Planner calls went only to engaged actors and deal parties (run 79g) | Playtest | Fixed | PR #638 |
| BG-181 | Ness bound the player's leg but nothing recorded it, so the story still called them bleeding (run 79g) | Playtest | Fixed | PR #638 |
| BG-182 | Who's here on Play showed no names, only status words: since PR #514 each chip's name sat inside a code comment. | — | Fixed | PR #662 |
| BG-183 | The agent couldn't get the cellar key: Hobb offered a key he lacked and a filch behind the bar fell short (Ali's report) | Play | Fixed | PR #672, #673 |
| BG-184 | A carried walk never ended once in its goal zone, so the view kept "9 m / 6 s to go" forever | 13/11/2026 | Fixed | PR #675 |
| BG-185 | Words said while a walk carried on stopped the walk and dropped it, though AT49 says words are said on the way | 13/11/2026 | Fixed | PR #675 |
| BG-186 | A shortbow saved in old 'hand:' slots wasn't in hand, so "I shoot Hobb" became a punch out of reach (Ali's report) | Play | Fixed | PR #677 |
| BG-187 | Corwin's "find my mother's tin charm" became goal other: the charm was real but not in his view (quest_goal_gap) | Play | Fixed | PR #684 |
| BG-188 | A guard told a suspect to turn out his pockets; no search happened and a willing suspect couldn't be searched (Ali's report) | Play | Fixed | PR #684 |
| BG-189 | A finished fight kept the player in fight turns: their own engaged pair counted as a fight they could hear | — | Fixed | PR #681 |
| BG-190 | "I sneak while following the lean man" had to be repeated every turn, "continue" was not understood, and nothing said he was lost | Play | Fixed | PR #687, #683, #692 |
| BG-191 | The story opened at the top, not the latest lines, on coming back to Play from another page | Play | Fixed | PR #689 |
| BG-195 | Ali's report, story mwf2lt7l: Wren gave Happi the charm from his sack and nothing happened | 14/11/2026 | Fixed | PR #764 |
| BG-199 | Wren broke and yielded but nothing said so; his chip, the XP row and an essence offer were all wrong (Ali's report) | 14/11/2026 | Fixed | PR #750 |
| BG-200 | Ali's report, story mwf2lt7l t29: the roll line said the shot was a tier ahead yet it only grazed, because cover moved the gap and the line never said so | 14/11/2026 | Fixed | PR #750 |
| BG-193 | Playtests run-100/101 and Ali's story mwf2lt7l t29/t32: "punch him" or "strangle him" with a weapon in hand struck with the weapon | 14/11/2026 | Fixed | PR #754 |
| BG-194 | Playtest run-101-at-shopper t21: the Narrator's leak scan flagged the word "thief" because an actor's id is thief, and the turn fell back to template narration | 14/11/2026 | Fixed | PR #754 |
| BG-201 | Ali's report, story mwf2lt7l t24: Wren's words as he left were placed where his walk ended, beyond the kitchen wall, so Happi never heard them | 14/11/2026 | Fixed | PR #759 |
| BG-202 | Ali's report, story mwf2lt7l t24: whispering thanks ended Happi's stealth | 14/11/2026 | Fixed | PR #754 |
| BG-203 | "I follow the lean man" walked to where he was last seen and then told him leaving as a stranger (Ali's report) | 14/11/2026 | Fixed | PR #754 |
| BG-206 | Ali's report, story mwf2lt7l t30: searching the downed Wren found his sack but not the charm inside it | 14/11/2026 | Fixed | PR #754 |
| BG-207 | Ali's report, story mwf2lt7l t32: Happi's attack on the downed Wren let him roll a dodge | 14/11/2026 | Fixed | PR #754 |
| BG-213 | Ali's report, story mwf2lt7l t35: taking the offered "give Corwin the lucky charm" walked to Corwin, then lost the give and offered nothing to carry on | 14/11/2026 | Fixed | PR #754 |
| BG-208 | The Street Instinct essence's skills showed nowhere, and /essence take was lost on a reload (Ali's report) | 14/11/2026 | Fixed | PR #704, #757 |
| BG-209 | An item ability or perk an in-scenario achievement opened arrived a turn late: perk sync ran before the scenario closed | 13/11/2026 | Fixed | PR #707 |
| BG-210 | A Trader brought back with wares got a second purse and stock on top, so coin and goods piled up every scenario | 13/11/2026 | Fixed | PR #710 |
| BG-211 | A stash was quiet and plainly visible instead of hushed and low: its SENSE entry sat inside a note (PR #660) | 14/11/2026 | Fixed | PR #731 |
| BG-212 | A minted reward whose name held a hidden term inside a longer word was placed as a plain item (part-word match) | 14/11/2026 | Fixed | PR #746 |
| BG-214 | In the Bent Nail the lane ran through the tavern, zone sides weren't whole metres, and map marks covered each other | 14/11/2026 | Fixed | PR #755 |
| BG-215 | The Achievements page counted branch rows in a chain's ↻N, so a finished two-level chain read as four | 14/11/2026 | Fixed | PR #774 |
| BG-216 | Furniture behind the counter moved between map zooms, and some pieces vanished zoomed out | 14/11/2026 | Fixed | PR #770 |
| BG-192 | Wren's give of the charm in his sack was dropped: the NPC gear check knew only what hung on him (invalid_gear) | 13/11/2026 | Fixed | PR #698, #764 |
| BG-196 | Story mwf2lt7l t23 (invalid_gear): Wren's second try at the same give, plus taking the charm out of his own sack first; both dropped. Same bug as BG-192 | 13/11/2026 | Fixed | PR #698 |
| BG-197 | Story mwf2lt7l t21: following Wren into the kitchen walked Happi onto the exact spot Wren stood on, 0 m apart | 13/11/2026 | Fixed | PR #759 |
| BG-198 | Story mwf2lt7l t24 (invalid_gear): Wren's third try at the same give, as a Responder answer. Same bug as BG-192 | 13/11/2026 | Fixed | PR #698 |
| BG-204 | The Weaver put the barred north gate straight on the way to a frontier; a repair call added a zone beyond it | 13/11/2026 | Fixed | PR #791 |
| BG-205 | Story mwf2lt7l t27 (invalid_gear): Wren's fourth try at the same give. Same bug as BG-192 | 13/11/2026 | Fixed | PR #698 |
| BG-217 | Ali's report, story mwf2lt7l t37: achievements, XP and levels earned in free roam land at once; they should wait for the end of the next scenario | 14/11/2026 | Fixed | PR #791 |
| BG-218 | The Character card read "In the the Crooked Kettle" | 14/11/2026 | Fixed | PR #791 |
| BG-219 | The Gear pop-up opened off screen on wide, zoomed screens: pop-ups were placed in screen pixels as page pixels | 14/11/2026 | Fixed | PR #796 |
| BG-220 | Play-page comment: Back went to another tab instead of closing the full-screen Perks pop-up | 14/11/2026 | Fixed | PR #796 |
| BG-221 | Ali's play, turn 43: the tinker woman's Weaver beat hailed the player with no words (fired mid-turn; only beats due at a turn's start get their words written) | 14/11/2026 | Fixed | PR #806 |
| BG-222 | Game report (checkin_failed), turn 43: a check-in pointing the ending at Corwin's made sword was refused as item unknown | 14/11/2026 | Fixed | PR #806 |
| BG-223 | Game report (weaver_off_catalog), turn 43: road lengths in words refused; only keys or km passed | 14/11/2026 | Fixed | PR #806 |
| BG-224 | Ali's report, turn 44: the clarifying question's ways out to unbuilt places (east road, mill stream) couldn't be clicked | 14/11/2026 | Fixed | PR #806 |
| BG-225 | Map thread (Ali's map comment), turn 44: the east road was placed apart from the square it links to | 14/11/2026 | Fixed | PR #806 |
| BG-226 | Map thread, turn 44: crossing onto the 2 km east road put the player at its middle | 14/11/2026 | Fixed | PR #806 |
| BG-227 | Playtest turn 39: an ending on holding Corwin's sword named the plain sword | 14/11/2026 | Fixed | PR #812 |
| BG-228 | Playtest turn 59: a yes-or-no clarify had nothing to click | 14/11/2026 | Fixed | PR #812 |
| BG-229 | Playtest turns 57-59: "shoot the first one who appears" asked about or dropped | 14/11/2026 | Fixed | PR #812 |
| BG-230 | Playtest turns 53-56: watching from hiding passed 2 seconds a turn | 14/11/2026 | Fixed | PR #812 |
| BG-231 | Playtest turns 57-60: no way to wait until someone appears | 14/11/2026 | Fixed | PR #812 |
| BG-232 | Ali's note: the agent keeps repeating the personality's signature | 14/11/2026 | Fixed | PR #820 |
| BG-233 | Playtest: an achievement handed over at a scenario's end named that turn, not the turn it was reached | 14/11/2026 | Fixed | PR #832 |
| BG-234 | Playtest turn 45: six Weaver plans had road lengths refused (far_road, track, market_road and others) | 14/11/2026 | Fixed | PR #806 |
| BG-235 | Playtest turn 44: a scenario reward was placed as a plain item (IT4) | 14/11/2026 | won't fix | Working as designed: the scenario's minted cap (SCENARIO_CAPS.minted) was used up; this is the report asked for in BF50. |
| BG-236 | Playtest turns 60-68: Ennis's gate-and-woodpile job could not be done, and the tools he named did not exist | 14/11/2026 | Fixed | PR #832 |
| BG-237 | Playtest turns 65-68: "take the hinge pins from the trough" only walked to the trough | 14/11/2026 | Fixed | PR #832 |
| BG-238 | Playtest turn 75: the shot at the girl took 53 seconds (a free-roam attack waited for the Weaver to plan the new scenario) | 14/11/2026 | Fixed | PR #832 |
| BG-239 | Playtest: "The scenario draws to a close" showed before the gains pop-up | 14/11/2026 | Fixed | PR #824 |
| BG-240 | Playtest turn 80: an 8-hour wait ended scenario 3 as "worn out" | 14/11/2026 | Fixed | PR #880 |
| BG-241 | Playtest turns 75-90: people did not notice blows from someone hidden, or a body next to them | 14/11/2026 | Fixed | PR #832 |
| BG-242 | Playtest turns 75-76: no hit pop-up | 14/11/2026 | Fixed | PR #824 |
| BG-243 | Playtest turns 90-95: Osric shouted the same thing every turn | 14/11/2026 | Fixed | PR #832 |
| BG-244 | Playtest: NPCs with no bed never slept | 14/11/2026 | Fixed | PR #832 |
| BG-245 | Playtest turns 90-95: Bettany fell back asleep every turn after being woken | 14/11/2026 | Fixed | PR #832 |
| BG-246 | Playtest: a 49 shown as Critical Failure−−−−−− with no reason | 14/11/2026 | Fixed | PR #832 |
| BG-247 | Playtest turns 104-116: Hob stood a step away and never landed a punch | 14/11/2026 | Fixed | PR #832 |
| BG-248 | Playtest turn 115: a tapped name in a question added brackets and asked again | 14/11/2026 | Fixed | PR #824 |
| BG-249 | Light Sleeper wake checks never taught: the sleeper's Earshot and a sneaker's stealth skill got no mark | 14/11/2026 | Fixed | PR #836 |
| BG-250 | Animal races attack at skill 0: their natural attacks roll Natural Weapons, whose tree is open only to slimes and dragons, so the skill counts as closed | 14/11/2026 | Fixed | PR #842 |
| BG-251 | Shots and throws made no sound where they landed, so people there never learned they were under attack | 14/11/2026 | Fixed | PR #847 |
| BG-252 | Someone made out by the make-out roll was named in the story but stayed "someone" in Who's here and to the Narrator | 14/11/2026 | Fixed | PR #854 |
| BG-253 | An NPC's words beside its action were picked at the turn's start, so a guard urged finishing a slime already dead (NV7) | 14/11/2026 | Fixed | PR #860 |
| BG-254 | The playtest script started every run as the Swordsman class (CL1), which is no longer a Start, so every run crashed at once ("CL1 is not a Start") | 14/11/2026 | Fixed | PR #859 |
| BG-255 | Code-run fighters swung at foes across the zone, walking 3 m and losing the blow turn after turn | 14/11/2026 | Fixed | PR #861 |
| BG-256 | Bane and total-defeat chains did not add up their levels' rewards, and the library showed carried rewards apart | 15/11/2026 | Fixed | PR #890 |
| BG-257 | The roll line said "you make out who is there" for every plain roll, not only Look around | 15/11/2026 | Fixed | PR #893 |
| BG-258 | A code-run human holding a sword punched whenever its foe stood within fist reach: its fallback named unarmed strike | 15/11/2026 | Fixed | PR #894 |
| BG-259 | On every Questions hub page a new question showed above older answered ones | 16/11/2026 | Fixed | PR #898 |
| BG-260 | A hub question in the colour-block layout showed only its recommendation, never its options | 16/11/2026 | Fixed | PR #904 |
| BG-261 | The Stacking tab named the wrong rolls for Total defeats and Blade Wall: the text was written by hand beside the rules | 16/11/2026 | Fixed | PR #923 |
| BG-262 | A spear held in one grip beside a shield thrust two-handed and still blocked: grips were counted in all, not per weapon | 16/11/2026 | Fixed | PR #930 |
| BG-263 | A stealthy shot that first stepped into range got no notice contest of its own: the step's Sneaking contest used it up | 16/11/2026 | Fixed | PR #927 |
| BG-264 | On creation, Random (or the other race) reset skill points to the recommended build: a race change rebuilt the screen | 16/11/2026 | Fixed | PR #936 |
| BG-265 | Three slimes mauling the reed-cutter: Suggested read "Look around: Nothing presses" and the slimes got no foe marker | 16/11/2026 | Fixed | PR #942 |
| BG-266 | One slime of a group of three was listed as "Slimes in the cellar": the group's label went to its leader | 16/11/2026 | Fixed | PR #942 |
| BG-267 | A blow could be lost by a hair: picking the weapon compared reach with a plain >=, not withinM; a parry's strike back too | 17/11/2026 | Fixed | PR #952 |
| BG-268 | A slime "surrendered": a Critical Failure morale break or an Overwhelm made any creature give itself up, whatever its mind | 16/11/2026 | Fixed | PR #944 |
| BG-269 | Three slimes in reach were "A slime", "The other slime" and "The other slime", so "the other slime" was ambiguous | 17/11/2026 | Fixed | PR #947 |
| BG-270 | Submit's wake line on the hub named answers Ali had not changed: chip clicks were saved but not submitted | 17/11/2026 | Fixed | PR #950 |
| BG-271 | Duplicate of BG-270: a second thread took this number for the same bug by mistake | 17/11/2026 | duplicate of BG-270 | none |
| BG-272 | The opening event roll's achievement was granted outside any scenario's end (achievement_outside_end) | 17/11/2026 | Fixed | PR #951 |
| BG-273 | A new character in story 2's world got a copy of the village: the newcomer's empty stage hid the world from the Weaver | 17/11/2026 | Fixed | PR #953 |
| BG-274 | Look around showed people out to 25 m but searched for hidden people to 25.1 m: the look range was written twice | 17/11/2026 | Fixed | PR #969 |
| BG-275 | A 4th character stopped after one turn: the opening never recorded its end, so 17 fights read as stale (fight_ends) | 17/11/2026 | Fixed | PR #962 |
| BG-276 | The Parser's answer shape listed lock, unlock, bar and unbar but not open and shut: the ops were typed out three times | 17/11/2026 | Fixed | PR #969 |
| BG-277 | The action deck's "in reach" label, the attack hint and the person card compare distance with a plain <=, without withinM's 0.1 m margin | 17/11/2026 | Won't fix | PR #974 |
| BG-278 | A dead body half seen in the dark showed as a plain Someone: the deck offered attack and talk, and the Narrator made it stand | 17/11/2026 | Fixed | PR #963 |
| BG-279 | In the action-deck playtest a Success on a look at a slime 23 m off in the dark was undone the same turn: its later step rolled a fresh make-out and failed | 17/11/2026 | Fixed | PR #964 |
| BG-280 | In the action-deck playtest the deck offered talk, haggling, gifts and searches to slimes in sight and to slimes last seen far away | 17/11/2026 | Fixed | PR #964 |
| BG-281 | In the action-deck playtest a walk up to someone read Keep walking to the zone the player already stood in | 17/11/2026 | Fixed | PR #964 |
| BG-282 | In the action-deck playtest a Restrain (and a try to break free) showed no roll: the contest was never put on its event | 17/11/2026 | Fixed | PR #966 |
| BG-283 | In the action-deck playtest the deck offered to attack with an axe held in a crippled hand; the order was wasted (not in hand) | 17/11/2026 | Fixed | PR #966 |
| BG-284 | Taking a pack off a body 19 m away took three turns, each filing invalid_gear: the walk used only move time | 17/11/2026 | Fixed | PR #967 |
| BG-285 | The causeway listed the cottage row twice: building a frontier added the new zone's way back before the frontier was joined, a second way to the same zone | 17/11/2026 | Fixed | PR #967 |
| BG-286 | Two roads north-west from the causeway: a newcomer's arrival road was built beside the unbuilt frontier for the same way | 17/11/2026 | Fixed | PR #967 |
| BG-287 | The opening's ending "the common room is cleared" had to be judged: band\_out checks one band and the slimes there came from several | 17/11/2026 | Fixed | PR #967 |
| BG-288 | Crossing the causeway's unbuilt road built it a second time (nwroad_2): the link to the built road was refused | 17/11/2026 | Fixed | PR #968 |
| BG-289 | An unbuilt frontier on nwroad pointed at a crossroads already built from the other side, so walking it could build a second | 17/11/2026 | Fixed | PR #982, #988 |
| BG-290 | A check-in beat had the weir-house man size up the hero with no grade, so it rolled at Moderate (grade_gap; run 18) | 17/11/2026 | Fixed | PR #972 |
| BG-291 | A trip's last leg never rolled for an encounter, so roads under about 4.5 km never met anything | 17/11/2026 | Fixed | PR #978 |
| BG-292 | A hub question kept "Asked again" after Ali answered: the re-ask was stored as `true` instead of a time | 17/11/2026 | Fixed | PR #1001 |
| BG-293 | Essence removal and swaps needed "at rest", which counted any hostile in the zone: zone used as distance | 17/11/2026 | Fixed | PR #1043 |
| BG-294 | A broken actor's walk weighed only foes in its own or its target zone (fearedFoes): zone used as distance | 17/11/2026 | Fixed | PR #1043 |
| BG-295 | Sleeping companions shared watches only in the sleeper's zone (planNight): zone used as distance | 17/11/2026 | Fixed | PR #1043 |
| BG-296 | The loot list offered only bodies in the player's zone (lootSources): zone used as distance | 17/11/2026 | Fixed | PR #1043 |
| BG-297 | The turn check flagged a hold only across zones, not by metres (turnCheck.ts): zone used as distance | 17/11/2026 | Fixed | PR #1043 |
| BG-298 | Typing a new answer to a re-asked hub question replaced the earlier answer: the re-ask time was set in the future | 17/11/2026 | Fixed | PR #1012 |
| BG-299 | Emptying the new answer box on a re-asked hub question also deleted Ali's earlier answer | 17/11/2026 | Fixed | PR #1013 |
| BG-300 | On a 390 px phone six library viewer tabs scrolled sideways: cards sized to their widest table | 17/11/2026 | Fixed | PR #1011 |
| BG-301 | Battle Cry's rally skipped anyone already broken, and a broken NPC stayed broken until the scenario ended (TC39, TC42) | 17/11/2026 | Fixed | PR #1015 |
| BG-302 | A few play-screen buttons showed Arial instead of the game font: buttons don't inherit the page font | 17/11/2026 | Fixed | PR #1016 |
| BG-303 | A code-run NPC's fallback bed was any within 2 zone links (BED_NEAR_HOPS): zone links used as distance | 18/11/2026 | Fixed | PR #1054 |
| BG-304 | Fieldcraft rows looked for zones only up to 3 ways off (FIELD_WAYS_OUT): zone links used as distance | 18/11/2026 | Fixed | PR #1054 |
| BG-305 | A planner's view held zones within 2 ways (PLAN_VIEW_WAYS), so a 3 km road counted as near: zone links as distance | 18/11/2026 | Fixed | PR #1054 |
| BG-306 | The code-run fight list attacked only foes believed in its own zone: same zone used as near | 18/11/2026 | Fixed | PR #1054 |
| BG-307 | A goal step "wait until X arrives" ended only when X stood in the same zone: same zone used as near | 18/11/2026 | Fixed | PR #1054 |
| BG-308 | An NPC leading someone waited until they stood in its zone, even with them in the doorway: same zone used as near | 18/11/2026 | Fixed | PR #1054 |
| BG-309 | Stepping up to be heard happened only within the same zone or one sight link: same zone used as near | 18/11/2026 | Fixed | PR #1054 |
| BG-310 | On windows under about 1000 px tall the right column cut off the Level / XP bar, Coin and the sheet link | 18/11/2026 | Fixed | PR #1063 |
| BG-311 | A new story on a new world opened on the fallback stage: the region call and the Weaver shared one timeout | 18/11/2026 | Fixed | PR #1064 |
| BG-312 | A normal voice 0.7 m away across the tavern's doorway was not heard clearly: a doorless doorway acted as a shut door | 18/11/2026 | Fixed | PR #1081 |
| BG-313 | The Map's two views disagreed: the Map still drew zone tiles and links, never the floor plan or the fog (PZ12 a) | 19/11/2026 | Fixed | PR #1096 |
| BG-314 | A search never reached past the searcher's own title, even someone 1.6 m away in a clear line (SE20's zone-era "own area") | 19/11/2026 | Fixed | PR #1089 |
| BG-315 | Gut Feeling judged a watcher's sight by titles joined by see-through ways, not by a line of sight: a watcher over a fence never set it off | 19/11/2026 | Fixed | PR #1092 |
| BG-316 | Off-screen walkers opened doors "unseen" whenever the player stood in neither title beside the door (CS11 wording) | 19/11/2026 | Fixed | PR #1095 |
| BG-317 | The Gear table broke "Mundane" mid-word and the rail cut long group names | 19/11/2026 | Fixed | PR #1085 |
| BG-318 | Journal (UI review, 19/11/2026): the Places note still says "The Map page draws their zones", but the map is a pop-up from the Play header, not a page | 19/11/2026 | Fixed | PR #1085 |
| BG-319 | The Play deck still called the essence action "Pull the Thread": 17 labels were typed by hand (src/ui/deck.ts) | 19/11/2026 | Fixed | PR #1082 |
| BG-320 | Sizing someone up rolled Insight against Lying, though a face kept is a body lie (Guile); Misdirection had the same gap | 19/11/2026 | Fixed | PR #1088 |
| BG-321 | The old skill name Lying survived its rename to Falsehood wherever it was typed by hand | 19/11/2026 | Fixed | PR #1088 |
| BG-322 | The Defense buttons' text sat at the top of each button, not centred (align-items: baseline) | 19/11/2026 | Fixed | PR #1086 |
| BG-323 | The shared test run passed or failed by file order: perks.test.ts emptied the library's perk table and never restored it | 20/11/2026 | Fixed | PR #1121 |
| BG-324 | The map checker flagged a person's token over a door icon: the initial's text box ran 2 px past its disc | 20/11/2026 | Fixed | PR #1132 |
| BG-325 | The map smoke test's long-names stage failed on GitHub only: text width does not scale evenly with size where glyphs are hinted | 20/11/2026 | Fixed | PR #1132 |
| BG-326 | Hover tips showed at once in the published game: parseFloat read the minified ".15s" as 0.15 ms | 20/11/2026 | Fixed | PR #1143 |
| BG-327 | People last seen never show on the Map or in zone cards: their zone reaches the map as a name, looked up by id (MAP-45) | Thread | Fixed | #1156 |
| BG-328 | The save check demanded exactly one current class, so a classless start's save (Commoner unlocked only) failed it | Thread | Fixed | #1175 |
| BG-329 | Bluff listed allies in reach as targets, which the engine then refused as not foes | Thread | Fixed | #1193 |
| BG-330 | The strike-card smoke test (BF66) failed now and then: its dummy, a standing copy of the player, punched back and felled the player | Thread | Fixed | #1202 |
| BG-331 | The Perks tile counted class and other granted perks, but the Perks board drew only ladder, Innate and Linked perks | Thread | Fixed | #1208 |
| BG-332 | On a carried-on world the floor plans (walls, doorways, roofs, lights, furniture) and ground items were lost | Thread | Fixed | #1206 |
| BG-333 | The GM page's turn number ran one ahead of the play page's (it showed the next turn) | Thread | Fixed | #1206 |
| BG-334 | Body parts reached the screen and the Narrator as ids ("Your right_leg"): the combat packet and condition changes gave the part's id | Thread | Fixed | #1209 |
| BG-335 | A turn that landed scrolled the story to the end of its results, past the prose, so the narration could not be read as it revealed | Thread | Fixed | #1209 |
| BG-336 | A failed first save in a carried-on world left a story with no save that kept the world taken, so reopening said it was no longer free | Thread | Fixed | #1218 |
| BG-337 | After a turn failed to save, its story text was saved anyway, so a reload showed a turn the save did not hold (and the Universe day moved on) | Thread | Fixed | #1218 |
| BG-338 | A failed delete after /undo's head write said there was nothing to undo and kept the pre-undo state on screen | Thread | Fixed | #1225 |
| BG-340 | A crossbow shot ran under its instant spanning row, so it never locked movement and paid base strain, not Hard | Thread | Fixed | #1291 |
| BG-341 | Test fixtures ran at another distance than asked: `beside()` fell back silently, and `tinyArea()` was undone by `makeVillage()` | Thread | Fixed | #1275 |
| BG-343 | The ambush rolled the attacker's weapon skill against one sense, not Combat Stealth (against ST2); now the attack's own stealth contests | Thread | Fixed | #1304 |
| BG-345 | The sleep bonus (FT8) went to anyone asleep in a room with a bed, on it or not: nearness by room, not metres | Thread | Fixed | #1377 |
| BG-346 | A zone name does not fit its zone at an intermediate zoom on the Bent Nail Map (MAP-20, tavern.common) | Thread | Fixed | #1378 |
| BG-347 | Sleep on a far bed from the map slept where the first move ended, then walked to the bed | Thread | Fixed | #1397 |
| BG-348 | A zone name showed on ground not seen: back yard on bent-nail, on the Map at 40 m and the minimap (MAP-16), fitted to the zone, not its seen part | Thread | Fixed | #1416 |
| BG-349 | An exit's arrow ran past the map's edge while its note was in view (MAP-50, minimap 60 m on the default fake page, Map 60 m on long-names) | Thread | Fixed | #1420 |
| BG-350 | A person at their own point in a small room was drawn outside it at every zoom (one-room with people; MAP-25, MAP-68), and could crowd out the door's exit | Thread | Fixed | #1425 |
| BG-351 | A copy NPC's rank traits were redrawn on every load and only added, so a trait-pool or RANK_TRAITS edit gave saved NPCs more traits than their rank | Thread | Fixed | #1430 |
| BG-352 | Each backdrop downloaded twice when the host sent no cache headers (PS-489), so the opening smoke test failed about half the time | Thread | Fixed | #1435 |
| BG-353 | The Character page's level bar showed no progress: its fill had no colour outside a skill tree | Thread | Fixed | #1434 |
| BG-354 | Over bright backdrops (snow, sky) the veil's top was too thin (62%), so muted and faint text and the stat icons fell below WCAG AA at the top | Owner | Fixed | #1444 |
| BG-355 | Plain doors on the Map test stages had no barrier record, so they drew as open gaps and acted as doorways (MAP-52) | Thread | Fixed | #1447 |
| BG-356 | On the Map a person's disc and your pin drifted off their own point as you zoomed in, so a last-seen disc sat off its ring's centre (MAP-68) | Owner | Fixed | #1449 |
| BG-357 | A pop-up opened from the minimap could end up off screen: placed once for the window's size at opening and never moved back in when the window narrowed, and the minimap's tip ran off the right edge (PS-490) | Owner | Fixed | #1463 |
