# Growth Proposal: Essences and Scenario-End Growth — v0.1 \[Proposed\]

Nov 12, 2026 · for @Ali

This proposal answers an independent review of how characters grow. **Nothing here is built.** Code changes wait for Ali's answers to the decisions in section 7, which are also on the questions page "Growth Proposal Decisions" (https://claude.ai/artifact/PzLCsXLLpwEGLoXnEiXQUZ). Every number below is a *placeholder* and lives in CONFIG or a library table. IDs EG1–EG12 are the decisions.

The review asked for two systems:
- **Essences.** Notable foes and scenario endings offer a package of a few points plus one trait. The player can take or decline it, and holds at most N packages, with N set by level.
- **Scenario-end growth.** Marks record which skills did the work, and each scenario pays out once when it ends.

The review's target feel is *Surviving the Game as a Barbarian*: power arrives in rare packages that the player chooses, into limited room, rather than as a trickle. Mechanics are borrowed, not the novel's names or content.

## 1. Assessment first

The review is right about the feel and mostly right about the shape. Four parts would be mistakes as written, and two need guard rails. Each has a fix below, and the rest of the proposal is built on the fixed version.

### What the review gets right

- **Growth lands mid-fight today.** It does: a skill rolls at the end of the turn it is marked (SKILL\_UP\_INSTANT, SM2), and a level-up lands the turn the XP arrives. That alone could be fixed with timing (the open "Skill-Up Timing Revisit" page, ST1/ST2). This proposal goes further and replaces it.
- **Nothing grows past 100 except perks.** Raw skill stops at the mortal limit (LF4), and only perk true-skill bonuses go further (D-6). An essence that adds **true** skill fills that hole, and it fits the Thread lore: the body stops at 100, the thread does not.
- **Room limited by level.** This gives levels a job beyond class levels and perk points, and makes every essence a choice. Today nothing the player gains ever crowds anything else out.

### Mistakes as written, and the fix

1. **Paying a flat growth amount split across marked skills** (mistake). Skill growth today goes through the improvement roll: d100 over raw + Burden, a 1d3 gain, Flawed rolling twice and keeping the lower, Tagged skills ignoring Burden, Quick Study's extra rolls, and the mortal limit (LF4). A flat amount skips all of that. At skill 98, a flat +3 would carry the body past 100 through training, which the lore and LF4 forbid. Training would also stop slowing down as a skill climbs.
   **Fix:** the scenario pays **improvement rolls**, not points. Each roll is today's roll, unchanged.
2. **Setting the payout by the gain grade** (mistake). The event roll's *tier* is code's. The *gain grade* is the Weaver's pick within the band the tier allows (GRADES\_FIT: a Success may carry any gain from none to extreme). Paying by gain grade would let an agent set growth.
   **Fix:** pay by the event roll's **tier**, which only code rolls.
3. **Paying by the ending reached** (guard rail). The Weaver writes the endings and their kinds into the plan, though code checks the plan before play. A *judged* ending is picked by the Weaver at a check-in.
   **Fix:** keep the ending factor in a narrow range (0.5 to 1), and have every judged ending pay one fixed factor, whichever ending it was (EG5).
4. **"Each scenario pays once"** (guard rail). Free roam starts a scenario whenever you talk, trade or fight. Without a cap, a string of tiny scenarios is a payout farm.
   **Fix:** a scenario never pays more rolls than the marks earned in it. Moment-scale scenarios pay half. The FR1 gap (5 turns before a calm start) already slows the churn.
5. **Offer odds that "involve chance"** (fine, with one tweak). The review wants knowing the tables to tell the player what to hunt, not what they will get.
   **Fix:** a chance roll decides *whether* there is an offer and *how good* it is. The *kind* of essence is fixed by what you beat. A slime always offers slime essences, so the tables say what to hunt and the roll says how lucky you were.
6. **"Growth happens at story moments"** (true only if levels move too). Level-ups would still land mid-fight unless they wait as well.
   **Fix:** level-ups wait for the same moment (EG8).

## 2. Essence

### 2.1 What it is

