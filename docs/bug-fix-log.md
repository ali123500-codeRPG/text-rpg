# Bug fix log

Every fixed bug (BG-n): what was wrong, and what was done to fix it. Newest first.

Every thread that fixes a bug adds its entry here in the fixing PR, newest at the top (tests/unit/bug-fix-log.test.ts checks that every
fixed row in the bug log of docs/build-spec.md has one). Entries up to BG-189 were filled in from that bug log: the fix as the log
words it, or, where the log only names a PR, that PR's title.

## BG-252

**What was wrong:** After the make-out roll (PR #840) succeeded, the story named the person, but Who's here, the Narrator's list of people present and name learning still showed them as "someone": all three come from one function (seenActors) that went by distance alone. The Narrator was told both that the event's actor was "a village guard" and that the same person was an unknown "someone". The "stays put" rule (Q17) only reached 25 m and, in Who's here, only dark rooms.

**What was done:** Ali approved the fix (PG11 a). The turn's make-out results live in src/perception/madeOut.ts; seenActors counts anyone the viewer made out by sight this turn as seen clearly, for the player and NPCs alike. The player keeps anyone seen clearly named while they stay put and can still be glimpsed (stillGlimpsed in src/perception/sight.ts), the same rule in event perception and in Who's here, in light and dark.

**Fixed by:** [PR #TBD](https://github.com/ali123500-codeRPG/text-rpg/pull/TBD)

## BG-251

**What was wrong:** Ali asked whether shots make noise where they land: they didn't. A shot or throw was heard and seen only where the shooter stood, at conversation loudness, so people where it landed never learned they were under attack, and a missed target still "felt" the miss.

**What was done:** Ali approved the fix (BF73). Every shot or throw, hit or miss, makes an impact event at its target's spot (src/engine/resolve.ts landImpact): Loud on armour, a shield or a hard surface (a miss indoors), Raised on flesh or soft ground (a miss outdoors), from real impact measurements (CONFIG.IMPACT_NOISE). It raises the alarm and startles those it reaches, so they react; a missed target notices the miss by it instead of feeling it (perception), and the shooter stays as hidden as before.

**Fixed by:** [PR #847](https://github.com/ali123500-codeRPG/text-rpg/pull/847)

## BG-250

**What was wrong:** Every animal race (dog, wolf, tiger, bear and the rest) attacked at skill 0. Their bites, claws, kicks, tusks and tail lashes roll the Natural Weapons skill, but that skill's tree was open only to slimes and dragons, so for an animal the game counted the skill as locked: a wolf built with Natural Weapons 61 rolled as if it had none. Found in the animal body types work, right after PR #838.

**What was done:** A skill that one of a being's own natural attacks rolls (its body type's or its race's) is always open to it, worked out from its attacks, so every animal added later is covered without a list. The tree's other rules are unchanged. A test checks that a composed wolf rolls its real skill and that every race can use every skill its own attacks roll.

**Fixed by:** [PR #842](https://github.com/ali123500-codeRPG/text-rpg/pull/842)

## BG-249

**What was wrong:** A Light Sleeper's hearing roll when someone came near (src/engine/sleep.ts wakeCheck) never marked anything: not the sleeper's Earshot, on either the contest against a sneaker or the check against open steps, and not the sneaker's stealth skill. Every other sense contest (someone sneaking near you, an ambush, a filch) marks both sides. Found while checking passive Eyesight and Earshot growth.

**What was done:** Ali approved the fix (PG1 a on the "Passive Eyesight and Earshot growth" page). The contest now marks both sides (markUse), and the open hearing check is recorded like any check against its difficulty (ruleset.recordUse). Tests in tests/cases/s301-sleep-near-by-sound.test.ts.

**Fixed by:** [PR #836](https://github.com/ali123500-codeRPG/text-rpg/pull/836)

## BG-238

**What was wrong:** Turn 75 ("I shoot at the small girl with the stick") took about 53 seconds. The player was in free roam; an attack there starts a new scenario at once, and the turn waited for the Weaver to plan it (50.5 seconds) before showing anything.

**What was done:** Ali approved the fix (BF63). Danger in free roam no longer holds the turn: the event roll is made and saved (stage.starting), the turn is shown at once, and the Weaver plans the scenario in the background after the save (src/scenario/director.ts holdStart, startPlanning). Free roam goes on for one more turn and the scenario opens after it from that plan, checked again against the stage; a reload plans it then with the saved roll, and a knock-out or road encounter first drops it. A frontier crossing still waits.

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-241

**What was wrong:** The player shot the girl from hiding, then killed the keeper a step from her, and she never reacted; hours later she walked past his body as if nothing had happened, and the story kept calling her asleep. A hidden striker's attack reached no one, not even what it did; nobody ever noticed a body; only those already fighting got to think; and someone woken on a sleep step still showed as sleeping.

**What was done:** Ali approved the fix (BF65). A blow that hurts or downs someone is felt by them and seen by anyone who sees them as a struck event, while the striker stays as hidden as the stealth rolls say (src/engine/resolve.ts struckSeen). Someone who first sees a body it did not see fall finds it once (findBodies, Mind.bodiesFound). Both raise the alarm (src/minds/state.ts updateAlarms) and the existing fears, and startle the NPC so it gets a Planner call to react even outside a fight (src/agents/game.ts plannerActors). Awake on a sleep step reads as lying awake.

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-237

**What was wrong:** "Take the hinge pins from the trough" only walked the player to the trough, three times: the Parser could not pick up something not in view and its rules said nothing for that case, so it kept just the walk, and it put the rest off as "interact them", which nobody would type.

**What was done:** Ali approved the fix (BF62). The Parser's rule now reads taking something not in view from a named place or thing as a search there (move plus search). A put-off line is never an action name with a stand-in: the Parser is told so, an action waiting for arrival with no line the player would type waits as nothing (src/agents/wrappers.ts actionWords), and any placeholder put-off line is dropped and logged (placeholderLine, deferred_placeholder).

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-236

**What was wrong:** Ennis gave a job to rehang the pen gate and split the woodpile, and named hinge pins, a mallet and an axe that did not exist: the chore was kind "other", which nothing could do or check, and his reply described things freely.

**What was done:** Ali approved the fix (BF61). Givers may offer only jobs code can check (defeat, deliver, reach, find): "other" is gone from the job schema, the job rule tells them never to offer a chore and never to say a tool or thing is somewhere their view doesn't show, and a job code still can't read is refused (src/engine/quests.ts makeQuest, unchecked_goal) and filed as a gap. Doable chores went to the features thread.

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-247

**What was wrong:** From turn 104 to 112 Hob's punches were all lost as out of reach about 1 m short: a walk never ended within 1 m of anyone, the target included, and only went in a straight line, so with Osric beside his line in he stopped 1.7 m away; the drover ended on Hob's very spot because anyone near a walk's start was let off.

**What was done:** Ali approved the fix (BF71), with the gap cut to 0.2 m. Closing in keeps no gap from its target and stops at the action's reach; a taken straight-line spot makes the walker step round to the nearest free spot at that reach within its walk (src/engine/position.ts walkLeg, ringSpots). Hemmed in on every side, the blow or grab is lost with no_room (roomAround). A walk's end keeps PLACE_GAP_M (0.2 m) from everyone, no one let off; placing people and walking up to someone keep PLACE_SPACING_M (1 m). The code-run opening move closes to the blow's reach.

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-246

**What was wrong:** A roll line read "d100 49 → Critical Failure−−−−−− [weapon +9, light −5, Shaken −5]" with nothing to say how a 49 got there: the eight outcome steps lost for an old sword far beyond Corwin's skill were never shown, and his own view never told him the sword was beyond him, so he kept swinging it.

**What was done:** Ali approved the fix (BF70). Every roll line shows the outcome before its whole steps, the steps with their sources, and the outcome after (src/agents/game.ts tiered), for attacks, defenses, contests and checks. An NPC's own gear in its view says when it is beyond its skill and by how many steps (OwnGearView.beyondYou, src/views/index.ts beyond).

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-245

**What was wrong:** Woken by every shout in a fight, an exhausted Bettany fell straight back asleep the same moment, six turns running, and never fled: collapsing from exhaustion checked none of the guards that falling asleep by routine checks.

**What was done:** Ali approved the fix (BF69). Collapse uses the same guards as routine sleep (src/engine/sleep.ts mayDropOff): not within FALL_ASLEEP_MIN of waking, nor while alarmed, broken, engaged or held. Once those lift, exhaustion takes the actor again.

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-244

**What was wrong:** Bettany, Osric and Tam were never given a bed, and a routine step whose place is missing was skipped, so they never slept; Bettany keeled over in the square after three days.

**What was done:** Ali approved the fix (BF68). When the cast is placed, anyone whose set has a bed slot and none given gets a real bed within BED_NEAR_HOPS links of its own spots, else its refuge, else its work spot (src/scenario/apply.ts withBed). A sleep step with no bed in play runs where the NPC stands, and the gap is filed once as a bug (bed_missing).

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-243

**What was wrong:** Osric opened almost every turn with the same shout: words said beside a deed (a bark) were left out of every NPC view, so his mind never saw what he had said and the people around him never got his words.

**What was done:** Ali approved the fix (BF67). A bark is real speech: those who hear it get its words, the speaker's said list includes it (src/views/index.ts), and the shared line rule tells every speaker never to say a line from its said list again, or the same thing in other words (src/agents/prompts.ts LINE_RULE). Barks still copy no beliefs.

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-233

**What was wrong:** An achievement held for a scenario's end was stamped with the turn it was handed over, so its line named the wrong turn.

**What was done:** Ali approved the fix (BF60). A queued achievement keeps the turn it was reached on (pendingAchievements[].turn), and the grant uses it (src/engine/xp.ts grantAchievement, src/engine/growth.ts flushGrowth).

**Fixed by:** [PR #832](https://github.com/ali123500-codeRPG/text-rpg/pull/832)

## BG-248

**What was wrong:** Tapping a name inside a clarifying question filled the box with the last order plus the name in brackets ("I attack hob (Osric Fell)"); the Parser never saw its own question, so it asked again, and each tap added another bracket.

**What was done:** Ali approved the fix (BF72). A question with answer buttons has no tappable names. A tapped name replaces the name the first order used ("I attack Osric Fell"), built from the first order of the run so taps never pile up (src/ui/play.ts answerWith). The words sent after a question reach the Parser beside the question and that order (ANSWERING, src/agents/answering.ts), and Parser rule 5 reads them as one order. Test tests/cases/s316-clarify-answer.test.ts.

**Fixed by:** [PR #824](https://github.com/ali123500-codeRPG/text-rpg/pull/824)

## BG-242

**What was wrong:** No hit pop-up showed on turns 75 and 76: the strike card only existed with motion on, came about 2 seconds after the turn landed, and any click on the story in that time threw it away.

**What was done:** Ali approved the fix (BF66). The card shows as the turn lands, before the prose, on its own timer: a skip lands its motion but never removes it, and with motion off it shows still for the same time (src/ui/play.ts strikeCard). The page records the browser's motion settings at db diag/motion. Tests in tests/smoke/play.smoke.ts (motion on and off).

**Fixed by:** [PR #824](https://github.com/ali123500-codeRPG/text-rpg/pull/824)

## BG-239

**What was wrong:** "The scenario draws to a close" showed above the waiting line before the gains pop-up, giving the ending away; the rail's perk-point badge could also change while the turn ran.

**What was done:** Ali approved the fix (BF64). The line is gone, and the rail's badge keeps its count until the turn lands (src/ui/app.ts). Test in tests/smoke/play.smoke.ts (no end-wait rule during a turn).

**Fixed by:** [PR #824](https://github.com/ali123500-codeRPG/text-rpg/pull/824)

## BG-232

**What was wrong:** The agent playing the character said the player's signature saying on move after move: In character told it to "keep to" each signature, the guided part gave them a second time every move, and words its commands had the character say aloud never went in the list of lines it must not repeat.

**What was done:** Ali approved the fix (BF59 a, plus an automatic flag). In character calls signatures habits, not lines to recite: a saying only where the moment calls for it, never on two moves running; in character the guided part no longer repeats them; quoted words in the agent's command join its said list; a line said word for word again within the last few is filed as bug code agent_repeat (src/save/bugs.ts). Test tests/cases/s311-speech-in-character.test.ts.

**Fixed by:** [PR #820](https://github.com/ali123500-codeRPG/text-rpg/pull/820)

## BG-231

**What was wrong:** "Wait for someone to appear" passed one minute: a wait could only run to a time of day, so the Parser made it a plain hold, and even a wait to a time of day ran on past a passer-by coming into sight.

**What was done:** Ali approved the fix (BF58, option b). A wait can now run until someone appears (target "someone", WAIT_SOMEONE in src/scales.ts): time runs on until anyone new comes into the player's sight or hearing (inSenses in src/engine/comingNear.ts, why "appeared"), or CONFIG.WAIT_SOMEONE_MAX_H (8 hours). Parser rule 12 sends "wait until someone comes", "hold my place" and watching with no end there, with anything meant for whoever comes deferred (BF57). Test tests/cases/s314-wait-for-someone.test.ts.

**Fixed by:** [PR #812](https://github.com/ali123500-codeRPG/text-rpg/pull/812)

## BG-230

**What was wrong:** Watching the road from behind the log heap passed about 2 seconds a turn: the Parser read it as Hide, and outside a fight a turn lasts as long as its order.

**What was done:** Ali approved the fix (BF58). Parser rule 15 says Hide is getting out of sight; once hidden, staying hidden and watching is the wait until someone appears (BG-231), which keeps the player hidden. Test tests/cases/s314-wait-for-someone.test.ts.

**Fixed by:** [PR #812](https://github.com/ali123500-codeRPG/text-rpg/pull/812)

## BG-229

**What was wrong:** "Hold my place and shoot the first one who appears" was asked about, dropped, or set aside with nothing to fire it.

**What was done:** Ali approved the fix (BF57, as a wait). The hold is the wait until someone appears (BG-231), and the shot goes in deferred, offered back in the box when someone comes. A real readied action is parked as a feature. Test tests/cases/s314-wait-for-someone.test.ts.

**Fixed by:** [PR #812](https://github.com/ali123500-codeRPG/text-rpg/pull/812)

## BG-228

**What was wrong:** The game's clarifying question "Do you want to hold your place and wait...?" had nothing to click: only names in a question could be tapped.

**What was done:** Ali approved the fix (BF56). The Parser gives two or three replies (answers) with a question; they show as buttons under it, and a tap fills the box without sending. Tests tests/cases/s314-wait-for-someone.test.ts and the play smoke test.

**Fixed by:** [PR #812](https://github.com/ali123500-codeRPG/text-rpg/pull/812)

## BG-227

**What was wrong:** A scenario ending "the player holds a basket-hilted sword" could never be met: the same plan made Corwin's sword from the plain one, and the ending named the plain one.

**What was done:** Ali approved the fix (BF55) and asked for a bug report each time. An ending naming the base of the one item its plan makes means the made item (applyStagePlan), and each such ending files an ending_item_remapped bug report. Test tests/cases/s298-turn43-checkin-road-clarify.test.ts.

**Fixed by:** [PR #812](https://github.com/ali123500-codeRPG/text-rpg/pull/812)

## BG-226

**What was wrong:** Crossing a frontier onto the new east road put the player at the road's middle, about 1 km from the square, in one move: entering a newly built zone set the player's zone but not where in it they stood, so they were put at its centre.

**What was done:** Ali approved the fix (BF54). Crossing into a newly built zone puts the player a step inside the way they came in by (entryPoint in src/engine/position.ts), as walking into any zone does. Test tests/cases/s299-frontier-road-joins.test.ts.

**Fixed by:** [PR #806](https://github.com/ali123500-codeRPG/text-rpg/pull/806)

## BG-225

**What was wrong:** The east road was built apart from Thornbury's square, about 23 m east and 24 m south of it: the new zones were placed on the map before the square's frontier was joined to them, so the road had no placed neighbour and went in the fallback spot east of everything.

**What was done:** Ali approved the fix (BF53). The frontier is joined to the new zone before the zones are placed, so it is laid touching the zone it leads from (also for the fallback zone when the Weaver fails). Zones already placed don't move, so roads in existing saves stay where they are. Test tests/cases/s299-frontier-road-joins.test.ts.

**Fixed by:** [PR #806](https://github.com/ali123500-codeRPG/text-rpg/pull/806)

## BG-224

**What was wrong:** A clarifying question named the ways out of the square ("the east road out of the village", "the lane down toward the mill stream"), but only the high lane could be clicked: tappable phrases came from the names of people, places and items, and ways out to places not built yet have only a label.

**What was done:** Ali approved the fix (BF52). The labels of the ways out of where the player stands are tappable too. Test in tests/cases/s298-turn43-checkin-road-clarify.test.ts.

**Fixed by:** [PR #806](https://github.com/ali123500-codeRPG/text-rpg/pull/806)

## BG-223

**What was wrong:** The Weaver's road lengths in words ("an hour's walk") were always refused: it is told the words, but the check took only the code's keys (hour), so every new road needed a repair call.

**What was done:** Ali approved the fix (BF51). The check reads a length in words as its key, and "2 km" written as text as km; anything else is still refused. Test in tests/cases/s298-turn43-checkin-road-clarify.test.ts.

**Fixed by:** [PR #806](https://github.com/ali123500-codeRPG/text-rpg/pull/806)

## BG-222

**What was wrong:** A Weaver check-in that pointed the scenario's ending at Corwin's own sword (an item made in play, IT26_m39_0) was thrown out as "item unknown": endings that ask for an item were checked against the base catalogue only.

**What was done:** Ali approved the fix (BF50). Hold and deliver endings are checked with the same lookup as the rest of the game, which knows items made in play. The Weaver's world summary names items made in play too. Test in tests/cases/s298-turn43-checkin-road-clarify.test.ts.

**Fixed by:** [PR #806](https://github.com/ali123500-codeRPG/text-rpg/pull/806)

## BG-221

**What was wrong:** The tinker woman hailed the player with no words ("the words slide past you unheard"): her Weaver beat fired in the middle of the turn, the moment she saw him, but a beat's words are written only for beats due at the start of a turn.

**What was done:** Ali approved the fix (BF49). A speech beat aimed at the player that comes due mid-turn waits for the next turn's start, where the speaker's own call writes the words. Other beats still fire at once. Test tests/cases/s297-mid-turn-speech-beat-waits.test.ts.

**Fixed by:** [PR #806](https://github.com/ali123500-codeRPG/text-rpg/pull/806)

## BG-220

**What was wrong:** Back (the browser's or the mouse's back button) went to another tab instead of closing the full-screen Perks pop-up: opening it added no step to the browser's history, so Back left the Character page.

**What was done:** Ali approved the fix (BF48). Opening a full-screen pop-up adds one history step, so Back closes it and stays on the page; closing it with ✕ or Esc takes that step back off, so the next Back goes where it always did. Small pop-ups are unchanged. Browser test in tests/smoke/play.smoke.ts.

**Fixed by:** [PR #796](https://github.com/ali123500-codeRPG/text-rpg/pull/796)

## BG-219

**What was wrong:** The small Gear pop-up on the Character page opened outside the screen. On screens 2400 px and wider the page is zoomed 1.3x, and pop-ups were placed from screen-pixel sizes used as page pixels, so they landed 1.3 times too far right and down. The perk card, the item tip, the distance tip, the rail tips and dragging pop-ups had the same mix-up.

**What was done:** Ali approved the fix (BF47). New helpers in src/ui/kit.ts (viewSize, boxOf, pointOf) turn the window size, an element's box and the mouse position into page pixels; every floating panel uses them, and pop-ups are capped at the zoomed window's height. Below 2400 px nothing changes. Browser test at 2560x1440 in tests/smoke/play.smoke.ts.

**Fixed by:** [PR #796](https://github.com/ali123500-codeRPG/text-rpg/pull/796)

## BG-218

**What was wrong:** The Character card read "In the the Crooked Kettle": it always wrote "In the" before the place's name, though place names carry their own article or are proper names (it would have said "In the Thornbury"). The agent player's where-you-are line had the same gap ("Where you are: the the village square").

**What was done:** Ali approved the fix (BF46). One rule, theName in src/words.ts, puts "the" only before a plain common name; a name that starts with an article, a capital letter or a place word like "behind" stays as it is. The card and the agent player's line both use it. Test tests/unit/bg218-place-article.test.ts.

**Fixed by:** [PR #791](https://github.com/ali123500-codeRPG/text-rpg/pull/791)

## BG-217

**What was wrong:** Ali's report (story mwf2lt7l, turn 37): after scenario 1 ended at turn 34 he was in free roam, and achievements (Set Foot in a Tavern, Set Foot in a Village, Job Done, For Nothing) and level 6 landed at once, one by one. Growth only waited while a scenario ran.

**What was done:** Ali approved the fix (BF44). Free roam now counts toward the next scenario for growth: achievements queue, levels and All-XXX steps wait, and the next scenario's end grants them in its gains moment, whose XP line and sources start where the roam started. Test in tests/cases/s205-growth-at-scenario-end.test.ts.

**Fixed by:** [PR #791](https://github.com/ali123500-codeRPG/text-rpg/pull/791)

## BG-204

**What was wrong:** Story mwf2lt7l, turn 27: the Weaver put the village's barred north gate straight on the way to the north road, a frontier. The plan check refuses a barrier there, but the Weaver's instructions never said so, so it cost a second Weaver call to repair the plan.

**What was done:** Ali approved the fix (BF43). The Weaver's barrier instructions now say a barrier goes only on a way between two zones, never on a drop or a way to a frontier; for a gate out of a place it adds the zone beyond the gate and gives that zone the frontier. Test in tests/unit/agents.test.ts.

**Fixed by:** [PR #791](https://github.com/ali123500-codeRPG/text-rpg/pull/791)

## BG-192

**What was wrong:** In story mwf2lt7l (turns 22 to 27) Wren kept trying to hand Happi the lucky charm from his sack, and each time the game dropped the charm from his action (invalid_gear). The check on what an NPC may name knew only what hung on his body, not what was inside his own sack, so his give, and his try to take the charm out first, both pointed at an item he "didn't have". It was filed four times, once per try: BG-192, BG-196, BG-198 and BG-205.

**What was done:** Nothing new was needed; Ali OK'd closing it (BF42). PR #698 (putting things into containers) had already taught the check that what is in your own sack is yours to name, give or take out. It merged about half an hour after the last of these turns. BF34 (PR #764) made a give from a sack actually hand it over. A test replays Wren's turn 23 answer and expects nothing dropped (tests/cases/s280-put-into-containers.test.ts).

**Fixed by:** [PR #698](https://github.com/ali123500-codeRPG/text-rpg/pull/698), [PR #764](https://github.com/ali123500-codeRPG/text-rpg/pull/764)

## BG-196

**What was wrong:** Another of Wren's tries to give the charm from his own sack, dropped as invalid_gear. The same bug as BG-192.

**What was done:** Closed as BG-192 (BF42): already fixed by PR #698 and PR #764.

**Fixed by:** [PR #698](https://github.com/ali123500-codeRPG/text-rpg/pull/698), [PR #764](https://github.com/ali123500-codeRPG/text-rpg/pull/764)

## BG-198

**What was wrong:** Another of Wren's tries to give the charm from his own sack, dropped as invalid_gear. The same bug as BG-192.

**What was done:** Closed as BG-192 (BF42): already fixed by PR #698 and PR #764.

**Fixed by:** [PR #698](https://github.com/ali123500-codeRPG/text-rpg/pull/698), [PR #764](https://github.com/ali123500-codeRPG/text-rpg/pull/764)

## BG-205

**What was wrong:** Another of Wren's tries to give the charm from his own sack, dropped as invalid_gear. The same bug as BG-192.

**What was done:** Closed as BG-192 (BF42): already fixed by PR #698 and PR #764.

**Fixed by:** [PR #698](https://github.com/ali123500-codeRPG/text-rpg/pull/698), [PR #764](https://github.com/ali123500-codeRPG/text-rpg/pull/764)

## BG-197

**What was wrong:** Following Wren into the kitchen (story mwf2lt7l, turn 21) walked Happi onto the exact spot Wren stood on, so they ended 0 m apart: nothing stopped two people ending on one spot, and a follow had no distance of its own.

**What was done:** Already fixed by BF35 (PR #759): a walk stops about a metre short of anyone standing at its end, and a follow keeps the distance you say (about 2 m by default, more when sneaking). Ali OK'd closing the number (BF42). Test tests/cases/s304-follow-distance.test.ts.

**Fixed by:** [PR #759](https://github.com/ali123500-codeRPG/text-rpg/pull/759)

## BG-215

**What was wrong:** On the Achievements page "No Match for You" showed "↻4" beside its name although the chain has only two levels. The ↻N counted every row in the chain, its branch rows included (Influence I, Sight I), and it sat glued to the name. Next also ignored the branches once the trunk was finished, so the chain said nothing was left while two branches were part-way.

**What was done:** Ali approved the fix and the new look. The ↻N is gone; the level line reads "II of II · 1 branch" and Next follows the branch closest to its next count. The page now draws each chain as a gold thread (src/ui/achievementThreads.ts): a knot for each level held and one for the next, filled as far as the tally has come, with a short fading tail when more levels follow. The place reads "I of ?" until the last level is in sight. Branches (By race · Human and so on) sit under the trunk, a size smaller, folded by default; tag headings fold their whole section. Tests in tests/cases/s284-achievement-chains-page.test.ts.

**Fixed by:** [PR #774](https://github.com/ali123500-codeRPG/text-rpg/pull/774)

## BG-216

**What was wrong:** On the map, the furniture in "behind the counter" sat in different spots at each zoom (Ali's two screenshots), and on the Bent Nail some pieces vanished when zoomed out and came back when zoomed in. Every zoom placed the marks again in screen pixels and pushed them round the zone's name, which sat inside the zone at one zoom and outside on a leader line at another, so the free spots changed.

**What was done:** Ali approved the fix (MZ1-MZ4). Marks inside a zone (furniture, stairs, you, people) are placed once at the closest zoom, and every zoom keeps each at the same share of its zone. Zoomed out, furniture or stairs that would cover another mark hide in their own spot and come back there; you and people are never hidden and step aside only then. Zone names became bold letters inside the zone, as large as fit its box, on a layer behind the marks, so a name takes no room (MZ2), shrinking to stay inside a small zone (MZ3). The map checker lets marks sit on that layer (MZ4). Tests check the three test stages at six zooms and a whole turn.

**Fixed by:** [PR #770](https://github.com/ali123500-codeRPG/text-rpg/pull/770)

## BG-195

**What was wrong:** Wren gave Happi the lucky charm from his sack and nothing happened: a give could only hand over what the giver held or had stowed, never what sat in a bag, and it moved the item at once with no say from the one receiving it.

**What was done:** Giving and taking became trades at no price (BF34). A give holds the item out, from a grip, the pack or the giver's own bag, until the other side takes it by the end of the next turn; an NPC who is not set against the giver takes it at the end of the turn. A new take action is the taker's at once when the item is held out to them, or the owner yielded, surrendered, is down or asleep; anyone else refuses. Both need the grips to reach.

**Fixed by:** [PR #764](https://github.com/ali123500-codeRPG/text-rpg/pull/764)

## BG-201

**What was wrong:** On turn 24 Wren called "Here! The hare... take it to him" to Happi as he left. The words were placed where his walk ended, beyond the kitchen wall, so Happi never heard them.

**What was done:** Ali approved the fix (BF36). Words beside a walk are heard from where they are said. An NPC says them as it sets off, unless its move says to say them on arrival (speakAt "end"). A walk up to someone to be heard still comes first. For the player, the order of their words decides, through the Parser's "after". A case test covers an NPC talking as it leaves, a line beside a dash, speakAt "end", and the player both ways.

**Fixed by:** [PR #759](https://github.com/ali123500-codeRPG/text-rpg/pull/759)

## BG-208

**What was wrong:** After turn 32 Ali asked why the skills from the Street Instinct essence (Dodge +1, Insight +1) showed nowhere. Happi had neither skill on her sheet, so the essence's points counted as 0. Separately, /essence take was a command, and commands were not saved until the next turn, so the take was lost if the page reloaded first.

**What was done:** Ali approved both parts (BF40). Part 1 was fixed in PR #704: a held essence puts the skills it gives on the sheet at raw 0, so its points count and show. Part 2: a command that changes the character (/essence take, pass, give, sell and remove, and /title) now saves at once, as a perk pick does. A unit test reloads the story after a take, a pass and a give.

**Fixed by:** [PR #704](https://github.com/ali123500-codeRPG/text-rpg/pull/704) and [PR #757](https://github.com/ali123500-codeRPG/text-rpg/pull/757)

## BG-214

**What was wrong:** On the stage map the high lane ran straight through the Bent Nail, with the bar on the far side of the lane; zone sides were not whole metres (a 60 m² room was 7.746 m across), and zone names, doors, exit marks and people covered each other, with exits pointing at empty space. Placement put each zone at the first free spot beside its link without leaving room for the exits still to come, a building's outline counted its open yard, and the map drew every mark at a fixed offset without looking at what was already there.

**What was done:** Ali approved the plan (stage map questions MR1 to MR3). Zones snap to whole metres and take the free spot that leaves the most room for their named exits; a building is its indoor zones only. A layout pass (src/ui/mapPlan.ts) places every mark in the rpg-map order so nothing covers anything, tags every element, and in dev views the rpg-map checker runs after each render. A stored layout that breaks the rules is placed again once on load (MR2), and the journal keeps the zones the player has stood in so the map draws seen apart from explored (MR1). Tests in tests/unit/map-plan.test.ts.

**Fixed by:** [PR #755](https://github.com/ali123500-codeRPG/text-rpg/pull/755)
## BG-203

**What was wrong:** On turn 25 Happi followed the lean man, who had just gone out of sight behind the kitchen door. The follow became a walk to where she last saw him, the walk's words named nobody ("them"), and the follow was dropped, so the story found an empty spot and then met the same man as a stranger.

**What was done:** Ali approved the fix (BF28). The walk names the person as the player knows them ("the spot where you last saw the lean man"), and the Narrator is told that anyone like him there is him. A follow of someone out of sight stays a follow: once they are seen or heard on the way it keeps after them on the next turns; not found at the spot, they are lost and the following line says so. A case test replays the turn.

**Fixed by:** [PR #754](https://github.com/ali123500-codeRPG/text-rpg/pull/754)

## BG-213

**What was wrong:** On turn 35 the give went to Corwin, who was out of sight, so the out-of-sight rule held the action back for arrival. It kept only spoken words, and a give has none, so nothing was kept: the walk ended a pace from Corwin with no suggestion.

**What was done:** Ali approved the fix (BF41). A held-back action now comes back on arrival as the player's own line, built from the action ("give Corwin the lucky charm"), when there are no spoken words. A unit test covers the give.

**Fixed by:** [PR #754](https://github.com/ali123500-codeRPG/text-rpg/pull/754)

## BG-202

**What was wrong:** On turn 24 Happi whispered her thanks while stealthy, and her stealth ended. Any speech action ended stealth whatever its volume, though only speaking above a whisper should.

**What was done:** Ali approved the fix (BF38). A whisper keeps the player stealthy, whatever action carries it; speaking louder still ends it. A case test checks both.

**Fixed by:** [PR #754](https://github.com/ali123500-codeRPG/text-rpg/pull/754)

## BG-194

**What was wrong:** In playtest run 101 the leak scan counted every actor id as a secret word. One actor's id was the plain word "thief", so a story about the purse thief was thrown out twice and the player read the bare template line.

**What was done:** Ali approved the fix (BF39). Only ids that look like ids (with digits, underscores or dots) are scanned as ids. Strangers' first names (capitalised, not common words like Will or Rose at a sentence start) and unlearned secret ids are scanned as words. A case test checks both.

**Fixed by:** [PR #754](https://github.com/ali123500-codeRPG/text-rpg/pull/754)

## BG-207

**What was wrong:** On turn 32 Happi attacked Wren while he lay down, and he rolled a dodge and was only grazed. Code treated someone down as merely unaware, which still rolls a defense with a penalty.

**What was done:** Ali approved the fix (BF30). Someone down, asleep or held in a grip fails the defense roll outright (Critical Failure, "can't defend"), so the rest of the attack works as normal. A case test checks all three.

**Fixed by:** [PR #754](https://github.com/ali123500-codeRPG/text-rpg/pull/754)

## BG-193

**What was wrong:** "Punch him" with a sword in hand struck with the sword, and on turn 32 "I strangle the lean man" became a shortbow shot. The view listed no attacks made with the body itself, so the Parser fell back to the weapon in hand.

**What was done:** Ali approved the fix (BF32). The player's view lists the body's own attacks (punch, grapple, kick...), and the Parser uses one for a blow with the body; a strangle is a grapple. With every hand full, the game asks the player to put the held item away first instead of going ahead. Case and unit tests cover the sword and the bow.

**Fixed by:** [PR #754](https://github.com/ali123500-codeRPG/text-rpg/pull/754)

## BG-206

**What was wrong:** On turn 30 Happi searched Wren for the charm. A search of a person listed only what they carried at the top level, so it found his sack but never looked inside it.

**What was done:** Ali approved the fix (BF29). A hands-on search looks inside the unlocked bags someone carries, and what it finds there can be picked up from them. A locked bag is found and named as locked. A case test checks the charm in the sack.

**Fixed by:** [PR #754](https://github.com/ali123500-codeRPG/text-rpg/pull/754)

## BG-200

**What was wrong:** On turn 29 Happi's shot read as one tier ahead of Wren's dodge, yet it only grazed him. The midden yard's cover had pushed the result one tier his way, but the roll line never said so, so the outcome looked wrong.

**What was done:** Ali approved the fix (BF25, pushed with BF33). The roll line now names every shift of the gap and whose way it went, for example "cover: 1 tier his way", for the player's attacks and for attacks on the player. A case test checks the line names the cover shift.

**Fixed by:** [PR #750](https://github.com/ali123500-codeRPG/text-rpg/pull/750)

## BG-199

**What was wrong:** On turns 23-24 Wren broke and yielded to Happi, but the story never said so. His chip still showed a morale bar level, the XP row gave one total with no source, and an essence was offered from him although he was not dead.

**What was done:** Ali approved the fix (BF24, pushed with BF33), and added that an essence drops only on a death, never a defeat. The turn now says "Wren breaks and yields to you" or "surrenders to you", and his chip reads Broken or Surrendered. The XP row lists each award with its source ("Wren Tallow defeated (broke)", "job done: ...", an achievement). An essence now rolls only for a foe the player hurt, on the turn that foe lies dead. Case tests cover the yield line, the chip, the XP sources and the death-only rule.

**Fixed by:** [PR #750](https://github.com/ali123500-codeRPG/text-rpg/pull/750)

## BG-212

**What was wrong:** A reward the Weaver minted with a name of its own was placed as a plain item when a hidden term of the plan sat inside a longer word of its name or look ("rat" inside "a pirate's sword"). Nothing leaked, so the player lost the better item for no reason. The reward check matched parts of words; every other leak check in the plan matches whole words (V10).

**What was done:** Ali approved the fix plan (leftover scan CS19). The reward check uses the same whole-word helper (mentions) as the rest of the plan; a whole hidden word ("the rat's blade") still drops the name. A case test (s292) covers both.

**Fixed by:** [PR #746](https://github.com/ali123500-codeRPG/text-rpg/pull/746)

## BG-211

**What was wrong:** A stash was a quiet sound that anyone nearby could see plainly, instead of the hushed, low-visibility act the rule sets (SE9). More people noticed stashes, and whoever saw one clearly learned where the item was hidden. When filching was added (PR #660), its entry and note in the engine's table of event noise and sight were put on the line just before the stash entry, so the stash entry ended up inside the note and the code stopped reading it. Every stash since then used the default for kinds the table doesn't list (quiet, normal).

**What was done:** Ali approved the fix plan (leftover scan CS4). The stash entry is back on its own line (hushed, low), and filch has its own line too, so a note can't swallow an entry again. A case test stashes a dagger on the street square and checks that the event is hushed and low.

**Fixed by:** [PR #731](https://github.com/ali123500-codeRPG/text-rpg/pull/731)

## BG-210

**What was wrong:** When the Weaver brought back a Trader who was already in the world and gave them wares again, they got a second 50-coin purse and a second lot of the same goods on top of what they still had. In the test village Mags went from 55 to 105 coin and from 4 to 8 bandages after one more scenario, and it grew again every scenario.

**What was done:** Ali chose "purse once, goods top up" (leftover scan CS1). A Trader gets the 50-coin purse only the first time they become a seller; after that their coin is what they earned and spent. Each listed good is topped up to the listed count, never added on top (Mags lists 4 bandages and has 3 left: she gets 1). The list of what they sell is replaced by the new plan's, as before. A case test brings Mags back twice, once after a sale.

**Fixed by:** [PR #710](https://github.com/ali123500-codeRPG/text-rpg/pull/710)

## BG-209

**What was wrong:** Found by the new Threadbound end-to-end test. An achievement earned while a scenario runs is only granted when the scenario ends. The ability it opens on a Threadbound item (for example Call the Toss on Varo's Loop) then showed up one turn late, because the game hands out item abilities before it closes the scenario. A perk that an achievement completes through a perk link had the same one-turn delay.

**What was done:** Right after a scenario closes, the game hands out the player's Threadbound item abilities and linked perks again, so they arrive on the same turn as the achievement. The end-to-end test checks it.

**Fixed by:** [PR #707](https://github.com/ali123500-codeRPG/text-rpg/pull/707)

## BG-191

**What was wrong:** On coming back to Play from another page (Ali came from Bugs), the story opened at the top instead of at the latest lines. Leaving Play takes the story off the screen, and the browser forgets where it was scrolled.

**What was done:** Coming back to Play now always opens the story at the latest lines. A browser test plays a few turns in a short window, goes to Bugs and back, and checks the story is at the bottom.

**Fixed by:** [PR #689](https://github.com/ali123500-codeRPG/text-rpg/pull/689)

## BG-189

**What was wrong:** Action-time playtest run-100-at-rester, turns 9-16: after the fight the player bandaged and rested in 6 s fight turns for about ten turns, so a 40 s bandage looked like it never finished. Wick, who had punched the player and gone out to the lane, stood there silent, out of sight and earshot, but was still engaged with the player; fightInSenses took the player's own engaged pair as "a fight they can hear" by probing it at a loud noise.

**What was done:** The fight-in-senses clause counts only fights between others (engine/mode.ts fightInSenses); the player's own fight counts through the first clause, a foe after them they can see or hear.

**Fixed by:** [PR #681](https://github.com/ali123500-codeRPG/text-rpg/pull/681)

## BG-188

**What was wrong:** Ali's report, story mwf2lt7l t11-17: Osric told the man in the patched coat to turn out his pockets and boots; no search happened (Osric only talked), a willing suspect could not be searched hands-on, and turning out one's own pockets had no action. Ali asked for the guard template to carry the search skill.

**What was done:** Ali BF16 c: letsSearch (Parser and NPC outputs) lets that person search you hands-on this turn and the next (minds openToHands); the new action show turns out what you carry, and its item is kept back only if the Filching contest goes unnoticed (engine/resolve.ts doShow); SEARCH_RULE for Planner, Responder and Voice. BF17 b: the guard template's Eyesight floor (a search's skill) is 40.

**Fixed by:** [PR #684](https://github.com/ali123500-codeRPG/text-rpg/pull/684)

## BG-187

**What was wrong:** Story mwf2lt7l t3 (quest_goal_gap): Corwin's job "find my mother's tin charm and bring it back" became goal other: the charm was real (in Wren's sack) but nothing in Corwin's view showed it, so he could not name it in a deliver goal.

**What was done:** Ali BF18 a: a Weaver reward may name its owner (rewards[].owner); away from them the item is on the owner's self.missing (id and name, never where), and a job's deliver goal may name that exact item (JOB_RULE). views/index.ts missingOf, scenario/apply.ts.

**Fixed by:** [PR #684](https://github.com/ali123500-codeRPG/text-rpg/pull/684)

## BG-186

**What was wrong:** Ali's report, story mwdvbl6k t16-17: "I shoot Hobb at his leg" with the shortbow walked up to the counter and came to nothing, a step short. The story predates the move of held items to 'grip:' slots (FR2, PR #579), so the bow saved in 'hand:' slots was not in hand: the shot quietly became a punch with fist reach.

**What was done:** Ali chose to upgrade saves and fail loudly: save schema v8 renames 'hand:' slots to 'grip:' on load (save/checks.ts handToGrip), and an attack naming a weapon not in hand is wasted with reason not_in_hand: no close-in, no repeat blows, never a fist in its place (engine/resolve.ts notInHand, for every actor).

**Fixed by:** [PR #677](https://github.com/ali123500-codeRPG/text-rpg/pull/677)

## BG-185

**What was wrong:** Interface thread: words said while a walk carried on (a talk to Wim) stopped the walk short and dropped it, though AT49 says words are said on the way: the exchange spends the order's move before the words

**What was done:** the walk goes on after the words, ctx.saidOnWay; a step up only to be heard, BG-74, still ends there

**Fixed by:** [PR #675](https://github.com/ali123500-codeRPG/text-rpg/pull/675)

## BG-184

**What was wrong:** Interface thread, AT49 indicator test: once the player was in a carried walk's goal zone the walk never ended; player.walking stayed set and the view kept saying 9 m / 6 s to go, a walk stuck forever on screen

**What was done:** the end-of-turn walk code clears player.walking at its goal, a way found shut, a trip or another long thing to do

**Fixed by:** [PR #675](https://github.com/ali123500-codeRPG/text-rpg/pull/675)

## BG-183

**What was wrong:** Ali's report, story mwdvbl6k t7-14: the agent couldn't get the cellar key. Hobb said he had it and would hand it over, though he carried none, and Dell sent the player to him for a key the barred cellar door never needed; a filch with behind stayed on the near side of the bar and came to nothing out of reach (close-in dropped the move behind and reached over the counter); the Weaver's personality values given by name (kindness, family) were dropped.

**What was done:** An NPC's line claims or promises an item only if self.gear lists it, and says how a way is passed only as its view shows (a key only for a lock, a bar from its bolt side). Close-in keeps a move behind the counter and walks to them, and from the near side walks right up to the counter. personalityFrom takes types and values by id or name. The agent's own repeat asks: PR #672.

**Fixed by:** [PR #673](https://github.com/ali123500-codeRPG/text-rpg/pull/673)

## BG-182

**What was wrong:** Who's here on Play showed no names, only status words: since PR #514 each chip's name sat inside a code comment.

**What was done:** The name is back as each chip's first word; a smoke test checks a seen person's name shows.

**Fixed by:** [PR #662](https://github.com/ali123500-codeRPG/text-rpg/pull/662)

## BG-181

**What was wrong:** Run 79g t38-42: Ness bound the player's leg, but nothing recorded it; the story called them unbandaged and bleeding, Ness tried to bind it again with empty hands (no_item twice), her no_item reason left her view a turn later, and "I hand Ness the linen" with none held became action other.

**What was done:** A healing item used on someone marks them tended (condition.tended, shown by item name in every view) until their next wound; Narrator rule 29 (bound only when tended; no bleeding danger). An NPC keeps its last wasted try (self.lastWasted) until it next does that kind of thing. Parser: giving or using what the player does not carry is give or use_item with item null.

**Fixed by:** [PR #638](https://github.com/ali123500-codeRPG/text-rpg/pull/638)

## BG-180

**What was wrong:** Run 79g t44-47: Ness said she was off to fetch rags from her chest, walked there, then stood silent two turns: Planner calls went only to engaged actors and deal parties, so a code-run NPC acted again only when spoken to.

**What was done:** An answer with a deed under way (a move, an open, a lead: anything but words or a hold) gives that NPC Planner calls for ERRAND_TURNS (3) turns, code-run or not; its own hold ends it. Planner rule 6: a promise in its said lines is carried out.

**Fixed by:** [PR #638](https://github.com/ali123500-codeRPG/text-rpg/pull/638)

## BG-179

**What was wrong:** Run 79f t35: Brenn sat drinking near people his band is hostile to, in another building; nobody struck anyone, yet the game went into fight turns, which dropped the player's words said beside an action to Ness.

**What was done:** BF14 a: the mode is Tactical only while a fight concerns the player (fightTurns: someone fighting them knows they are there, or they can perceive blows or a spar). Engaged actors elsewhere still get Planner calls.

**Fixed by:** [PR #635](https://github.com/ali123500-codeRPG/text-rpg/pull/635)

## BG-178

**What was wrong:** Run 97f t44-47: the player searched Wen's body and found a key and coin, left them, searched again and was told nothing, while Bram's search found both; the first find was told as the key in the player's palm.

**What was done:** What a searcher found before and is still there is found again (searchPerson); a find reads as left there for now, never taken.

**Fixed by:** [PR #633](https://github.com/ali123500-codeRPG/text-rpg/pull/633)

## BG-177

**What was wrong:** Run 97f t31-41: Wen, held in a real fight, said "Enough, I yield" with yields set, but an NPC's yields only left a spar (invalid_spar_yield); the fight went on and Bram killed him. Sibling: grabbing someone one already holds was wasted as already_held and told as someone else's grip.

**What was done:** An NPC's yield in a real fight surrenders, as a surrender from fear does (loseNerve, one function); in a spar it leaves the spar; the NPC prompt offers it. The wasted reason is already_holding.

**Fixed by:** [PR #633](https://github.com/ali123500-codeRPG/text-rpg/pull/633)

## BG-176

**What was wrong:** Runs 81c t34-40 and 97c: the purse read "coin ×16" in /inv and the gear line the agents read, so a player kept trying to pay four silver.

**What was done:** Every item count reads through countWords, which says coin in coin words (1 silver and 6 copper); also the inventory tooltip.

**Fixed by:** [PR #631](https://github.com/ali123500-codeRPG/text-rpg/pull/631)

## BG-175

**What was wrong:** Run 79e t33-34: Ness's shut chest showed in her view as `container: {}`, and her own wasted use_item and give (no_item) reached her with no reason, so she tried the same again.

**What was done:** A shut container says `shut` in every view; a mind's own wasted event carries its reason in its next view; NPC prompts say to act on that reason.

**Fixed by:** [PR #631](https://github.com/ali123500-codeRPG/text-rpg/pull/631)

## BG-174

**What was wrong:** Run 97e t35-38: "walk east with Wen" in Mill Lane, whose east end has no way on: once at the east side, each such move took no step and the turn was a silent wait, five tries running.

**What was done:** A move that takes no step, nothing stopping it, gives the Narrator stayedPut (where the player already stands); Narrator rule 28 says so and names the ways out.

**Fixed by:** [PR #628](https://github.com/ali123500-codeRPG/text-rpg/pull/628)

## BG-173

**What was wrong:** Run 79d t33: Ness was told to open her shut chest first, but open was missing from the NPC action list (the schema and the action list written into the NPC prompts), so she sent use_item with nothing again and again.

**What was done:** open is an NPC action (NPC_ACTIONS), and the prompts build their action list from NPC_ACTIONS, so they never drift from what the schema takes.

**Fixed by:** [PR #628](https://github.com/ali123500-codeRPG/text-rpg/pull/628)

## BG-172

**What was wrong:** Run 98c t28: "I open the side gate and check behind it": a 0.3 m step up to the gate took the move slot, so opening it had none left and came to nothing while the search went on.

**What was done:** A step up to a way (ENTER_M at most) is part of working it: the op keeps the move slot. A longer walk still spends it (BG-86).

**Fixed by:** [PR #625](https://github.com/ali123500-codeRPG/text-rpg/pull/625)

## BG-171

**What was wrong:** Run 79c t30-32: Ness, her hands empty and her chest shut, ordered use_item on the player with no item; the turn showed a use with nothing in it, and she kept saying she was pressing the bandage. Run 98c t19: "walk over to Wren and grab his wrist" after he left was all deferred, and nothing said he was gone.

**What was done:** Using an item one does not carry comes to nothing, with reason no_item; the NPC prompts say a shut container is opened first and use_item names an item carried. notThere also counts someone named in this turn's deferred words.

**Fixed by:** [PR #625](https://github.com/ali123500-codeRPG/text-rpg/pull/625)

## BG-170

**What was wrong:** Run 97d t28: on the edge the back lane shares with Mill Lane, "walk out into Mill Lane and grab Wen's arm" crossed the doorway in 0 m, and a 0 m leg ended the walk, so the grab fell 0.3 m short.

**What was done:** A 0 m doorway crossing walks nothing and the walk goes on with what is left: the turn's walk, the speaking-spot projection and the trip walk alike.

**Fixed by:** [PR #625](https://github.com/ali123500-codeRPG/text-rpg/pull/625)

## BG-169

**What was wrong:** Replay run 77d step 24: from the back lane, "go up toward the square" was refused, though Kettle Street was in sight with its way "up the street toward the square": only the player's own ways, zones in view and known places could be named.

**What was done:** A way out of any zone in sight is a place the player can name (legality and Parser rule 13); the walk finds the way.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-168

**What was wrong:** Run 100c step 36: the Narrator was refused twice for "sack" and "chest" (item names lying elsewhere, but everyday nouns), so a crippling blow fell back to the template, which said "You use item" for a bandage used up.

**What was done:** Only a telling item name (a story-made item, a Threadbound one) counts in the leak scan; an event names its item by instance or by the item's own id, so a used-up stack still has its name.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-167

**What was wrong:** Run 91b (BF12): paying Hadley 3.5 m away across a barred way came to nothing; and hands passed a locked solid door when both stood at it.

**What was done:** BF12 b: hands pass a way only when it is open or shut but see-through (a grate), in withinGrip, so every hands-on action follows it; a hand-over across a way has the one it is for step up to their side of it (their move) when willing.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-166

**What was wrong:** Run 97c t26-27: on the edge the back lane shares with Mill Lane, 1 m from Wen across it, "step out into Mill Lane" was already beside him, so no step was taken and the player stayed in the lane while the story put them in Mill Lane.

**What was done:** A move to a spot in another zone always goes into that zone (moveGoal enter).

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-165

**What was wrong:** Replay run 95b step 8: "I try the shed door on this side of the weir" crashed the turn (null reach): the way named was not out of the player's zone.

**What was done:** A way op on a way not out of this zone comes to nothing as out of reach, and the move stands.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-164

**What was wrong:** Run 98b t15-18: Wren slipped out of the common room unseen; the player stood on his last-seen spot and spoke to him three turns running, and nothing ever said he was gone.

**What was done:** Someone whose last-seen spot the player can see (still-figure sight, not dark) and who is not seen there is gone from it: PlayerView lastSeen gone, and the Narrator gets notThere (rule 27) for whom this turn's words, action or walk were for, never where they went. Parser: no lastSeen spot move for one gone.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-163

**What was wrong:** Run 85d t28: "walk up to the gate and lift the latch" from 9.4 m: one move slot walks 8.4 m, so the player stopped a metre short of grip reach (as the rules say), and the story called the gate "still a way off".

**What was done:** Every action wasted out of reach carries how far short it fell (metres, from reachOf), and Narrator rule 18 tells a step as a step.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-162

**What was wrong:** Run 90c t45: the player stood 1 m from a downed slime and struck at it with fists (0.7 m reach); closing in skipped anyone down, though the blow may strike them, so it was wasted out of reach. "Grab the slime and dig through it" also came as an attack.

**What was done:** Whoever can be struck is closed in on (reachOf: anyone not dead); Parser rule 15: going through someone or their body by hand is search.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-161

**What was wrong:** Smoke test: after restoring the turn 10 backup from turn 12, the Play header still said "Turn 12" and the story column kept turns 11 and 12 of the timeline that was dropped, in memory and in the saved story.

**What was done:** Restoring a backup drops the story text of every turn after it, on screen and in the saved history (cutHistory).

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-160

**What was wrong:** Run 79b: Ness said for three turns she was fetching bandages to bind the player's leg, and nothing happened: a healing item healed only its user, and NPCs could not take things out of a chest.

**What was done:** BF13 a: a healing item used on someone within the user's grip reach heals them by its row (use_item needs grip, closing in first), for the player and NPCs; NPCs can pick up what an open container shows.

**Fixed by:** [PR #619](https://github.com/ali123500-codeRPG/text-rpg/pull/619)

## BG-159

**What was wrong:** Run 95b, turns 37-44: a move-only walk from the hill track to the alder copse, 1.2 km off, never became a trip (TV1) because two slimes far away still knew of the player, a check on what the player can't know; it walked 30 m a turn, so the whole walk would take about 40 turns

**What was done:** action time stage 3d-1, AT45/AT46: outside a fight a walk is one turn whatever its length

**Fixed by:** [PR #670](https://github.com/ali123500-codeRPG/text-rpg/pull/670)

## BG-158

**What was wrong:** Run 81b, turns 18 to 23: "I walk over the counter to Harl's table" kept the player behind the counter four turns running (the counter rule keeps you on your side), and the narration had them step out.

**What was done:** Parser rule 7: going behind a counter, over it, or out from behind it sets behind, which crosses it either way; without it the player talks across.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-157

**What was wrong:** Playtesters drew Varo's Loop as a weapon and the narrator put it "on your finger": the player's own gear reached the parser and narrator by name only, never its look

**What was done:** own gear carries its look; the Loop's look names it an earring of Varo

**Fixed by:** [PR #613](https://github.com/ali123500-codeRPG/text-rpg/pull/613)

## BG-156

**What was wrong:** Soak village seed 2: the turn checker said a broken guard was still engaged with a slime that kept fighting it, while the engine keeps a fight alive from either side.

**What was done:** One rule (fightRenewed) for when a fight was last kept alive, shared by the engine and the checker.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-155

**What was wrong:** Run 97b: the barkeep, half seen across the room, listed no wares, so a buy from her was asked about again and again and never happened.

**What was done:** A seller the player has seen is still known to sell: lastSeen carries her wares, a buy may name her, and the walk steps up to her.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-154

**What was wrong:** Runs 100b turn 9 and 95 turn 4: a whisper across a counter to Marta, named only as its addressee, was never raised to reach her.

**What was done:** A whisper is said low enough for each one it is for: line.to, a speak's target, and every addressee.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-153

**What was wrong:** Run 92b, turns 21 and 22: a spot by the yard gate walked 30 m the wrong way: the lane and the yard don't touch, and the way's point fell back to the far end of the lane.

**What was done:** The point of a way out is where the walk leaves the zone (crossing), for spots and walks alike.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-152

**What was wrong:** Run 90b, turns 40 to 42: searching a dead slime 1 m away stayed at 1 m, past a hand's 0.7 m, and read "needs a hold on them" three times.

**What was done:** A search of someone who can't stop hands on them (down, dead, asleep, yielded, held) closes to grip reach first, like any grip action.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-151

**What was wrong:** Run 86c, turn 40: a trigger walked Pell into the kitchen; the end-of-turn catch-up walked him straight back by his routine, crossing a doorway in 0 m with no move event, so the player found the kitchen empty.

**What was done:** Anyone whose own order (an agent's or a trigger's) moved them this turn is left out of the catch-up; a 0 m doorway is still a leg, emitted and walked on from.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-150

**What was wrong:** Replay set (TQ3), runs 78b and 90: a crossing onto fallback ground (the Weaver failed) or into a saved zone kept the player's point from the zone it left, outside the new zone's rectangle (turn checker inside\_zone).

**What was done:** Every scenario path that moves people places them: the fallback ground and a saved-zone crossing call placeAll, as a built plan does.

**Fixed by:** [PR #609](https://github.com/ali123500-codeRPG/text-rpg/pull/609)

## BG-149

**What was wrong:** Run 91b, turn 46: paying Hadley 3.5 m away behind a barred way came to a wasted event with no reason, narrated as pushing the grate.

**What was done:** Every wasted event carries a reason (a test enforces it); a give says out of reach, no item, already down. Handing things to someone behind a shut way is question BF12.

**Fixed by:** [PR #607](https://github.com/ali123500-codeRPG/text-rpg/pull/607)

## BG-148

**What was wrong:** Run 89c, turn 39: the gate to the lane was locked (tried before), so the walk went round through the common room without a word.

**What was done:** A walk that goes round a way straight there that the walker knows is shut carries round (the way and why), and the Narrator says so.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-147

**What was wrong:** Runs 98, 99 and 86c: words to someone known to be about but out of sight (heard through a door, seen earlier) were refused or put off until the player went to them; "Slime, stay back!" beside a step away was put off too.

**What was done:** Speech reach follows hearing, not sight: anyone the player knows is about can be called to, and whoever hears it answers; the Parser says it now, loud enough to carry, and never defers words beside a move.

**Fixed by:** [PR #612](https://github.com/ali123500-codeRPG/text-rpg/pull/612)

## BG-146

**What was wrong:** Run 100, turns 4 and 7: Marta's Weaver beat had her speak to the player, but she was code-run, so no Responder wrote her words and the speak carried no line.

**What was done:** Every owner of a speech beat at the player gets a Responder call for its words, code-run too.

**Fixed by:** [PR #607](https://github.com/ali123500-codeRPG/text-rpg/pull/607)

## BG-145

**What was wrong:** Run 97, turn 9: "I pay the barkeep four copper for Wen's bread and stew" gave a buy with no ware, so the barkeep refused and the coins sat on the counter.

**What was done:** A buy naming no ware is the seller's only ware, or the player is asked which (never a refused buy); the Parser maps a ware named by what it holds.

**Fixed by:** [PR #607](https://github.com/ali123500-codeRPG/text-rpg/pull/607)

## BG-144

**What was wrong:** Run 95, turn 13: "unbar the plank gate and slip out" walked toward the gate but did not reach it, and the dropped unbar was only logged, so the story just had the player stop.

**What was done:** Every dropped way op is a wasted event with its reason (out of reach, no time left, no key...), so it is told.

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-143

**What was wrong:** Run 96: words to "the broad-shouldered man" that mentioned "the two strangers" were addressed to the band, so code asked "Who do you speak to?" twice; the clarify turn kept no log.

**What was done:** The action's target speaks for its band, so there is nobody to ask about; Parser rule 7: words to one person go to them; every clarify keeps the turn log.

**Fixed by:** [PR #607](https://github.com/ali123500-codeRPG/text-rpg/pull/607)

## BG-142

**What was wrong:** Runs 93, 89b: a search that found nothing carried no effect, so the story never said whether anything turned up.

**What was done:** A search always ends in an outcome: found_nothing ("finds nothing here"; on a person not held, "sees nothing on them; going through their things needs a hold"), the same whether nothing was there or it was missed; a tie that half finds someone adds none.

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-141

**What was wrong:** Run 94, turn 5: one zone that was not a road kind had a length, which sank the Weaver's whole extension and left a bare, dead-end square.

**What was done:** A length or danger on a zone that is not a road is dropped as a repair, never fatal.

**Fixed by:** [PR #607](https://github.com/ali123500-codeRPG/text-rpg/pull/607)

## BG-140

**What was wrong:** Runs 86b, 93, 77g, 91: NPC lines voiced deeds their action did not do (a free drink poured with talk; "I'll stand aside" with no move; "right behind you" with headTo instead of follow).

**What was done:** Agent rule: a line never says you do something this turn your action does not do; going somewhere with the player is the follow routine. Followers who are not bandmates travelling with you is question BF9.

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-139

**What was wrong:** Run 91, turns 38-40: Osric said "follow me out" and stepped into the street; next turn his routine took him back inside as the player came out.

**What was done:** Leading someone a single step (lead, no headTo) waits there like any lead (BF4).

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-138

**What was wrong:** Run 89b, turn 33: the Narrator wrote "lift" (the chest lid), a stage hidden term, twice, so the turn fell back to a bare template.

**What was done:** The retry note asks for new wording; the Weaver lists names and telling phrases as hidden terms, never everyday words with other meanings.

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-137

**What was wrong:** Run 90: a lie the player did not see through still came with how convincing it was ("it lands clean... you find yourself believing every word"; a weak one "rings hollow"), so a believed lie read differently from the truth.

**What was done:** A lie gives the player no impression; seeing through it gives only the tell. How ties read is question BF10.

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-135

**What was wrong:** Run 75h, turn 43: "turn toward the back door to see what moved there" aimed the look at the common room behind the shut door, not the half-seen someone by it in the yard, so the story told only of the shut door.

**What was done:** Parser rule 15: a look aims at someone in view (half seen too) or a zone the player can see into, never the room beyond a shut way. Finding someone hiding still takes a search (the look's weak search lost the contest here).

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-134

**What was wrong:** Runs 91 and 92: the Parser wrote "deferred" in its own words (an actor id, "the player", its own notes), and that text was offered back to the player as what they put off.

**What was done:** Parser rule 2: deferred is written as the player would type it next turn, in their voice, people named as the player knows them, never ids, "the player" or notes.

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-133

**What was wrong:** Run 90, turns 26-28: Dov's refuge routine kept him "cowering" while he sat in the open on his log talking with the player 1 m away, so the narrator said he was hiding in the thorns.

**What was done:** A keeping-out-of-sight look is not shown for someone in a talk who is not stealthy. When a refuge cower should end is question BF7.

**Fixed by:** [PR #604](https://github.com/ali123500-codeRPG/text-rpg/pull/604)

## BG-132

**What was wrong:** Run 77f, turn 33: Wennick's whispered reply rode on a dropped move as two hold barks with no listener, so the player 1 m away heard nothing.

**What was done:** A dialogue call's line is for the player (line.to), so a whisper leans in whatever carries it; one order's words are said once a turn.

**Fixed by:** [PR #602](https://github.com/ali123500-codeRPG/text-rpg/pull/602)

## BG-131

**What was wrong:** Run 77e, store turn 32: "Come on, stay with me": Wennick agreed and walked to stand beside the player in the street, but the player had already left it for the square that turn; his spot was dropped and they crossed.

**What was done:** A walk beside someone goes to where that person is when the walk runs, while the walker still perceives them (moveGoal, the one rule for every order's walk).

**Fixed by:** [PR #597](https://github.com/ali123500-codeRPG/text-rpg/pull/597)

## BG-130

**What was wrong:** Run 85b, step 17: the Parser deferred "ask Wren why she followed Arden out here"; Wren is he. He was out of sight, and PLAYER_VIEW.lastSeen carried no pronouns.

**What was done:** lastSeen entries carry the person's pronouns, as seen actors do (BG-97 for the Narrator).

**Fixed by:** [PR #593](https://github.com/ali123500-codeRPG/text-rpg/pull/593)

## BG-129

**What was wrong:** Run 86: the slime job closed as handed in when the player spoke to Marta, though she never saw the kill; she refused to pay for a job the game called done.

**What was done:** BF6 (Ali: no magic knowledge): talking hands a job in only if the giver perceived the deed; else the giver judges the player's report (questEnd done for any job).

**Fixed by:** [PR #602](https://github.com/ali123500-codeRPG/text-rpg/pull/602)

## BG-128

**What was wrong:** Run 85, turn 13: the Weaver gave Wren a trigger "pick $player" (try the newcomer's purse); it fired as a lock pick at the player and resolved as a wasted "no lock", which the Narrator told as a meaningless lock attempt.

**What was done:** One rule (WAY_ORDERS): a pick's target is a way (a zone), never a person, checked for plan and check-in triggers, NPC agents and the Parser. There is no stealing yet.

**Fixed by:** [PR #591](https://github.com/ali123500-codeRPG/text-rpg/pull/591)

## BG-127

**What was wrong:** Run 75f, turn 30: "I'm going to check your pockets" at Wren, hidden in the dark: the narration view dropped the action's target, so the Narrator wrote the player searching their own pockets.

**What was done:** The player's own action at someone they cannot see keeps its target as "someone". (Searching a person is not a mechanic yet.)

**Fixed by:** [PR #591](https://github.com/ali123500-codeRPG/text-rpg/pull/591)

## BG-126

**What was wrong:** Run 78b, step 28: crash "zone north_road has no rectangle". A frontier whose build fell back got an empty zone with no kind, size or rectangle (ZR8).

**What was done:** The fallback's empty ground (frontier or place) is open ground with a kind, a size and edges, placed like any built zone.

**Fixed by:** [PR #591](https://github.com/ali123500-codeRPG/text-rpg/pull/591)

## BG-125

**What was wrong:** Run 75f, steps 33 to 36: Wren slipped off and hid along the common-room wall; "walk over to Wren" (a spot near him) asked "Where in common room do you want to go?" four turns running.

**What was done:** The player's journal keeps the point where they last perceived each actor (lastSpot); a spot near someone out of sight walks there, never to where they really are.

**Fixed by:** [PR #591](https://github.com/ali123500-codeRPG/text-rpg/pull/591)

## BG-124

**What was wrong:** Run 77c, turn 14: "Yes, I'll walk out with you; let's go out the front together" (move to the street + talk to Wennick) lost the player's move with no log. The common room's counter side (a low edge) also faced the street in the layout, so the street door counted as reached across and the move became a step up to Wennick.

**What was done:** Only a way seen through (a counter, a rail) is reached across, never a door (reachesAcross needs a seen-through link).

**Fixed by:** [PR #591](https://github.com/ali123500-codeRPG/text-rpg/pull/591)

## BG-123

**What was wrong:** The GM view never listed the story's backups and its Restore button threw "restore is not available", though the save module had listing and restore (code scan 3). Fixed: the game reads the backups list after each save and on load, and Restore restores through the save module, as /undo does

**What was done:** Code scan round 3: BG-123 GM backups, shared time words, one rule for "down"

**Fixed by:** [PR #589](https://github.com/ali123500-codeRPG/text-rpg/pull/589)

## BG-122

**What was wrong:** Run 82, steps 8 and 9: the player thanked Hobb, then asked Marta a question; both are regulars, Hobb was named first and took the band's one spokesperson slot, so Marta never answered. Asked alone, the question parsed as observe and reached no one.

**What was done:** The action's target speaks for its band, however it is addressed (named, by band or everyone). Parser rule 2: words to someone are the main action unless the player also does something that changes the game; asking what someone saw or knows is never observe.

**Fixed by:** [PR #585](https://github.com/ali123500-codeRPG/text-rpg/pull/585)

## BG-121

**What was wrong:** Run 80: Marda said "follow me round to the kitchen", walked there and went straight back to her counter as the player came in.

**What was done:** BF4 a (Ali): an agent's headTo can lead someone; the NPC waits there until they come or LEAD_WAIT_TURNS (2) pass.

**Fixed by:** [PR #602](https://github.com/ali123500-codeRPG/text-rpg/pull/602)

## BG-120

**What was wrong:** Run 77b, turn 12: Wennick, standing beside the player, whispered his job offer and the player never heard it, though Dov's quieter idle at the same distance was heard. Causes checked: the agent (ok: whisper to the player), HB8's lean-in (at fault: he stood 1.00008 m away, past WHISPER_REACH_M's 1 m by rounding, while the standing gap beside someone, PLACE_GAP_M, is 1 m too), and every other reach check (the same: closing in stops exactly at a reach, so a hair over fails). One rule now, position.ts withinM (d <= reach + 1 cm): whisper lean-in, grip, auras, Dirt in the Eyes, the shooter's crowded check, attack reach, One-Two and parry strike-back reach, closing in, stepping up and travel arrival

**What was done:** BG-117, BG-118, BG-120, BG-122, BF1: words reach their listener; the cast knows who it can see at the start

**Fixed by:** [PR #585](https://github.com/ali123500-codeRPG/text-rpg/pull/585)

## BG-120 (part 2)

**What was wrong:** Run 81: Maud whispered three answers from behind her counter to the player about 5 m back; a whisper carries about 1 m, so none was heard.

**What was done:** BF3 a (Ali): a whisper that does not reach its listener after the step-up is said low enough to hear; c: agents are told how far a whisper carries, and whisper_raised logs each time code had to raise one.

**Fixed by:** [PR #602](https://github.com/ali123500-codeRPG/text-rpg/pull/602)

## BG-118

**What was wrong:** Run 75e, turns 23 to 25: Wren answered the player three turns running by fleeing toward the yard gate with a line ("Keep your distance"), and none of it was seen or heard. Causes checked: the agent output (ok: flee plus a line), the bark rule (a line beside an action rides on the action's event, as designed), and resolve.ts doMove (at fault: an NPC at an unbuilt frontier waits with its move spent and no event, so the line had nothing to ride on). Siblings with the same gap: a break-free try, a way found shut or opened, a player crossing a frontier or jumping, a dropped walk and a doorway underfoot. One rule now: each of those events carries the line, and a move that left no event says it where the walker stands (walk)

**What was done:** BG-117, BG-118, BG-120, BG-122, BF1: words reach their listener; the cast knows who it can see at the start

**Fixed by:** [PR #585](https://github.com/ali123500-codeRPG/text-rpg/pull/585)

## BG-117

**What was wrong:** Run 78, turns 17 and 19: "I grab his wrist and ask..." and "I let go of his wrist and say, show me your pockets" each gave an interact action with the words as a bark, so Wick never got a dialogue call and never answered. Causes checked: the engine (a line beside a non-speech action is a bark with no exchange, as designed, AE1/AE7), the grip (no hold existed: interact is a plain check, and the game has no let-go op), and Parser rule 2 (at fault: it told the Parser that what the player does while speaking "goes in move or action", so a gesture took the main action from the words). Parser rule 2: a gesture that changes nothing in the game is never the main action; with words to someone beside it, the words are the main action and the gesture its approach

**What was done:** BG-117, BG-118, BG-120, BG-122, BF1: words reach their listener; the cast knows who it can see at the start

**Fixed by:** [PR #585](https://github.com/ali123500-codeRPG/text-rpg/pull/585)

## BG-116

**What was wrong:** Buying and selling is always a spoken order, even for someone who cannot speak; a mute character calls out orders it has no voice for (Ali's question, bug-fix review thread)

**What was done:** a race tagged 'speaks' with a speech part not Destroyed). trade.ts `orderReaches`: a speaker calls the order (hearsOrder, as before); someone who cannot speak points and pays in person, within both grip reaches (else out_of_reach). merge.ts `needOf`: their buy or sell needs grip, so they close in on the move slot first. Test: tests/cases/s214-grip-reach.test.ts. (PR #583

**Fixed by:** [PR #583](https://github.com/ali123500-codeRPG/text-rpg/pull/583)

## BG-115

**What was wrong:** Run 75d, turn 20: "Oswin, ... please come tell the guard in Hound Lane with me" gave a talk to Oswin plus the player's own move to the lane, so the player walked out first and Oswin never got to answer. Causes checked: Parser rule 2 ("a place the player asks to go fills the turn's move") read a place inside the request as the player's move (at fault); turn 19's deferred ask was rule 11 (Oswin out of sight: walk there first), as designed. Parser rule 2: a place inside what the player asks someone else to do is part of the words, never the player's move

**What was done:** BG-114, BG-115: a look is the place only; a place inside a request is words, not a move

**Fixed by:** [PR #582](https://github.com/ali123500-codeRPG/text-rpg/pull/582)

## BG-114

**What was wrong:** Run 77, turns 2 and 3: the common room's look, written by the Weaver, said three people sat dicing at a corner table; they had already gone (two fled on an alarm at turn 1, one prowled unseen), yet the Narrator described them twice and the player's "join their game" came to nothing. Causes checked: the Weaver's look put people in a place description (at fault), the Narrator retold people from a look (at fault), the Parser (rule 11, as designed once the look is fixed), and why they left (Dov and Wennick, set up opposed at one table, first noticed each other on turn 1 and fled as an alarm). Weaver: a look is the place only, never people; Narrator rule 3: the people there are only those in actors and events (PR #582). BF1 (Ali, a): the cast knows everyone it can see at a scenario's opening, except someone set up hiding (a stealthy routine), and knowing them from the start raises no alarm (scenario/apply.ts, minds knownFromTheStart)

**What was done:** BG-114, BG-115: a look is the place only; a place inside a request is words, not a move; BG-117, BG-118, BG-120, BG-122, BF1: words reach their listener; the cast knows who it can see at the start

**Fixed by:** [PR #582](https://github.com/ali123500-codeRPG/text-rpg/pull/582), [PR #585](https://github.com/ali123500-codeRPG/text-rpg/pull/585)

## BG-113

**What was wrong:** Zone review, sibling found while building ZR4: two probes measured from the centre of a zone instead of where the person stands: "perceives now" (yields, bandmates together, Spotter) and Never Surprised hearing an attack coming. Fixed: both measure from the person's own point

**What was done:** Zone review answers: Dirt in the Eyes, Cover Ally, Spotter, unseen moves, seeing people and item value in metres (BG-105, BG-106, BG-108..BG-110, BG-113)

**Fixed by:** [PR #581](https://github.com/ali123500-codeRPG/text-rpg/pull/581)

## BG-112

**What was wrong:** Every NPC plans its walk around every barred, locked or blocked way in the world without having tried it, even in a house it has never been in; BG-69's rule said only its own place's ways (bug-fix review, FR5)

**What was done:** FR5). relations.ts `knowsShut`: an NPC knows a shut way of a place it lives or works in (a zone its routine is bound to, mind.slots), or one it tried; rubble in plain view is known to all. A visitor learns by trying, as the player does. Test: tests/cases/s189-barriers.test.ts. (PR #580

**Fixed by:** [PR #580](https://github.com/ali123500-codeRPG/text-rpg/pull/580)

## BG-111

**What was wrong:** Run 75, turns 7 and 8: Oswin answered the player in a whisper from 2.9 m in the busy common room, and the player never heard either reply. Causes checked: approachMove (it did give the step-up: spot beside the player), hearing (a whisper is clear there only within about a metre, true to life), the exchange path (at fault: it walked a spokesperson's move to its zone and dropped the spot, so an actor already in that zone never moved). One rule now, moveGoal, turns every order's move into its goal and spot: the player's, an NPC's in turn, and a spokesperson's in the exchange

**What was done:** BG-111: every order's move walks to its spot, the exchange too

**Fixed by:** [PR #576](https://github.com/ali123500-codeRPG/text-rpg/pull/576)

## BG-110

**What was wrong:** Zone review: everyone in the player's zone or a zone in sight is shown in full (name, health) at any distance, so a face 100 m across a market square is known. Fixed (ZR6): people are made out by the sight table in metres (still: low; doing something: their most visible event), glimpsed as someone, else not listed; player and NPC views

**What was done:** Zone review answers: Dirt in the Eyes, Cover Ally, Spotter, unseen moves, seeing people and item value in metres (BG-105, BG-106, BG-108..BG-110, BG-113)

**Fixed by:** [PR #581](https://github.com/ali123500-codeRPG/text-rpg/pull/581)

## BG-109

**What was wrong:** Zone review: the unseen-moves feat counts only watchers in the zone the player sneaked into. Fixed (ZR5): watchers are everyone with sight of where the player ended

**What was done:** Zone review answers: Dirt in the Eyes, Cover Ally, Spotter, unseen moves, seeing people and item value in metres (BG-105, BG-106, BG-108..BG-110, BG-113)

**Fixed by:** [PR #581](https://github.com/ali123500-codeRPG/text-rpg/pull/581)

## BG-108

**What was wrong:** Zone review: Spotter tells only band-mates in the same zone. Fixed (ZR4): band-mates who hear the owner's normal voice clearly or make out its hand sign (close visibility)

**What was done:** Zone review answers: Dirt in the Eyes, Cover Ally, Spotter, unseen moves, seeing people and item value in metres (BG-105, BG-106, BG-108..BG-110, BG-113)

**Fixed by:** [PR #581](https://github.com/ali123500-codeRPG/text-rpg/pull/581)

## BG-106

**What was wrong:** Zone review: Cover Ally can step in front of an arrow for an ally anywhere in the zone. Fixed (ZR2): only within the coverer's grip reach of the ally

**What was done:** Zone review answers: Dirt in the Eyes, Cover Ally, Spotter, unseen moves, seeing people and item value in metres (BG-105, BG-106, BG-108..BG-110, BG-113)

**Fixed by:** [PR #581](https://github.com/ali123500-codeRPG/text-rpg/pull/581)

## BG-105

**What was wrong:** Zone review: Dirt in the Eyes can be thrown at any foe in the zone and none outside it. Fixed (ZR1): it reaches as far as an improvised throw (THROW_M improvised), in sight

**What was done:** Zone review answers: Dirt in the Eyes, Cover Ally, Spotter, unseen moves, seeing people and item value in metres (BG-105, BG-106, BG-108..BG-110, BG-113)

**Fixed by:** [PR #581](https://github.com/ali123500-codeRPG/text-rpg/pull/581)

## BG-104

**What was wrong:** Zone review: a hold (A8) lasts while holder and held share a zone, at any distance in it

**What was done:** withinGrip). Test: tests/cases/s214-grip-reach.test.ts. (PR #579

**Fixed by:** [PR #579](https://github.com/ali123500-codeRPG/text-rpg/pull/579)

## BG-103

**What was wrong:** Zone review: when the player talks to a band or "everyone", who answers was ranked by zone hops, so in one zone the first by id answered, not the nearest. Fixed: nearest in metres from where the player speaks (after the step-up walk)

**What was done:** Zones are places, not distances: closing in, One-Two, parry strike-back, Bluff and who answers in metres (BG-98..BG-103)

**Fixed by:** [PR #571](https://github.com/ali123500-codeRPG/text-rpg/pull/571)

## BG-102

**What was wrong:** Zone review: the library's visibility table still gave sight in zone links (clearTo, glimpsedTo), and Leg Bolt, Gut Feeling and Dread Presence texts still said "one zone link" or "one zone away" while the code used metres. Fixed: link columns removed, texts match the code

**What was done:** Zones are places, not distances: closing in, One-Two, parry strike-back, Bluff and who answers in metres (BG-98..BG-103)

**Fixed by:** [PR #571](https://github.com/ali123500-codeRPG/text-rpg/pull/571)

## BG-101

**What was wrong:** Zone review: Bluff (and the Ideas list) aimed at any foe in the zone and no one outside it, even right through an open doorway. Fixed: a lie needs the foe to hear the owner's normal voice clearly (the speech rule); the view lists who is in range for each perk move

**What was done:** Zones are places, not distances: closing in, One-Two, parry strike-back, Bluff and who answers in metres (BG-98..BG-103)

**Fixed by:** [PR #571](https://github.com/ali123500-codeRPG/text-rpg/pull/571)

## BG-100

**What was wrong:** Zone review: a parry's strike back needed only the same zone, so a dagger "struck back" at a spearman 2 m away. Fixed: the strike back happens only within the parrying weapon's reach in metres

**What was done:** Zones are places, not distances: closing in, One-Two, parry strike-back, Bluff and who answers in metres (BG-98..BG-103)

**Fixed by:** [PR #571](https://github.com/ali123500-codeRPG/text-rpg/pull/571)

## BG-99

**What was wrong:** Zone review: One-Two's free punch needed only the same zone, so it was thrown at a foe out of fist reach (wasted) and the check stood for distance. Fixed: the punch follows only when the foe is within the fists' reach in metres

**What was done:** Zones are places, not distances: closing in, One-Two, parry strike-back, Bluff and who answers in metres (BG-98..BG-103)

**Fixed by:** [PR #571](https://github.com/ali123500-codeRPG/text-rpg/pull/571)

## BG-98

**What was wrong:** Zone review: a hostile counted as closing in (hunting) only when it changed to a zone fewer links from its target, or walked straight at it; a step nearer inside one big zone, or into a zone with the same link count, did not count. Fixed: closing in is metres, where the leg ended against where it set off (every move leg now keeps fromPos)

**What was done:** Zones are places, not distances: closing in, One-Two, parry strike-back, Bluff and who answers in metres (BG-98..BG-103)

**Fixed by:** [PR #571](https://github.com/ali123500-codeRPG/text-rpg/pull/571)

## BG-97

**What was wrong:** Ali's story, turn 2: the narration called the player "a boy of thirteen", though her pronouns are she. No view that describes the player carried the player's pronouns, so agents guessed from the name. NarrationView, PlayerView and WeaverView now carry player.pronouns (NPC views already had them through the seen-actor list), and Narrator rule 9 says never to guess pronouns from a name

**What was done:** BG-97: every view that describes the player carries their pronouns

**Fixed by:** [PR #570](https://github.com/ali123500-codeRPG/text-rpg/pull/570)

## BG-96

**What was wrong:** Run 74d turn 26: "pick up the draught, then ask the tinker why he shouted" gave a pick-up in gear and deferred the question, so the turn passed without the question, though gear costs nothing (Parser rule 9). Causes checked: legality (no errors), indirect speech ("ask him" parses as spoken elsewhere), the slot rule. Parser rule 2 now says gear takes neither slot, so words or an action beside it stay in this turn; perk moves (rule 14) and sneak (rule 15) already said so

**What was done:** BG-96: gear takes neither slot, so words beside a pick-up stay in the turn

**Fixed by:** [PR #567](https://github.com/ali123500-codeRPG/text-rpg/pull/567)

## BG-95

**What was wrong:** Ali's story, turns 2 to 8: Wenna, Dell and Hobb named each other aloud in front of the player, yet no name was learned. Agents never filled introduces (0 of 7 replies), introduces refused a bandmate's name anyway, and NPCs never kept the player's name. Fixed: one code rule (knowsName, learnNames) for every speaker and listener, player and NPC; introduces removed

**What was done:** BG-95: names said aloud are learned by whoever hears them and sees their owner

**Fixed by:** [PR #569](https://github.com/ali123500-codeRPG/text-rpg/pull/569)

## BG-94

**What was wrong:** Run 74c turn 25: Hobb the tinker called for help as the player walked up to look at his packs, three turns after his alarm rose (turn 22), in the middle of a calm talk. The onAlert shout was queued at the alarm, but his own agent spoke for him on turns 23 and 24, so the shout waited and fired on the first turn with no agent order. onAlert is now the reaction of the moment: an actor whose turn a higher order takes (trigger, flight, its agent) has spent it, and alertOrders drops a shout more than one turn old

**What was done:** BG-94: the onAlert shout belongs to the moment of the alarm

**Fixed by:** [PR #566](https://github.com/ali123500-codeRPG/text-rpg/pull/566)

## BG-93

**What was wrong:** Kishirika study: an NPC wrote a stage direction inside its spoken line ("*She's already got half of it in her mouth* Mmf."). One rule for every speaker now: Planner, Responder and Voice prompts say a line holds only words said aloud, the Parser says the same for the player's spoken, and code cuts *...* and [...] from every NPC line and the player's spoken as a backstop (logged as stage_direction)

**What was done:** BG-93: a spoken line holds only the words said aloud

**Fixed by:** [PR #564](https://github.com/ali123500-codeRPG/text-rpg/pull/564)

## BG-92

**What was wrong:** Run 74b turn 22: a figure half seen back in Mill Lane, 2.5 km south, was narrated as "resolving into" the man in the alder hollow beside the player, so the player thought south led west. The Narrator had no place for half-seen actors and no rule against merging them with someone else. Now every seen actor, half-seen included, carries side and distance in the narration view, and Narrator rule 23 keeps each person apart.

**What was done:** BG-92: keep a half-seen figure apart from other people in narration

**Fixed by:** [PR #562](https://github.com/ali123500-codeRPG/text-rpg/pull/562)

## BG-91

**What was wrong:** The library viewer's Stacking tab still showed part-state keys (damaged, crippled) for wound penalties instead of their names (bug-fix review, sibling of BG-76). Fixed: the row reads the part-state scale's names

**What was done:** Bug-fix review: siblings earlier fixes missed (BG-83, BG-87 to BG-91)

**Fixed by:** [PR #561](https://github.com/ali123500-codeRPG/text-rpg/pull/561)

## BG-90

**What was wrong:** NPCs who followed the player through a frontier (NW8) arrived with no move event, so the Narrator was told nobody walked along with the player (bug-fix review, sibling of BG-73). Fixed: each follower gets a move event into the new zone

**What was done:** Bug-fix review: siblings earlier fixes missed (BG-83, BG-87 to BG-91)

**Fixed by:** [PR #561](https://github.com/ali123500-codeRPG/text-rpg/pull/561)

## BG-89

**What was wrong:** Anything aimed at someone that wasn't words was felt as touch: a silent walk toward them from another room, a wasted action (which Narrator rule 18 says touched no one), a refused sale (bug-fix review, sibling of BG-72). Fixed: only blows, hand-overs and a broken grip are felt

**What was done:** Bug-fix review: siblings earlier fixes missed (BG-83, BG-87 to BG-91)

**Fixed by:** [PR #561](https://github.com/ali123500-codeRPG/text-rpg/pull/561)

## BG-88

**What was wrong:** The "hears it clearly" checks for orders (trade), stepping up (approachMove) and who answers "everyone" left out the listener's Keen Ear and leaning in to whisper, so they could disagree with what the listener perceives (bug-fix review). Fixed: one rule, perception hearsClearly, used by all three

**What was done:** Bug-fix review: siblings earlier fixes missed (BG-83, BG-87 to BG-91)

**Fixed by:** [PR #561](https://github.com/ali123500-codeRPG/text-rpg/pull/561)

## BG-87

**What was wrong:** Stepping up to talk to someone seen through a doorway walked into their room but stopped inside the way in, not beside them, so in a big busy room they still might not hear (bug-fix review, sibling of BG-62, BG-74). Fixed: going into their zone ends beside them

**What was done:** Bug-fix review: siblings earlier fixes missed (BG-83, BG-87 to BG-91)

**Fixed by:** [PR #561](https://github.com/ali123500-codeRPG/text-rpg/pull/561)

## BG-86

**What was wrong:** Doors and gates are worked from anywhere in the zone: opening, unlocking, barring, picking or checking a door happens from 19 m away without walking to it; the step-up rule (BG-80) covers people only (bug-fix review)

**What was done:** FR3): a door op, pick or check is done within grip reach of the doorway (position.ts `wayPoint`). Out of reach, the move slot walks to the door and the op takes the main action if it is free, else waits for the next turn (logged way_op_dropped). NPCs follow the same rule. Test: tests/cases/s214-grip-reach.test.ts. (PR #579

**Fixed by:** [PR #579](https://github.com/ali123500-codeRPG/text-rpg/pull/579)

## BG-85

**What was wrong:** Hand reach means "same zone", not metres: an item can be handed to someone 38 m away in the same street, or across a counter from the far side of the room; ground items and a downed body's gear can be picked up from anywhere in the zone (bug-fix review, sibling of BG-80)

**What was done:** FR2, FR4): no "hand" need; reach is grip reach in real metres from the body type's grip parts (PartDef.reachM: a humanoid arm 0.7 m; the dragon's head now grips, 1.5 m, as a quadruped carries things in its jaws). ruleset/body.ts `gripReachM`, engine/position.ts `withinGrip`. Handing over needs both grip reaches (straight over a counter); a pick-up needs reach of where the item lies (ItemInstance.at: where it was dropped, where a thrown one landed; one placed with no point lies at its zone's centre). Out of reach, the move slot closes in first (NEEDS in engine/merge.ts is the one approach table: voice, grip, weapon). The equip slot is 'grip:<part>' (was 'hand:'). Test: tests/cases/s214-grip-reach.test.ts. (PR #579

**Fixed by:** [PR #579](https://github.com/ali123500-codeRPG/text-rpg/pull/579)

## BG-84

**What was wrong:** Someone the player names when speaking gets the player's exact words and answers them even when they cannot hear them (behind a shut door, or still out of earshot after a short walk); only "everyone" checks hearing (bug-fix review, sibling of BG-57, BG-71, BG-74)

**What was done:** FR1). engine/speech.ts `playerVoice`: hearing is checked from where the words are said, after this turn's walk over (engine/merge.ts `speakingSpot` projects the BG-58 walk, one move slot, stopping at a way not open to the player). Anyone named or picked from a band answers only if they hear the voice; one who hears the voice but not the words answers with no contest and is told MUFFLED instead of the words. The same rule drives the "everyone" path. Test: tests/cases/s210-fix-review.test.ts. (PR #572

**Fixed by:** [PR #572](https://github.com/ali123500-codeRPG/text-rpg/pull/572)

## BG-83

**What was wrong:** The player's words in a conversation were always said at a normal voice: the speak event ignored the Parser's volume (BG-71 fixed only who answers), so a whisper to one person was heard by the room and a shout through a door reached bystanders like a normal voice (bug-fix review). Fixed: the event carries the chosen volume and its noise

**What was done:** Bug-fix review: siblings earlier fixes missed (BG-83, BG-87 to BG-91)

**Fixed by:** [PR #561](https://github.com/ali123500-codeRPG/text-rpg/pull/561)

## BG-82

**What was wrong:** Coming into the kitchen to find the cellar, the narration never named the cellar hatch, though it was one of the kitchen's ways out; the Narrator now names a new zone's ways out in passing and never leaves out one the player is after, and the playtest player reads the Map's ways out as a real player does

**What was done:** BG-82: the Narrator names a new zone's ways out; playtest player reads the Map

**Fixed by:** [PR #553](https://github.com/ali123500-codeRPG/text-rpg/pull/553)

## BG-81

**What was wrong:** A walk that reached its spot (the bridge gate) still told the narrator 'toward the bridge gate', so narration kept the gate 'a stretch away'; spot words now say 'at …' once there and 'toward …' on the way, and a walk up to a person says it reached them

**What was done:** BG-80/BG-81: one approach rule for talk, trade and give; spot words say when reached; playtest --resume

**Fixed by:** [PR #551](https://github.com/ali123500-codeRPG/text-rpg/pull/551)

## BG-80

**What was wrong:** Nearness was fixed action by action (talk BG-74, buy BG-78): NPCs never stepped up and give needed the same zone though a counter is see-and-reach-across. One rule now (engine/merge.ts approachMove, NEEDS voice/hand) covers talking, trading and handing over, for the player and NPCs; give works across a counter, fence or rail

**What was done:** BG-80/BG-81: one approach rule for talk, trade and give; spot words say when reached; playtest --resume

**Fixed by:** [PR #551](https://github.com/ali123500-codeRPG/text-rpg/pull/551)

## BG-79

**What was wrong:** 'Order a drink, then take a table by the hearth': the Parser deferred the move though the turn's move slot was free; Parser rule 2 now says a place asked for beside the action fills the move, and a spot with no id is named by someone there or a side

**What was done:** BG-79: a move asked for beside an action is not deferred

**Fixed by:** [PR #548](https://github.com/ali123500-codeRPG/text-rpg/pull/548)

## BG-78

**What was wrong:** Renting a bed from the barkeep across the busy tavern was refused as 'not here' and narrated as 'not sold under this roof'; buying and selling now step up to the seller like talking (BG-74), and an order the seller cannot hear clearly is refused as out of earshot

**What was done:** BG-78: buying and selling step up to the seller; out-of-earshot refusal

**Fixed by:** [PR #543](https://github.com/ali123500-codeRPG/text-rpg/pull/543)

## BG-77

**What was wrong:** Following the watchman into the tavern while talking to him: the talk-move rule (BG-62) turned the move through the door into a step beside him in the lane; a move through a doorway to another room now stands, only a step over a counter, fence or rail (or a move aimed at them) ends beside them

**What was done:** BG-77: following someone through a doorway while talking keeps the move

**Fixed by:** [PR #540](https://github.com/ali123500-codeRPG/text-rpg/pull/540)

## BG-76

**What was wrong:** The library viewer's Stacking tab listed morale levels by their code keys (afraid −5) instead of their names (code scan 2). Fixed: the row reads the morale scale's names

**What was done:** Code scan 2: Weaver sees the real character level, Stacking tab names morale levels, stray comments and imports

**Fixed by:** [PR #535](https://github.com/ali123500-codeRPG/text-rpg/pull/535)

## BG-75

**What was wrong:** The Weaver's view gave the player's level as the sum of class levels only, leaving out bonus levels, so the Weaver saw a lower level than the sheet (code scan 2). Fixed: it reads charLevel

**What was done:** Code scan 2: Weaver sees the real character level, Stacking tab names morale levels, stray comments and imports

**Fixed by:** [PR #535](https://github.com/ali123500-codeRPG/text-rpg/pull/535)

## BG-74

**What was wrong:** Talking to the barkeep 6.1 m off in the busy tavern: a normal voice is not clear there, so his reply came through without words; talking to someone in view who would not hear you clearly now steps up to them first (BG-62's spot)

**What was done:** BG-74: talking to someone out of clear hearing steps up to them first

**Fixed by:** [PR #533](https://github.com/ali123500-codeRPG/text-rpg/pull/533)

## BG-73

**What was wrong:** Crossing a frontier the Weaver builds that turn left the player's move event inside the old zone, so narration had them walk the street while the screen showed the new zone; the event now leaves for the zone built there

**What was done:** BG-73: a frontier crossing's move event ends in the zone built there

**Fixed by:** [PR #532](https://github.com/ali123500-codeRPG/text-rpg/pull/532)

## BG-72

**What was wrong:** Words said to the player from out of sight (e.g. behind a shut door) counted as touch by the event-target rule, so narration had the gate shudder; speech is now reached only by sound or sight

**What was done:** BG-72: words said to someone are not felt as touch

**Fixed by:** [PR #530](https://github.com/ali123500-codeRPG/text-rpg/pull/530)

## BG-71

**What was wrong:** The player could not shout: every player line was a normal voice, so a shout through a barred door went unheard once hearing used real metres. The Parser now gives volume (whisper, normal, shout)

**What was done:** BG-71: the player can whisper and shout

**Fixed by:** [PR #529](https://github.com/ali123500-codeRPG/text-rpg/pull/529)

## BG-70

**What was wrong:** Opening a door just to look in did nothing (no door state): doors now open and shut, and an open one is seen through (Ali chose this)

**What was done:** BG-70: doors open and shut; an open door is seen through

**Fixed by:** [PR #527](https://github.com/ali123500-codeRPG/text-rpg/pull/527)

## BG-69

**What was wrong:** The player's walk went round a door barred out of sight (through the yard gate, sliding its bar) before ever trying it; knocking on a door became a move inside

**What was done:** BG-69: don't route round a door the player never tried

**Fixed by:** [PR #524](https://github.com/ali123500-codeRPG/text-rpg/pull/524)

## BG-68

**What was wrong:** Parser split a spoken line into deferred actions (asks to the listener are speech)

**What was done:** BG-68: keep asks to the listener in spoken

**Fixed by:** [PR #521](https://github.com/ali123500-codeRPG/text-rpg/pull/521)

## BG-67

**What was wrong:** 'Tell her' went to the barkeep instead of the woman you were talking to

**What was done:** BG-67: a bare pronoun means the one you are talking with

**Fixed by:** [PR #517](https://github.com/ali123500-codeRPG/text-rpg/pull/517)

## BG-66

**What was wrong:** A step already taken was also offered as 'put off to next turn'

**What was done:** BG-66: the Parser defers only what the turn leaves undone

**Fixed by:** [PR #516](https://github.com/ali123500-codeRPG/text-rpg/pull/516)

## BG-65

**What was wrong:** Checking a door said nothing about whether it was locked

**What was done:** BG-65: checking a door says whether it is locked

**Fixed by:** [PR #515](https://github.com/ali123500-codeRPG/text-rpg/pull/515)

## BG-64

**What was wrong:** Spotting a sneaking NPC gave achievements but the story never said whom you spotted

**What was done:** BG-64: the deed you spot a sneaking NPC by is told

**Fixed by:** [PR #512](https://github.com/ali123500-codeRPG/text-rpg/pull/512)

## BG-63

**What was wrong:** Switching between your story and the agent's own story while a story was still being created mixed them up: resume swapped the loaded story while the opening (or a turn) was still being written, so that turn landed on the other story. Fixed: the agent bar's story switch is disabled while the story is being written, and resume refuses to switch then

**What was done:** BG-63: no switching stories while one is still being written

**Fixed by:** [PR #513](https://github.com/ali123500-codeRPG/text-rpg/pull/513)

## BG-62

**What was wrong:** Walking over to talk to someone ended in the wrong zone (behind the counter)

**What was done:** BG-62: walking over to talk ends beside them, on your side of a counter

**Fixed by:** [PR #511](https://github.com/ali123500-codeRPG/text-rpg/pull/511)

## BG-61

**What was wrong:** Answering Dobb, who had just spoken through the barred tavern door, got "Who do you mean?": he was out of sight, so he was in neither the player's actor list nor talkingWith, and the addressee was refused (playtest run 56, turn 2). Fixed: talkingWith lists everyone whose words just reached the player, seen or only heard, with a name; a speech's addressee or target may be anyone in it

**What was done:** BG-61: answer someone heard but out of sight

**Fixed by:** [PR #510](https://github.com/ali123500-codeRPG/text-rpg/pull/510)

## BG-60

**What was wrong:** An NPC called Wren "he" though she was introduced as "she": NPC views gave pronouns only for people in sight, never in beliefs, so an agent speaking of someone out of sight guessed (playtest run 55, turn 9). Fixed: each belief carries the other person's pronouns

**What was done:** BG-60: beliefs carry pronouns

**Fixed by:** [PR #509](https://github.com/ali123500-codeRPG/text-rpg/pull/509)

## BG-59

**What was wrong:** An NPC forgot being handed coin when the player spoke while handing it over: words beside a deed make the deed's event a bark, and every bark was dropped from NPC views and history, so the watchman kept demanding coin (playtest run 54, turns 4 to 6). Fixed: only a bark that is nothing but words is left out (barkOnly); a deed with a bark still counts in NPC views, history and free roam's scenario start, with its line dropped

**What was done:** BG-59: a deed with a bark still counts in NPC views

**Fixed by:** [PR #508](https://github.com/ali123500-codeRPG/text-rpg/pull/508)

## BG-58

**What was wrong:** "Walk over to them and say..." spoke first, from where the player started, and walked after: the player's words resolved in the exchange slot before their move (playtest run 53, turns 8 and 12). Fixed: the player's move comes first and the words are said from where it ends, as an NPC's reply already did. Also the Parser no longer walks the player behind a counter to talk to the barkeep (turn 10)

**What was done:** BG-58: walk over first, then speak

**Fixed by:** [PR #507](https://github.com/ali123500-codeRPG/text-rpg/pull/507)

## BG-57

**What was wrong:** Marta's whispered answer from behind the counter never reached the player a metre away: behind the counter is the next zone, and a whisper isn't heard next door (NV5) (playtest run 51, turn 12). Stopgap: Planner, Responder and Voice are told a whisper is heard only in their own zone, so they speak up across a counter or doorway. Fixed: hearing by real metres, background noise and losses at doors and walls (HB1–HB8); the stopgap prompt rule is gone

**What was done:** BG-56 tavern rooms; BG-57 stopgap: whispers stay in-zone; BG-57: hearing by real metres (HB1–HB8)

**Fixed by:** [PR #506](https://github.com/ali123500-codeRPG/text-rpg/pull/506), [PR #528](https://github.com/ali123500-codeRPG/text-rpg/pull/528)

## BG-56

**What was wrong:** The tavern landing read "doors to the rooms let for the night" and NPCs named those rooms, but the layout had no room zones, so trying a door got "no such door" (playtest run 51, turns 8 to 12). Fixed: the tavern layout has two let rooms off the landing (front room north, back room south)

**What was done:** BG-56 tavern rooms; BG-57 stopgap: whispers stay in-zone

**Fixed by:** [PR #506](https://github.com/ali123500-codeRPG/text-rpg/pull/506)

## BG-55

**What was wrong:** A reply that names no one ("Yes, I'll take the work") went to nobody, so the NPC who had just offered the job stood silent: the Parser had no record of who the player was talking with (playtest run 50, turn 10). Fixed: the player view lists talkingWith (NPCs whose words at the player reached them last turn, and those the player spoke to); the Parser gives unnamed words to them, and fillSpeech does the same when it doesn't

**What was done:** BG-55: unnamed words go to whoever the player was just talking with

**Fixed by:** [PR #505](https://github.com/ali123500-codeRPG/text-rpg/pull/505)

## BG-54

**What was wrong:** "Open the hatch and climb down" left the player standing still with no word why: the Parser added a way op (unbar) the plain hatch can't take, the op was dropped, and because a way op takes the move slot the move was skipped too (playtest run 49, turn 5). Fixed: a way op that can't be done spends no move slot and the move happens; the Parser is told that opening a way to go through it is only the move

**What was done:** BG-54: a way op that can't be done leaves the move to happen

**Fixed by:** [PR #504](https://github.com/ali123500-codeRPG/text-rpg/pull/504)

## BG-53

**What was wrong:** The Equations tab said Every Fall a Lesson comes at A Nobody class level 20; A Nobody tops out at 15 and the perk is its level 15 capstone (code scan). Fixed: the text reads the perk's classLevel

**What was done:** Code scan: fix stale Equations-tab text (BG-51..53), stray comments, leftover owner names

**Fixed by:** [PR #503](https://github.com/ali123500-codeRPG/text-rpg/pull/503)

## BG-52

**What was wrong:** The Equations tab said the attack gap is kept between −5 and +5, while code clamps it to GAP_MIN..GAP_MAX (−10..+5, the ladder's rows) (code scan). Fixed: the text reads GAP_MIN and GAP_MAX

**What was done:** Code scan: fix stale Equations-tab text (BG-51..53), stray comments, leftover owner names

**Fixed by:** [PR #503](https://github.com/ali123500-codeRPG/text-rpg/pull/503)

## BG-51

**What was wrong:** The library viewer's Equations tab showed the literal text "${n(CONFIG.GRIT_SHARE)}" in the effective-skill augments term instead of the Grit share: the string used plain quotes, not a template (code scan, 12/11/2026). Fixed: a template string

**What was done:** Code scan: fix stale Equations-tab text (BG-51..53), stray comments, leftover owner names

**Fixed by:** [PR #503](https://github.com/ali123500-codeRPG/text-rpg/pull/503)

## BG-50

**What was wrong:** A scenario talk beat at the player (a fired talk order) spoke an empty line whenever the player had not addressed that NPC, so every bout offer from Brann in run 42 was silent (playtest run 48). Fixed (Ali chose "Add a Responder call"): each agent-run NPC with a fired talk order at the player gets a Responder call that turn, told the player said nothing and it speaks first; that output is the one used for it; a speak with no words carries no line

**What was done:** BG-50: talk beats at the player get a Responder line

**Fixed by:** [PR #502](https://github.com/ali123500-codeRPG/text-rpg/pull/502)

## BG-49

**What was wrong:** A story starts the player at the middle of a 40 m street, about 20 m from the tavern door, while the opening narration has them under the sign by the open door, so "step inside" takes two or three turns (playtest runs 46 and 47). Fixed (Ali chose "at the door"): a story that opens outdoors puts the player at the way into the building beside them, the scenario's place first (startAtDoor)

**What was done:** A story that opens outdoors starts the player at the door (BG-49)

**Fixed by:** [PR #500](https://github.com/ali123500-codeRPG/text-rpg/pull/500)

## BG-48

**What was wrong:** "Step inside and walk over to the old soldier" walked 8.4 m toward him and stopped in the lane, but BG-47's toGo was only on legs heading for a zone, not on legs toward a person in another zone (turn 1 of playtest run 47). Fixed: those carry toGo too

**What was done:** Legs toward someone in another zone say how far the way still is (BG-48)

**Fixed by:** [PR #499](https://github.com/ali123500-codeRPG/text-rpg/pull/499)

## BG-47

**What was wrong:** "Push the tavern door open and look inside" (a move plus a look) walked one move slot (8.4 m) along a 40 m street and stopped short of the door, but the Narrator put the player at the threshold; the player tried again and the same happened (turns 1 and 2 of playtest run 46). Fixed: a move leg that stops short of the way into the zone it heads for carries toGo, the metres still ahead, and the Narrator is told the character is not there yet

**What was done:** Move legs that stop short say how far the way still is (BG-47)

**Fixed by:** [PR #497](https://github.com/ali123500-codeRPG/text-rpg/pull/497)

## BG-46

**What was wrong:** "I knock on the tavern door and call out: Hello? Who's there?" walked the player into the common room, and the words were never said (turn 1 of playtest run 45): the Parser gave a move through the door and kept the line in spoken with no action, and code speaks only for a speech action. Fixed: words with no action are a talk to whoever they are for (fillSpeech), and the Parser is told that knocking on, calling through or listening at a door is not going through it

**What was done:** Words with no action are said; knocking is not going in (BG-46)

**Fixed by:** [PR #495](https://github.com/ali123500-codeRPG/text-rpg/pull/495)

## BG-45

**What was wrong:** The Narrator's JSON closed a bracket it never opened ("text":"…"],"narrated":[…]) on turn 2 of playtest run 44, so the turn showed the bare code narration ("A stout man in good wool idle."). Fixed: the tolerant parser drops a ] or } outside strings that doesn't close the bracket open there

**What was done:** Tolerant JSON drops a stray closing bracket (BG-45)

**Fixed by:** [PR #494](https://github.com/ali123500-codeRPG/text-rpg/pull/494)

## BG-44

**What was wrong:** The Weaver's ending "the player leaves the tavern" fired on one step into Mill Lane while the player was still chasing the ring, though the lane was on the scenario's ground (scenarios 1 and 2 of playtest run 43)

**What was done:** Ali chose only once off the ground.

**Fixed by:** [PR #493](https://github.com/ali123500-codeRPG/text-rpg/pull/493)

## BG-43

**What was wrong:** Following the hidden thief into the tavern's back yard ended the scenario as left (twice, turns 31 and 35 of playtest run 43): a scenario's ground (CH1) is only the start zone, the zones its plan builds and the stage zones the plan names, and the back yard was never named although the thief's routine runs there

**What was done:** Ali chose whole places.

**Fixed by:** [PR #493](https://github.com/ali123500-codeRPG/text-rpg/pull/493)

## BG-42

**What was wrong:** All six Weaver check-ins were spent by turn 36 of playtest run 42, so the over-time check-in never came and the scenario drifted to its hard limit at turn 77. Fixed (Ali chose): the over-time check-in always happens, outside the cap of six, and is not counted

**What was done:** Scenario endings: whole-place ground (BG-43), leave endings off the ground (BG-44), over-time check-in (BG-42)

**Fixed by:** [PR #493](https://github.com/ali123500-codeRPG/text-rpg/pull/493)

## BG-41

**What was wrong:** The Weaver check-in couldn't see what happened: in playtest run 42 the player won the bout a judged ending asked for (turn 9), but every check-in to turn 36 said no bout was fought and added the beat again; the scenario only ended at turn 76, worn out. The check-in view had the stage, actors, plans and quests but no events. Fixed: the check-in sees a list of what happened in the scenario and the memory lines kept since it began, and is told never to add a beat for something that already happened

**What was done:** BG-41: the Weaver check-in sees what happened in the scenario

**Fixed by:** [PR #491](https://github.com/ali123500-codeRPG/text-rpg/pull/491)

## BG-40

**What was wrong:** The Weaver's first plan was refused with "band cutpurse: chase is Post, Ground, Near or Far": the schema shows chase as names ("Ground") but kept the raw word, and the validator wanted the key, so every scenario start whose band named a chase cost a whole Weaver retry (playtest run 42). Fixed: chase is read like tactics, a name maps to its key.

**What was done:** Weaver band chase written as its name maps to the key (BG-40)

**Fixed by:** [PR #489](https://github.com/ali123500-codeRPG/text-rpg/pull/489)

## BG-39

**What was wrong:** The scenario ending moment (SD1) never showed in play: resolveTurn records and closes a scenario that ends that turn, clearing its frame, so the pipeline's pendingEnding() found no scenario afterwards. The pipeline test set the frame by hand after resolve, so it never caught it. Found while building chases. Fixed: closeScenario keeps how and when the scenario closed (StageInfo.closed), and pendingEnding reads it that turn

**What was done:** Chases and free roam (CH1–CH7)

**Fixed by:** [PR #476](https://github.com/ali123500-codeRPG/text-rpg/pull/476)

## BG-38

**What was wrong:** Playtest run 40: Tam the thief hid and could never be found on purpose: a search rolled nothing against anyone hiding, Look around never found a stealthy actor, and an NPC's search rolled nothing either. Fixed by the search redesign's people part (SE1–SE24): a search is a sense contest against the stealth of everyone hiding in reach, Look around is a weak one, and NPCs search the same way

**What was done:** Search redesign, people part: a search is a sense contest against everyone hiding in reach (BG-38)

**Fixed by:** [PR #598](https://github.com/ali123500-codeRPG/text-rpg/pull/598)

## BG-37

**What was wrong:** On the Map, two places' outlines overlapped (the Crooked Kettle over the slime field): the force layout places zones, not places, so sibling places could land on top of each other. Fixed: after layout, each top place's group of zones and each loose zone is pushed apart the short way, keeping the group the player is in still

**What was done:** Map: place outlines no longer overlap (BG-37)

**Fixed by:** [PR #459](https://github.com/ali123500-codeRPG/text-rpg/pull/459)

## BG-36

**What was wrong:** The Weaver's layouts, named spots and looks, and a zone's height, size, area, edges, road length and danger never reached the game: the plan schema copied only the keys it named (agents/schema.ts obj()), so every place came out with no layout. Found while building scenarios. Fixed: the schema names every field the Weaver may give, and the scenario too

**What was done:** Scenes as situations: scales, endings, records, inner scenes (SC1–SC10, SC13) + BG-36

**Fixed by:** [PR #460](https://github.com/ali123500-codeRPG/text-rpg/pull/460)

## BG-35

**What was wrong:** The Narrator's JSON left out the comma before "narrated" (one call in 244 in run 40), so the turn fell back. Fixed: the tolerant parser puts back a missing comma between members

**What was done:** Playtest run 40 fixes: BG-32, BG-33, BG-34 (Narrator side), BG-35

**Fixed by:** [PR #462](https://github.com/ali123500-codeRPG/text-rpg/pull/462)

## BG-34

**What was wrong:** Brannoc agreed to walk back with the player, but no NPC can follow, so he stayed put while the Narrator showed him walking along. Narrator side fixed: nobody walks along unless their own move says so. Ali chose a follow order: any NPC's agent may switch it to the follow routine, and it then walks after the player each turn until the agent ends it

**What was done:** Narrator side), PR #468 (follow order

**Fixed by:** [PR #462](https://github.com/ali123500-codeRPG/text-rpg/pull/462), [PR #468](https://github.com/ali123500-codeRPG/text-rpg/pull/468)

## BG-33

**What was wrong:** The Narrator called Maud, a cloth merchant (she), "he": she had spoken that turn but was out of sight by its end, so her pronouns were not in the view. Fixed: each fully seen event carries its actor's pronouns (and its target's), and Narrator rule 9 reads them and keeps a person's pronouns the same throughout

**What was done:** Playtest run 40 fixes: BG-32, BG-33, BG-34 (Narrator side), BG-35

**Fixed by:** [PR #462](https://github.com/ali123500-codeRPG/text-rpg/pull/462)

## BG-32

**What was wrong:** Playtest run 40 had two taverns: the bare place made for the story start ('tavern') and the Weaver's tavern of the same key, which became 'tavern_2', The Crossed Keys; the player was in one, the other kept the plain name, and Brannoc said there was no such house. Fixed: the bare start place is marked bare, and the plan's place with its key fills it in instead of becoming a second place

**What was done:** Playtest run 40 fixes: BG-32, BG-33, BG-34 (Narrator side), BG-35

**Fixed by:** [PR #462](https://github.com/ali123500-codeRPG/text-rpg/pull/462)

## BG-31

**What was wrong:** "Walk to Tavern Lane, the street door" came as a move to the lane with a spot near the common room; the lane was out of view, so the spot couldn't be checked and the player was asked "Where in common room do you want to go?" twice (playtest run 40). Fixed: on a move to another zone, a spot that doesn't fit is dropped and the move goes on.

**What was done:** Moves to another zone drop a spot that doesn't fit instead of asking where (BG-31)

**Fixed by:** [PR #458](https://github.com/ali123500-codeRPG/text-rpg/pull/458)

## BG-29

**What was wrong:** Who's here showed "A sharp-eyed woman · Down · Terrified" for a dead woman: others' morale (MB16) was shown even when they were Down (Ali's report, the agent's save). Fixed: anyone Down shows no mood.

**What was done:** Who's here: no mood shown for anyone Down (BG-29)

**Fixed by:** [PR #450](https://github.com/ali123500-codeRPG/text-rpg/pull/450)

## BG-28

**What was wrong:** "I strike the innkeeper behind the counter" moved the player behind the counter and struck no one, and the next turn answered "No innkeeper is in sight". The barkeep had been seen, then only heard running off to the kitchen; that unseen move wiped her from the player's clear sightings, so the Parser had no trace of her. Fixed: lastSeen keeps everyone seen or heard at the last zone known (Journal lastKnown), and the Parser never asks who someone in it is

**What was done:** BG-28: keep people heard leaving in lastSeen

**Fixed by:** [PR #453](https://github.com/ali123500-codeRPG/text-rpg/pull/453)

## BG-27

**What was wrong:** Pressing Report bug only saved the report; the open bugs reached Claude only through a separate "Send open bugs to Claude" button, though Ali had asked that reporting sends them. Fixed: Report bug saves the report and sends every open bug to Claude at once (the send button stays for sending again)

**What was done:** Report bug sends the open bugs to Claude (BG-27)

**Fixed by:** [PR #446](https://github.com/ali123500-codeRPG/text-rpg/pull/446)

## BG-26

**What was wrong:** The autopilot agent kept stopping to check how badly it was hurt ("let me check how bad I'm hurt") with /stats instead of acting (Ali's report, the agent's save, turn 15). Fixed: the agent is given its health, wounded parts, morale, coin and perk points every move, is told never to check its wounds, and a /stats move is re-asked once

**What was done:** Guided autoplay: the agent asks you at crossroads; no more sheet-checking (BG-25, BG-26)

**Fixed by:** [PR #445](https://github.com/ali123500-codeRPG/text-rpg/pull/445)

## BG-25

**What was wrong:** The player swung three times at a woman lying Incapacitated at 0.7 m; every blow was wasted in silence (attacks on anyone down were refused), and the Narrator made up a blade stuck in the floorboards and shaking hands (Ali's game, turns 11 to 14). Fixed: blows on someone down land with no defense, only the dead can't be struck, and a wasted action says why (Narrator rule 18)

**What was done:** Strike someone who is down; a wasted action says why (BG-24, BG-25)

**Fixed by:** [PR #444](https://github.com/ali123500-codeRPG/text-rpg/pull/444)

## BG-24

**What was wrong:** "Wrench my sword out and strike" drew the arming sword already in the player's hand, and the draw was logged as invalid gear (Ali's game, turn 12). Fixed: drawing what is already in hand is nothing to do, not a mistake

**What was done:** Strike someone who is down; a wasted action says why (BG-24, BG-25)

**Fixed by:** [PR #444](https://github.com/ali123500-codeRPG/text-rpg/pull/444)

## BG-23

**What was wrong:** The barkeep, 0.7 m from the player, broke and fled through the kitchen door; perception took the move only where it ended (no sight into the kitchen), so the player only heard something, she dropped from lastSeen, and "cut down the barkeep" next turn asked who that was (Ali's game, turn 6). Fixed: a leg out of a zone is also seen where it set off (`fromPos`), and a clear sight of it remembers the zone she went into

**What was done:** Someone leaving in plain sight is seen going (BG-23)

**Fixed by:** [PR #434](https://github.com/ali123500-codeRPG/text-rpg/pull/434)

## BG-22

**What was wrong:** The narration view's move events said only where each leg ended: "open the tavern door and step inside" (8.4 m along the lane, then into the common room) was told as stepping out into the lane and coming back in, and cellar to kitchen as leaving the common room (playtest run 39). Fixed: a leg that leaves a zone carries `from`, a leg inside a zone is `within` it and names the zone it is `heading` for; Narrator rule 17 reads them

**What was done:** Moves in the narration say where they came from (BG-22)

**Fixed by:** [PR #425](https://github.com/ali123500-codeRPG/text-rpg/pull/425)

## BG-21

**What was wrong:** A doorway right where the walker stood (a cellar laid under its counter with no heights) was crossed in 0 m with no move event and no trail entry, so "go back" had nothing to read (found testing BG-19). Fixed: a crossing counts as a move however short

**What was done:** Left and right, ties, the back of a zone, walking to a way out (BG-18 to BG-21)

**Fixed by:** [PR #422](https://github.com/ali123500-codeRPG/text-rpg/pull/422)

## BG-20

**What was wrong:** "Walk to the cellar steps" from behind the bar went down into the cellar: a move to a way out was parsed as a move through it (playtest run 38). Fixed: going to a way out is a spot near it in the zone it leaves from; going through it is a move to the zone beyond

**What was done:** Left and right, ties, the back of a zone, walking to a way out (BG-18 to BG-21)

**Fixed by:** [PR #422](https://github.com/ali123500-codeRPG/text-rpg/pull/422)

## BG-19

**What was wrong:** "Walk to the back of the cellar" still gave move.spot {awayFrom: the player's own zone} after PR #415 (playtest run 38, as in run 37). Fixed: legality reads awayFrom the zone itself as away from the way the player came in (cameFrom[0]), and the Parser is told so

**What was done:** Left and right, ties, the back of a zone, walking to a way out (BG-18 to BG-21)

**Fixed by:** [PR #422](https://github.com/ali123500-codeRPG/text-rpg/pull/422)

## BG-18

**What was wrong:** With two slimes both an arm's length away, "attack the nearest slime" and then "the slime on the left" / "on the right" each got the clarify "Which slime do you mean?", two turns running, while both slimes kept attacking (playtest run 38). The Parser has no way to break a tie or use left/right. Fixed: everyone in view has a `side` (ahead, left, right, behind) by the way the player last walked (Actor.facing, engine/position.ts sideFrom); the Parser picks one of equally fitting foes and never asks

**What was done:** Left and right, ties, the back of a zone, walking to a way out (BG-18 to BG-21)

**Fixed by:** [PR #422](https://github.com/ali123500-codeRPG/text-rpg/pull/422)

## BG-17

**What was wrong:** A guard's shout at the gate, four rooms away, reached the player in the cellar word for word: any sound heard, even partly, carried its words (playtest run 36). Fixed by Ali's decision: words need the sound heard clearly

**What was done:** Words need clear hearing; far moves name their destination; no hold after a move

**Fixed by:** [PR #418](https://github.com/ali123500-codeRPG/text-rpg/pull/418)

## BG-16

**What was wrong:** A move-only turn ("walk behind the bar") was narrated as "You hold your ground and wait": the turn's unused main action made a hold event after the move (playtest run 37). Fixed: no hold after a move unless words go with it

**What was done:** Words need clear hearing; far moves name their destination; no hold after a move

**Fixed by:** [PR #418](https://github.com/ali123500-codeRPG/text-rpg/pull/418)

## BG-15

**What was wrong:** "Go up the cellar steps and out the front door into the street" stopped behind the bar: moves could only name a zone next to the player, so the Parser named the first step (playtest run 37). Fixed: a move can name any zone the player knows, or a way out of one it has seen (PlayerView `known`), and the walk goes through the zones between

**What was done:** Words need clear hearing; far moves name their destination; no hold after a move

**Fixed by:** [PR #418](https://github.com/ali123500-codeRPG/text-rpg/pull/418)

## BG-14

**What was wrong:** A level tunnel was laid on top of the cellar on the same floor, because the layout read the tunnel's back exit ("back up into the cellar") as a climb while heights put both at −3 m; their doorway became the cellar's middle, so a slime from the tunnel stood 0 m from the player (playtest run 36). Fixed: once heights are settled, they alone decide whether an exit climbs

**What was done:** Fix BG-12, BG-13, BG-14: spots in a zone, no attacks on the dead, tunnel laid on the cellar

**Fixed by:** [PR #415](https://github.com/ali123500-codeRPG/text-rpg/pull/415)

## BG-13

**What was wrong:** The Parser aimed attacks at a slime its view listed as Dead, so the player swung at a corpse while a live slime kept attacking (playtest run 36). Fixed: legality stops an attack on someone the view lists as Dead with "That one is already dead. Who do you mean?", and the Parser is told not to aim at the dead

**What was done:** Fix BG-12, BG-13, BG-14: spots in a zone, no attacks on the dead, tunnel laid on the cellar

**Fixed by:** [PR #415](https://github.com/ali123500-codeRPG/text-rpg/pull/415)

## BG-12

**What was wrong:** The player can't move to a spot inside their zone ("walk to the back of the cellar"): moves only name a zone, so the Parser returned nothing and the turn passed as holding still, five times (playtest run 36). Fixed: a move can name a spot in its zone (move.spot: near someone or a way out, away from one, or a compass side)

**What was done:** Fix BG-12, BG-13, BG-14: spots in a zone, no attacks on the dead, tunnel laid on the cellar

**Fixed by:** [PR #415](https://github.com/ali123500-codeRPG/text-rpg/pull/415)

## BG-11

**What was wrong:** BG-9 again on a new story (play)

**What was done:** Fix scene planning failures (BG-8..BG-11); Narrator gets the player's personality as flavour

**Fixed by:** [PR #412](https://github.com/ali123500-codeRPG/text-rpg/pull/412)

## BG-10

**What was wrong:** BG-8 again on a new story (play)

**What was done:** Fix scene planning failures (BG-8..BG-11); Narrator gets the player's personality as flavour

**Fixed by:** [PR #412](https://github.com/ali123500-codeRPG/text-rpg/pull/412)

## BG-9

**What was wrong:** The Weaver's repair of BG-8 failed the same way, so the scenario fell back to a placeholder area (play)

**What was done:** Fix scene planning failures (BG-8..BG-11); Narrator gets the player's personality as flavour

**Fixed by:** [PR #412](https://github.com/ali123500-codeRPG/text-rpg/pull/412)

## BG-8

**What was wrong:** Scenario planning failed: the Weaver named a tavern place and used its layout's zone keys (tavern.common) without naming the layout, so no zones were built and every link, slot and trigger pointed nowhere (play)

**What was done:** Fix scene planning failures (BG-8..BG-11); Narrator gets the player's personality as flavour

**Fixed by:** [PR #412](https://github.com/ali123500-codeRPG/text-rpg/pull/412)

## BG-7

**What was wrong:** The player can't walk out of the tavern front door: zones of different places sit about 36 m apart with no doorway, so the walk heads for a crossing point in the gap, a partial leg leaves the player outside the room, and the next turn resets them to its centre (playtests runs 34, 35)

**What was done:** the gap is not walked

**Fixed by:** [PR #408](https://github.com/ali123500-codeRPG/text-rpg/pull/408)

## BG-6

**What was wrong:** Zone placement read "down the street" and "up the road" as stairs, so level street zones were stacked on top of each other

**What was done:** Zone positions step 2 PR 1: positions, walking and reach in metres, closing in to strike

**Fixed by:** [PR #395](https://github.com/ali123500-codeRPG/text-rpg/pull/395)

## BG-5

**What was wrong:** The player's fight never ended after they left it: the slimes stayed hostile and aware while fighting the guard, so fightingWith kept the engagement open and the end-of-engagement skill-up rolls never came (playtest run 31)

**What was done:** YD6

**Fixed by:** [PR #387](https://github.com/ali123500-codeRPG/text-rpg/pull/387)

## BG-4

**What was wrong:** "I yield" asked a hostile who never fought the player (waiting in another room), and the sheet's "Deciding" list revealed him; he also counts in the fight log

**What was done:** YD1–YD3, YD6, YD7

**Fixed by:** [PR #387](https://github.com/ali123500-codeRPG/text-rpg/pull/387)

## BG-3

**What was wrong:** "I await the outcome" after a yield got a clarify ("Nothing is pending"): the Parser had no way to let a moment pass

**What was done:** BG-3: let a moment pass; playtest flags for the instant skill-up comparison

**Fixed by:** [PR #375](https://github.com/ali123500-codeRPG/text-rpg/pull/375)

## BG-2

**What was wrong:** A sparring blow struck from hiding raised the alarm (SP11)

**What was done:** A sparring blow from hiding raises no alarm (SP11)

**Fixed by:** [PR #363](https://github.com/ali123500-codeRPG/text-rpg/pull/363)

## BG-1

**What was wrong:** Fight checks that go one way (health fears, crippled-part fear, crowded shots) skipped the player, because the player holds no stances or beliefs; spars didn't count as engaged

**What was done:** Player fight checks: health fears, crippled-part fear, spars, crowded shots

**Fixed by:** [PR #361](https://github.com/ali123500-codeRPG/text-rpg/pull/361)