When you overcome someone, part of the thread their training wound ties into yours: that is defeat XP. An **essence** is a rarer, stronger knot. It is one specific strand of what they were, which you can choose to tie into your own thread whole. It is thread, not body, so its points are **true skill**. They count everywhere true skill counts, and they ignore the mortal limit.

It is felt, never seen: no glowing strings. The narration tells what the player feels, such as a slime's patience settling into the gut, and the card gives the rules. Thread itself stays hidden lore unless Ali opens it (EG11).

### 2.2 Row schema (library table `essences`, typed IDs `ES` in src/library/essenceIds.ts)

```
EssenceDef {
  id: string                 // ES1, ES2 … through the ES constant table, never literals
  name: string               // grounded at low grades; grander names allowed from rare up
  source: EssenceSourceKey   // which source table offers it (2.3)
  weight: number             // its share of its source's table
  skills: { skill: string; weight: number }[]   // 1 to 3 skills the points go to, split by weight (SK ids)
  trait: string              // one perk row (PK id); OwnedPerk source 'essence'
  quirk?: string             // optional quirk row paired with it (a cost that can be an engine, DP6)
  story: string              // what the player reads and feels (the Narrator gets this, never the numbers)
  rules: string              // exact rules, generated from the row like perks (Story / Rules views)
  tags?: string[]            // for synergy rules later
}
```

The essence's **grade** is not stored on the row. It comes from the offer roll (2.4), so one row can arrive common or rare.

**Points.** points = max(1, round(ESSENCE\_SHARE × source skill × GRADE\_MULT\[grade\])), split over the row's skills by weight.
- The source skill is the beaten foe's raw × tier in that skill.
- For a scenario-end offer, it is the player's own true skill in that skill.
- ESSENCE\_SHARE is 0.07.
- ESSENCE\_GRADES is a names table: common ×1, fine ×1.5, rare ×2.5, epic ×4, legendary ×6, and one more row per step past Critical Success, with no top.

**Traits** are perk rows, so there is one perk engine. Essence traits never cost perk points, never count toward milestone gating, and live in their own section of src/library/perks.ts.

**Example rows.** Illustrative only, for Ali to replace:
- **"Gel Patience"** (slime source): Endurance 2, Tremor sense 1. Trait: *Settles Slowly*, the first morale loss each fight is halved.
- **"Gate-Warden's Habit"** (guard source): Block 2, Hearing 1. Trait: *Eyes on the Door*, +5 to notice rolls while standing still.

### 2.3 Sources (library table `essenceSources`)

```
EssenceSource { key: string; when: SourceCheck; rollBase: number; table: ES[] }
```

- **Notable foe** (row per body type, race or template tag). A foe is notable when any of these is true:
  - its power is at least ESSENCE\_NOTABLE\_SHARE (0.75) × the player's;
  - its template is tagged `notable` (leaders, permanent and unique NPCs);
  - it holds an essence itself (later, D-226).

  It offers when the player defeats it, with defeat meaning what it already means: Down, yielding, morale break or fleeing after being hit (DEFEATED rule). One offer per foe, ever, like defeat XP (B4).
- **Scenario ending** (one row per ending kind). Only *resolved* endings offer, and only when the event roll's tier was Great Success or better. Their table is the body types and races of the foes beaten in that scenario. With no foes beaten, it is a small "deed" table of grounded essences tied to the skills marked most.
- **Not sources:** achievements (they keep XP and their own rewards), quests (their own XP table), shops (DP: no buying power with coin, SY11), and the Weaver. No agent can name, seed or change an essence.

### 2.4 The offer roll (the first loot roll)

One d100 on the event roll's tier table:

```
margin = d100 + source.rollBase − 100 + essence-roll modifiers
```

Natural edges apply as on every roll. The result's tier decides the offer:
- **Near Miss or worse:** no offer.
- **Success:** a common essence.
- **Great Success:** a fine one.
- **Critical Success:** a rare one.
- **Each step past Critical Success:** one grade higher.

Then code picks which row by weight from the source's table. Modifiers come only from perks, gear and statuses whose rows name the essence roll, stacked by type at STACK\_RATIO, as on the event roll.

With rollBase 80, the notable-foe default, an offer comes 31% of the time: 25% common, 1% fine and 5% rare (the fine and rare split comes from the natural edges). With rollBase 100, the default for a resolved ending at Critical Success, offers come 51% of the time. Ending rows at Great Success use 80.

### 2.5 Taking, declining, room

- **Room.** ESSENCE\_SLOTS = ESSENCE\_SLOTS\_BASE (1) + floor(character level ÷ ESSENCE\_SLOT\_EVERY (4)).
  - Level 1: 1 slot. Levels 4, 8, 12, 16 and 20: 2, 3, 4, 5 and 6 slots.
  - It keeps growing past 20: level 40 has 11. There is no cap.
  - Character level is the full level, free and bonus levels included.
- **When the offer shows.** A foe's offer is held until the player's engagement ends. A scenario offer shows at the scenario's ending moment. Nothing pops up mid-swing.
- **The choice.** A card shows the essence's Story and Rules views, its grade and points, and the slots.
  - **Take** fills an empty slot.
  - With every slot full, **Take** asks which held essence to give up. That one is removed by the removal rule (2.6).
  - **Let it go** declines it for good.
  - The offer waits ESSENCE\_OFFER\_TURNS (10) turns, or until the next scenario starts, whichever comes first. Unanswered means declined.
- **Milestones.** Essence points are true skill, so they count toward perk milestones (20, 40, 60…) and toward All-XXX, like perk bonuses do (EG4). A perk unlocked this way is kept if the essence later goes (S4).
- **Learning window.** The window's top is true skill + MARK\_WINDOW, so an essence also widens what teaches you. This is a deliberate synergy.

### 2.6 Removing a held essence

Options are in EG3. The recommendation is that a held essence can be removed only outside an engagement and at rest. The essence is lost (no refund), and its trait and quirk go with it. The cost is the opportunity: you gave up whatever else could have filled that slot. A removed essence never comes back from that same foe (B4).

### 2.7 Narration and the play page

- Code adds a GameEvent `essence_offered` {essenceId, grade, source}, then `essence_taken` or `essence_declined`.
- The NarrationView gets `essenceOffered: {name, story}`, never points, odds or grade numbers. Rule: describe what the player feels, in a grounded tone, and never call it thread or XP (EG11 may change the word).
- The character sheet gets an **Essences** section showing slots, held essences with Story and Rules views, and the room the next level opens.
- With mechanics shown, the turn lists "Essence offered: Gel Patience (fine)" and "Essence taken".

### 2.8 Scaling

Points follow the source's skill, so hunting stronger things matters at every stage. This table shows the points per essence by grade, for a source skill of 50, 75, 100, 150 and 200:

| Grade | 50 / 75 / 100 | 150 / 200 |
| --- | --- | --- |
| Common | 4 / 5 / 7 | 11 / 14 |
| Fine | 5 / 8 / 11 | 16 / 21 |
| Rare | 9 / 13 / 18 | 26 / 35 |
| Legendary | 21 / 32 / 42 | 63 / 84 |

- **At 50:** a rare package (9 points) is worth a bit more than a 40 perk (+6 in its own skill).
- **Past 100:** packages are the main way skills keep rising, with perks, because raw training stops at the mortal limit.
- **At 200 and beyond:** the grade table and the slot count have no top, and both grow by rows.
- **Watch:** six legendary packages all in one skill would add about 500 true skill at a source of 200. A cap per skill (ESSENCE\_SKILL\_CAP) is a lever to add if playtests show stacking abuse. It is not proposed now.

## 3. Scenario-end growth

### 3.1 Marks

Marks are recorded exactly as today: the learning window (MARK\_WINDOW), close calls, endurance by big hits, stacking every MARK\_STACK\_EVERY (3), and the Every Fall a Lesson capstone. The only change is that nothing rolls when a mark is made. A scenario keeps its own mark counts per skill (`ScenarioFrame.marks`). Marks made in an inner scenario count only there. Marks made in free roam wait for the next scenario to start, and count in it.

### 3.2 The formula

When a scenario ends:

```
rolls = min( marks earned in it,
             round( GROWTH_ROLLS[tier] × ENDING_FACTOR[ending] × SCALE_FACTOR[scale] ) )
```

| Event roll tier | GROWTH\_ROLLS |
| --- | --- |
| Critical Failure / Failure / Near Miss | 2 / 2 / 3 |
| Success | 4 |
| Great Success / Critical Success | 5 / 7 |
| Each step past Critical Success | +2 |

| Ending | ENDING\_FACTOR |
| --- | --- |
| resolved | 1 |
| lost, broken off (knocked out) | 0.75: a hard loss teaches (DP1) |
| left, escaped, interrupted, worn out | 0.5 |
| any judged ending | 0.75, fixed whichever one the Weaver picks (EG5) |

| Scale | SCALE\_FACTOR |
| --- | --- |
| moment | 0.5 |
| situation | 1 |
| episode | 2 |
| venture | 3 |

Each roll is today's improvement roll on one marked skill: d100 over raw + Burden, a gain of 1d3 (SKILL\_GAIN\_DIE), Flawed rolling twice and keeping the lower, Tagged ignoring Burden, and Quick Study's extra roll below 15. Burden is one snapshot for the whole payout.

**Why the tier and not the ending carries the size.** Hard events (low tiers) still pay at least 2 rolls when you did the work. Good fortune pays more. The ending moves the size by at most a factor of 2, so the Weaver's ending kinds can't swing it much.

### 3.3 The split

Recommended (EG6 b): code deals the rolls one at a time to marked skills, weighted by each skill's marks. Then the player gets one **focus**: they can move up to FOCUS\_ROLLS (1) of the rolls to any other marked skill, on the ending card, before the dice are thrown. This gives a choice without bookkeeping, and the skills that did the work still get most of it.

The alternatives are a) all rolls weighted by marks, no choice, and c) the player places every roll among marked skills.

### 3.4 Rules around it

- Each scenario pays once, at its ending moment. An inner scenario pays for its own marks, and the bigger one pays for the rest.
- A knock-out (broken off) pays too, at 0.75. You learned something from it.
- The GM's End scenario (interrupted) pays at 0.5.
- SKILL\_UP\_INSTANT and the per-engagement roll go away. Mark counts clear at the scenario's end instead of the engagement's.
- The "Skill-Up Timing Revisit" ST1 is settled by this if approved (EG7).

### 3.5 Levels move too (EG8)

- **What waits.** XP is paid and shown at once, as today. The level-up waits for the scenario's ending moment: class level, class perks, perk point, capstone offer and new essence slots all land together.
- **What does not wait.** Quest and achievement XP earned in free roam levels up at once, because there is no scenario to wait for.

### 3.6 Scaling

| Raw skill | What a payout roll does |
| --- | --- |
| 50 | About half of rolls gain (less with Burden) |
| 75 | About 1 in 4 |
| 98–99 | Only a roll above the target. 99 can still reach 100. |
| 100 and up | Never: raw stops at the mortal limit (LF4). Essences and perks carry it on. |

The payout table has rows past Critical Success and scale rows up to venture, so nothing runs out of rows.

## 4. Pacing check

### Method

A model run of 3,000 characters from level 1 to 30, recording the same fights under today's rules and under this proposal. The script is kept at /mnt/project-files/growth-proposal/pacing-sim.test.ts; it is not in the repo.

**Real code it uses:**
- the default swordsman's sheet;
- power(), rating() and levelCost() for defeat XP against an equal foe (taper 1);
- Burden (POTENTIAL 300, K 20);
- the improvement roll `improves` (no natural pass, LF4);
- SKILL\_GAIN\_DIE.

**Modelled (placeholders):**
- **Marks per fight:** weapon 90%, block 50%, dodge 30%, endurance 40%, about 2 rolls a fight. This matches the 11/11 skill-mark sim's 1.98 against a guard. A further 5% chance of a stacked extra roll.
- **One calm mark per scenario** (a check or talk).
- **Scenarios:** moment 40%, situation 45%, episode 15%, with 0–1, 0–2 and 1–3 fights each.
- **Event roll tiers:** Critical Failure 5%, Failure 20%, Near Miss 15%, Success 30%, Great Success 20%, Critical Success 10%.
- **Endings:** resolved 50%, lost 15%, left or escaped 20%, worn out 10%, broken off 5%.
- **Notable foes:** a quarter of defeats.
- **Essence offers:** 30% from a notable foe; at a resolved ending, 25% at Great Success and 50% at Critical Success. Grades in the model are 3, 5, 8 or 12 points (60/30/9/1%), averaging about 4.1, close to 2.8's formula at these levels.
- **Taking:** always take; with every slot full, swap out the weakest for a better one.

**Left out on both sides:**
- **Achievement and quest XP.** They speed levels the same way on both sides, so they don't change the comparison.
- **Perk bonuses**, which are the same on both sides.

"Rank-ups" here means perk milestones crossed (true skill passing 20, 40, 60…). Level-ups happen at the same fights on both sides, because XP is unchanged.

### Results by landmark level

The four fought skills are weapon, block, dodge and endurance. Their starting sum is 160 and the weapon starts at 52.

**Per level: fights, and the moments something grew**

| Level | Fights | Today: skill-ups | Proposal: growth moments |
| --- | --- | --- | --- |
| 1 | 2.0 | 3.8 | 1.3 |
| 5 | 4.1 | 7.0 | 2.6 |
| 10 | 4.4 | 5.9 | 2.7 |
| 15 | 4.0 | 4.3 | 2.2 |
| 20 | 3.5 | 3.1 | 1.8 |
| 25 | 3.1 | 2.4 | 1.5 |
| 30 | 2.8 | 1.8 | 1.2 |

Proposal growth moments are scenario payouts that raised something. Essences come on top: 0.2 offers per level at level 1, and 0.3 to 0.5 per level from level 3 on.

**Where the character stands at the end of the level**

| Level | Today: fought sum / weapon | Proposal: true sum / weapon | Proposal: essences held (slots) |
| --- | --- | --- | --- |
| 1 | 160 / 52 | 159 / 52 | 0.2 (1) |
| 5 | 188 / 62 | 181 / 61 | 1.2 (2) |
| 10 | 229 / 75 | 217 / 75 | 2.6 (3) |
| 15 | 257 / 82 | 245 / 85 | 3.7 (4) |
| 20 | 275 / 85 | 267 / 93 | 5.0 (6) |
| 25 | 288 / 87 | 285 / 100 | 6.2 (7) |
| 30 | 297 / 88 | 299 / 104 | 7.2 (8) |

**Totals, levels 1 to 20 (76 fights)**

| Measure | Today | Proposal |
| --- | --- | --- |
| Growth moments | 101 skill-ups, each on its own turn | 45 scenario payouts + 6.2 essences taken (8.5 offered, 1.2 swaps) |
| Perk milestones crossed | 8.3 | 7.0 |
| Levels 21 to 30 (31 fights) | 24 skill-ups, 2.3 milestones | 15 payouts, 2.7 essences taken, 2.7 milestones |

### What it shows

- **About the same total power at level 20, delivered differently.** Today gives about 100 small mid-fight gains. The proposal gives about 45 end-of-scenario moments and 6 chosen packages. The four fought skills end at 267 true (243 raw + 24 from essences) against today's 275, within 3%.
- **The proposal keeps growing where today stalls.** Today's weapon flattens at 85–88 from level 20 on, because raw training slows toward the mortal limit and Burden rises. With essences the weapon reaches 100 around level 25 and keeps going (104 at 30). That is the D-6 hole, filled by the lore.
- **Early levels feel thinner.** Level 1 has 1.3 growth moments against 3.8 skill-ups. If the first hour should feel generous, raise the low-level payout (a GROWTH\_ROLLS bonus below level 5) or start every character with one essence slot already filled from its background (EG10).
- **Spikes stay rare.** About one essence offer every 2–3 levels. The slots are never all full before level 20 (5.0 held of 6), so swapping out an essence only starts to matter late. A smaller ESSENCE\_SLOT\_EVERY (3) would make the room tighter sooner.

## 5. What stays as it is

- The d100 roll and its tiers.
- The event roll and the Weaver's scenarios.
- Achievements and scars, classes, levels and XP: the defeat-XP formula, power() and the XP curve.
- Marks and the learning window.
- Burden and Potential, the improvement roll, and LF4.
- Code owns every number, roll and fact. No agent decides growth.

## 6. New levers (all placeholders)

**Essences:**
- ESSENCE\_SHARE 0.07
- ESSENCE\_GRADES (names table with GRADE\_MULT)
- ESSENCE\_NOTABLE\_SHARE 0.75
- essence sources' rollBase (80 / 100)
- ESSENCE\_SLOTS\_BASE 1
- ESSENCE\_SLOT\_EVERY 4
- ESSENCE\_OFFER\_TURNS 10

**Scenario-end growth:**
- GROWTH\_ROLLS by tier
- ENDING\_FACTOR (with a judged row)
- SCALE\_FACTOR
- FOCUS\_ROLLS 1

**Retired if approved:** SKILL\_UP\_INSTANT.

## 7. Decisions for Ali

| ID | Decision | My recommendation |
| --- | --- | --- |
| EG1 | Adopt essences (section 2)? | Yes |
| EG2 | Room: 1 + one slot every 4 levels, no cap? | Yes |
| EG3 | Removing a held essence: a) never; b) at rest, lost, no refund; c) at a cost in banked XP | b |
| EG4 | Essence points count toward perk milestones and All-XXX? | Yes: they are true skill |
| EG5 | Pay scenario growth by the event roll's tier, not the Weaver's gain grade; judged endings pay a fixed 0.75? | Yes to both |
| EG6 | Split: a) by marks; b) by marks + one focus roll you place; c) you place every roll | b |
| EG7 | Replace instant and end-of-engagement skill rolls with scenario-end payouts (settles ST1)? | Yes |
| EG8 | Level-ups wait for the scenario's ending moment (free-roam XP levels at once)? | Yes (settles ST2) |
| EG9 | Offer kinds fixed by what you beat; chance only decides whether and how good? | Yes |
| EG10 | Early levels: leave thin, add a payout bonus below level 5, or start with one background essence? | Bonus below 5 (GROWTH\_ROLLS +1) |
| EG11 | Surface the Thread lore in essence narration (revising XL3)? | Not yet: describe the feel only, keep the word hidden |
| EG12 | Achievement proposals: "First Knot" (take your first essence, level I) and "Room for No More" (fill every slot at level 8+, level II)? | Your call: proposals only |

**Parked (new D-numbers if approved):**
- D-226: NPCs holding essences, who then offer them when beaten.
- D-227: a per-skill essence cap.
- D-228: essence rows for every body type and template. The content round goes to the lore and loot threads.

## 8. Ali's answers (round one, 12/11/2026)

- **EG1 a:** essences are adopted as in section 2.
- **EG2:** one slot at level 1, then one more every 7 levels: 2 at level 7, 3 at 14 and 4 at 21 (ESSENCE\_SLOT\_EVERY 7).
- **EG3 "b and 1 level":** removal happens at rest and the essence is lost. What "1 level" means is asked in EG15.
- **EG4 a:** essence points count toward perk milestones and All-XXX.
- **EG5 b:** pay by the event roll's tier. A judged ending pays by which ending it was, not a fixed 0.75. Ali asked for a lower and an upper limit on the reward (EG14).
- **EG6 a:** code deals the rolls by marks, with no focus roll. Ali raised two worries:
  - a moment inside an episode pays its marks at the moment's lower scale;
  - episodes already pay more because they hold more marks.

  Both are confirmed by the model (EG13).
- **EG7 a:** scenario-end payouts replace instant and per-engagement skill rolls. This settles ST1.
- **EG8 a:** level-ups wait for the scenario's ending moment. This settles ST2.
- **EG9 a:** an essence's kind is fixed by its source; chance decides whether there is an offer and how good it is.
- **EG10 b:** +1 payout roll per scenario below level 5.
- **EG11 b:** the Thread lore surfaces in essence narration. Essences are where the player first senses the weave (XL3 revised for essences only).
- **EG12 a:** both achievement proposals, "First Knot" and "Room for No More", are approved.

## 9. Round two

Questions page "Growth Proposal Round Two": https://claude.ai/artifact/WYwm1rJ5vHH5mzW7u4SBDD.

- **EG13, the scale fix.** In the model, the same work paid 56% of its marks as rolls in a moment, 73% in a situation and 82% in an episode. Recommended: drop SCALE\_FACTOR. Rolls = marks × tier share × ending factor. The tier shares are Critical Failure 0.5, Failure 0.6, Near Miss 0.7, Success 0.8, Great Success 0.9 and Critical Success 1, plus 1 roll per step past it. With that, every scale paid 64–66% in the model.
- **EG14, the limits.** Recommended: at least GROWTH\_MIN\_ROLLS (1) roll when any mark was earned, and at most GROWTH\_MAX\_PER\_SKILL (4) rolls per skill per scenario.
- **EG15, the meaning of "1 level" in EG3.** The three readings are losing a level, paying one level's XP, or a one-level wait. Recommended: pay one level's XP, with the bar allowed to go into debt.
- **EG16, Ali's new rule: "tags should add 25 to the skill cap."** A tagged skill trains to 125. Options for the roll above 75 are on the page. Recommended: c, today's odds up to 75, then target = 75 + (raw − 75) ÷ 2.

The round-two model is kept at /mnt/project-files/growth-proposal/pacing-sim-round2.test.ts.

### Ali's answers (round two, 12/11/2026)

- **EG13 a:** no scale factor. Rolls = owed rolls × tier share × ending factor.
- **EG14:** no per-skill cap and no 1-roll floor. Ali wants a minimum and a maximum on the part the Weaver can move (asked in EG17).
- **The rounds rule (new):** payout rolls are made in rounds. Every skill with rolls left makes one, then Burden is worked out again before the next round.
- **EG15 b:** removing a held essence costs one level's XP, and the XP bar may go into debt.
- **EG16:** Ali asked for options found online, then (round three) for a full document on a different way to roll skill gain overall.

## 10. Round three

Questions page "Growth Proposal Round Three": https://claude.ai/artifact/SvZsDfFJkjvN67rT9QzDNE.

- **EG16:** a new way to roll skill gain overall gets its own document, written next.
- **EG17 a, max 1.25:** the ending factor is the Weaver's part. Every ending's factor is kept between ENDING\_FACTOR\_MIN (0.5) and ENDING\_FACTOR\_MAX (1.25).

**Built:** scenario-end growth (section 3 as answered: EG7, EG8, EG10, EG13, EG17 and the rounds rule), then essences (section 2 as answered; spec Part 1, Essences). The parks proposed as D-226 to D-228 became D-227 (NPCs holding essences), D-228 (a per-skill cap) and D-229 (essence content rows and traits), since D-226 is LF3. One fix to 2.4: the offer margin is d100 + base − 150, which gives the odds the section states (31% at base 80, 51% at 100).

## 11. Skill gain roll

Questions page "Skill Gain Roll Options": https://claude.ai/artifact/86PT4FAa8FPMYCadfmzXi2.

- **SG1 c (Ali, in the thread: "C is nice"):** the improvement roll reads its gain off the tier table. Margin = d100 + (cap − raw − Burden) − 90; Success +1, Great Success +2, Critical Success +3, plus 1 per band past it; raw never passes its cap (100, or 125 tagged). Built (`growthRoll` in src/ruleset/improve.ts; spec Part 1 §6).
- **SG2 a:** natural edges do not move the roll (GROWTH\_NATURAL\_EDGES false).
- **SG3 a:** each skill's own cap is in the roll (GROWTH\_CAP\_IN\_ROLL true).
- **Flaws (Ali, with SG1–SG3):** a flawed skill's cap is 25 lower, 75 (FLAW\_CAP\_PENALTY). Tags and flaws keep no roll advantage: the flawed "2d100 keep the lower" is gone, so every state rolls one d100 and only the cap moves.
- **SG4:** moot with C, which never makes fractions.
