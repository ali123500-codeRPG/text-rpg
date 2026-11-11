# Text RPG Framework — Build Spec v0.6

Nov 6, 2026 · @Ali

v0.6 combines the rules framework (Part 1), the turn engine with Explore mode, scene setup and the actor-control review (Part 2), the HP and body-part system (Part 3), the save data model (Part 4) and gear (Part 5). The open questions at the end must be answered before this spec goes to a build agent; deferred items can wait until after the first build; check-on-release items are settled for now and get reviewed once the game is played. The game is for personal use only: one player, published only as a Claude artifact, with no public release.

## Part 1 — Rules framework (from v0.1)

### 1. How to read this spec

- Treat every rule here as binding. Values marked *placeholder* are tunable config values, not constants.
- Items marked **\[Proposed\]** were suggested during design but not yet confirmed. Build them so they are easy to change.
- Do not invent mechanics beyond this spec. Report any gap as an open question instead.

### 2. Core principle

Skill growth, Burden and Potential are never shown to any agent. Part 2's hard rules govern everything else about what code and Claude each own.

### 3. Character model

Skills are grouped into trees of exactly three. Example only: Tactics = Preparation, Cleverness, Logistics.

**Combat skill trees** (minimum for the first build; skill names are *placeholders*):

- Combat – Arms: light weapons, medium weapons, heavy weapons
- Combat – Ranged: light ranged, medium ranged, heavy ranged
- Combat – Unarmed: strike, grapple, improvisation; they behave the same for now (Part 5 §5). Improvisation is fighting with whatever is at hand: improvised weapons (Part 5 §7) roll it (Ali, 07/11/2026). Every improvised base has two modes (Ali, 09/11/2026): a melee **strike** and a ranged **throw** (the Throw action, like throwing a vase: reach 0 + the throw's +2, combined roll of Improvisation and the ranged skill of its class), the strike rolled with Improvisation. Unarmed skills stand in for both; Arms skills also stand in for the strike and Ranged skills for the throw (`AttackMode.standInFns`, at the usual stand-in share). Natural weapons is a creature-only skill outside every player tree (creatures' natural attacks roll it)
- Combat – Defense: dodge, block
- Fortitude (Ali, 10/11/2026, MB5, MB31, MB32): endurance, resolve; the third slot is open. Resolve has the Morale function (Will group, XP factor Full); it sets max morale and rolls the morale roll (Part 3, Morale).
- Armor – Conventional (Ali, 08/11/2026, AR1–AR3): light_armor, medium_armor, heavy_armor; function armor in the Defense group; blocked for amorphous bodies. What the skill does while worn (AR4) and how it improves (AR5) are parked (D-184); equip requirements will read it (EQ1–EQ7, levels pending).

Endurance sets total HP (Part 3, Total HP). An average fighter has 50 in a combat skill; this is the design reference point. All-XXX perks apply to these trees as to any other.

**Other skill trees** (placeholders; each is its own tree):

- Perception: sight, hearing, and a third skill not chosen yet. Both are tagged with the Sense role.
- Stealth (Ali, 08/11/2026, ST1–ST19): sneaking, combat\_stealth and vanishing. Sneaking and Combat Stealth have the same use, split by engagement: Combat Stealth inside an active engagement or for an attack, Sneaking outside one. Vanishing breaks the sight of someone who already sees you, in or out of an engagement, and counts as a combat skill for the rating. Each stands in for the others at 0.5×. For the character rating, Sneaking counts as a notice skill and Combat Stealth as a combat skill. Renaming, moving or adding skills stays a data edit (a tree lists its skills; a skill's tree is read from that list).
- Speech: persuasion, intimidation, barter. No body-part role.

The trees' skills are designed with character and mob generation. A perception roll uses sight for an event perceived by sight and hearing for one perceived only by sound (the cue from computePerception); when both apply, the higher. Combined checks (sight with hearing) are to be explored later.

**First-build skill list.** The first build has these skills, by id: melee\_light, melee\_medium, melee\_heavy; ranged\_light, ranged\_medium, ranged\_heavy; unarmed\_strike, unarmed\_grapple, unarmed\_natural; dodge, block, endurance; sight, hearing; persuasion, intimidation, barter; plus the class trees (Swordsman: riposte; Slime: tremor). Perception's third skill is left out of the first build; sneaking and combat\_stealth are in. Which trees an actor can use comes from each tree's access rule (Part 4 §4, Skill tree access); the creation screen offers the trees a new swordsman can use. Natural attacks and fallback.attackSkill name one of these ids.

**Skill substitution.** Any roll or check may use another skill that shares a function with the named skill (Skill functions, below) at reduced efficiency: that skill's effective skill × SUBSTITUTE\_EFFICIENCY (0.3, Ali 08/11/2026, F4; perks can raise or lower it). Code computes every candidate and uses only the highest value after efficiency. Example: intimidating with intimidation 20 and persuasion 100 uses persuasion at 30. The named skill counts at full value, and the roll is recorded against the skill actually used.

**Typed IDs** (ID review, Ali, 09/11/2026). Every library ID is a type prefix plus a number, never a name: skills SK, functions FN, groups GR, classes CL, achievements AC, services SV, perks PK (`src/library/perkIds.ts`), items IT (`src/library/itemIds.ts`), skill trees TR (`treeIds.ts`), races RC and body types BT (`raceIds.ts`), NPC templates TP (`templateIds.ts`), and the small tables in `tableIds.ts`: body-part roles RL, healing sources HL, clock rows DU, zone kinds ZK and attack modes AM; each counted from 1 within its type. Agents see perks as `{ id, name }`; a perk move the Parser names instead of giving its id is read as its id. A minted or improvised item's story ID is built from its base item's ID (`IT2_m12_1`, `IT21_i7`); the Parser still names an improvised weapon's base by word (improvised_light, improvised_medium, improvised_heavy), and code maps the word to its item (`IMPROVISED_ITEM`). Body types now carry a display name; the Weaver sees body types as `{ id, name }`. Roles and attack modes carry display names (the `attackModes` table; a natural attack may keep its own name, such as fists). Agents see a weapon's modes as `{ id, name }`, and a mode an agent names instead of giving its id is read as its id (`modeIdOf`); natural attacks are `natural:<AM id>`. The Weaver writes a zone's kind as its ZK id from `catalogs.zoneKinds`. The prefix shows what kind of thing an ID is, so IDs of different types never collide. Ordered scales, tags and categories, body parts, NPC behaviour (activities, routines, routine sets), place kinds and story-world IDs keep their word keys: ordered scales use stable keys plus one names table, tags and categories are fixed string enums, and body parts and NPC behaviour are words the Weaver and Planner write. **Skill IDs** (Ali, 09/11/2026). Every skill's ID is fixed (`src/library/skillIds.ts`, `SK`), never its name, so renaming a skill touches only the names table (`skillNames.ts`). Data and saves store the ID; code refers to skills through `SK` (e.g. `SK.eyesight` = SK14). IDs are never reused or renumbered. A standing defense (dodge/block), a sense function (sight/hearing), an armor weight and a weapon class map to their skill through `DEFENSE_SKILL`, `SENSE_SKILL`, `ARMOR_SKILL` and `CLASS_SKILL`; no skill ID is built from text. Functions and groups have fixed IDs too (`src/library/functionIds.ts`: `FN` FN1–FN10, `GR` GR1–GR7), so a function and a group with the same display name (Defense, Ranged, Stealth, Influence) never share an ID; names live in FUNCTION_NAMES and GROUP_NAMES (functionNames.ts). Agents see each skill as `{ id, name }`, and a skill an agent writes by name or old alias is read as its ID (`skillIdOf`).

**Skill functions and groups** (Ali, 08/11/2026, F1–F8). Each skill's library entry lists its narrow functions, and a skill may have several; stand-ins read functions. Each function sits in one broad group; a 40 perk's +1 and defeat XP read the group. Current list: docs/skill-tags.md. Exception pairs (`CONFIG.NO_STAND_IN`) never stand in for each other even when they share a function: dodge and block (Ali, 09/11/2026). **Sense rolls are function rolls** (Ali, 09/11/2026): a sight roll (stealth contest, ambush notice, Look) rolls the sight function, so every skill with that function counts at full value and the higher effective skill applies (tier multiplier still applies): Eyesight or Tremor for sight, Earshot or Tremor for hearing (`RollRequest.fn`). A function roll marks only the skill that rolled. Its situational modifiers (light, Night Eyes) follow the skill that rolls, not the function (Q3, Ali 09/11/2026): Tremor ignores light.

- Melee group: arms (melee\_light, melee\_medium, melee\_heavy), unarmed (unarmed\_strike, unarmed\_grapple, unarmed\_improvised, unarmed\_natural)
- Ranged group: ranged (ranged\_light, ranged\_medium, ranged\_heavy)
- Defense group: defense (dodge, block)
- Health group: health (endurance)
- Will group: morale (resolve)
- Notice group: sight (sight, tremor), hearing (hearing, tremor)
- Stealth group: stealth (sneaking, combat\_stealth, vanishing)
- Influence group: influence (persuasion, intimidation, barter)
- No function yet: riposte (no effect designed yet), lockpicking

**Skill states** (one per skill):

| State | Counts toward Burden | Affected by Burden | Improvement roll |
| --- | --- | --- | --- |
| Tagged | No | No | 1d100 |
| Normal | Yes | Yes | 1d100 |
| Flawed | Yes | Yes | 2d100, keep lower |

A Flaw is something the character functionally struggles to improve. Near 100 a Flawed skill is effectively frozen; this is intended.

**Limits:**

- 100 is the mortal limit for raw skill. Above 99, improvement happens only on a 99+ roll. Workaround mechanics come later.
- Soft cap on raw skill and hard cap on effective skill. Values and behaviour are *placeholders*.

**Three skill values** (Ali, 07/11/2026):

- **Raw skill:** what training gave. Burden, Total and skill improvement use raw skill only.
- **True skill:** raw skill + perks that raise that one skill by a flat amount and are always on (e.g. a ladder's Training milestone, +5). Ladder milestones and all-XXX perks read true skill. It has no cap of its own, so a ladder's boosts can carry a skill past the mortal limit of 100 toward the 120 and 140 milestones.
- **Effective skill** (computed for every check and roll, in order): true skill → + gear → × the skill's tier multiplier → + combined-check perks → + situational skill perks → apply hard cap → apply conditions.
- **Skill tiers** (Ali, 08/11/2026). Each skill has a tier on the SKILL\_TIERS scale (tier\_0, tier\_1, tier\_2), set in the library. The tier gives the skill's final efficiency multiplier (CONFIG.SKILL\_TIER\_MULT): tier 2 is 1×, tier 0 is 0.5×, and tier 1 is 0.75× (a placeholder). Every skill is tier 2 except the Slime senses skill (tremor), which is tier 0. The rating reads the skill at its tier (X18–X23).

Derived, never saved; the Character page shows true skill, with raw skill beside it when they differ.

Gear is a flat bonus to effective skill unless an item says otherwise. Standard kit (an average fighter's minimum equipment) gives one +25 per roll, shared by all kit pieces: pieces never stack (*placeholder*).

Wounds are no longer part of effective skill: the health-track level and body-part role penalties are a roll modifier type (§4, Combat rolls). They apply to rolls only, never to no-dice checks (settles OQ-15, Ali, 07/11/2026).

**Character fields:** defined in Part 4 §4 (a Core every actor has, plus Progression, Mind and Journal modules). Part 4 adds race, body type and classes.

### 4. Resolution

The dice deal the hand; skills and perks decide what the character can do with it.

**Layer 1 — event roll.** Rolled once per scene, for the player, at scene setup (Part 2, Scene setup). It deals the hand: it decides the who and what of the scene (its event, cast, challenge and gain), not how alert anyone is. Code reads it with a fixed base in place of skill (EVENT\_BASE, *placeholder*, 50):

```
margin = d100 + EVENT_BASE + net modifiers − 100
```

Only three sources may modify the roll, each its own modifier type: perks, gear and statuses (blessings, buffs, curses, debuffs) whose library entry names the event roll. A gear effect counts only when its library entry names the event roll; it may be active while only carried (Part 5 §2). Code reads the player's inventory once, at scene setup step 2. Injury, place, difficulty, skills, terrain and tactics never modify it. With the placeholder base, the totals (d100 + net modifiers) read as follows:

| Total (d100 + modifiers) | Tier (ID) | Stakes |
| --- | --- | --- |
| Under 0 | Critical Failure (−3) | A real challenge with little gain; the harder of the two **\[Proposed\]** |
| 0–24 | Failure (−2) | A real challenge with little gain |
| 25–49 | Near Miss (−1) | A normal event, gain matched to challenge |
| 50–74 | Success (0) | A normal event, gain matched to challenge |
| 75–99 | Great Success (1) | High gain with a matching high challenge |
| 100+ | Critical Success (2) | The biggest gain with the biggest challenge **\[Proposed\]** |

**Natural edges** apply after the bands, clamped at the ends of the scale: a natural 01 drops two tiers, 02–05 one tier, 96–99 raises one tier, 00 two tiers.

**Layer 2 — skill checks.** No dice. Effective skill is compared with the scene's target number. Result is pass or fail only; the margin does not matter. The target comes from the stage plan's challenge grade through DIFFICULTY: none 20, minor 35, moderate 50, major 65, extreme 80 (placeholders). A check passes when effective skill plus situational modifiers is at least the target. The same rule applies to every actor. Wounds don't apply (settles OQ-15). Exception, looking around (Ali, 07/11/2026, Q17): the player's observe action with a notice skill (sight, hearing) is a roll, not a check: d100 with the skill, a scene difficulty modifier (moderate − the challenge grade's target) and the light modifier of the player's zone. Success or better shows everyone in the player's zone and the zones in sight of it clearly.

- **Combined checks:** some perks let a check add several skills, or half of another skill.
- **Gear:** flat skill bonuses from item effects that are active (Part 5 §2–3). They enter effective skill; item stats and the rare noted roll modifiers are read separately.
- **Wounds:** superseded by Part 3, which is the latest for all HP-related items.
- **No critical rolls.** There is no separate AGG-style Critical Roll; Critical Failure and Critical Success are ordinary tiers with no special effects (critical effects are deferred).

**Layer 2b — combat rolls.** Attacks and defenses are rolls, not checks. Both use one function:

```
margin = d100 + SKILL_WEIGHT × effective skill + roll modifiers − ROLL_NEEDED
SKILL_WEIGHT = 0.5, ROLL_NEEDED = 63.5 (placeholders); d100 runs 1–100 (00 = 100)
```

Tiers on margin: below −75 Critical Failure; −75 to −26 Failure; −25 to −1 Near Miss; 0 to 24 Success; 25 to 74 Great Success; 75+ Critical Success. Margins may end in .5; compare exact values.

**Scale keys.** Standing design rule for anything in the code with levels (Ali, 07/11/2026, restated 08/11/2026 NV3): every ordered scale (tiers, band tactics, zone light and cover, stance, noise, visibility, and in turn the others) has one table in `src/scales.ts`: a row per level, lowest first, each a stable key and its display name. Code and saves use only the key, a level's order is its row position, and display names appear only in text for the player and for Claude, so adding or renaming a level edits only the table (Ali, 07/11/2026). Numbers that go with a level (a reach, a modifier) are keyed by the level's key in config, never by its position. Noise, quietest first: silent, faint, hushed, quiet, murmur, normal, raised, loud, blaring, deafening (murmur, raised and blaring added 11/11/2026). Each noise level is a loudness in decibels at 1 m from real references (CONFIG.NOISE\_DB; the library's Noise levels table gives each its reference: faint 20 dB breathing, hushed 30 a whisper, quiet 40 a library, murmur 50 low talk or rain, normal 60 conversation, raised 70 a busy tavern, loud 88 a shout, blaring 100 a hammer on an anvil, deafening 120 a thunderclap). How many zone links it carries, [clear, heard], comes from one equation (perception `noiseReach`): the decibels less 20·log10(metres) (the inverse-square law) less CONFIG.LINK\_SOUND\_LOSS\_DB (12) per link crossed, heard while at least HEAR\_DB (0, the threshold of human hearing) and clear from CLEAR\_HEAR\_DB (25); same zone counts as SAME\_ZONE\_M (1 m) and a link as LINK\_PACES × PACE\_M (8 m). That gives faint [−1, 0], hushed [0, 0], quiet [0, 1], murmur [0, 2], normal [1, 2], raised [1, 3], loud [2, 4], blaring [3, 5], deafening [5, 7]. A perk's `hearingDb` makes every sound that many dB louder for its owner (RD4: Keen Ear 10, the gap between sharp, attentive ears and average ones, about one link farther); silence stays unheard. Visibility, least first: unseen, faint, close, low, normal, high, glaring (NV1–NV6, Ali, 08/11/2026). Each is how far it is made out clearly and glimpsed, in metres, in daylight with a clear view, from real references (CONFIG.SIGHT\_M; the library's Visibility levels table): faint 0.5/2 m a palmed coin, close 6/20 m a nod or an expression, low 15/60 m someone keeping still (where witnesses stop naming faces), normal 25/200 m someone walking, high 50/500 m a fight or someone running, glaring 200/2000 m a fire or a torch at night. Perception measures them in metres (step 2 PR 2, `sightLevel` with position `seeingM`): the straight line with sight from the observer to where the event happened (GameEvent.pos, the actor's point), never less than SAME\_ZONE\_M (1 m); full out to the clear metres, partial out to the glimpsed metres. In a zone without rectangles the same zone counts as SAME\_ZONE\_M and each sight link as LINK\_PACES × PACE\_M metres, which gives the old links (`sightReach`, still in the library table): faint [−1, 0], close [0, 2], low [1, 7], normal [3, 25], high [6, 62], glaring [25, 250]. A still figure (NS2 stealthStart) is kept out to low's 15 m and a look (Q17) makes out figures to normal's 25 m. A dark zone caps sight at partial. **Words carry only by sound** (real distances, 11/11/2026): a line's words reach an observer only when its sound does, and heard clearly (Ali, 11/11/2026, BG-17: a sound heard only partly is a voice without its words; Every Sense One still carries them) (the perception's `heard` flag, `hearsWords`), so a talker seen across a field is seen, not heard; this covers the words shown, what is passed on (told), deals, quest hand-ins, NPC speech rolls at the player and Overheard. A line said beside another action (a bark) is as loud as the louder of the action and the voice. A careful look (Q17) makes out a still figure as far as a moving one (normal's clear reach), and a figure turning stealthy stays seen as far as a still one is made out (low's clear reach). Addressing everyone reaches those who hear a normal voice clearly. Armor weight, lightest first: light, medium, heavy. Worn armor makes body-moving events (move, attack, perk move, break free, pick up) louder by CONFIG.ARMOR\_NOISE\_STEPS noise steps: light +0, medium +1, heavy +2 (placeholders); a stealthy posture doesn't cancel it (AN1–AN4, Ali, 08/11/2026). Tier keys, worst first: critical_failure, failure, near_miss, success, great_success, critical_success. Tier arithmetic (shifts, gaps) works on a tier's level, its row position; a roll shifted past either end keeps the end key plus `beyond`, the steps past it, shown as one + or − per step (Critical Success+). Saves store keys (schema v3; v1 and v2 saves are migrated on load). Schema v5 split hostile from opposed: older saves' opposed becomes hostile, so they play as before, and a logged more\_opposed step becomes colder.

Modifier types (each type diminishes within itself; values per type are deferred):

- Gear and situational skill perks: inside effective skill; flat skill perks: inside true skill (§3).
- Roll perks: flat roll points.
- Gear roll modifiers: rare noted modifiers from items, such as the weapon hit adjustment, at full value (Part 5 §3).
- Wounds: health-track level plus body-part role penalties, plus −5 while an essential part is Crippled or worse, in roll points.
- Situational: flanking, outnumbered, unaware, terrain, range, light, dodge vs missiles.
- Aim: its own type, so it never diminishes with situational modifiers.

**Stacking within a type.** Within one modifier type, bonuses and penalties are ranked separately by size. In each group the x-th largest counts at STACK\_RATIO^(x−1): the largest in full, the second at 0.5, the third at 0.25, the fourth at 0.125 and so on (Ali, 08/11/2026; was: a fourth counted 0). The type's value is the bonus total plus the penalty total. STACK\_RATIO 0.5 is a placeholder. Example: bonuses +6, +4, +2 give +8.5; penalties −8, −3 give −9.5; the type adds −1.

One roll point equals two skill points; write roll modifiers small.

**Tier shifts**, applied after banding: natural edges (01 −2 tiers, 02–05 −1, 96–99 +1, 00 +2) and tier perks. They apply to attack and defense rolls, never to the location roll. There is no clamp: a shifted tier may go past Critical Success or below Critical Failure. Narration and the packet show the nearest of the six named tiers with one + or − per step past the end: ID 3 is "Critical Success+", ID 4 "Critical Success++", ID −4 "Critical Failure−".

**Gap shifts**, applied to the gap (Part 3, Damage flow): heavy weapon vs block −1, cover, and perks that add a tier to block or dodge.

The margin bands stay open-ended: a margin of 75 or more is Critical Success, never more. Only shifts move a tier past the ends.

**Contests.** Every roll with two sides (perception against stealth, an ambush roll against perception, speech against the listener) uses roll() for both sides and is read by tier difference, like the attack and defense gap: gap = the opposing side's tier − the acting side's tier, after tier shifts. The acting side wins below 0, the opposing side wins above 0, and 0 is a tie. ContestResult carries the gap; what a larger gap does is not defined yet. Modifier types are those of Layer 2b except aim, stacked the same way. Wounds reach a roll through the skill's body-part role tags (Part 3, Roles).

### 5. Progression

XP drives levels and perks only. Skills grow separately, through skill improvement (section 6).

- **What XP is: the Thread** (Ali, 09/11/2026, XP lore XL1–XL3). This is backstory: no NPC or agent knows it, and nothing in play shows it (no renamed "XP", no level-up flavor). It is the design lens for deciding what gives XP and why.
  - Every life is a thread in the world's weave. Skills are the body's craft: they grow by use and stop at the mortal limit (100). XP is thread, not practice.
  - Overcoming someone ties the part of their thread that their training wound into yours, so defeat XP is the foe's training effort. Hitting them, or their yielding, is the touch that ties it. A foe that flees, or one downed by someone else, slips away. A thin thread adds little to a thick one (taper). The weave doesn't care whose thread it is, so stance doesn't matter.
  - A great deed knots your own thread: achievement XP.
  - Classes are patterns a thread can follow. A class's top level is a pattern with only so many turns, and its capstone closes it. Banked XP is loose thread waiting for a pattern, and Commoner is the plainest pattern, always open. Unwritten Legend and A Nobody are threads not yet woven.
  - It is felt, never seen (no glowing strings), and nobody can see another's thread. Beyond the mortal limit (D-6) can hang off it: the body stops at 100, the thread doesn't.
  - **Test for any new XP source:** does it overcome someone, so their thread joins yours, or is it a deed big enough to knot your own? If neither, it teaches through skill marks and gives no XP.

- **XP** (Ali, 07/11/2026, XP proposal X1–X10; all numbers *placeholders*, kept small at first). Three sources, each logged on the source trail as {source, amount, turn} (B8):
  - **Defeats (main source).** An NPC pays once (B4), whatever its stance (RS7), when it is downed and the player hit it at least once, or when it surrenders to the player. A broken (fleeing) foe pays nothing. Companions' defeats wait for companion XP. The amount comes from stats only (X18–X23, Ali 07/11/2026; Danger was dropped). Defeat XP reads each skill's **group** (Ali, 10/11/2026: there is no separate XP category): a skill counts in its first group (`groupsOf`), so attack skills count in Melee or Ranged, dodge and block in Defense, endurance in Health, the senses in Notice, stealth skills in Stealth and speech in Influence. Riposte and Blade Dance (formerly Slip Counter) join the Melee and Defense groups directly (D-158) and count in Melee. A skill with no group (lockpicking) counts 0. A skill's training effort is (100 ÷ 3) × ln(100 ÷ max(100 − s, 2)), so high skills weigh more (Part 1 §6); s is the raw skill × its tier multiplier. Within each group the efforts are ranked high to low and count at 1, ½, ¼…. The foe's **rating** is the sum over groups × the group's XP factor. XP factors are an ordered scale (XP\_FACTORS: None 0, Quarter 0.25, Half 0.5, Three quarters 0.75, Full 1; CONFIG.XP\_FACTOR\_MULT), and each group names its level (CONFIG.XP\_GROUP\_FACTOR): Melee, Ranged, Defense and Health Full, Stealth Three quarters (Ali, 10/11/2026), Notice Half, Influence Quarter, Speed None. Melee and Ranged are separate pools, so a foe strong in both counts both in full. **Gear in the rating** (Ali, 10/11/2026): a rating also adds GEAR\_RATING\_FACTOR (0.25) × the coin value of the gear the actor holds and wears (gear coin is priced at about one coin per skill point of power; carried spares and coin don't count). Gear counts on both sides: the player's held and worn gear is part of the player's rating in the taper, like the foe's. **Levels in the rating** (Ali, 10/11/2026, option B): every rating, the player's included, adds LEVEL\_RATING\_SHARE (0.02, a balance lever) × what the XP curve asks to reach the actor's level from 0 (`xpToReach`, the sum of `levelCost` for every step; xpToNext asks the same `levelCost`, so changing the curve changes both). An NPC's level is its template level; the player's is its full character level, free and bonus levels included (Ali). With LEVEL\_XP 100: level 4 adds 14, level 10 adds 92, level 20 adds 382. Kill XP = (foe rating + foe gear rating) × min(1, KILL\_XP\_TAPER (2) × (foe rating + foe gear rating) ÷ (player rating + player gear rating)) × KILL\_XP\_MULT (1, X20). All numbers are *placeholders*, to be tuned later (X19). Example against the recommended swordsman (rating 72): a slime (rating 17, with tremor at 50) gives 7.7 XP, a guard (rating 46) 46.
  - **Achievements**, each with an id and a name, each earned once. Library achievements are a data table that only code awards. Per body type: 1, 10 and 100 defeats (100, 250 and 1000 XP; ids first\_defeat:<type>, defeats\_10:<type>, defeats\_100:<type>; "First Slime Felled", "Slimebane", "Scourge of the Slime Hordes"). Per race (human and elf for now, identical, both humanoid; library NPCs and the player are human until creation offers a choice): the same counts (ids first\_defeat\_race:<race>, defeats\_10\_race:<race>, defeats\_100\_race:<race>; "First of Elfkind Felled", "Bane of Elfkind", "Scourge of Elfkind"). In all: 10, 100 and 1000 defeats (100, 250 and 1000 XP: "Blooded Fighter", "Calamity of a Hundred Blades", "Thousand-Slayer, Herald of Ruin"). Per tree, when enough of its skills (by its rating) reach 50, 100 and 150 (250, 1000 and 2000 XP), one line per tree rating, grander the higher the rating (D-165): normal "Adept / Master / Grandmaster of <tree>", superior "Paragon / Ascendant / Transcendent Sovereign of <tree>", legendary "Chosen of <tree>", "<tree> Incarnate", "The Heavens Kneel to <tree>"; inferior trees earn none. The achievements table is treated like a scale table: saves keep only the row key and what it names, so a rename or a new reward level edits only the table. Each achievement has a reward level, an ordered scale like tiers: 0 50, I 100, II 250, III 1000, IV 2000, V 5000, VI 10000 XP (REWARD_LEVELS in src/scales.ts, XP in CONFIG.REWARD_XP; Ali, 07/11/2026). Names name what was defeated and grow grander with the feat; small feats get tame names (Ali, 07/11/2026). Progression keeps defeat counts per body type and race. New achievements come only from Ali-approved proposals (D-108); Weaver-seeded scene achievements (X7) are dropped (Ali, 07/11/2026). The character sheet lists earned achievements.
  - **Quests** pay XP when done, from their own reward table, separate from achievements (QT9/QT28): 0 50, I 100, II 250, III 1000, IV 2000 XP (QUEST_REWARD_LEVELS, CONFIG.QUEST_REWARD_XP). The level is picked by code from the scene's gain grade when the quest is accepted: minor 0, moderate I, major II, extreme III (CONFIG.QUEST_GAIN_LEVEL); IV is kept for later story quests. A defeat quest's XP is cut by the defeat-XP taper (QX2): min(1, KILL_XP_TAPER × the counted foes' average power ÷ the player's power), each foe's power taken when it fell and the player's at hand-in (QX4), so easy hunts pay little to a strong player. Other jobs are not cut: their reward level already comes from the scene's grade (QX3). Sizing quest XP to the player's level is parked (D-180). See Quests below.
- **Levels.** From level n to n+1 takes LEVEL\_XP × n XP (LEVEL\_XP 100). **Class level cap** (Ali, 09/11/2026): a class's top level is set by its tier: CLASS\_TIER0\_MAX\_LEVEL (5) + CLASS\_LEVELS\_PER\_TIER (5) × tier, at most CLASS\_MAX\_LEVEL (20) (`classMaxLevel`). So tier 0 tops out at 5, tier 1 at 10, tier 2 at 15, and tier 3 and up at 20. When the class the next level would go to is at its top level, no level happens and XP banks (Progression.xp keeps growing). Picking a class with room on the sheet takes every banked level at once (`spendXp`). The default class, **Commoner** (`fallback`), is unlocked for a player whose current class reaches its top level, so banked XP always has somewhere to go. Its capstone (at 5, its top level), **Nobody Special**, unlocks the class A Nobody (ClassDef.unlockPerk). **A Nobody** (Ali, 09/11/2026) is also a starting class (50 points and level 1, like the Unwritten Legend, for now). It gives Quick Study at its level 1 and the capstone **Every Fall a Lesson** at 15, its top level: losing a contest or a defended attack by exactly one tier step marks the owner's rolled skill (and the asked skill when a stand-in rolled), inside the learning window or not. A class perk the character already has is not granted twice. **Alternate capstones** (Ali, 09/11/2026): a class's capstone (ClassDef.capstone, the default) is granted when the class reaches its top level, not at a flat 20. A class can also list alternates (ClassDef.capstones), each with conditions in the tree-access form (Must / Either of / Blocked by), which can name a race, race tag, body type, class level, perk or a true skill (kind 'skill'). When the class reaches its top level, every alternate whose conditions hold at that moment is offered (Progression.capstoneOptions). While an offer stands, the default is granted dormant (inactive). On the character sheet the player either keeps the default, which makes it active (`keepCapstone`), or picks one of the offered alternates in its place (`swapCapstone`); either choice is final. With nothing on offer the default is active at once. The alternates themselves are designed in the capstone thread. There is one XP bar. A level goes to the class picked on the sheet ("Next level goes to", shown when more than one class is current or unlocked), or else to the current class, with no waiting (X9; settles OQ-8). With mechanics shown, the turn lists "+n XP (source)" and "Level n!".
- **Level perks:** one perk point on every even level, spent on perks. Some perks are trade-offs (e.g. give up a skill for a higher cap, faster training and bonuses to class skills); these come later, on their own tab (S6).
- **Skill ladders** (Ali, 07/11/2026, perk page S1–S9): every skill has a perk at each 20 points of true skill: milestones 20, 40, 60, 80, 100, 120 and 140. Reaching a milestone unlocks its perk; taking it costs one perk point (S2). Milestones 20, 60, 100 and 140 give a perk that adds a new ability; milestones 40, 80 and 120 give a perk that raises a number, such as +5/+10/+15 true skill (S5). A perk is kept if the skill later drops below its milestone (S4). **Milestone gating** (Ali, 07/11/2026): a milestone shows only once enough ladder perks have been taken in that same skill: 60 and 80 need one (from 20 or 40), 100 and 120 need two, 140 needs three. Until then it stays sealed like an unreached one. All-XXX perks do not count. **The 20/60/100/140 perks and the 40/80/120 perks** (Ali, 08/11/2026, F1–F5; docs call each by its milestone: "20 perk", "40 perk" and so on). The 20, 60, 100 and 140 perks add an ability; the 40, 80 and 120 perks raise numbers. A 40/80/120 perk has no conditions and gives +5 true skill in its skill, +1 true skill in its skill and in every other skill sharing a function with it (docs/skill-tags.md; "+1 function (including itself)", Ali 08/11/2026), so +6 in its own skill, and one more number: one of the skill's own numbers, or +10 true skill on skills that work well with it (+10 to one, or +5 to two). Numbers stay on theme (light weapons get hit and aim, heavy weapons get damage), and a 40/80/120 perk never repeats what a 20/60/100/140 perk gives. The 40 perks are in src/library/boostPerks.ts; 80 and 120 raise the same number again for now (F3, placeholder). Ladder perks are level perks (OwnedPerk source 'level'). Content is chosen milestone by milestone; the chosen perks and the bank of perks kept for later are in docs/perks.md. **Two views** (Ali, 07/11/2026): every perk has a Story write-up (what a player reads when choosing) and exact Rules (what code applies, the basis for building it), and the two must say the same thing. Both live in src/library/perks.ts, and docs/perks.md is generated from it. On the Perks screen the player switches the perk card between Story and Rules. A perk that is written but not coded yet (built: false) shows both views but can't be taken. Most perks are always on and apply when their condition is met; a few are moves chosen on a turn (G1). **Quirks** (Ali, 08/11/2026, name for now): a perk that is negative in nature is called a quirk (PerkDef quirk: true). None are designed yet. **Innate perks and quirks** (Ali, 08/11/2026): each race can list any number of innate perks and innate quirks (RaceDef innatePerks, innateQuirks). Every member of the race, player or NPC, has them from spawn as owned perks with source 'race'. They cost no perk point, can't be undone and don't count toward milestone gating. The Perks screen lists them under Innate. Human and Elf have none yet. When Human and Elf perks are picked, AGG's origin perks are the models (Ali, 08/11/2026, AGG comparison A4). The Swordsman skill (riposte) is a placeholder and get no perks for now (G2); lockpicking and the slime senses get none either (G3).
- **All-XXX perks** (All-50, All-100, All-150; formerly mastery perks, renamed by Ali on 07/11/2026; the save key stays `mastery`): granted instantly, at no point cost, when enough skills of a tree reach 50, 100 or 150 (by its rating, D-164). All three steps work alike (D-197): the tree's passive for that step plus each of those skills' part (src/library/allPerks.ts ALL_BUNDLES, STEP_PARTS). Once granted they are never removed. They replace the LLtQ category bonus.
- **All-XXX check:** runs only when a skill crosses a threshold upward, and checks whether the other two skills in its tree already meet it. Uses true skill (S9, Ali, 07/11/2026).

With 100 as the mortal limit, the All-150 tier is unreachable through training alone until workaround mechanics are designed.

### 6. Skill improvement algorithm

Runs entirely in code at the end of a training action. Claude has no part in it.

```
At start of resolution:
  Total  = sum of raw skills, excluding Tagged skills
           (Flawed skills count)
  Burden = max(0, floor((Total - Potential) / K))
  Burden is a snapshot: it does not change during this resolution,
  so skills improving in the same training face the same Burden.

For each marked skill:
  Tagged : Target = Skill            ; roll 1d100
  Normal : Target = Skill + Burden   ; roll 1d100
  Flawed : Target = Skill + Burden   ; roll 2d100, keep LOWER

  If roll > Target OR roll >= 99:
     old   = Skill
     Skill += 1d3 (SKILL_GAIN_DIE)
     For each threshold T in (50, 100, 150):
        if old < T <= Skill: run all-XXX check for T

Clear all marks.
```

- **Marks** (Ali, 07/11/2026, "Skill progression: options" SP1–SP11): a use marks the skill actually rolled (SP4) and, when a stand-in made the roll, also the skill the action asked for (Ali, 09/11/2026: both learn, each against its own window, so a skill far below its stand-in can still rise), success or failure, when the opposition is from MARK\_WINDOW (10, placeholder) below the skill's raw value up to MARK\_WINDOW above its true value (SP2; Ali, 09/11/2026, replacing ±10 of raw or true), so true-skill perks widen what teaches you. A skill not on the sheet learns from use too (Ali, 09/11/2026): it counts as raw 0 and joins the sheet with its first gain. Close calls teach too (Ali, 09/11/2026, an "or" with the window): a contest or defended attack whose final tier gap is exactly 0 marks both sides' skills whatever their values. The opposition is a check's target, or the other side's true skill in a contest, attack or defense; notice rolls follow the same rule (SP6). Endurance is marked by a single hit costing ENDURANCE\_MARK\_PCT (10%, placeholder) health or more (SP5). One mark per skill. Only the player keeps marks; NPC progression comes later (SP7).
- **Stacking marks** (Ali, 11/11/2026, SM1): a skill's marks are counted per engagement (or per scene, outside one). The first mark owes an improvement roll, and so does every MARK\_STACK\_EVERY-th mark after it (config, 3: marks 1, 4, 7...). Counts clear when the engagement ends or the scene breaks (SM3).
- **Instant skill-ups** (SM2, on since Ali chose it after playtests 31–32, 11/11/2026; the engagement rules are being reworked in BG-4/BG-5): with SKILL\_UP\_INSTANT on, owed rolls are made at the end of the turn of the mark; the limit above still holds (SM3), and a perk unlocked mid-fight can be taken at once (SM4).
- **When the roll runs** (SP3): at the end of each engagement (a tactical turn after which no one is engaged), and when the scene breaks (rest, story beat or stall), for marks earned outside a fight. A gain shows on the turn's mechanics lines ("Sight 38 → 41", and "New perk unlocked" when a 20 milestone is crossed); failed rolls show nothing and nothing goes to Claude (SP11). Visuals, including a mark dot on the Character page, wait for the designer (SP10). The all-XXX check is not run yet.
- **Training actions** happen only under a tutor; designed later (SP1, SP8). Beyond the mortal limit stays later (SP9).
- **StartingTotal:** sum of untagged raw skills at creation. A record only; it never changes.
- **Potential:** the Total at which Burden begins. Can be changed later by perks or events. At creation it is the fixed POTENTIAL (300, placeholder) for every character. Any character, NPC or player, may carry its own value instead, set case by case: an NPC template's potential, or a value set on one player character.
- **K:** *placeholder*, default 20.

### 7. Player commands \[Proposed\]

Commands are handled by code and do not advance time. There is no /save: the story saves every turn (Part 4 §10), and a full export exists only in the GM debug view.

| Command | Effect |
| --- | --- |
| `/stats` | Show the character sheet |
| `/inv` | Show inventory |
| `/quests` | Show active quests |
| `/undo` | Rewind one turn: the head moves back to the previous bookmark; dice are not rolled back (Part 4 §6) |
| `/help` | Show the rules text and a recap of the events the player perceived; code only, no Claude call |
| `/difficulty` | Change difficulty setting |
| /aim | Marks this turn's attack as aimed. The play screen's Aim toggle does the same. Code only; resets after the turn resolves |

## Part 2 — Turn engine (rev. 2 + Explore mode + scene setup + actor control)

### Role, goal and hard rules

You are building the turn engine for a text RPG that runs as a Claude artifact app. Code owns every number and every fact; Claude calls only interpret, decide intent, voice characters, plan scenes and narrate.

The engine must solve four problems that appear when one model plays both sides:

1. **Omniscient enemies.** Enemies react to the player's current action because the same context saw it. Fix: enemies commit to orders without seeing it (simultaneous turns), and each actor acts only on what it knows.
2. **Leaky narration.** The narrator hints at plans the character could not know. Fix: the narrator never receives hidden information.
3. **Forgotten plans.** An ambush or secret disappears between turns. Fix: hidden state lives in code, and triggers fire without asking a model.
4. **Latency and cost.** Several calls per turn is slow. Fix: parallel calls where the design allows, cheaper models where prose quality doesn't matter, and agents only in scenes that need them.

**Ruleset (do not change its numbers):** skills in three-skill trees in the style of Long Live the Queen, with caps, Tags (+) and Flaws (−); Fallout-style perks (level perks plus all-XXX perks); AGG-style d100 roll-high with tiered results, where the dice set the situation and skill checks mitigate it. Build the ruleset behind the Ruleset interface (Resolution engine): the six core methods for real (Part 2, First-build ruleset), the rest stubbed (each method keeps its signature and returns a fixed placeholder).

**Agents.** Six Claude agents, each with one job:

| Agent | Job | Side |
| --- | --- | --- |
| Agent Parser | Turns player text into structured intent | Player-side |
| Agent Planner | Commits an engaged actor's order before the player acts (background) | Hidden-side |
| Agent Responder | Answers the player as an NPC with a secret or plan (dialogue) | Hidden-side |
| Agent Voice | Answers the player as an ordinary NPC; never sees the hidden store | Player-side |
| Agent Narrator | Writes what the player reads | Player-side |
| Agent Weaver | Plans events, casts and stages at scene setup and stage extension | Hidden-side |

Agent Planner and Agent Responder both read OppositionView; each has its own prompt. Agent Responder and Agent Voice are the dialogue calls: one per addressed spokesperson, after the Parser.

**Hard rules**

- No model computes a roll, sets health, adds an item or decides success. A model's output is a request; the engine decides.
- The player and every NPC go through the same roll code. No player-only resolution path.
- No agent receives anything its character could not know. Views are built deny-by-default. Nothing from state.hidden reaches Agent Parser, Agent Narrator or Agent Voice.

### Architecture: one turn

Only code ever sees every agent's input and output. Planner calls run in the background between turns, before the player submits. In dialogue turns the addressed actors' dialogue calls run after the Parser, because spoken words are meant to be heard. Speech is an action: talking takes the turn's main action, for the player and for every NPC.

#### Tactical and explore turn

1. After turn N is saved, code computes turn N+1: its mode, the triggers that fire at its start, and its engaged significant actors (state.pending). If the player's zone links to a frontier with no held extension, code also starts that frontier's background Agent Weaver call (Stage extension).
2. Each engaged significant actor's Planner call starts at once, in the background, with that actor's OppositionView built from saved state, up to MAX\_PLANNER\_CALLS. Explore has no engaged actor, so it runs no Planner.
3. On submit, Agent Parser receives the player's text and PlayerView. Resolution starts once the Parser returns, and never before the previous display plus BACKGROUND\_WINDOW, in every mode. An actor whose Planner call isn't back by then uses its type's combat list this turn (Fallback behavior).
4. Code validates every output. If the Parser returns a clarify question, the turn stops and turn is unchanged. Planner outputs are kept, because state hasn't changed, and apply once, when this turn resolves.
5. The engine builds every active actor's ActorView, then merges the Parser's intent with one order per actor, in this priority: fired triggers, broken actors' Flee orders (Part 3, Morale), agent orders (dialogue call, else Planner), onAlert orders, routine orders (not engaged) or combat-list orders (engaged); rolls, applies effects, and records who perceived each event at the moment it happens.
6. If this turn called sceneBreak, or the player moved into a frontier, scene setup or stage extension runs now, before the save (Scene setup).
7. The story is saved (Part 4 §10), including plan updates and this turn's logged agent inputs and outputs.
8. Code builds NarrationView from the events the player perceived.
9. Agent Narrator writes the full narration and lists the events it covered; the leak scan and fact check run; then the text is shown. No streaming.

#### Dialogue turn

A turn is a dialogue turn when the Parser's main action is a speech action (talk, persuade, deceive, intimidate, barter) addressed to one or more NPCs.

1. The Parser parses the player's text and lists the addressees: named actors, a band, or everyone in earshot.
2. Code picks one spokesperson per addressed band: the named member; else the sticky partner (the NPC the player last spoke with this scene) if it is an active member of that band in reach; else the band's nearest addressed member, ties by actor id. When a band is addressed without a name, no partner of it is in reach and the player can see more than one of its members, code asks "Who do you speak to: A or B?" naming only people the player can see, with no Claude call and no turn spent (OQ-27, answered 07/11/2026). At most MAX\_SPOKESPEOPLE (config, placeholder) bands get one, in the order the player's words name them; members of other bands only hear the words. Inactive actors are never picked.
3. Exchange slot, part 1: the engine resolves the player's speech. A speech check is the speaker against the other side: one roll by the player with the action's speech skill, contested separately against each spokesperson's roll with the same skill (read by tier difference, Part 1 §4, Contests). Talk and persuade use persuasion; deceive uses Lying, answered with Insight; intimidate uses intimidation; barter uses barter. Each earlier try of the same kind at the same listener this engagement costs the speaker −15 (D-154). Any of them may be substituted by another speech skill (Part 1 §3, Skill substitution). The speech event is perceived like any other event. Winning counts toward check\_passed secret reveals, sets prices with a seller (D-93), and leaves the listener Shaken or Swayed (D-154). NPCs speak to the player with a roll the same way, through persuade, deceive, intimidate or barter (D-154).
4. One dialogue call per spokesperson runs in parallel: the Responder if that spokesperson has an agenda, else the Voice. Each receives its own view plus only this turn's spoken words and its impression (Dialogue input, below). Each returns its one action for the turn: a reply (a talk action) or any other main action.
5. Exchange slot, part 2: spoken replies resolve right after the player's speech, in initiative order. A spokesperson that chose another action resolves it at its own initiative in step 6.
6. resolveTurn runs for every other actor and for the spokespeople's other actions, as in step 5 of the tactical turn; then steps 6 to 9 of that turn run.

Rules for dialogue turns:

- **Planner calls:** an addressed spokesperson's background Planner call is cancelled once the Parser returns a dialogue intent, never on a clarify question; a result that arrives anyway is logged as unused. Engaged actors elsewhere keep their Planner calls.
- **Triggers:** a turn-start trigger fired for a spokesperson is shown to its dialogue call as already committed. The trigger's order is its action, and the call's line is kept only as a bark. A mid-turn trigger may replace a spokesperson's other action before it resolves; a reply already spoken stands.
- **Barks:** words spoken alongside a non-speech main action are a bark, not speech, and make no dialogue turn.
- **Calm bandmates \[Proposed\]:** when a spokesperson's output switches its routine, calm, code-run bandmates who perceived the exchange switch to the same routine next turn. A bandmate switches only if that routine id is in its own routines list and every slot the routine reads is bound for it; otherwise it keeps its routine and code logs routine\_skip. Engaged bandmates decide through their own Planner or combat list.
- **Timing:** dialogue results are shown no earlier than DIALOGUE\_WINDOW (config) after submit, set at or above the Responder's usual latency, so guarded and ordinary NPCs answer in the same time.

#### Dialogue input

A dialogue call receives, from this turn, only the words the player spoke and one impression per speech action: how convincing it sounded (talk, persuade, deceive, barter) or how threatening it felt (intimidate). It never receives the player's action type, any non-speech check, the player's move, approach, stance or deferred actions. The impression comes from the player's tier; the listener's roll decides only who wins the contest. Code maps the tier to fixed words (table below; wording is a placeholder). No tier names, no numbers.

| Player's tier | Convincing (talk, persuade, deceive, barter) | Threatening (intimidate) |
| --- | --- | --- |
| Critical Failure | insulting, plainly false | laughable |
| Failure | unconvincing | unimpressive |
| Near Miss | doubtful but possible | unsettling |
| Success | convincing | threatening |
| Great Success | very convincing | frightening |
| Critical Success | completely convincing | terrifying |

The tier names are the six tiers of Part 1 §4; the ruleset still owns them.

### Action economy

Settled by Ali 07/11/2026 ("Action economy: options", AE1–AE12; settles D-19, D-60, D-83).

- **Slots (AE1).** A turn is one move (a walk: 8.4 m for an unarmored human), one main action, and free things: gear ops, defenses (each after the first in a turn takes the outnumbered modifier) and barks. Perks and class skills change a slot: add one, swap one, or make one free. A fight turn stays 6 seconds whatever it holds (AE12).
- **Ranged (AE1, ZP3).** A ranged attack (a shot or a throw) costs the main action and CONFIG.RANGED\_MOVE\_SLOTS move slots (1) by default. If the attack reaches from where the actor stands, it takes its move slot first and a move goes only on the move slots left (with one move slot the move is dropped: move\_dropped, ranged\_attack); otherwise the move stands and the attack is dropped. Shoot and Move (B4, banked) would lower the cost.
- **Action slots (CO13).** Each actor gets CONFIG.MOVE\_SLOTS move slots (1) and CONFIG.MAIN\_SLOTS main slots (1) a turn (engine actionSlots, the one place a perk or body type would add slots). A movement spends a move slot first and, when no move slot is left, a main slot, but only when no main action is planned. How far a slot goes comes from real speeds over the Fight turn duration (6 s, engine/speed `slotMetres`): a move slot walks and a main slot spent moving (a dash: the move costs both actions) runs the rest of the turn. Speeds (RD7, `moveSpeed`) come from the body type (`BodyType.speed`, m/s): humanoid walk 1.4, run 5 (a run in kit); winged quadruped 1.8 and 12 (a horse on the ground); amorphous 0.5 and 1 (placeholder). Worn armor slows both: a flat m/s off, then a share off what is left (`armor.speed`, default CONFIG.ARMOR\_SPEED by weight: light 0 and 0%, medium 0.1 and 5%, heavy 0.2 and 15%, placeholders), and a movement speed factor (`speedFactor`, 1 today) multiplies the result for later perks, statuses and mounts. An unarmored humanoid walks 8.4 m and a dash adds 21.6 m: 30 m in all. Without zone rectangles a fresh slot always crosses at least one link. An actor with more move slots walks farther.
- **Dash (AE2).** Anyone (player or NPC) with no main action whose move hasn't reached its zone when the move slot runs out spends the main slot to run on. A Crippled or Destroyed part with the move role stops a dash (dash\_blocked), and so does Leg Bolt's slow.
- **Order (AE3).** The move comes first unless the Parser marks it `after` ("strike, then step back"). NPCs keep move first for now (parked as D-185: the Planner would need the same field).
- **Extra attacks (AE4)** come only from perks and class skills (Flurry: a second attack at tier shift −1), never from a high skill alone.
- **Free actions (AE5)** stay as above; a perk can make one action free a limited number of times per engagement (Dirt in the Eyes).
- **Readying (AE6)** is a perk move (Held Shot), not something everyone can do; anyone can still hold.
- **Speech (AE7)** in a fight stays the main action; a free one-line remark is a perk (Quick Word); barks persuade no one. With Quick Word, a one-sentence line said beside a non-speech action in a fight is an exchange like talk (same spokespeople, contest and dialogue calls), but the player's action still resolves in turn order; each spokesperson's spoken reply is free too, and the action its dialogue call chose still resolves in turn order.
- **Perk moves (AE8)** (Plead, Battle Cry, Buy Them Off) are main actions of their own type: the Parser picks an owned one by name (its perkMove), and Commands and Ideas list the ones the player has. A free perk move (Dirt in the Eyes) rides beside the move and the main action and resolves just before the main action; one that fails its conditions is dropped (perk\_move\_dropped).
- **NPCs (AE9)** use the same slots and perks. The Planner still returns one move and one action; an extra slot with no choice in it (Flurry's second attack) is filled by code, and one with a choice gets a Planner field the NPC fills only when it owns the perk.
- **Armor (AE10):** putting armor on or off stays one main action. **Criticals (AE11):** "lose your next action" means the next main action.

### Game state model

The save is the set of pages defined in Part 4. On load, the engine builds one in-memory GameState from those pages; it is never saved as one document. Everyone is in a zone and stands at a point in metres in it (step 2, below). Each zone belongs to one place, and the stage may hold zones from several places. Knowledge lives on the observer: the guard's belief about the player is `guard.mind.knowledge.player`, and it can be wrong.

```ts
type Perception = 'full' | 'partial';
type Cue = 'sight' | 'sound' | 'smell' | 'touch';

// In-memory working state, built from Part 4's pages on load
type GameState = {
  storyId: StoryId;
  turn: number;
  mode: 'explore' | 'dialogue' | 'tactical';
  zones: Zone[];                // the stage: zones loaded now, possibly across several places
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
  tactics: 'simple' | 'competent' | 'cunning';   // TACTICS keys
  lethal: boolean;   // set when the band is made, default true; an existing band keeps it (Part 2, Agent Weaver)
  relations: Record<string, 'hostile' | 'opposed' | 'neutral' | 'friendly'>;  // default stance toward other bands
};

// What a zone is (Z1–Z5, Ali, 08/11/2026): one open space with nothing in the way inside it, where anyone can reach anyone
// else in a step or two, at most about a room (5 to 10 paces) across. A barrier (wall, counter, door, gate, steps) or more
// distance starts a new zone, so every link is about one room of distance. A bigger space (a square, a field, a hall) is
// several zones of the same kind joined by sight links. There are no positions inside a zone. Every Weaver zone names a
// zone kind from the library (zoneKinds: room, corridor, stairs, cellar, street, square, gate, yard, field, woods); the kind
// fixes indoor or outdoor and gives the default cover and light, which the plan may change. An unknown kind is a bad_zone.
// Height: a zone's height is metres above the ground outside (0 when unset). Stairs change height, never distance north,
// south, east or west. The Weaver may give it; when it doesn't, code infers it from the exits (src/scene/heights.ts): a
// link whose words go up (up, upstairs, loft, roof...) climbs CONFIG.STOREY_HEIGHT (3 m, placeholder), one that goes down
// (downstairs, cellar, below...) drops it, any other keeps it; a bare "up" or "down" counts only beside a way to climb
// (stairs, steps, ladder, hatch...), so "down the street" stays level (BG-6); a story's first zones stand at 0. The Map page shows
// one height (floor) at a time, with floor buttons and stair badges, and zones on other floors straight above or below.
// Metres (CO1–CO19, Ali, 11/11/2026; step 1, no rule reads these yet): the range unit is the pace, CONFIG.PACE_M (1 m,
// about one stride; 1.5 m until 11/11/2026), with CONFIG.LINK_PACES (8, so a link stays about 8 m) converting today's link-based tables. A zone's area is m²: the Weaver
// gives a size word (ZONE_SIZES cramped 9, small 25, room 60, hall 225, yard 400, open 1,600, vast 10,000; CONFIG.ZONE_SIZE_M2,
// placeholders) or area in m², else the kind's default size. Each library zoneSizes row names a real or fantasy reference.
// Each side (n, e, s, w by map compass) has an edge kind from the library's edgeKinds table (EK1 wall, EK2 open, EK3 low:
// counter or fence, EK4 window; a new kind is a new row with walk/see/reach/climb flags); indoor kinds default to wall,
// outdoor kinds to open, and the Weaver gives edges only for a side that differs. An unknown size or edge kind is a bad_zone.
// Placement (CO1 B, src/scene/geometry.ts placeZones): code, never Claude, gives each new zone a rectangle (Zone.rect, metres:
// centre east/north, w east-west, d north-south) of its area at its kind's aspect (corridor and street 4:1, stairs and gate
// 2:1, else square), touching the zone it links to on the side its exit's compass word names (else the first free side),
// lined up with that zone's centre or either end, sliding outward only when all are taken. Zones up or down stairs sit
// straight above or below. doorway() is the middle of a shared wall (CO3). The Map's "Draw to scale" button draws the
// rectangles at 12 px a metre, each side by its edge kind, with a 10 m bar in metres and paces.
// Layouts (CO7, CO17; src/library/layouts.ts, typed ids LY): a common building's zones, sizes, sides and exits, prebuilt.
// A plan place may name one ("layout": LY id from catalogs.layouts, optional "names"/"looks" by the layout's zone keys);
// code adds its zones as placeKey.zoneKey (not counted against the zone cap) and places them like any others. The Weaver
// links its own zones to placeKey.<entry>. An unknown layout is a bad_place. LY1 village tavern (common room with a counter
// on its north side, behind the counter, kitchen, back yard, upstairs landing, cellar), LY2 cottage, LY3 shop, LY4 smithy
// (open to the street on its south side), LY5 gatehouse. A building type may have several; a new layout is a new row.
// Positions (step 2, ZP1–ZP6, src/engine/position.ts): everyone stands at a point (Actor.pos, metres in the rectangles'
// frame). Code places them (placeAll, at scene setup and each turn's start): anyone whose point is missing or outside its
// zone gets the zone's centre, else the nearest free point on a CONFIG.PLACE_GAP_M (1 m, arm's length) grid around it.
// Distance (distM): a straight line when there is sight between the zones (the same zone, or a path of sight links;
// sightDistM, which attacks use: a blow or shot never goes round a wall), else the walking path through the doorways,
// adding any climb. A move walks one leg at a time (walkLeg): to the next zone's doorway, then on; a move to a zone ends
// CONFIG.ENTER_M (1 m) past its doorway. A zone with no rectangle (a hand-built test world) is a point, and each link costs
// LINK_PACES × PACE_M metres, as before positions. The narration and views carry metres (a move's `metres`, a seen
// actor's distanceM). PR 2 moves sight and sound to metres; PR 3 the hostile-within-2 m shot rule and the aura. Step 3
// is travel along a road that is one long zone (CO18, its own deep dive).
// Roads (TV3, TV4): a road between places is ONE zone of the road kind (ZK11), however long. The Weaver gives it a length
// (a ROAD_LENGTHS word: a short walk 0.5 km, half an hour 2, an hour's walk 4.5, half a day 15, a day's walk 30, two days
// 60, CONFIG.ROAD_LENGTH_KM; or km) and a danger (ROAD_DANGERS: safe, quiet, wild, dangerous; the chance per hour that
// something meets you is CONFIG.ROAD_ENCOUNTER_PCT 2/4/8/15 %, placeholders). Code makes its rectangle that long and
// ROAD_WIDTH_M (4 m) wide. Left out: an hour's walk, quiet.
type Zone = { id: string; placeId: PlaceId; name: string; look: string;   // look: public text
              links: ZoneLink[]; cover: 'none' | 'some' | 'heavy'; light: 'bright' | 'dim' | 'dark';      // zone ids unique within a story
              height?: number;                                           // metres above the ground outside
              rect?: Rect;                                               // set by code (placeZones): metres on the map
              area?: number; edges?: Partial<Record<'n' | 'e' | 's' | 'w', string>>; // CO16 m², CO15 edge kind ids by side
              danger?: 'safe' | 'quiet' | 'wild' | 'dangerous';          // TV4 roads only (ROAD_DANGERS)
              groundItems: ItemInstance[] };                             // Part 5 §4
type ZoneLink = { to: string; label: string; sight: boolean; frontier?: true };
                                                   // label: how the linked zone reads from here, e.g. 'left of the gate'
                                                   // sight: true = actors here can see into `to` [Proposed]
                                                   // frontier: `to` names an area not yet built

type Belief = {
  status: 'unaware' | 'suspicious' | 'aware' | 'tracking' | 'hunting' | 'engaged';   // AWARENESS keys (src/scales.ts)
  lastKnownZone?: string;
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  closedTurn?: number;          // YD6: last turn either side attacked or closed in, which keeps hunting and engaged alive
  revealed: string[];           // facts learned about the other actor, e.g. 'has_crossbow'
};

type Fact = { id: string; text: string };

type GameEvent = {
  id: string; turn: number; actorId: string;
  kind: string;                 // 'attack', 'move', 'hide', 'speak', 'call_help', 'alarm', 'arrival', 'presence', ...
  zone: string; target?: string;
  tier?: Tier;                  // absent for actions with no check, such as a plain move or speech
  effects: Effect[];            // structured; text is built per view, never stored
  noise: NoiseKey; visibility: VisibilityKey;   // NOISE / VISIBILITY keys (src/scales.ts); reach per level: noiseReach (from CONFIG.NOISE_DB), CONFIG.SIGHT_M metres from `pos`
  pos?: { x: number; y: number };               // where it happened (the actor's point, step 2); absent = the zone's centre
  perception: Record<string, { level: Perception; cue: Cue }>;   // absent = not perceived
  bark?: boolean;               // speech flavor only: narrated, copies no belief, left out of every NPC view
};

type Effect = { kind: string; actorId: string; data: Record<string, unknown> };
```

The actor fields Part 2 relies on live in Part 4's sheet: control, morale, knowledge, knows, overrides, routine, routines and alarm in Mind; bandId, posture and label on the Actor itself; secretsKnown and namesKnown in Journal. hasAgenda is derived, never stored: an actor has an agenda when it holds a secret, has a plan or has a memory note. It is computed when a dialogue call is routed, from turn-start state.

Routines, routine sets, activities and durations are library content, not saved state **\[Proposed\]**. The routine bank is the only source of routines. Claude drafts entries offline from a brief the designer sets; the designer edits and approves them; the import validator checks them; only the designer promotes them to the library. Agent Weaver picks one routine set per actor by id and binds its slots to zones; it never writes routines. An actor's saved state holds its set's routine ids, its slot bindings, and its current routine with its anchor (Part 4 §9).

```ts
type RoutineSet = {                       // the bank entry Agent Weaver picks
  id: string;
  brief: string;                          // one line for the Weaver
  tags: { place: string[]; role: string[]; time: ('day' | 'night' | 'any')[]; event: string[] };
  slots: Record<string, { kind: 'zone' | 'route'; hint: string }>;   // hint: one line for the Weaver
  routines: string[];                     // [default, ...others]; becomes Mind.routines
};
type Routine = {
  id: string;
  brief: string;                          // one line for the Planner, Responder and Voice
  kind: 'schedule' | 'follow' | 'wait';
  loop: boolean; steps: RoutineStep[];    // schedule only
  activity?: string;                      // follow and wait only
  alert?: string;                         // this routine's alert variant; listed in the same set
  onAlert: OrderTemplate | null;          // one order, fired once on alarm
};
type RoutineStep = { slot: string; duration: DurationId; activity: string };
                                          // a route slot expands to one stop per bound zone
type DurationId = 'brief' | 'short' | 'medium' | 'long';   // turns per id: DURATIONS (config, placeholder)
type ActivityDef = {
  id: string;
  look: string;                           // public text, e.g. 'dozing on a stool'
  attention: 'alert' | 'normal' | 'distracted' | 'asleep';   // a situational tag; the ruleset owns its value
  noise: NoiseKey; visibility: VisibilityKey;
};
// Tag values come from the library tag catalog. Slot names: see Slots, below.
```

A routine is a desired-state function: from the turn number and the actor's own ActorView it gives a desired zone and activity.

- **Schedule.** Code first expands the steps: a step that reads a route slot becomes one stop per zone bound to that slot, in order, each with the step's duration and activity. The desired step is found from (turn − anchorTurn) through the expanded steps' lengths (DURATIONS), looping if loop is true, else holding the last step. The desired zone is the actor's binding for the step's slot.
- **Follow.** The zone where the actor believes the player is (its lastKnownZone, never the truth), with the routine's activity.
- **Wait.** The zone bound to the actor's here slot, with the routine's activity. Code writes here when the actor switches to a wait routine.

Nothing is resumed: when control returns, the actor reads its desired state for the current turn.

**Slots \[Proposed\].** Slot names belong to the actor, not to a routine: one binding per name, shared by every routine in the actor's routines list. A zone slot holds one zone id; a route slot holds 1 to MAX\_ROUTE\_ZONES (config, placeholder) zone ids; the here slot is written only by code. Shared routines, used by more than one set, read only the standard slots post, route, refuge, exit and here. A set may add its own slot names for its own routines.

**Anchors \[Proposed\].** Code sets every anchorTurn; no agent sets one.

```
At install, with the Weaver's startAt:
  anchorTurn = currentTurn − (turns of the expanded steps before the first step that reads the startAt slot)
At install, without startAt:
  looping schedule: anchorTurn = currentTurn − rng.int(0, loopLength − 1)   // seeded; replay is exact
  otherwise:        anchorTurn = currentTurn
On a switch to another routine: anchorTurn = currentTurn
On a calm return:               the anchor saved in returnTo (Explore mode: Alarm)
```

**Companions \[Proposed\].** Every player-band member uses the library set companion: follow (the default) and wait, each with an alert variant. All four have onAlert null, so an alert never makes a companion shout during stealth play. A player-band cast entry names this set and binds no slots.

Tier comes from the ruleset. Health and body parts are Part 3's health track and per-body-type parts (SavedCondition, Part 4).

```ts
type Tier = 'critical_failure' | 'failure' | 'near_miss' | 'success' | 'great_success' | 'critical_success';   // keys of TIERS (src/scales.ts), worst first; names only via tierName()
```

Six views are built from state:

| View | Sent to | Contains | Never contains |
| --- | --- | --- | --- |
| PlayerView | Agent Parser | Player sheet, current zone, zones and actors the player perceives | Hidden store, NPC beliefs, unperceived actors |
| ActorView | Code minds: routines, combat lists | The same fields as OppositionView, as structured data | The same as OppositionView |
| OppositionView | Agent Planner and Agent Responder, one per actor | That actor's condition and position, its beliefs, events it perceived (including the last few exchanges it heard), what it was told, its own last few spoken lines (SAID_LINES, so it does not repeat itself), its plan and memory note, its own secrets, its band's goals and relations; the brief of each routine in its routines list | This turn's player input (a Responder gets only the dialogue input), other actors' private knowledge, the player's true zone unless perceived, the player sheet beyond revealed, place facts and headlines, barks |
| DialogueView | Agent Voice | ActorView minus plan, memory list and agreements, plus its knows facts and the dialogue input | Hidden store, other actors' knowledge, place facts and headlines, barks |
| NarrationView | Agent Narrator | This turn's events the player perceived, with level and cue; player condition; visible surroundings; NPC lines the player heard; public stage text only; a label for each actor whose name the player does not know; the activity look of each actor in a presence event | Hidden store, NPC plans and beliefs, unperceived events, any number from a roll, damage, a pool or HP (code shows them in the mechanics panel); the tier, grades and hidden stage-plan fields; any tone hint from the tier |
| WeaverView | Agent Weaver | Tier and stakes group; the place or frontier being planned and its ancestors' headlines; the stage's zones; actors on the stage with their plans and secrets; quests, flags, band goals; player level, current class, health-track level; the previous Weaver note; catalog ids, including routine sets with their brief, tags and slot hints | Skill growth, Burden, Potential; this turn's player text |

OppositionView is ActorView plus prompt formatting. It serves allies and companions as well as enemies; the name is kept for continuity. Place facts and headlines (Part 4 §5) go only to PlayerView, NarrationView and WeaverView. NPCs learn only through perception, communication events and their knows list. Build every view deny-by-default: copy whitelisted fields into a new object. Never copy full state and delete fields from it, because a field added later would leak silently.

Gear in views follows Part 5 §8: each actor sees its own inventory by name, kind, slot and mode ids; on actors it perceives fully it sees held items, shield and armor by public look, accessories only when tagged visible, concealed items only once revealed, and never stowed items; it sees ground items in perceived zones. No view holds a gear number.

### Information model

Each actor knows only what it perceived itself, plus what reached it through a communication event the engine resolved. There is no band-wide knowledge. A bark is not a communication event: it copies nothing.

**Communication events.** Speech (whisper, normal, shout), call\_help, alarm and a face-to-face report are ordinary events. They are perceived by volume and zone links like any other event. When an actor perceives one, code copies the sender's belief to the listener:

- source becomes 'told'.
- status is capped at 'suspicious'; being told never makes an actor 'aware' or 'tracking'.
- lastKnownZone and lastSeenTurn are the sender's values at the moment of sending, so passed-on information is dated and can be stale.
- No model is involved in passing information on.

**Belief decay.** Code lowers a belief one step when lastSeenTurn is older than a config value: tracking → aware → suspicious → unaware. The step lengths are engine config (DECAY\_TURNS), not ruleset numbers. Without decay, actors never calm down and the game never leaves Tactical.

**Hunting and engaged** (YD6 B, Ali, 11/11/2026; BG-4, BG-5). Two awareness states sit above tracking. **Engaged**: the two traded blows. A real (not sparring) blow engages the attacker with its target, and the target with the attacker once it knows who struck (at least aware; a shot from hiding leaves it suspicious). The target's bandmates who perceived the blow and know who struck become engaged with the attacker too. **Hunting**: a hostile that knows where someone is (aware or better) and moves closer to them (into a zone nearer them, or a step inside one zone that closes in on them), before any blow. Both stay up while either of the two keeps attacking or closing in on the other (Belief.closedTurn). They drop to tracking after CONFIG.ENGAGEMENT\_END\_TURNS (3) turns in which neither did, and ordinary decay takes over from there (src/engine/engagement.ts noteFighting, run each turn after the blows). Seeing someone never lowers hunting or engaged. **Being in a fight** means hostile and engaged, either way round (fightingWith). The player holds no beliefs, so a fight with the player is read from the NPC's belief about the player. A fight engagement counts on the turns either side attacks or closes in, so the quiet turns that drop engaged also end the engagement: a fight you walk away from ends ENGAGEMENT\_END\_TURNS turns later, even if the foe stays hostile and aware of you (BG-5). Tactical mode still starts as soon as a hostile is at least suspicious of someone (isEngaged), as before.

**Bandmates together, the band apart** (YD7, Ali, 11/11/2026). A band's members who each perceive the other right now (in sight, or close enough to hear a faint sound) are together. Members apart act as the band's faction: same friends and enemies, but a deal one of them makes on the spot binds only those together with it. Band membership (bandId) is permanent; only code changes it. Affiliations and larger groups are parked (D-196).

**Stance.** stance(a, b) = a's override for b if it has one, else the relation of a's band to b's band; same band is friendly. The stance scale, coldest first: hostile, opposed, neutral, friendly (Ali, 07/11/2026). **Hostile** attacks on sight: it engages, attacks, chases, blocks rest and counts for the crowded-zone modifier. **Opposed** is at odds but never strikes first: an opposed actor is wary, so its onAlert fires when it notices the other, but it does not engage, attack or chase. Code sets a's override to hostile toward an attacker when a perceives an attack on itself or a bandmate. The Planner, Responder or Voice may request a one-step change of its override toward an actor whose speech it perceived since its last call; the engine applies it (friendlier or colder, one step on the stance scale).

### Who thinks for each actor

Every actor gets exactly one order per turn, from the first controller in this order that has one: fired trigger > broken (Part 3, Morale) > agent (Planner, Responder or Voice) > onAlert > routine (desired state) for an actor not engaged, or its type's combat list for an engaged one (Fallback behavior). An inactive (incapacitated) actor gets none. Significance (control: agent or code) only decides who thinks when the actor is engaged.

| Actor this turn | Controlled by | Notes |
| --- | --- | --- |
| Inactive (incapacitated) | Nothing | No order, trigger, routine or reply; a revived actor is active again next turn |
| A trigger it owns fired | The trigger's order | Overrides everything below; when several fire, the first in plan order wins |
| Addressed spokesperson | Its dialogue call: Responder if it has an agenda, else Voice | Its Planner or combat-list order is discarded this turn |
| Significant and engaged | One Planner call | Engaged = active, and believes (suspicious or higher) in an active actor it is hostile to |
| Minor and engaged | Its type's combat list (Fallback behavior) | \[Proposed\] |
| Over the call cap | Its type's combat list | \[Proposed\] |
| First leaving unaware of a wary actor (opposed or hostile toward it), or first perceiving an attack or alarm | Its routine's onAlert order, once | Then the alert variant of the routine it was following, until DECAY\_TURNS pass with no attack or alarm perceived; then it returns to the routine saved in returnTo. |
| Not engaged | Its routine's desired state | Even during a Tactical turn; companions default to follow |
| No valid order | Engaged: its type's combat list. Not engaged: its routine's desired state | Failed or late calls, dropped orders |

Every code mind, combat lists included, reads only its actor's ActorView, never GameState.

**Call cap.** At most MAX\_PLANNER\_CALLS Planner calls run per turn (config). Engaged actors beyond the cap run their type's combat list (Fallback behavior), the same one minor actors use \[Proposed\]; actors nearest the player get calls first. Dialogue calls are outside this cap; spokespeople are capped by MAX\_SPOKESPEOPLE. The values and the ordering rule are still to be reviewed (D-18).

**Control by actor and state.** Who controls each kind of actor in each state:

| Actor | Calm | Alarmed (not engaged) | Engaged | Addressed | Incapacitated |
| --- | --- | --- | --- | --- | --- |
| Player | Parser, after submit | Parser | Parser | Not applicable: NPC replies reach the player as perceived events | Flagged: a story branch (deferred) |
| Significant actor (control: agent) | Routine, at resolution | onAlert once, then its alert routine | Planner, in the background before submit; over the cap or late: its type's combat list | Responder if it has an agenda, else Voice, after the Parser; returns its one action; its Planner is cancelled | Inert |
| Minor actor (control: code) | Routine | onAlert once, then its alert routine | Combat list, at resolution (Fallback behavior) | Responder or Voice, as above; its combat-list order is discarded | Inert |
| Companion (player-band member) | Follow or wait routine | onAlert once, then its alert routine | Planner or combat list, by significance | Dialogue call, as above: you command a companion by talking to it | Inert |
| Guarded NPC (agenda, not engaged) | Routine plus its own triggers | onAlert once, then its alert routine | As significant or minor | Responder | Inert |
| Ordinary NPC or bystander | Routine | onAlert once, then its alert routine | Only once hostile (attacked, or persuaded into it): Planner or combat list | Voice | Inert |

In both tables, "its alert routine" means the alert variant of the routine the actor was following (Routine.alert). An actor whose routine has none keeps that routine.

In every row a fired trigger replaces the actor's order at turn start, or mid-turn if the actor hasn't acted; for an addressed actor, its dialogue call still runs and its line is kept only as a bark. Every controller reads only its own actor's view: OppositionView for the Planner and Responder, DialogueView for the Voice, ActorView for code minds and defaults.

When each controller runs in a turn: turn start (triggers fire, engaged set computed) → background (Planners) → after the Parser (dialogue calls, in parallel; replies in the exchange slot) → resolution (code minds, deeds, mid-turn triggers, onAlert) → Narrator.

#### Fallback behavior \[Proposed\]

An engaged actor with no agent order this turn gets one order from its type's combat list. That covers minor actors, actors over the call cap, actors whose Planner call is late or failed, and actors whose order was dropped. An actor that is not engaged and has no valid order follows its routine's desired state. There is no separate default behavior.

Code checks the combat list top to bottom; the first rule that matches gives the order:

1. **Flee:** the actor is broken (its morale bar reached Broken, Part 3, Morale). A broken actor takes this move whoever controls it, Planner included, and its Planner call is skipped. It moves one link toward its exit slot, else its refuge slot, else into a linked zone away from the nearest hostile actor it believes in. Once there, it holds. A surrendered actor (Part 3, Morale) skips the move and holds.
2. **Attack:** an active hostile actor it believes in (aware or tracking) is in its zone. It attacks with its type's attackSkill, targetPart null, aimed false. Target: the actor that last hit it, else the player, else an rng pick.
3. **Close in:** it moves one link, by the shortest path, toward the lastKnownZone of its most recent belief about a hostile actor. Never into a frontier.
4. **Search:** it is already in that zone and no hostile actor is there.
5. **Hold.**

Like every code mind, it reads only its ActorView. The rng pick uses the turn's seeded rng, so replay stays exact. Its orders carry source 'fallback'.

**Per-type data.** Each body type, or the NPC template when it sets one, names fallback.attackSkill. Slime: unarmed\_natural; slimes have only the general area, so targetPart is always null.

The rule order is fixed in code for the prototype. Each rule is its own small check, so a per-type, data-driven rule order can replace the fixed one later (D-17). tactics does not change the list yet (D-17).

### Agent Parser

Agent Parser turns the player's free text into a structured request. It runs on the smallest fast model, sees only PlayerView, and never narrates or decides outcomes.

Output shape (notation, not literal JSON):

```
{
  move:    { toZone: zone_id, after?: true } | null,
  action:  {
    type:     attack | hide | sneak | talk | persuade | deceive | barter | intimidate | use_item | equip | give | observe | interact | other | rest,
    skill:    skill_id,
    target:   actor_id | zone_id | item_id | null,
    targetPart: part_id | null,     // a body part of the target the player named; never implies aiming
    item:     item_instance_id | null,     // weapon, consumable, tool or item given
    mode:     mode_id | null,              // attack mode; code default if null (Part 5 §5)
    approach: short phrase in the player's style,   // flavor only
    stance:   careful | normal | reckless,         // flavor only
    improvised: { base: improvised_light | improvised_medium | improvised_heavy, name: short phrase } | null   // a scene object used as a weapon (Part 5 §7)
  } | null,
  perkMove:   { perk: perk_id, target: actor_id | null } | null,   // an owned perk move (AE8); a free one rides beside the action
  gear:       [ { op: draw | stow | swap | wear_acc | remove_acc | pick_up,
                  item: item_instance_id, from?: actor_id } ] | null,   // free; before the action
  spoken:     words said aloud | null,   // the speech if the main action is a
                                         // speech action; otherwise a bark
  addressees: [actor_id | band_id | "everyone"] | null,
  deferred:   [actions that didn't fit this turn],
  clarify:    one short question | null
}
```

- approach and stance are flavor: the engine ignores them unless an active skill or perk names them as a trigger. They are passed to Agent Narrator so the prose keeps the player's style.
- deferred is logged and otherwise ignored for now. How extra actions are handled is part of the action-economy discussion (D-19).
- A clarify answer stops the turn: no resolution, turn unchanged. Planner outputs are kept and apply when the turn resolves.
- Code adds aimed: true | false to the player's order from the Aim toggle or /aim (Part 1 §7). The Parser never sets it.

Fixed instructions (sent as the leading user turn):

```
You are the Intent Parser for a text RPG. You turn the player's words into structured actions. You never narrate and never decide outcomes.

You receive:
- PLAYER_INPUT: what the player typed.
- PLAYER_VIEW: what the character knows right now: skills, perks, inventory, current zone, and the zones and actors they can perceive.

Rules:
1. Use only targets, items and skills present in PLAYER_VIEW. If the player names something that isn't there, map it to the closest thing that is, or ask.
2. A turn holds at most one move and one main action. Speaking counts as the main action; words said alongside another action are a passing remark, kept in "spoken" as a bark. Put anything extra in "deferred".
3. Choose the skill a fair game master would call for. If two fit, pick the one the player's wording stresses.
4. Keep the player's style in "approach", e.g. "quietly, from behind the crates".
5. If the intent is truly unclear, return only "clarify" with one short question.
6. Never assume success. "I kill the guard" is an attack, not a kill.
7. When the player speaks to someone, list in "addressees" whom the words are for: named characters, a group ("the guards"), or everyone.
8. If the player names a body part of the target, put it in "targetPart". Never decide whether the attack is aimed.
9. Drawing, stowing, swapping, putting on or taking off accessories and picking things
   up go in "gear"; they cost nothing. Putting armor on or taking it off is an "equip"
   action. Name the item, and the attack mode, when the player names them.
10. If the player fights with an object from the scene that is not in PLAYER_VIEW (a chair, a
   bottle), set "improvised": the base by its size (improvised_light, improvised_medium,
   improvised_heavy) and a short name for the object. Leave "item" null.
11. If the player goes to someone who is not in PLAYER_VIEW to talk to them or act on them, give only
   the move toward where they are and put what they meant to say or do in "deferred". Do not ask who they mean.
12. Passing time is "wait" (put the time of day to wait for in "target": "dawn", "day", "dusk" or "night"; null waits until the next one) or "sleep". A short rest to recover is "rest".
13. The move comes before the action unless the player acts first and then moves ("strike, then step back"): then set "after": true on the move. A move walks toward the zone named; with no action it runs on (a dash). An attack on someone in sight needs no move: the character closes in by itself. A ranged attack and a move cannot share a turn.
14. If the player uses one of PLAYER_VIEW's perkMoves (by its name or by what it does, e.g. "throw dirt in his eyes"), put it in "perkMove" with its target, beside any move and action.

Return only JSON matching the schema.
```

Rules 1 and 5 are provisional: how to handle a player naming something that doesn't exist is still open, because a clarify question can reveal what exists in the world (D-21).

### Agent Planner

Agent Planner plays one engaged significant actor, on any side: an enemy, an ally or a companion. Each such actor gets its own call, made before this turn's player action exists, so it acts only on what that one actor perceived or was told.

Code builds the OppositionView from that actor's own knowledge. If the player hid from this guard, the Planner sees status: 'suspicious' with the last known zone, never the true zone. The engine rejects any order targeting something this actor has no belief about.

Output shape:

```
{
  action:   { type: attack | move | search | hide | hold | call_help | flee |
              talk | persuade | deceive | intimidate | barter |
              use_item | equip | give | other,
              target: actor_id | zone_id | null, skill: skill_id | null,
              targetPart: part_id | null,      // preferred part; takes effect only through the gap
              aimed: boolean,                  // pays the aim penalty for a sure location
              defense: dodge | block | null,   // sets the standing defense; null keeps it
              item: item_instance_id | null, mode: mode_id | null,
              intent: short phrase },
  dialogue: { line, volume: whisper | normal | shout, introduces?: [actor_id] } | null,
            // the words if action.type is talk; otherwise a bark
  gear:     [ { op, item, from? } ] | null,   // as the Parser: free gear ops, before the action
  stance:   { toward: actor_id, step: friendlier | colder } | null,
  planUpdate: { goal, steps, triggers,
                routine: routine_id | null } | null,  // routine: next turn; null = keep the current plan
  memory:   { add: [string], drop: [number] } | null,  // PM1: edit the memory list; drop by its number in the view
  agreement: { with: actor_id, text, job? } | null,   // PM3/PM4: a deal said aloud this turn; job: a quest (QT1)
  endAgreements: [ { id, outcome: done | broken } ],   // a party ends its own deal (never one holding a quest)
  questEnd?: { id: quest_id, outcome: done | abandoned | called_off } | null   // QT6/QT12/QT22
}
// job = { line, goal: { kind: defeat | deliver | reach | find | other, target?, count?, item?, qty?, to? },
//         pay?: { coin?, item?, qty? } | null, due?: { days, by?: time of day } | null, after?: quest_id | null }
```

Standing defense is saved on the actor (Part 4 §4 Core gains standingDefense: dodge | block). Default: whichever of dodge and block has the higher effective skill **\[Proposed\]**.

Fixed instructions (sent as the leading user turn):

```
You play the character described in CHARACTER, in a text RPG. You decide what this one character does this turn. You never narrate outcomes and never roll dice.

You receive CHARACTER (who you are) and OPPOSITION_VIEW. OPPOSITION_VIEW holds only what your character knows: your condition and position, the zones, your plan, memory list and agreements, events you noticed (and earlier ones, briefly), what others told you, and what you believe about the player (status, last known zone, what you have learned). It may be wrong or out of date. Other characters, even allies, know things you don't.

Rules:
1. Act only on what OPPOSITION_VIEW contains. You may guess, search, set traps or wait, but you cannot target what you have not perceived or been told. If you lost track of the player, act on the last known zone.
2. To share what you know with allies, you must communicate: speak, shout, call for help or raise the alarm. Allies who don't perceive it don't learn it.
3. Play your band's goals and your temperament, as given in CHARACTER. Your job is to be believable, not to beat the player or to help them. Guards guard, cowards flee, fanatics hold, friends stand by friends.
4. Respect your condition and morale. If hurt or outnumbered you may retreat or call for help.
5. Tactical skill: tactics in CHARACTER: simple (predictable), competent, or cunning.
6. Give exactly one action; "hold" is allowed. Talking is an action. A line given with any other action is only a passing remark that no one acts on.
7. Change the plan only when it should change. Use triggers for things that should happen later without you, such as an ambush that springs when you see the player on the bridge. When things calm down, you may pick which of your routines to follow.
8. If your line gives your own name or another character's, list them in introduces.
9. To strike a body part, name it in targetPart. Set aimed to true only when a sure hit on that part is worth a harder attack. Set defense to dodge or block to change how you defend from now on; null keeps it.
10. You may draw, stow or swap gear and pick things up in "gear" at no cost. Use only items
   your view lists as yours or lying where you can see them.
11. stance is null unless the player's words this turn truly change how you feel about them. Step colder only
   for a real provocation: a threat, an insult, an accusation, a drawn weapon, or pressing on after you warned them
   off. Questions, curiosity, polite pushing and your own wariness are not provocations. If you are already
   opposed to them, colder makes you hostile and you will attack them on sight, so take that step only over
   something you would truly come to blows for.

Return only JSON matching the schema.
```

Shared plans between actors (a coordinated ambush across several guards) are an open design question tied to how actors are grouped. For now each actor holds its own plan and triggers.

### Agent Responder

Agent Responder plays one addressed spokesperson that has an agenda (it holds a secret, has a plan, has memory entries or is in an agreement). It runs after the Parser, on the same model as the Planner, and decides that actor's one action for the turn: a reply or something else.

Input: CHARACTER (name, role, band, band goals, temperament); OPPOSITION\_VIEW; DIALOGUE\_INPUT (the spoken words and the impression); COMMITTED (a turn-start trigger's order, or none); SLIPS (a secret that comes out this turn whatever it intends, or none) **\[Proposed\]**.

Output shape:

```
{
  action:     { ...as the Planner... },   // talk to reply, or any other action
  dialogue:   { line, volume, introduces? } | null,   // the reply if action.type is talk;
                                                      // otherwise a bark
  gear:       [ { op, item, from? } ] | null,   // as the Parser
  stance:     { toward, step } | null,
  reveals:    [secret_id],                // its own secrets told by choice [Proposed]
  planUpdate: { ...as the Planner... } | null
}
```

Fixed instructions (sent as the leading user turn):

```
You play the character described in CHARACTER, speaking with the player in a text RPG. You decide what this one character does this turn: answer, or do something else instead. You never narrate outcomes and never roll dice.

Rules:
1. Answer what the player actually said, in character, or choose another action instead. Give exactly one action.
2. Let the impression shape your reaction, but stay in character: you can be convinced and still refuse.
3. Protect your secrets as your character would; you may lie. To tell a secret by choice, list it in "reveals".
4. If SLIPS names a secret, your line or action must let it out: a confession, a blurt or a tell.
5. If COMMITTED is set, that is your action, and your line becomes a passing remark.
6. You speak for your own band only. Your view lists what you already said in "said"; do not say it again, move the talk on.
7. Play your band's goals and temperament, as given in CHARACTER.
8. Change the plan only when it should change.
9. If your line gives your own name or another character's, list them in introduces.
10. You may draw, stow or swap gear and pick things up in "gear" at no cost. Use only items
   your view lists as yours or lying where you can see them.
11. stance is null unless the player's words this turn truly change how you feel about them. Step colder only
   for a real provocation: a threat, an insult, an accusation, a drawn weapon, or pressing on after you warned them
   off. Questions, curiosity, polite pushing and your own wariness are not provocations. If you are already
   opposed to them, colder makes you hostile and you will attack them on sight, so take that step only over
   something you would truly come to blows for.

Return only JSON matching the schema.
```

### Agent Voice

Agent Voice plays one addressed spokesperson with no agenda, such as a shopkeeper or a ferryman. It runs after the Parser, on the same model as the Responder, and decides that actor's one action for the turn. It exists so that talking to an ordinary NPC and talking to a guarded one look the same from outside: same pipeline, same number of calls, same order, same timing.

- Receives DialogueView: its own view plus only this turn's spoken words and its impression (Dialogue input).
- Shares only listed facts. It may share facts from the NPC's knows list and nothing else. This closes the hole where the Narrator, voicing NPCs itself, could invent directions, prices or clues.
- Never sees the hidden store. An NPC that gains a secret, a plan, a memory entry or an agreement has an agenda, and from then on Agent Responder voices it.

Output shape:

```
{
  action:     { ...as the Planner... },   // talk to reply, or any other action
  line:       what the NPC says,          // the reply if action.type is talk;
  volume:     whisper | normal | shout,   // otherwise a bark
  shares:     [fact_id],                  // facts from KNOWS this line reveals; may be empty
  introduces: [actor_id],                 // optional: the speaker, or actors in KNOWS, whose names this line gives
  gear:       [ { op, item, from? } ] | null,   // as the Parser
  stance:     { toward, step } | null,
  routine:    routine_id | null           // from its routines list; next turn
}
```

Fixed instructions (sent as the leading user turn):

```
You voice the character described in CHARACTER, in a text RPG. You decide what this character says or does in reply to the player. You never narrate and never decide whether the player's attempts succeed.

You receive CHARACTER (your name, role and band) and DIALOGUE_VIEW: your sheet, the facts you know (KNOWS), what you have noticed lately, what you believe about the player, the last few exchanges, what the player just said, and how it struck you (IMPRESSION, or none).

Rules:
1. Answer what the player actually said, in character, or do something else: leave, trade, fetch, flee, help. One action.
2. State facts only from KNOWS, and list each one you reveal in "shares". Never invent a specific place, price, name or clue.
3. Let IMPRESSION shape your reaction; stay in character.
4. You speak for your own band only. You may switch to one of your routines (follow, wait, or another listed one).
5. Keep it to one or two sentences unless asked for more. Your view lists what you already said in "said"; do not say it again, move the talk on.
6. If your line gives your own name or another character's, list them in introduces.
7. stance is null unless the player's words this turn truly change how you feel about them. Step colder only
   for a real provocation: a threat, an insult, an accusation, a drawn weapon, or pressing on after you warned them
   off. Questions, curiosity, polite pushing and your own wariness are not provocations. If you are already
   opposed to them, colder makes you hostile and you will attack them on sight, so take that step only over
   something you would truly come to blows for.

Return only JSON matching the schema.
```

The engine checks every shares id against knows and scans line for names and facts that are not in the NPC's view.

**Failure handling (Responder and Voice) \[Proposed; see D-43\].** One repair retry, then a neutral in-character line from the NPC's sheet as a talk action. The legality check on targets applies to both, as it does to the Planner.

### Resolution engine

The engine is pure code: the same state, the same logged agent outputs and the same RNG state always give the same events, so any turn can be replayed. Player and NPC actions go through the same ruleset calls.

```ts
interface Ruleset {
  readonly TIERS: readonly Tier[];                                      // ordered best to worst
  initiative(actor: Actor, state: GameState, rng: Rng): number;
  check(req: CheckRequest, state: GameState, rng: Rng): CheckResult;   // Part 1 §4 Layer 2: no dice; skill + modifiers vs the scene's target, pass or fail
  contested(a: RollRequest, b: RollRequest, state: GameState, rng: Rng): ContestResult;
  roll(req: RollRequest, state: GameState, rng: Rng): RollResult;          // Part 1 §4 Layer 2b
  attack(req: AttackRequest, state: GameState, rng: Rng): AttackResult;    // Part 3, Damage flow
  eventRoll(actor: Actor, state: GameState, rng: Rng): EventRollResult;
  // Layer 1 (Part 1 §4): d100 + EVENT_BASE + modifiers from perks, gear and
  // statuses whose library entry names the event roll. No skill. Six tiers and
  // natural edges. Called once per scene, at scene setup step 2, always for the player.
  applyEffects(result: CheckResult | ContestResult | AttackResult, state: GameState): Effect[];
  recordUse(actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult, state: GameState): void;
  // improvement-roll timing is open; recordUse only records a use for now
}

type CheckRequest = { actorId: string; skill: string; target?: string; modifiers: { source: string; value: number }[] };
type CheckResult  = { actorId: string; skill: string; target: number; passed: boolean; modifiers: CheckRequest['modifiers'] };
type ContestResult = { a: RollResult; b: RollResult; gap: number; winner: 'a' | 'b' | 'tie' };   // a = the acting side; gap = b.tier − a.tier (Part 1 §4, Contests)
type EventRollResult = {
  actorId: string;                    // always the player
  roll: number;                       // natural d100
  tier: Tier;                         // one of the six TIERS
  modifiers: { source: string; type: 'perk' | 'gear' | 'status'; value: number }[];
};

type RollRequest = {
  actorId: string; skill: string;
  modifiers: { source: string; type: 'roll_perk' | 'wounds' | 'situational' | 'aim' | 'gear'; value: number }[];
  tierShifts: { source: string; value: number }[];      // tier perks; the natural edge is added by roll()
};
type RollResult = {
  actorId: string; skill: string; d100: number; margin: number;
  tier: Tier;                       // clamped to the table
  beyond?: number;                  // steps a shifted roll went past the end tier (+ above, − below); tierLevel() adds it
  natural: -2 | -1 | 0 | 1 | 2;
  modifiers: RollRequest['modifiers']; tierShifts: RollRequest['tierShifts'];
};
type AttackRequest = { attackerId: string; targetId: string; weaponId: string;
                       targetPart: string | null; aimed: boolean };
type AttackResult = {
  attack: RollResult; defense: RollResult | null;       // null when the attack floor missed
  defenseType: 'dodge' | 'block' | null;
  gap: number | null; gapShifts: { source: string; value: number }[];
  outcome: 'missed' | 'dodged' | 'grazed' | 'blocked' | 'full_hit' | 'heavy_hit' | 'crushing_hit';
  location: string | null;
  locationHow: 'rolled' | 'aimed' | 'redirected' | 'restricted' | 'shield' | null;
  multiplier: number; damage: number;                   // code only; never reaches an agent
  deciding: { attack: string[]; defense: string[]; gap: string[] };
};

type Order = {
  actorId: string;
  type: string; target: string | null; skill: string | null; intent: string;
  source: 'player' | 'agent' | 'trigger' | 'onAlert' | 'routine' | 'fallback';
};

function resolveTurn(state: GameState, playerIntent: Intent, dialogueOrders: Order[],
                     agentOrders: Order[], fired: Order[], rng: Rng) {
  const views = buildActorViews(state);            // active actors only; code minds never see GameState
  const actions = mergeOrders(fromIntent(playerIntent), fired, brokenOrders(views), dialogueOrders, agentOrders,
                              alertOrders(views), routineOrders(views), fallbackOrders(views));
  // one order per active actor: trigger > broken > agent (dialogue call, else Planner) > onAlert
  //                             > routine (desired state) (not engaged) or combat list (engaged)
  resolveExchange(actions, state, rng);            // dialogue turns: the player's speech, then spoken replies
  const ordered = orderActions(actions, state, rng);          // ruleset.initiative
  const events: GameEvent[] = [];
  for (const step of walk(ordered, state)) {                   // pairs hide/search, attack/defend, deceive/insight as it goes
    if (!isActive(step.actor)) continue;                       // downed: order dropped
    applyGearOps(step, state);                                  // free gear ops at this actor's initiative, before its action (Part 5 §4)
    if (isAttackOnUnaware(step, state)) resolveAmbush(step, state, rng);   // before the blow; see Explore mode
    const result = step.attack
      ? ruleset.attack(step.attackReq, state, rng)        // Part 3, Damage flow
      : step.contested
      ? ruleset.contested(step.a, step.b, state, rng)
      : ruleset.check(step.req, state, rng);
    const effects = ruleset.applyEffects(result, state);
    ruleset.recordUse(step.actor, step.skill, result, state);
    const event = toEvent(step, result, effects);
    event.perception = computePerception(event, state, rng);   // at the moment it happens
    updateBeliefs(state, event, result);                        // still the ONLY writer of Belief
    if (event.actorId === 'player' && isMajorAction(event)) detectPlayer(state, event, rng);   // see Explore mode
    events.push(event);
    fireMidTurnTriggers(state, event, ordered);                 // see Hidden state persistence
  }
  applyBeliefDecay(state);
  checkSecrets(state, events);
  state.events.push(...events);
  return events;
}
```

A defense is a free reaction: it costs the defender no action and uses its standing defense. Each defense after the first in a turn takes the outnumbered situational modifier (value *placeholder*).

check() reads its target from the scene's challenge grade (Part 1 §4, Layer 2). Ambush, detection and stealth rolls run as before. A event roll's result is saved in the turn record; replay feeds it back with the logged Weaver output, so a replayed scene start makes no Claude call.

Perception rules:

- **Perception per event.** Computing perception after the loop gave a guard killed in step 2 knowledge of step 3, and gave a moved actor sight of events from its new zone.
- **One belief writer.** Stealth contests return results; updateBeliefs alone writes Belief, so the stealth result and the perception result can't overwrite each other.
- **Passive perception.** Every event is checked against every actor in range, whether or not that actor ordered a search. The player's own events are the exception: an observer unaware of the player perceives them only through detection (Explore mode).

**Active actors.** isActive(actor) is false while the actor is incapacitated. An inactive actor gets no order of any kind and an order it hasn't resolved is dropped. It skips desired-state evaluation, its triggers stay armed but don't fire, it counts on neither side of engagement, and it gets no dialogue call when addressed. A revived actor is active from the next turn.

Rules for simultaneous orders, because the Parser and the Planner worked without seeing each other:

- **Target moved first.** An attack resolves against where the target stands now if it is still within the weapon's reach; otherwise it becomes a wasted-action event ("swings at empty air"). Reach comes from the attack mode, in metres with sight (Part 5 §5).
- **Closing in (ZP3).** A melee attack on someone out of reach, with no other move planned before it (none, or a move to the target's zone), walks at the target on the move slot first and stops just inside the weapon's reach (a move event with `target` and no fromZone). Still out of reach, the blow is lost (a wasted action). A ranged attack never closes in.
- **Spots in a zone (BG-12).** A player's move can name a spot in its zone, the player's own zone included (Parser `move.spot`): `near` someone there (stops PLACE\_GAP\_M from them) or a way out of it (its doorway, or a frontier's side); `awayFrom` someone or a way out (the far edge straight across from it through the zone's middle; a way out at the middle, such as stairs straight down, keeps to the side the walker is on); or `side`, a compass word (the middle of that side). It walks there on move slots like any move, stopping ENTER\_M (a step) inside the edge (position.ts spotPoint). A spot that names nothing there makes the Parser's turn ask where. A move with no spot to the player's own zone is still no move.
- **Far moves (BG-15).** A player's move names where the player means to end up, not the first step: any zone the player knows (PlayerView `known`: zones stood in, seen across a sight link or left, and the ways out of them it has seen, named by the exit's words for a zone never entered). The walk finds the way through the zones between, slot by slot, as any move. A move-only turn is just the move: no hold event follows it unless words go with it (BG-16).
- **Ways out, the back, left and right (BG-18 to BG-20).** Walking *to* a way out ("to the cellar steps") is a spot near it in the zone it leaves from; walking *through* it is a move to the zone beyond. "The back" of a zone with no way named is away from the way the player came in. Everyone walking faces the way it last walked (Actor.facing); the player's view gives each person in sight a `side` from that (ahead, left, right, behind, each a quarter turn), and when words fit several people equally (two at the same distance), the Parser picks one and never asks.
- **Moves in the narration (BG-22).** Each move event the player sees says how it went: a leg that leaves a zone gives the zone it left (`from`) and the one it entered (`where`); a leg inside a zone is `within` it, and when it is on the way to another zone, names that zone (`heading`). The Narrator tells a turn's legs in order as one walk.
- **Moves.** A move resolves at its actor's initiative like any other action. Provisional: how many actions a turn holds is part of the action-economy discussion.
- **Same target or object.** Earlier initiative acts first; the later actor gets a contested check or a wasted action.
- **Stealth.** A hide or sneak is contested once per observer in perception range. Each result sets that observer's belief separately. A hide or sneak also sets the player's posture to stealthy.
- **Speech.** Talking is an action. A talk action resolves at the speaker's initiative and is perceived by volume and zone links, except addressed speech in a dialogue turn, which resolves in the exchange slot at the top of the turn, followed by the spokespeople's spoken replies. A bark rides on its action's event: perceived and narrated, but it copies no belief.
- **Numbers.** Tier tables, caps, perk effects and skill gains come only from the ruleset module. Do not invent or tune them here.

**First-build ruleset.** Build TIERS, eventRoll(), roll() and attack() as Parts 1 and 3 define them, and check() and contested() as Part 1 §4 sets out. The rest works like this:

- initiative(): d100 + SKILL\_WEIGHT × the best skill with the Initiative function (full value, like a function roll; 0 when none) + roll modifiers naming initiative (rollMod roll `initiative`). No skill has the function yet, so it is a plain d100 for now (Dodge joins the Speed group directly, without the function). Higher acts first. An actor unaware of anyone attacking it this turn takes INIT\_UNAWARE (placeholder), so it acts last. Ties go to the seeded RNG.
- applyEffects(): attacks as Part 3 sets out. A check or a contest only changes beliefs (through updateBeliefs) and reveals secrets; it never changes an object or a place (OQ-22).
- recordUse(): writes the use to the agent log and changes nothing, so no skill changes in the first build.
- The morale roll (Part 3, Morale) is moraleRoll(): roll() on Resolve with renown and rally; morale lost is saved in Condition.moraleLost and a break in Mind.moraleState until the scene ends. No new interface method.

**Replay.** Each turn record (Part 4 §6) holds the RNG state before the turn, each agent's exact output and any event roll. Replay feeds the logged outputs, not the player's text, back through the engine, and is exact only under the library version that record names. Merge Planner outputs in actor-id order, never in the order calls returned.

### Agent Narrator

Agent Narrator writes the prose the player reads, on the strongest model available. It receives only NarrationView, so the perception rule is enforced twice: structurally (it never gets hidden data) and in the prompt (it must not invent any). Its full text is checked before display; there is no streaming for now.

**Seen actors in the dark (P3, 07/11/2026).** An actor in a dark zone is perceived partially, unless it shares the viewer's zone and the viewer fully perceived one of its events since the scene began (for example it spoke face to face): then it stays fully seen.

Partial events reach the Narrator without actor names or intent, with the zone link's label and the cue, e.g. `{ kind: 'move', where: 'left of the gate', perception: 'partial', cue: 'sound' }`, so it can write "boots scrape somewhere to your left" and nothing more. Actors whose names the player doesn't know reach it by their public label.

Output shape:

```
{
  text:     the narration,
  narrated: [event_id]        // every event the text describes
}
```

Fixed instructions (sent as the leading user turn):

```
You are the Narrator of a text RPG. You turn resolved events into prose for the player. The events already happened; you describe them, you do not decide them.

You receive STYLE (tone, length) and NARRATION_VIEW: the events the player character perceived this turn (each marked "full" or "partial", with a cue), the character's condition, their visible surroundings, and any lines they heard.

Rules:
1. Write in second person, present tense, in the tone given in STYLE.
2. Describe only what the character perceives. Turn "partial" events into hints through their cue (a sound, a shadow, a smell) with no names, numbers or intentions.
3. Never add facts that change the game: no new characters, items, wounds, exits or clues beyond the events.
4. Never contradict an event's outcome or tier. Show success and failure through the fiction. Never print rolls or numbers.
5. Do not quote spoken lines: the screen shows each line the player character heard, word for word, under your text. You may say who spoke and how, and only for lines the player character heard.
6. List in "narrated" the id of every event your text describes.
7. Keep to the length given in STYLE. End on a moment that invites the player's next move. Do not list options.
8. Never write the player character's words or decisions beyond the resolved action.
9. Refer to each person with the pronouns given for them in actors. If none are given, use "they".

Return only JSON matching the schema.
```

For attacks, Agent Narrator receives the combat packet (Part 3, The packet), which holds no numbers. When SHOW\_MECHANICS is on, code prints the dice and modifiers in a mechanics panel under the narration; the Narrator never sees them.

### Hidden state persistence

Plans and secrets live in state.hidden, so they survive between turns even when no agent is called. Triggers use a small, machine-checkable vocabulary; the Planner and the Weaver may only write triggers from this list, and the engine drops any it can't parse.

```ts
type HiddenStore = {
  plans: Record<string, Plan>;       // actorId -> plan
  memory: Record<string, MemoryEntry[]>; // actorId -> memory list { turn, text }, at most MEMORY_ENTRIES (PM1)
  agreements?: Agreement[];          // PM3: { id, parties: [a, b], text, madeTurn, madeBy }, kept until done or broken
  secrets: Secret[];
  firedLog: { triggerId: string; turn: number }[];
  weaverNote: string;                // Agent Weaver's rolling note; replaced each call
  stage: { eventSummary: string; challenge: Grade; gain: Grade; hiddenTerms: string[] };
};

type Plan = { goal: string; steps: string[]; triggers: Trigger[]; createdTurn: number };

type Trigger = {
  id: string;
  ownerId: string;                   // the actor whose beliefs the condition reads
  when:
    | { type: 'player_seen_in_zone'; zone: string }   // the owner's own perception, not truth
    | { type: 'turn_reached'; turn: number }
    | { type: 'actor_down'; actorId: string }
    | { type: 'alarm_heard' }                          // the owner perceived an alarm event
    | { type: 'quiet_turns'; turns: number };          // a beat: the scene has been quiet this many turns in a row (Scenes)
  then: OrderTemplate;               // exactly one order; the validator rejects lists
  once: boolean;
  endsScene?: true;                  // a beat that ends the scene when it fires (Scenes)
};

type OrderTemplate = Omit<Order, 'source' | 'target'> & {
  target: string | '$player' | '$lastKnownZone' | '$triggerZone' | `$slot:${string}` | null;
                       // bound when the trigger or onAlert fires; $slot reads the owner's binding
                       // (a route slot gives its first zone)
};

type Secret = {
  id: string;
  holderId: string;                  // the actor who keeps it
  fact: string;                      // e.g. 'the captain is the informant'
  leakTerms: string[];               // words and phrases the leak scan looks for, e.g. ['informant', 'sold you out']
  revealWhen:
    | { type: 'event_in_zone'; kind: string; zone: string }
    | { type: 'check_passed'; skill: string; minTier: Tier; againstActorId: string };
};
```

Per turn:

1. **Turn start.** The engine checks every trigger once, after the previous turn is saved (Architecture step 1). Fired triggers become orders this turn and are written to firedLog; a once trigger is removed from its plan at that moment, so it can never fire twice. Triggers of inactive actors stay armed but don't fire.
2. **Mid-turn.** After each event, player\_seen\_in\_zone and actor\_down triggers are checked again. One that fires while its owner hasn't acted yet replaces that owner's order this turn; otherwise it fires next turn. An ambush springs while the player is still on the bridge.
3. **One order per actor.** A fired trigger's order replaces the agent's order for the same actor. When several of an owner's triggers fire in one turn, the first in its plan's order wins; the others stay armed unless they are once triggers.
4. **Next view.** The owner's next OppositionView lists its fired triggers under "already happened", so the Planner doesn't order the same thing twice.
5. **Plan updates.** A non-null planUpdate replaces that actor's plan. memory edits the actor's memory list on its own, with no plan update (PM1): drops by number first, then adds; past CONFIG.MEMORY\_ENTRIES (8, a placeholder) the oldest entries go (PM2). An older output's memoryNote is read as one added entry. Updates from a turn that stopped on a clarify question are kept and apply when that turn resolves. A late Planner output is discarded whole, planUpdate included (interim; D-43).
5a. **Memory and agreements** (PM1–PM8, Ali 08/11/2026, schema v6).
   - An agreement is recorded only when the other party (the player or an NPC) perceived a line spoken by its maker this turn; otherwise it is logged invalid\_agreement. The Planner and the Responder make deals with anyone (PM4); the Voice only with the player. Only a party can end a deal (done or broken).
   - Both parties' views list the deal (AgreementView: with, withId, text, madeTurn). The PlayerView lists the player's deals for the screen (PM5; the panel is the designer's).
5b. **Quests** (OQ-28 and D-105, settled by Ali 09/11/2026, QT1–QT28; src/engine/quests.ts).
   - A quest is a deal with a job in it; the giver is always an NPC and only the player takes quests (QT1, QT16). The giver's Planner, Responder or Voice offers the job in talk; the Weaver seeds givers only through an actor's plan (QT2). The deal's agreement carries the job; it becomes a quest only when the giver heard the player speak this turn (QT3). Unaccepted offers are not stored.
   - The job's line is one short line of what was asked. It goes through the narration leak scan; a refused line keeps the deal but makes no quest (QT4). One open quest per giver: a second is refused and logged (QT5).
   - Goals (QT6/QT7): defeat (N of a body type or race, or one named actor), deliver (an item, or one item instance, handed to someone), reach (a zone or place), find (see a named person clearly). Anything else is "other": logged quest\_goal\_gap and filed in the play page's bugs/ list (QT27), and the giver's agent judges it done at report-back. Goal kinds and quest states are unordered: their names are their IDs (QT21).
   - States (QT11, QT22): active, ready (goal met), done, failed, abandoned, called\_off. A ready quest is done when the player next talks to the giver in person; handing a delivery to the giver finishes it at once (QT8). Code fails a quest when the giver dies, a named target dies, a delivery item no longer exists, or the goal is not met by the deadline.
   - The deal is locked: code refuses (quest\_deal\_locked) any endAgreements on it, and ends it with the quest. The giver may call the job off only in words the player hears (called\_off, no stance change). The player abandons on the Quests page or by telling the giver (QT12).
   - Payment (QT10/QT23): the promise is data (coin and/or a library item and count). Anything the giver gives the player afterwards counts toward it. Still owed when the player's engagement ends after hand-in: the promise is broken, logged quest\_unpaid, the giver remembers it, and the quest shows Unpaid.
   - Deadlines (QT25): in N days, optionally by a time of day, as a clock time; without a time of day, the end of that day. Only the goal must be met by then.
   - Stance (QT13): done, one step friendlier; abandoned or failed by a missed deadline, one step colder.
   - Linked quests (QT24): a quest may name the quest it follows (after). A job from the same giver after a hand-in in the same engagement links on its own. Each quest keeps one goal and pays its own XP.
   - Views: an NPC's view lists in jobs the player's quests it gave or that send the player to it (a ready quest shows as active until hand-in). The Quests page shows giver, goal and progress, reward level, payment, due time and state, linked quests folded under one head row; the Play screen's quest line shows the pinned or newest open quest.
   - PM8: an agent-controlled NPC in an open deal gets a Planner call each turn even when not engaged, so a companion can act on the deal instead of only following.
   - PM6: when events an NPC perceived fall out of its RECENT\_EVENTS window, code writes one short line for each into Mind.earlier (no Claude call): "turn 12: player attack you (hit)". A line that repeats the one before it becomes a count (turn 12–14: … ×3). Only the last CONFIG.EARLIER\_LINES (6, a placeholder) stay. Every NPC view shows them as earlier.
   - Deferred (PM7): the Voice writing memory entries.
6. **Secrets.** A secret becomes player knowledge only when a resolved event meets revealWhen: minTier is a tier key and the check must reach at least that tier (the Weaver writes the tier's name; code keeps the key), and a check\_passed reveal needs the check aimed at againstActorId. A secret is also revealed when its holder's Responder lists it in reveals; code accepts only secrets that actor holds **\[Proposed\]**. When the player's speech check against a spokesperson meets one of its check\_passed reveals, its Responder is told so (SLIPS) before it answers **\[Proposed\]**. A revealed secret is added to the player's Journal (secretsKnown); only then can it appear in NarrationView.
7. **Save.** After resolution, the story is saved as described in Part 4 §10. Hidden fields are saved but shown only in the GM debug view.

**onAlert** is not a trigger. Code fires a routine's onAlert order once, when its owner first leaves unaware of a wary actor or first perceives an attack or alarm: this turn if the owner hasn't acted and has no agent order, otherwise next turn unless an agent order exists by then. An armed flag resets when the owner is calm again: unaware of every wary actor, and DECAY\_TURNS turns with no attack or alarm perceived.

### Encounter modes

Code picks the mode each turn; agents run only when someone needs a mind. Ordinary and guarded dialogue now share one pipeline, so the mode no longer shows whether an NPC has a secret.

**Engagement** (Ali, 07/11/2026, E1). An engagement is one encounter from an actor's point of view: a fight, a negotiation, or both. It starts when any actor becomes engaged with that actor, either in a fight (active, hostile to it, and the two engaged, on a turn either attacks or closes in; YD6, see Hunting and engaged) or in talk (the two speak to each other in a dialogue exchange). It ends once no actor has been engaged with it, in either way, for ENGAGEMENT\_END\_TURNS turns in a row (config, 3; Ali, 11/11/2026), or at once when everyone who heard the player's yield has taken it (YD3). A negotiation that turns into a fight, or a fight that turns into talk, stays one engagement (Ali, 07/11/2026): once-per-engagement effects and the improvement rolls at its end happen once. A scene can hold several engagements. Effects that work once per engagement reset when a new one starts, and other rules may count engagements too. Code keeps the current engagement's start turn per actor, and which kinds it has held so far (talk, fight, spar).

**Sparring** (Ali, 09/11/2026, SP1–SP12; src/engine/spar.ts). A spar is its own kind of engagement: a pact between sides that lets fighters hit each other while nobody's stance changes. The fighter who is hit does not turn hostile, nor do its bandmates or onlookers; no alarm goes up (SP11), and NPC views and the Narrator see each sparring blow marked spar. Sides: one against one is two sides of one fighter; groups and free-for-alls (every fighter on its own side) work the same way (SP3); fighters on one side are not opponents.
- **Start (SP2).** Agreed aloud in talk: an NPC's agent output gives spar {sides, cruel?}, with itself on a side, and every other fighter must have heard its line this turn (like a deal). Or the Weaver's stage plan lists spars by cast key or actor id; the validator checks the sides (bad\_spar, unresolved\_actor). A fighter is in one spar at a time.
- **Fighting.** Spar opponents count as foes for fighting rules (engaged, tactical mode, morale, crowding, rest and heal blocks, fallback attacks, Volley), but stance, hostility and XP rules see no change. Blows do their normal damage, with no exceptions (SP6).
- **Out (SP4, SP5).** A fighter is out once it reaches SPAR\_LIMIT on the health track (config, Critical) or yields. A cruel spar, which every fighter must accept, runs to Incapacitated instead. The player yields by saying so (the Parser's yields: true), applied after the turn's blows; an NPC yields in its output (yields: true), or when its morale bar reaches Broken while it has no real foe: it just leaves the spar, with no yielded stance and no flight.
- **End (SP7).** The last side with a fighter still in wins. A spar also ends on a scene break, after ENGAGEMENT\_END\_TURNS turns with no blow between sides, or when a fighter and someone outside the spar attack each other (that attack is real and follows the normal rules). Fighters may be in different zones (a ranged fighter against a melee one). A blow on or by a fighter who went out earlier in the same turn is held back (the order was made before; spar\_blow\_held); from the next turn on such a blow is a real attack.
- **Rewards (SP8, SP9).** A spar pays no defeat XP (no one is really defeated) and counts toward no defeat achievements; skills still learn from the rolls, and the engagement's improvement rolls happen as usual. Each spar the player's side wins adds to the spar\_wins tally for spar achievements (D-144).
- **After (SP10).** A spar changes no stance; NPCs may still step friendlier or colder in talk.

| Mode | When code enters it | Pipeline | Claude calls per turn |
| --- | --- | --- | --- |
| Explore | No engaged actor, and no one is being spoken to | Parser → engine → Narrator | 2 |
| Dialogue | The Parser's main action is speech addressed to NPCs | Parser → speech check → one Responder or Voice call per spokesperson, in parallel → engine → Narrator | 2 plus one per spokesperson (at most MAX\_SPOKESPEOPLE), plus background Planners for engaged actors |
| Tactical | At least one engaged actor | Background Planner per engaged significant actor; Parser → engine → Narrator | 2 plus one per engaged significant actor, capped by MAX\_PLANNER\_CALLS |

Engaged is side-neutral: an actor is engaged when it believes in an active actor it is hostile to, so allies fighting bandits make a turn Tactical too.

Modes are chosen per turn inside a scene (Scenes); a scene can open in any mode.

Mode is computed after the previous turn is saved, from saved state; Dialogue is still decided after the Parser returns. There is one resolveTurn: mode only decides which agents ran.

An attack from Explore resolves in the same turn (Explore mode, Ambush). Tactical no longer has an "or the player attacks" condition **\[Proposed\]**: observers of the attack become engaged anyway, and a kill nobody perceives leaves the game in Explore.

Belief decay still returns actors to unaware. Planner calls follow engagement per actor, so encounter mode doesn't change which calls run. Triggers are checked in every mode, so an ambush can start a tactical turn by itself.

Every mode takes the same time after the player submits, except turns that start a scene or cross a frontier (Latency and cost).

### Game clock

Settled by Ali 07/11/2026 ("Sense of time: options", T1–T11; settles D-101).

- **One clock.** Code keeps game minutes since midnight before day 1 in `clocks.time`. Claude never sets it. Every turn costs its action's time from the library durations table (*placeholders*): a fight turn 0.1 min (6 s), any other action 1 min, a trade (barter) 10 min, rest 60 min, sleep 480 min. A save from before the clock starts on day 1 at the start of day.
- **Time of day** is an ordered scale (TIME\_OF\_DAY: dawn, day, dusk, night); each starts at a minute of the day in CONFIG.TIME\_OF\_DAY\_FROM (*placeholders*: 5:00, 7:00, 18:00, 20:00). There is a day counter and no weekday or season names (T4).
- **What it changes (T3):** an outdoor zone (its zone kind says so, Z2) is lit by the brighter of its own lamps or fires and the sky (CONFIG.SKY\_LIGHT: day bright, dawn and dusk dim, night dark); indoor zones keep their own light. A routine set's time tags must fit the time of day (CONFIG.TIME\_TAGS: dawn and dusk take day or night sets), otherwise it is a routine error. Shop hours come with shops (Stage 6). Routines that change mid-scene wait (D-49).
- **Who sees it (T5):** NPC views and the Narrator get `time: {day, timeOfDay}`, never minutes. No new Claude call.
- **Waiting (T6):** the Parser reads "wait until dawn" as action wait with the time of day in target (none: the next time of day; the time of day it already is: nothing happens and the line says so, Q2 08/11/2026), and "sleep" as action sleep (the sleep row). Sleep also gives the rest heal (or the place's row, e.g. a clinic) once per REST\_COOLDOWN\_MIN of sleep, twice for 8 hours, and counts as the last rest (Ali, 07/11/2026). Code moves the clock and breaks the scene (time\_skip). A hostile in the zone or tactical mode blocks it, like rest. The turn shows "Time passes: 11 h (Day 2 · Dawn)".
- **Starting time (T8):** the Weaver's first plan names `timeOfDay`, and code sets the clock to its start on day 1. After that a plan may only name the current one (bad\_time otherwise).
- **Shown (T11):** the Play header reads "Turn 5 · Day 2 · Evening · …"; its look is the designer's.
- **Later:** NPC needs such as hunger and sleep (T10, not planned). Travel time for long journeys is the Travel section below.

### Travel

Settled by Ali 11/11/2026 ("Travel on the Road", TV1–TV9). Code: src/engine/travel.ts. Roads are one long zone (Zone type, Roads).

- **When (TV1):** a player move with no main action whose route uses a road, outside tactical mode, with nobody hostile engaged with the player or perceiving them (suspicious or more), is a trip walked in one turn. Otherwise it is a normal move, a slot at a time. A frontier off a road is at the road's far end (the side its label's compass names, else the end farthest from the player): the trip walks there, then crosses it.
- **Pace (TV2):** the Parser's `move.pace` (slow, normal, fast; normal when left out). Travel speed is the walking speed (body type, armor, speed factor: moveSpeed) × CONFIG.TRAVEL\_PACE\_SHARE (0.6 / 0.9 / 1.2), which gives a 1.4 m/s walker 3 / 4.5 / 6 km/h. Everyone travelling together goes at the slowest one's speed. Mounts and carts are parked (D-201).
- **Legs (TV4):** code walks the trip in legs of TRAVEL\_LEG\_MIN (60) game minutes; the clock moves and natural recovery runs for each. A leg that ends on a road meets something with a chance of ROAD\_ENCOUNTER\_PCT for its danger × the leg's share of an hour (× NIGHT\_ENCOUNTER\_MULT 2 in the dark). On a meeting, code makes the event roll (the encounter's tier) and the trip stops there: the scene breaks (`encounter`), and the next scene starts with that roll, its people placed ENCOUNTER\_M (20 m) on along the road the way the player was walking. The Weaver gets `target.encounter` (zone, danger, noticed). Like any event roll, an encounter can be good or bad: its tier sets which (Ali, 11/11/2026); the danger only sets how often one happens.
- **Night (TV5):** a trip that reaches dusk stops there (`nightfall`); the next order is the answer: travel again to press on, or camp (sleep, wait). A trip that sets off at dusk or night presses on: slow pace, the event roll gets NIGHT\_TRAVEL\_EVENT\_MOD (−15, type situational, source "night travel"), and encounters come twice as often. Hunger and fatigue are parked.
- **Who comes (TV6):** active bandmates together with the player (YD7) travel along and stand beside it at the end. Reviewing who travels together, and agreeing a time to set off, is parked (D-202).
- **What is shown (TV7):** one `travel` event with one `travelled` effect (metres, minutes, pace, night, stop); the Narrator gets it as one passage ("you travel 9.2 km in 2 h 2 min at a normal pace"). The mechanics line reads "Travelled 9.2 km at a normal pace · stopped at nightfall" and "Time passes: …". On the Map, a road you are on shows your point along it: its tile draws the road end to end (W to E, or S to N) with your pin at your place and "1.8 km of 4.5 km" under the name, in the World view too; drawn to scale, your pin stands at your own position (Actor.pos) at a fixed size and the view centres on it, since a road is far longer than the screen (alongRoad in src/ui/mapData.ts). Landmarks are parked (D-203).
- **Noticing (TV8):** when something meets the player, one noticing roll: the sight function, with the pace's modifier (TRAVEL\_NOTICE\_MOD slow +10, fast −10) and the light. Success or better: the player saw it coming, and the Weaver is told that no ambush springs and anyone lying in wait has not seen the player. What else could be hidden by a road (side paths, lost things) comes with landmarks.
- **Off the road (TV9):** parked. NPCs travelling between places use these rules in the NPCs-stay-in-the-world work.

### Scenes

A scene is the stretch of play between two scene starts.

- **Start.** A scene starts at story start, and whenever code calls sceneBreak(cause), where cause is rest, time\_skip or story\_beat. It ends when the next scene starts. Code calls sceneBreak after the turn's resolution (Ali, 07/11/2026, P7):
  - **rest:** the player rests outside tactical mode;
  - **story\_beat:** a beat with endsScene fires, or the scene stalls: STALL\_TURNS (*placeholder*, 8) quiet turns in a row with no beat left whose owner is active;
  - **time\_skip:** the player waits or sleeps (Game clock).
  A frontier crossing in the same turn goes first; the break waits for the next turn.
- **Quiet turns and beats.** A quiet turn is one where nobody on the stage attacks, the player learns nothing new (no secret, witnessed fact or name), and no beat fires. The stage counts quiet turns in a row and resets after any other turn and at scene start. Agent Weaver seeds at least one beat per scene plan: a trigger with when quiet\_turns N, which fires at turn start once the count reaches N.
- **Stage.** A scene is played on a stage: the set of zones currently loaded. A stage can span several neighbouring places; each zone belongs to exactly one place, and an actor's place is always the place of its zone. Moving between zones or places never starts a scene.
- **Frontiers.** A stage grows through frontiers: labelled exits to areas not yet built. When the player crosses a frontier, code extends the stage (Stage extension) without a new event roll, using the scene's tier. A place already set up in this scene is loaded, not planned again.
- **Loading** a save resumes the current scene and stage. Encounter modes are chosen per turn inside a scene. Per-scene caps (fact promotions, minted items) reset at scene start.

### Scene setup

Runs inside the turn that calls sceneBreak, after resolveTurn and before the save:

1. Resolve the player's place node.
2. Event roll: ruleset.eventRoll(player).
3. Agent Weaver returns a stage plan with the tier in its view: the event first, then the zones (each with its place, creating place nodes as needed) and frontiers, any new bands, the cast (each actor's band, routine set id and slot bindings, with an optional startAt, opening belief about the player, beliefs about other bands and personal stances), hidden seeds and reward refs. The tier shapes the event and cast; opening attention and beliefs are the Weaver's story choice.
4. Code validates the plan and instantiates the cast: templates, unique or copy, body types from the database.
5. Code checks the plan's challenge and gain grades against the tier, and nothing else, then applies it. Code computes each actor's anchorTurn (Anchors) and places the actor in its default routine's desired zone for the current turn, whose activity sets its attention. On open entry only, each opening belief about the player is written through updateBeliefs. New bands and personal stances (Mind.overrides) are installed; each belief about another band becomes one belief per member on the stage (lastKnownZone = that member's zone), written through updateBeliefs whatever the entry. A plan that fails gets one repair retry. After that, routine-only errors degrade the affected actors, and any other error gives the fallback stage (Agent Weaver: Failed stage plan).
6. Code installs each actor's routines list (its set's routines), slot bindings, current routine and anchor, then its knows facts (Mind.knows), plans, triggers and secrets. Each routine carries its one onAlert order; there are no onAlert triggers.
7. Arrival detection: if the player is stealthy, each observer in perception range runs the existing detection test against the player's last move; the plan sets no belief about the player for these observers.
8. Code builds the opening perception events (Opening narration), saves the turn (Part 4 §10) and computes the first turn (Architecture step 1).
9. The turn's Agent Narrator call narrates the arrival with the turn's other events.

Story start has no triggering turn: setup runs alone, is saved as turn 0, and one opening Agent Narrator call narrates it. Until turn 0 is saved, the build is kept at pending/start; reopening the game with it there starts the opening again (Ali, 08/11/2026). Turn 0's premise and starting place come from the story's setting, chosen per story (D-1).

**First build:** the premise is the config value STORY\_PREMISE, "A swordsman arrives at a village troubled by slimes", and the story starts in the village tavern.

Whether the player sees the event roll on screen stays with D-22. Until then it is hidden, like every roll Agent Narrator does not get.

### Stage extension

- **Background call.** After a turn is saved, if the player's zone links to a frontier that has no held extension, code starts a background Agent Weaver call for that frontier, with the scene's tier and the same contract.
- **Held, not saved \[Proposed\].** The result is held in memory, keyed by frontier, for the rest of the scene; it is not saved.
- **Crossing.** In the turn the player moves into that frontier, scene setup steps 4–7 run on the held plan in that turn's setup slot, after resolveTurn and before the save. There is no new event roll: the Weaver's step 3 already ran in the background with the scene's tier. If the call is not back yet, the turn waits for it.
- **Failure.** A failed background extension is not retried; the fallback stage applies when the player crosses that frontier.
- **NPCs at frontiers \[Proposed\].** Orders that move an NPC into a frontier are dropped, and the actor holds this turn if not engaged, or uses its combat list if engaged (Fallback behavior; OQ-13).
- **Stage trim \[Proposed\].** When the stage exceeds MAX\_STAGE\_ZONES (config, placeholder), code drops the zones farthest from the player that hold no engaged actor. They stay saved on their place pages, and the links into them become frontiers again; re-entry loads them with no Weaver call.

### Agent Weaver

Agent Weaver plans what a scene is about and who is in it. It runs at scene setup (inside the turn) and for stage extensions (in the background). It is hidden-side, like Agent Planner: it may see the hidden store, and none of its hidden output ever reaches Agent Parser, Agent Narrator or Agent Voice.

**WeaverView** (built deny-by-default, like every view):

- the tier and its stakes group;
- the place or frontier being planned, its ancestors' headlines, and the current stage's zones;
- actors on the stage, with their plans and secrets;
- quests and flags; the bands on the stage, with their goals and relations;
- the player's level, current class and health-track level;
- the previous Weaver note;
- catalogs: the library and blueprint ids it may use (templates, body types, routine sets with their brief, tags and slot hints, items). Catalogs change only with libraryVersion and sit right after the fixed instructions as a stable prefix (OQ-11).

Never in WeaverView: skill growth, Burden or Potential (Part 1 §2); this turn's player text.

Output shape (notation, not literal JSON):

```
{
  event:       { summary: hidden text, challenge: grade, gain: grade },
  places:      [ { key, name, kind, parent: placeKey | placeId } ],   // new place nodes only
  zones:       [ { key, place: placeKey | placeId, kind: zone kind id, name, look: public text,
                   cover?: none | some | heavy, light?: bright | dim | dark,   // keys of COVER and LIGHT; default from the kind
                   links: [ { to: zoneKey | zoneId | frontierKey, label, sight } ] } ],
  frontiers:   [ { key, label } ],
  bands:       [ { key, name: public text, goals: hidden text, temperament: hidden text,
                   tactics: 'simple' | 'competent' | 'cunning', lethal: true | false,   // keys of TACTICS (src/scales.ts)
                   relations: { [bandKey | bandId]: hostile | opposed | neutral | friendly } } ],
                                    // new bands only; may also set relations toward existing bands
  cast:        [ { template: templateId | actor: actorId,
                   label: public text, name, appearance: public text, pronouns: he | she | they | it,   // public; stored on the actor and shown to every agent that sees them (run 14 Q3)
                   knownOnSight?: true, knows?: [ { id, text: public text } ],   // facts this actor may share (Agent Voice); capped
                    key, band: bandKey | bandId, routineSetId,
                   slots: { <slot>: zoneKey | zoneId | [zoneKey | zoneId, ...] },   // every slot the set lists
                   startAt?: <slot>,                 // where in the loop to start; code computes the anchor
                   routineGap?: hidden text,         // what it wanted when no set fit; capped; GM view only
                   awarenessOfPlayer: unaware | suspicious | aware,      // what this actor knows of the player
                   awarenessOfBands?: [ { band: bandKey | bandId, awareness: unaware | suspicious | aware } ],
                                                                         // about every member of that band
                   overrides?: [ { actor: castKey | actorId, stance: hostile | opposed | neutral | friendly } ],
                   motive: hidden text } ],   // agenda is derived from seeded plans and secrets
  seeds:       { plans: [Plan], triggers: [Trigger], secrets: [Secret] },
  rewards:     [ { item: itemId | { base: libraryItemId, quality: 1 | 2 | 3 | 4, boosts: string,
                                    name: public text, look: public text },   // minted variant
                 qty?: number,
                 place: { carriedBy: castKey | actorId } | { groundIn: zoneKey | zoneId } } ],
  hiddenTerms: [ string ],     // words that must not appear in public text
  weaverNote:  hidden text     // replaces the previous note; keep it short
}
grade = none | minor | moderate | major | extreme
```

**Lethal.** Each entry in bands carries lethal: true | false, default true. It is saved on the band, and an existing band keeps its value. Agent Weaver sets false only for a conflict nobody means to end in death, such as a hostage-taking; monsters such as slimes are lethal. A spar is not a band setting: it has its own engagement kind (Sparring). Code reads lethal when the player goes down (D-54, built 09/11/2026): if any active actor hostile to the player belongs to a lethal band, the story ends on the "You fell" screen. Otherwise (bands marked not lethal, a spar, or nobody left standing to finish the job) the player makes one survival roll, roll() with no skill and no modifiers: Near Miss or better wakes at Critical and the scene breaks (cause knocked\_out); the Weaver gets target.wake and plans a new place whose first zone is where the player wakes, somewhere safe. Failure or worse ends the story the same way. A wake plan with no new zone fails validation (wake\_needs\_zone).

**Challenge and gain grades \[Proposed scale\].** A stage plan declares a challenge grade (how hard the scene is for this player: level, class, health) and a gain grade (what it can pay out: loot, XP, information, allies, quest progress). Code accepts the pair only if it fits the tier:

| Tier | Challenge | Gain |
| --- | --- | --- |
| Critical Failure | Major or extreme | None or minor |
| Failure | Moderate or higher | None or minor |
| Near Miss, Success | Minor to major | Within one step of challenge |
| Great Success | At least major | Major |
| Critical Success | Extreme | Extreme |

Grades are hidden-side and never reach Agent Narrator. A computed cross-check (cast and rewards against the declared grades) is a stub that passes for the cast; rewards are held to the gain's Boon budget (Part 5 §7, loot V8).

**Validation.** Code checks every stage plan before it touches state:

- every id resolves (story blueprints first, then the library); an unknown body type fails (Part 3);
- caps on cast size, zones and frontiers (placeholders); every cast entry names a band, every band reference resolves (the plan's new bands, then the story), and relations and stances use only hostile, opposed, neutral or friendly;
- every zone link points to a zone in the plan, on the stage, or a frontier;
- triggers use the trigger vocabulary and hold one order each, of a type the engine knows (ORDER_TYPES); every secret has leakTerms; a check\_passed secret names a library skill;
- the grades fit the tier;
- no public field contains a hiddenTerm or a secret's leakTerm, matched as whole words (as the Narrator's leak scan matches);
- public text respects TEXT\_CAP (placeholder). Hidden-only notes (event summary, band goals and temperament, motive, routineGap, plan goal, secret fact, Weaver note) are not rejected for length: code trims them to NOTE\_CAP at a word boundary.
- rewards never fail a plan; code repairs them and logs each repair (reward\_repaired): a reward with an unknown item, base or place, or one that would take the plan over its Boon budget (Part 5 §7), is dropped; a bad qty becomes 1; a minted variant past the per-scene cap, at a gain that allows none, or whose name or look is too long or uses a hidden term is placed as its plain base item; a quality above what the gain allows (Part 5 §7) is lowered to it; a weapon's boosts other than hitAdj or damageAdj becomes hitAdj (loot L1, V7);
- every routineSetId resolves; a player-band entry names the companion set and binds no slots;
- every slot the set lists is bound: a zone slot to one zone, a route slot to 1 to MAX\_ROUTE\_ZONES zones (one zone: the actor stays there); bound keys are zones in the plan or on the stage, never frontiers; startAt names one of the set's slots;
- every bound zone is reachable from the actor's other bound zones through zone links;
- routineGap respects its length cap (placeholder).
- every knows fact is public text: it respects its length and count caps (placeholders) and is scanned like other public fields;

**Defaults filled before validation.** A trigger inside an NPC plan with no ownerId belongs to the plan's owner; a trigger with no once fires once; a place with no parent (missing or null) is top-level, and a new place may name another new place as its parent; a plan with no steps gets an empty list. Validator errors are listed once each, with a hint where the Weaver mixes fields up (a stance in an awareness field; a secret in knows). The repair retry sends the rejected plan back with its errors and asks for only those fixes.

**Failed stage plan.** A plan that fails validation gets one repair retry with the validator's errors. If it fails again, or the call fails, or (scene start only) it passes WEAVER\_TIMEOUT (config), code builds a fallback stage: the place's saved zones, or one empty zone per frontier label; no new cast; grades none/none. The fallback is flagged so it cannot be missed:

1. The stage record carries fallback: { reason, turn } until the next scene start.
2. The turn record logs weaver\_fallback with the validator's errors.
3. The GM debug view shows a red banner while any fallback area is on the stage.
4. The play screen shows a small out-of-character marker ("Scene planning failed: placeholder area"), with no details, until the next scene start.

**Routine-only failures \[Proposed\].** After the repair retry, a plan whose only errors are routine errors still applies, minus those errors. Routine errors are an unresolved set, a missing or invalid slot binding, an unreachable bound zone or a bad startAt. Each actor with an error gets the library routine idle\_here: a wait routine with activity rest, here bound to its first valid bound zone, else the plan's first zone. Code logs routine\_fallback with the validator's errors, and sets the same four flags as a fallback stage.

**Model.** Agent Weaver runs on Claude Opus 5.5 for both scene setup and stage extensions: model "claude-opus-5-5", with modelTier "complex" as the fallback, and effort always set explicitly (Opus 5.5 defaults to medium). The artifact runtime (contract 0.2.96) accepts only low, medium and high, so the build sets WEAVER\_EFFORT = "high" (config), never max (D-33 closed). The agent log records modelApplied for every Weaver call.

Fixed instructions (sent as the leading user turn) **\[Proposed\]**:

```
You are the Weaver of a text RPG. You decide what is happening at a place and
who is there, so the scene fits the hand the dice dealt. You never narrate,
never decide outcomes and never roll dice.

You receive WEAVER_VIEW: the tier and what it means for this scene's stakes,
the place or frontier to plan, the stage so far, who is already present and
what they are up to, the story's quests and flags, the bands present with
their goals and relations, a short
summary of the player, your previous note, and the catalogs of ids you may use.

Rules:
1. Plan the event first, then the cast. The tier sets the stakes: bad tiers
   bring a real challenge with little gain; normal tiers match gain to
   challenge; high tiers bring high gain with a matching high challenge.
   Declare the challenge and gain grades honestly.
2. The tier decides who and what, not how alert anyone is. Threats may be
   calm, busy or unaware.
3. Use catalog ids for every mechanical thing: templates, body types,
   routine sets, items. Give each new actor one routine set and bind every
   slot it lists to zone keys from your plan or the stage. Never write
   routines or numbers. If no set fits, use the closest one and say in
   routineGap what you wanted. Free text is for names, labels, appearances,
   how places look, and your hidden notes.
4. Keep public and hidden text apart. Public text is only what anyone present
   could see or hear. Never hint at plans, ambushes, motives or secrets in
   public text. List in hiddenTerms the words that would give them away.
5. Fit what already exists: actors, plans and facts in your view stay true.
6. Put each actor in a band. Create a new band only when no existing band
   fits. Set band relations, beliefs about other bands and personal stances
   only where the scene needs them; band names are public, goals hidden.
   Stances: hostile attacks on sight, so use it only for a fight that starts
   the moment they meet (monsters, a raid). Use opposed for rivals, standoffs,
   tense guards and threats that talk first: they are wary but never strike
   first, and turn hostile if attacked or talked into it.
   Mark a band lethal: false only when nobody means the conflict to end in
   death, such as a hostage-taking or a beating meant to teach a lesson. Monsters are always lethal.
   A friendly bout (a training yard, a tournament, two guards sparring) goes in spars instead.
   To make an actor differ from its template, give it a personality: a Nerve line, up to two types and up to two
   values from catalogs.personality.
7. Seed a plan only for a real agenda. Everyday behavior goes in routines;
   an actor with a plan stops being an ordinary NPC.
8. Keep your note short: what the story is building toward and what you set up.
9. Seed at least one beat: a trigger with when {"type":"quiet_turns","turns":N} that moves
   the story when play goes quiet (someone arrives, the watch comes, an NPC acts). Set
   "endsScene": true on a beat that should close the scene.

Return only JSON matching the schema.
```

### Opening narration

At scene setup step 8, code adds to the turn's events an arrival event for the player and a presence event for each actor the player perceives on arrival, computed by computePerception (level full or partial, with a cue). Agent Narrator also receives the player's zone and the zones linked to it with sight (frontiers by label), and visible state per Part 3. Every full presence event must be listed in "narrated" (fact check); partial ones may be left out. Each presence event carries the actor's current activity look, which is public text.

Never in NarrationView: the tier, grades or event roll; the event summary, Weaver note, plans, triggers or secrets; opening beliefs or attention; or any tone or mood hint derived from the tier.

**Public and hidden text.** Every free-text field in a stage plan is either public (what anyone present could see or hear: labels, appearance, how a zone looks) or hidden (event summary, motives, notes). Only public fields reach Agent Narrator. The plan lists hiddenTerms: words and phrases that must not appear in public text. At validation, code scans public fields for hiddenTerms and for every secret's leakTerms; a hit fails validation (repair retry, then fallback). While the stage is active, the Narrator's leak scan also checks its hiddenTerms.

**Names.** Each cast entry has a public label ("a scarred dockhand") and a name. Agent Narrator gets the label until the player knows the name. The Journal gains namesKnown. A name becomes known when the Weaver marks the actor knownOnSight (public figures); when an Agent Voice or Agent Responder line introduces it (output field introduces, accepted only for the speaker or actors in its knows); or when a revealed secret or shared fact names it. The existing leak scan already rejects names outside the view.

### Explore mode

In Explore no Planner runs: unaware actors follow routines, the player is detected only on major actions, and an attack needs an ambush roll to surprise.

#### Routines

- Each actor follows one routine at a time from its routines list, the routines of one library routine set. A routine is a desired-state function (Game state model). At scene setup Agent Weaver picks the set and binds its slots; code sets the anchor.
- Each turn, every active actor with no higher-priority order reads its desired zone and activity from its ActorView. Elsewhere: it moves one zone link along the shortest path. There: it performs the activity. Actors are processed in actor-id order; ties use the seeded RNG. If no path to the desired zone exists on the stage, the actor stays in its zone, performing the step's activity, and code logs routine\_unreachable **\[Proposed\]**. Whether a stage trim may cut off a bound zone stays deferred (D-46).
- **Clear sight (Ali, 07/11/2026, Q17).** The player's Journal keeps clearSight: each actor the player has seen fully by sight (or made out with a successful look), with the zone it was in. While that actor stays in that zone, and the zone is the player's own or in sight of it, its events reach the player as full sight, dark zones included. A move or flee the player does not see fully removes it; one the player does see records the new zone.
- Moves and activities emit ordinary move and idle events with the activity's noise and visibility, and go through computePerception, so the player perceives patrols (a partial event, sound only).
- An activity's attention level is passed to the ruleset as a situational tag on perception rolls and checks. The ruleset owns its value (stub: 0).
- Actors that aren't engaged keep following their routines during Tactical turns too.

#### Stealthy posture

Ali, 08/11/2026, ST1–ST10.

- A hide or sneak action sets player.posture = 'stealthy' (display name "Stealthy", POSTURES scale). It stays over moves until the player acts openly.
- Sneak costs nothing: it keeps the turn's move and main action. Hide is the main action. Both are offered in the Ideas panel; code picks the skill (Sneaking, or Combat Stealth while engaged or attacking).
- What ends it: speaking above a whisper, any speech action, and a melee attack (the blow shows you). A ranged attack keeps it; the shot is noticed only through the stealth contest (Combat Stealth) per observer.
- While stealthy, the player's events reach only observers already aware of them; everyone else is reached only through the contest.
- **Situation tags** (ST21–ST22, Ali 08/11/2026). Situational modifiers apply by tag: each skill lists its situation tags (docs/skill-tags.md), and each situational table names the tags it reaches and the sign (CONFIG.SITUATION\_TAGS). Light (LIGHT\_MODS, read where the action is) hurts sight (every attack, Block, Dodge, Sight) and helps stealth (the three Stealth skills). Cover (COVER\_GAP, in tiers) helps hide (Vanishing) and hurts a ranged attack against a target in cover (a gap shift, as before). An action can add a tag: a Hide adds hide and ignores the move role, so leg wounds don't count (ST10). In a stealth contest both rolls get their own tags' tables, so darkness also hurts the observer's Sight. Darkness never hurts hearing, so against an observer who only hears the player, light gives the stealth roll no help either (Ali, 08/11/2026, P14). Leg wounds stay on body-part roles. Hearing and Tremor carry a hearing tag (Ali, 08/11/2026); no table reads it yet (the noise work will).
- **Unblinking** (ST23, the sight 60 perk): an observer with it who loses a Vanish must also lose a Sneaking or Combat Stealth contest before losing the player.
- Hide and Sneak never shake off someone who already sees you (ST12): those observers get no roll.
- **Vanish** (ST11–ST19) is active hiding: a move that breaks established sight, so it needs a destination one link away (with none, the Parser asks where). Which part of the turn it uses is a balance lever for later (ST13). Every observer who could perceive the move contests it against the player's Vanishing. One who saw the player and loses it drops to suspicious at the zone the player left (test 3); a tie or a win changes nothing for them. For everyone else a Vanish counts as a passed Sneaking or Combat Stealth check (ST16). Light and cover help it, and leg wounds count.
- For a foe who still sees you, being Stealthy changes nothing: they keep seeing you and the engagement goes on (ST15).
- A shot's target that loses the notice contest still turns suspicious, at the shooter's zone (ST19).
- Each observer gets at most one stealth contest per turn.
- **NPC stealth** (NS1–NS10, Ali 08/11/2026, settles OQ-14). Every actor follows the same rules: posture, the three Stealth skills, the contests, Vanish and Unblinking. An NPC's sneak or vanish names the zone it goes to (Planner actions sneak and vanish); its hide is the main action, as for the player. A stealthy NPC's events reach only its own band and observers who see it (aware). Observers are everyone outside its band, the player included, so NPCs contest each other too (NS5). The Planner decides when an NPC goes stealthy (NS8).
- **Your belief about a stealthy NPC** (NS2–NS4). You roll for yourself like any observer (NS3). You simply see open actors. For each stealthy one you keep a belief (journal.stealthSeen): unaware hides it, suspicious shows "someone", aware shows it as usual. When an NPC goes stealthy you keep it as far as you see it then (ST12); a stealthy NPC's move you don't perceive at all drops aware to suspicious. When it turns open the belief is cleared.
- **Ambush on the player** (NS6). A stealthy NPC that attacks you while you are unaware of it makes the ambush roll against your perception, as you do against NPCs. A melee blow still shows it.
- **Companions** (NS9). A member of your band on a follow routine copies your posture each turn. A routine can be stealthy (the thief's prowl and lie-low), which keeps the actor stealthy while it follows it.
- **The village thief** (NS7): template thief (Sneaking 40, Combat Stealth 30, Vanishing 30, Light Melee 35, Light Armor 25, Dodge 30, Sight 30, Hearing 30; dagger and gambeson) with the routine set thief (prowl, lie\_low\_alert, wait, wait\_alert).

#### Detecting the player

- Detection happens only on the player's major actions. isMajorAction() is a stub that counts every player action as major until the term is defined (D-34).
- Each observer who could perceive the action (the existing perception range) and is unaware or suspicious of the player gets one test:
  - Sneaking player: the observer's perception roll against the player's stealth roll (ruleset.contested).
  - Open player: no check or roll. The observer's perception level of the event (computePerception) decides: full makes it aware, partial makes it suspicious, none leaves it unaware.
- One test per observer per action: for a hide or sneak, the stealth contest in the simultaneous-order rules (Resolution engine) is the detection test, and detectPlayer skips observers already contested on that event. To be revisited (D-40).
- The result goes to updateBeliefs, which stays the only writer of Belief. A won contest makes the observer aware and a tie makes it suspicious; against an open player, full perception makes it aware and partial makes it suspicious (settles OQ-5, Ali, 07/11/2026).
- Observers unaware of the player don't perceive the player's minor actions at all.

#### Ambush: attacking from Explore

When the player attacks an actor that is unaware of them, code resolves the ambush before the blow:

1. The player makes one ambush roll, contested separately against the perception roll of the target and of every other observer who could perceive the attack. Which skill makes the ambush roll is a ruleset matter (stub).
2. **Player beats the target: surprise.** The target keeps its routine order this turn. The target's defense roll takes the unaware situational modifier (value placeholder). The ruleset may also apply an unaware tag to its initiative.
3. **Target wins: failed ambush.** The target becomes aware before the blow and defends normally. Its onAlert fires: this turn if it hasn't acted, otherwise next turn unless it then has an agent order. It is engaged from the next turn, and a significant target's Planner order outranks onAlert. Running a Planner for failed ambushes in the same turn is deferred (D-36).
4. **A witness wins.** It becomes aware and its onAlert fires the same way. If it is hostile to the player it is engaged from the next turn; otherwise it is alarmed.
5. **Nobody wins, or nobody perceives the attack.** Observers stay unaware. A kill nobody perceives leaves the game in Explore.

#### Alarm

- A non-engaged actor that perceives an attack or an alarm becomes alarmed. The onAlert order of the routine it is following fires once (Hidden state persistence). Code saves that routine and its anchor in Mind.alarm.returnTo, and the actor switches to that routine's alert variant, anchored at the current turn.
- It calms after DECAY\_TURNS turns with no attack or alarm perceived and returns to the routine in returnTo with its saved anchor, so a schedule continues in phase. An actor whose routine has no alert variant keeps that routine throughout. If an agent switches the actor's routine while it is alarmed, the switch stands and returnTo is cleared.

### Latency and cost

Without streaming, the player waits for the whole turn, so the parallel parts matter more.

| Mode | Wait after submit |
| --- | --- |
| Explore | Parser + Narrator |
| Dialogue | Parser + the spokespeople's calls (in parallel) + Narrator, shown no earlier than DIALOGUE\_WINDOW after submit |
| Tactical | Parser + Narrator (the Planner already ran in the background) |
| Turn that starts a scene | Parser + Weaver + Narrator |
| Turn that crosses a frontier | Parser + Narrator (the Weaver ran in the background), plus the Weaver's remainder if it is late |

- **Expected waits.** From the runtime docs: on the quick tier a short prompt answers in 1–2 s; on the default and complex tiers Claude thinks first, so first text usually comes after 5–60 s, and up to 2 minutes for a long structured prompt. The Narrator and the Weaver on thinking tiers set the turn's wait. The first Claude call of a session also waits on the viewer's consent dialog. Set BACKGROUND\_WINDOW and DIALOGUE\_WINDOW from times measured in playtests, not from these ranges.
- **Background Planner.** The Planner never needs this turn's input, so engaged actors' Planner calls run while the player reads the last narration. Background Weaver calls for frontiers run the same way.
- **Model per job.** The Parser on the smallest fast model; the Planner, Responder and Voice on the same small or mid model; the Narrator on the strongest model; the Weaver on Claude Opus 5.5 (Agent Weaver: Model).
- **Runtime check.** The artifact's Claude-call capability (sample, runtime 0.2.96) accepts a model tier (quick, default, complex) or a named model, plus effort (low, medium, high), so agents can run on different models. It has no system prompt, no max-tokens setting and reports no token counts. Every agent call is built the same way: input = \[{role: "user", content: FIXED\_INSTRUCTIONS}, {role: "user", content: PER\_TURN\_DATA}\], plus modelTier or model and effort; agents that return JSON call sample.json. Answer length is set only by the prompt. The agent log records modelTierApplied for every call, and modelApplied when a model was named \[Proposed\].
- **Call cap.** MAX\_PLANNER\_CALLS bounds cost in large fights; overflow actors run their type's combat list.
- **Call slots.** Only a couple of Claude calls run at once per viewer; a few more wait their turn and a flood is rejected (rate\_limited). Background Planner and Weaver calls share these slots with the turn's own calls, so parallel calls can queue and a queued Planner call is more likely to be late (planner\_late). Size MAX\_PLANNER\_CALLS and BACKGROUND\_WINDOW with that in mind. **Turn calls first (Ali, 10/11/2026, Motion Rules Review Q4):** the turn's own calls (Parser, dialogue calls, Narrator, a scene-start Weaver) always go ahead of background Planner and Weaver calls. Background calls start only while no turn call is waiting or running, and together never take more than CALL\_SLOTS − 1 slots (config, 2 until the slot count is confirmed), so a turn call never queues behind them and a fight with more significant NPCs answers no slower; background Planners therefore run one after another, nearest first. A call already running is never cut off (src/agents/call.ts, callGate). Abort a call (its signal) as soon as its output can no longer be used, so the viewer stops paying for it. The exact slot count is unconfirmed.
- **Compact views.** Ids, short descriptions and the last few relevant events, not the full log.
- **Prompt order.** Each agent's input starts with its fixed instructions (a leading user turn, since the capability has no system prompt) and ends with the per-turn data; nothing that changes per turn or per actor goes in the fixed part. If the platform caches prompt prefixes, this makes repeat calls faster; the runtime docs don't say it does (OQ-11), so estimates assume it doesn't. Pass cache:false on calls whose repeat must give a new answer.
- **Waiting state.** Show the same waiting line in every mode until the Narrator's checked text is ready (Play screen motion, M-01).
- **Streaming** is off for now; revisit after playtests (D-24).
- **Timing rule.** Resolution never starts before the previous display plus BACKGROUND\_WINDOW (config), in every mode. In dialogue turns, results are also shown no earlier than DIALOGUE\_WINDOW (config) after submit, set at or above the Responder's usual latency, so guarded and ordinary NPCs answer in the same time. Known limit: retries still change timing (D-45). The call count and the running agents show only in the GM view (play screen review UI1, UI3).

### Leak prevention, validation and failure handling

Every model output is checked before it touches state or the screen, and every failure has a fallback so the game never stalls. All checks are code; none adds a Claude call except the single regeneration or repair retry.

| Check | What it catches | On failure |
| --- | --- | --- |
| JSON schema on Parser, Planner, Responder, Voice, Narrator, Weaver | Malformed or missing fields | One repair retry with the error; then the fallback for that agent |
| Legality on the Parser | Targets, items or skills not in PlayerView (a speech action's skill is set by code from its type, so the Parser's is dropped) | Turn stops; ask the Parser's clarify question, else a question about the failed part ("Who do you mean? I can see …", "Which item do you mean?", "Where do you want to go?"), else a generic "What do you do?" (provisional, see D-21) Exception (Q16, Ali 07/11/2026): when the intent has a legal move and only its addressees or action target are out of sight, the move resolves this turn, the action and words are dropped into deferred (logged deferred\_to\_arrival), and the Play screen offers them in the empty action box after the turn |
| Legality on Planner, Responder, Voice | An order targeting something the actor has no belief about | Drop the order: the Planner's actor uses its combat list; a Responder or Voice uses the fallback reply. Log view\_leak if the id is real but outside the view; log invalid\_target if it doesn't exist |
| Gear legality on Parser, Planner, Responder, Voice | An item the actor doesn't hold or can't see, a mode the item lacks, a gear op on an item out of reach | Drop that op or field; the action stands if still legal; log invalid\_gear |
| Planner timing | A Planner call not back by BACKGROUND\_WINDOW | Combat list this turn; discard the whole output; log planner\_late |
| Reveals on the Responder \[Proposed\] | A secret id the actor doesn't hold | Drop that reveal; log invalid\_reveal |
| Barks in NPC views | A bark event inside an OppositionView, DialogueView or ActorView | Build-time error: view builders never copy bark events (unit test) |
| Facts on the Voice | A shares id not in knows, or a name or fact in line outside the NPC's view | Regenerate once; then a neutral line from the NPC's sheet |
| Leak scan on the Narrator | Names, ids, leakTerms of unrevealed secrets, or facts from unperceived events that are not in NarrationView; the active stage's hiddenTerms; names of actors not in namesKnown | Regenerate once with a note; then the fallback narration |
| Fact check on the Narrator | An id in narrated that isn't in NarrationView; a full event that changes the player's condition, inventory or position missing from narrated; a full presence event missing from narrated; names of characters or items outside the view | Same as the leak scan |
| Stage-plan validation on the Weaver | Unresolved ids, caps, broken links, unparseable triggers, grades that don't fit the tier, hiddenTerms or leakTerms in public text, over-long text, unresolved routine sets, missing or invalid slot bindings, unreachable bound zones, a bad startAt | One repair retry with the errors; then the flagged fallback stage; after it, routine-only errors degrade those actors to idle\_here |
| Routine switch (Planner, Responder, Voice, calm bandmates) | An id not in the actor's routines list, or a routine reading a slot the actor has not bound | Drop the switch; keep the current routine; log invalid\_routine (bandmates: routine\_skip) |
| Routine bank import (designer tool, not play) | Unresolved ids; a schedule with no steps, or steps on follow or wait; a slot read but not declared in every set that lists the routine; a shared routine reading a non-standard slot; an alert id not in the same set; a $slot target not declared | Entry not promoted; errors shown to the designer. The library never holds a failing entry |
| Call failed: upstream\_error \[Proposed\] | A transient service or connection failure | That agent's fallback this turn; no automatic retry; log call\_failed |
| Call failed: rate\_limited \[Proposed\] | Too many calls, or the viewer's usage limit | Fallbacks this turn; skip background Planner and Weaver calls until the next player action; show a short notice; log rate\_limited |
| Call failed: refused \[Proposed\] | Claude declined the input | The agent's fallback; never resend unchanged; log refused |
| truncated: true, or invalid\_json from sample.json \[Proposed\] | An answer cut by the length or time limit, or no parseable JSON | Same as malformed JSON: one repair retry, then the fallback |
| Call failed: not\_granted, sampling\_disabled, session\_expired \[Proposed\] | The viewer can't use Claude in this view | Stop play with a message to allow Claude or sign in again; no fallback play |
| Call ended: cancelled | The page aborted the call itself, such as a Planner call cancelled on a dialogue intent | Not an error; log as unused |

Every retry is single and changes its input. The runtime docs forbid retrying from a loop and treat only upstream\_error as transient. Error codes are the runtime's own.

Limit: code can't catch an invented unnamed figure ("another guard"). The prompt rule and playtests cover that.

The fallback narration's form is still open (D-23). Until then, build it from the events with plain templates.

Each actor type's combat list (Fallback behavior) keeps the game playable even if every Planner call fails, and covers actors beyond the call cap.

**GM debug view.** A toggle that shows full state, hidden plans, rolls, each actor's beliefs, and each agent's exact input and output for the turn. It's the fastest way to spot a leak.

### Play screen

One self-contained page for PC only, built with the HISAB design system (https://claude.ai/artifact/PsxYHump4Sjy9iz9GvXkfx): its tokens and HISABRound fonts (story text in Literata, SIL OFL, embedded; Ali, 07/11/2026), one theme only (Sky diary Night; no picture credit, as this is a personal-use project, Ali 07/11/2026), no network calls except the game's own Claude and database capabilities. No max width, 32px gutters, 1.3× zoom at 2400px and wider, 64px rail items, dates DD/MM/YYYY.

Read HISAB's README, tokens.json, components/bundle.css, navigation.md, patterns.md, data-display.md and checklist.md before building, and invent no colours, radii or spacing. These design rules are binding for every play screen:

- **Navigation:** a side rail per navigation.md. Items are 64px tall with no gap, and the active item is a pill filling the whole item. Nothing shrinks on short windows; the rail scrolls on its own. Its pages \[Proposed\]: Play, Character (/stats), Inventory (/inv), Quests (/quests), Journal and, when on, GM debug.
- **Visibility (Shown / Left out):** clickable summary tiles all behave the same. Clicking the big box cycles Shown → Left out → off (several Shown = either). Clicking the small heading ("INVENTORY ›") opens that group. Use the words "Shown" and "Left out", never "Only". A figure that can't be clicked this way goes in a text line under the row, not in the tile row.
- **Matching tiles:** tiles in one row share the same sub-line kind, units and ⓘ placement. When one page gets a feature, matching pages get it too.
- **Tables and grouping:** related entries fold under one head row with combined values (sum, earliest start, latest finish, average, "Mixed" when values differ, latest status) and a ↻N chip that opens the sub-rows. Sub-rows are numbered by start date. Order by start date, then finish date, then title in natural number order. Clicking a field's text opens the details panel with that field in edit; clicking empty space folds or unfolds. Charts go under the table they explain.
- **Estimates:** every estimated number shows its source line and a link, and stays editable.

* **Creation screen:** the approved layout at https://claude.ai/artifact/HW45ivigqwZ5VDo4PWPv9u (Part 4 §4, Player creation). The story starts from it.
* **Header:** the story title; under it the turn and the place line (the character's zone, then its place and parent place). The day and time of day follow the turn (T11). No mode word, Claude-call count or background-call note: each changes with the encounter mode, which is hidden. The call count and the running agents show in the GM view (play screen review UI1, UI3, 09/11/2026).
* **Your deals** (Ali, 08/11/2026, PM5 and Deals display K1 c): an "N deals" chip beside the scene title opens the player's deals with NPCs (PlayerView.agreements) in a gold-edged, gold-tinted list: who each deal is with, what each side will do, and the turn it was made. A click outside or Escape closes it. There is no chip while there are no deals. A deal leaves when a party ends it as done or broken; deals between NPCs never show.
* **Layout A, "Book with a status strip"** (play screen review UI8): fixed rows (header, who's here when it drops below the header, story, input) so nothing jumps; one reading column of about 70 characters a line (Literata, sized by the fit-the-screen rule, line height 1.6) on the left, over a stronger veil; the free space goes to the right margin. The side sheet is a narrow status strip by default (health level and bar, damaged-part chips, what is held, Stealthy); a click opens the full sheet as the 420px side panel, which pushes the story narrower. Open or closed is remembered per PC.
* **Who's here:** sits in the header line, between "Turn N · place" and the switches, while everyone fits; when too many people are around or the screen is narrow, it drops to its own fixed-height row under the header. It lists the actors the character fully perceives (PlayerView), by label until the name is known; "Nobody in view" when empty. Others' health shows only from Wounded down (Part 3), never as a bar (Voyage C2, U6, U7).
* **Narration log:** checked narration, newest last. While a turn runs, one neutral line for every turn, "The story is moving… 12 s", with "Taking longer than usual" after 90 s; it never names the agent (play screen review UI2). Story text is set in Literata.
* **Turn results** (UI4): under each turn's prose, in one place: the check line, every roll made against the player that they perceived (LogLine.incomingChecks), the turn's changes row, gear changes (LogLine.gear, ready-to-show rows the game writes when the turn ends; with the place, scene and the player line's aimed flag they survive a reload), skill gains, XP, and gold cards for level-ups, achievements and perk milestones, which show even with mechanics off. The check line never sits above the prose it describes.
* **Check line:** the player's own roll this turn with no numbers: skill, tier, the other side's tier, how far apart they are ("1 tier ahead") and the result, e.g. "Medium weapons Great Success vs the slime's dodge Success · 1 tier ahead · full hit, body" (Voyage U10). It opens with an icon for the kind of roll (attack or talk), and each tier is a chip tinted green (Great Success and up), blue (Success), amber (Near Miss) or red (Failure and worse) (Ali, 07/11/2026).
* **Speaker lines:** each line the character heard, word for word under the narration: the speaker's name in a column on the left, sized to the longest name, with how it was said (whispering, shouting) under it, the line on the right, vertically centred (Narrator rule 5; Voyage U9, U12, style A picked by Ali 07/11/2026). *Stage directions* show in italics without the asterisks, outside the quote marks; the player speaks as "You".
* **Turn changes:** one folded row per turn ("Turn 14 ↻3 You are Bruised", or "3 changes") that opens to one typed row per change: Combat, Condition, Health. Built by code from the combat packets the character perceived (Voyage U14 to U16).
* **Commands and Ideas:** two buttons in the tool row under the input open a panel above it, at most 40% of the story's height; Escape, a pick or a send closes it. Commands lists the / commands (D-100). Ideas lists everyone in view for Fight and Talk and up to three actions each for Move, Stealth and Use, built by code from PlayerView (D-107); the same name twice reads "the other …". Picking one fills the box; nothing is sent until Send.
* **Input:** one free-text box across the reading column with Send beside it; a line starting with / is a command (Part 1 §7). The tools (Commands, Ideas, Aim, Sneak, Hide, Vanish, the quick-heal slot) sit in one row under it. What the player put off last turn shows as a dimmed suggestion in the empty box ("From last turn · Tab to use, Esc to clear"); nothing is typed or sent until they take it. PageUp and PageDown scroll the story while the box has focus.
* **Input keys:** the action box keeps focus; what it sends is trimmed, and an empty line sends nothing. Narration is paced (Play screen motion, M-10); skipping uses a click on the story or Esc, never a key that types (Voyage A7, decided by Ali 07/11/2026; was OQ-24; M-12).
* **Aim toggle:** marks this turn's attack as aimed (Part 1 §7); an aimed turn's player line ends with "· aimed" (from the line's saved `aimed`).
* **Rolls:** while SHOW\_MECHANICS is on, each turn's dice, modifiers and damage fold under "Rolls" in that turn's results, wrapping. A "Show rolls" switch in the header sets the story's showMechanics (UI6).
* **Undo:** after /undo the undone turn's lines fold under one "Undone · turn N" row (struck through when opened), and the note reads "Turn N undone. Dice are not rolled back."
* **Story list:** the story is an append-only list (role=log) that announces each new turn once; the waiting line is a separate status. It draws the last 50 turns with a "Show earlier turns" button, and a redraw never closes an opened fold.
* **Out-of-character notices:** the scene-planning failure marker (Agent Weaver), the rate-limit notice and the stop-play message (Leak prevention, validation and failure handling).
* **Perks (Character page)** (Ali, 07/11/2026, K1–K4, S1, S7): a perk point is spent any time on the Character page; the rail shows a dot while one is unspent, and the level-up line on Play links there (K2). A taken perk can be undone until the next turn is played, then it is permanent (K3). Two views behind a "By tree / By effect" switch. By tree: a tab per skill tree, each skill a ladder of its seven milestones on a gold line showing true skill, the All-50/100/150 steps as dotted lines across the tree; on narrow screens the ladders become horizontal tracks. By effect: tracks in the same style grouped by what the perks do (Attack, Defense, Health, Speed, Senses, Speech); each group folds when its name is tapped. Milestones not yet reached are sealed and show only their number; the page never hints at what comes next (K4). Tapping a taken or open milestone shows a small card beside it with the perk's text and, when open, "Take · 1 point". Mock-ups: https://claude.ai/artifact/TVfF7qs3WnDdDZzzM6Yjf5
* **Journal page:** People (actors seen clearly now, or whose name is known; a label until the name is known; health only from Wounded down), Places (the current place and those above it, plus places of facts the character witnessed, folded under their parent place; the Map page draws their zones) and a Timeline (turns played since the page was opened). Built from PlayerView, the Journal and the story log only, never the hidden store (Voyage U26, U28; Ali, 07/11/2026).
* **Map page:** its own tab after the Journal. One map per top-level place, with each inner place outlined as an area; zones are tiles joined by their exits, placed by a force layout that follows the exits' compass words (north is up; up/stairs above, down/cellar below). Shows every zone the character stood in or saw across a sight link (journal.zonesSeen, noted at the start and end of each turn), plus exits not taken as stubs. Each top-level place (a village, say) is its own map; a road to a known zone on another map is a stub naming that place, and clicking it opens that map. A World crumb, first in the crumbs, shows every top-level place you know as one tile, joined by the roads you know between them (laid out by their compass words); clicking a place opens its map. Light, cover, people and ground items show only for zones in view now; remembered zones keep name, look and exits; people out of sight show where last seen. Pan, zoom, find me, show the whole map, place crumbs; clicking a zone opens its card (look, exits with a go button, people, items) beside the map with the places list and key. Built from PlayerView and the Journal only, never the hidden store.
* **Side sheet health:** the health bar marks the health-track thresholds and names the current level; clicking it opens each body part with its pool and state (Ali, 07/11/2026). Any part that is not Healthy shows as a chip under the bar ("Left leg crippled") in its state's colour, and the body figure opens by itself on a turn that changes a part. A "Held / worn" line names the gear in use.
* **Colours and depth:** every colour comes from the HISAB tokens in `:root` (health levels run ok → warn → danger → grey; time of day uses c4, scene-mark, c7 and accent; perk gold is scene-mark). No glows and no drop shadows except the toast shadow; tests/unit/styles-tokens.test.ts enforces both.
* **Place and scene breaks:** when a turn takes the player to a new place, a quiet rule named for it ("River path · the Riverside") sits between the player's line and the prose; a new scene in the same place gets the rule without a name. It reads the place and scene saved on each narration line (`place`, `scene`), so breaks survive a reload; undone turns are skipped when comparing.
* **Morale bar (MB11, MB16):** the status strip and the full sheet show the player's morale under health, in its own colour (c5): the level word in the strip; the level, morale left of max and the track's thresholds as ticks in the full sheet. Who's here shows another actor's morale level only from Afraid down, as PlayerView gives it.
* **After /yield (MB40–MB43):** while the player's yield stands, the status strip and the full sheet show a "You yielded" box under morale (warn tint): who took it, who is still deciding and who fights on (danger), by the names the player knows them by. It goes when the scene ends.
* **Learning window (SP2):** every skill bar, on the Character page and in the full sheet, draws the skill's learning window (raw − MARK_WINDOW to max(raw, true) + MARK_WINDOW) as an outlined range on the same 0–100 scale; the Character page also prints it as numbers ("20–40") beside the true skill. An augmenting skill (Riposte, Blade Dance, Shrewd Dealing) learns only on the rolls it adds to, at the roll's level (AU1), so its bar shows that roll's window, dashed, and the numbers read "via Parry 50–70" (augmentWindow). The play page shows only the player's own window, never the foe's skill.
* **Agent bar look:** "Watch an agent play" is a switch in the header beside Show rolls (✓ when open), so the bar takes no room while closed. Open, it is one quiet panel under the header: which story, Playstyle, Pace and ✓ Voice on the left; One turn, Play (main button) and × pushed right; the agent's spoken line under them in story type, labelled Agent.
* **Fit the screen (Ali):** the Play screen always fills the window, with no empty spaces. The full sheet is open by default at every width (wide and narrow screens each remember a fold); the open sheet is a fixed 300 px (--sheet-w), as narrow as its skill rows, and every block on it is kept that compact: a small body figure with its key beside it, labels that don't wrap. The sheet shows no scrollbar: the mouse wheel scrolls it, and so does dragging it with the mouse (a drag doesn't count as a click). The story column fills all the space beside it, with no reading-width cap, and its type grows with the screen (clamp(16px, 0.45vw + 10px, 20px)) so wide lines stay readable; speech lines are 16px.
* **Divider lines:** the gap under the story and the sheet sits inside each column, so the sheet's divider runs to the foot of the screen.
* **All-XXX counts (Perks, by tree):** each All-50/100/150 line reads "n of need", where need is the tree's rating requirement (CONFIG.ALL_STEP_SKILLS via allStepNeed), the same rule the mastery achievements use; an inferior tree reads "never".
* **Keyboard order:** Tab runs input, tool row, side sheet, then the rail (the rail is last in the page and placed in the first column by CSS). Rail labels use tighter tracking so "Achievements" fits the 84px rail.
* **"You fell" screen:** shown when a lethal fight incapacitates the player, offering /undo or reset (D-54).
* **GM debug view toggle** (Leak prevention, validation and failure handling).

### Play screen motion

Decided by Ali, 10/11/2026 (Motion Rules Review, answers Q1–Q4; it replaces the draft rpg-motion rules). Code resolves every number; the screen only animates what code already resolved. Built in src/ui/motion.ts (helpers), src/ui/play.ts (the turn's order) and the --m-\* tokens in styles.css. Q1: narration is paced sentence by sentence (this settles D-24's pacing; streaming stays off). Q2: the shield's state and an armor pool show on their gear lines. Q3: no minimum wait for scene-start turns (no false delays). Q4: the turn's own calls go ahead of background calls in the call slots (Latency and cost).

**Timing leak**

- **M-01** One pending state for every turn: the line "The story is moving… N s", kept apart from the story as a status. It looks the same in every mode and for every turn, and adds "Taking longer than usual" after 90 s. It never names an agent, an actor or a step, and has no progress bar or step counter.
- **M-02** A turn shows only when the game hands over the whole finished turn: checked narration, outcome labels and state changes, after the BACKGROUND\_WINDOW and DIALOGUE\_WINDOW gates. Nothing of it shows while any of its calls is still out. Streaming stays off (D-24); if it is ever turned on, this rule is reviewed with it.
- **M-03** After a turn lands, every animation's length comes from the motion tokens and from what is on screen (how many sentences, how many changes), never from response time, which agents ran, how many calls ran, retries or fallbacks. Two turns that show the same things animate for the same time.
- **M-04** Background work is invisible. Background Planner calls, background Agent Weaver stage extensions, actors run by their type's combat list (minor, over MAX\_PLANNER\_CALLS, or after a late or failed call) and every fallback get no animation, indicator or layout shift of their own. A frontier turn that waits for a late Weaver shows only the normal pending line. The out-of-character notices (scene-planning failure marker, rate-limit notice, stop-play message) appear only when the turn shows, or when play stops, never while calls run.
- **M-05** Nothing on screen shows who or what decided an NPC's words or deeds: Responder or Voice, Planner, combat list, routine, trigger, a reply or a bark, a fallback line. Their words reach the screen only inside the narration, so they share its container, reveal and timing.
- **M-06** While a turn runs, nothing on the play screen changes except the pending line's seconds: no sheet value, Who's here entry, header line or chip updates until the turn shows.

**Narration reveal**

- **M-10** Each turn's narration appears sentence by sentence: each sentence fades in and rises at most 4 px. Never character by character.
- **M-11** Paced narration uses one fixed gap per sentence (--m-sentence) and a cap on the whole reveal (--m-reveal-cap); past the cap the remaining sentences appear together.
- **M-12** A click on the story, or Esc, finishes every running animation at once. Keys that type never skip. While something animates, Esc only skips; otherwise it does its usual job. Sending the next action also finishes everything still running.
- **M-13** Input is never blocked or disabled by an animation.
- **M-15** Screen readers hear each new turn once, through the story list (role=log), when the turn lands, never sentence by sentence. A value that counts up carries its final value in text from the start, so nothing is read half-way.

**Outcome beats**

- **M-20** Each outcome label the player perceived (their own check line and the rolls made against them) gets one beat on its result word, growing with severity: missed and dodged appear with no motion; grazed and blocked fade in; full hit gets one short pulse; heavy hit a pulse plus a shift of at most 3 px; crushing hit the strongest, still under 300 ms. The word's colour says whose loss it is: danger for a hit on the player, accent for the player's hit.
- **M-21** A turn's results play after its narration, top to bottom as they sit under the prose: check lines in action order, the changes row, then sheet values in the order health, body parts, morale, skills, XP and level, coin, then gold cards. Each starts --m-stagger after the last, and past --m-results-cap the rest lands at once.
- **M-22** Outcome beats carry no numbers. Numbers about other actors never show at all. The player's own numbers that the sheet already shows (skills, XP, coin, quick-heal count) may count to their new value. The Rolls fold (Show rolls) never animates.

**Body parts, health and morale**

- **M-30** A body-part state change animates once on that part: its colour and pattern change, then one short pulse. Worsening and recovery use the same motion; colour carries direction. When one of the player's parts becomes Crippled or Destroyed, or recovers from it, its state chip lands on the sheet ("Right arm · Crippled") and the turn's results get a card naming it. Only states the player is shown animate.
- **M-31** Body-part changes play as one batch per turn, in their place in the M-21 order.
- **M-32** Destroyed is the only part state with a second beat: the item the part held, or a destroyed shield, leaves its gear line. A destroyed head or neck (essential) is Dead for the player, so the fall sequence replaces every other beat that turn.
- **M-33** Crossing a level on the health or morale track gets one beat on that track: the level word changes and the bar settles. Never a loop or a flash. Reaching Wounded or worse also gives one short red pulse at the screen edge; at Critical the edge keeps a steady tint. Reaching Incapacitated hands over to the fall sequence.
- **M-34** State must be readable without motion: colour plus a text label or icon on every state.
- **M-35** A held shield shows its state on its gear line (Healthy, Damaged, Crippled, Destroyed) and animates like a body part (M-30, M-32). An armor pool (a heavy helmet) has no states: its gear line shows how much is left, which drops with one short beat when it absorbs a blow and reads "empty" once spent.

**Sheet values**

- **M-36** Every other value that changes on the play screen gets one feedback beat on its own element. A number counts to its new value with a small "+n" or "−n" beside it; a bar moves to its new length with a fading trail of the part lost; a word swaps with a short cross-fade; a chip or line (Shaken, Swayed, Stealthy, the yield box, a quest step, the deals chip) fades in or out. This covers skills, XP and level, coin, the quick-heal count, morale, time of day, and arrivals and departures in Who's here.
- **M-37** Motion never shows more than the screen shows: no direction, size or timing that PlayerView doesn't already give. Another actor's level word only animates when PlayerView shows that word.
- **M-38** Gold cards land last in a turn's results, one at a time. A level-up also fills the XP bar, then starts it again from empty, as one short moment (the Thread weaves). The perk-point badge on the rail's Character item is held back until then: it lands with the level-up card that gave the point, never before it (src/ui/play.ts pointsBeat).
- **M-38a** An achievement is the turn's special moment. Its gold card shows the reward tier ("Tier II") and what it asks for (earnedAtText). It arrives with its own beat within --m-honor: it rises in, one band of light sweeps across it, and then its tier lands. A scar arrives heavier and in the danger colour, with no light. A click, Enter or Space on the card opens the movable, non-modal details pop-up (src/ui/pop.ts), which shows why it was earned, what it asks for, its XP and its rewards. Esc closes the pop-up, unless something is still moving, in which case Esc only skips (M-12).

**Scenes**

- **M-40** A scene break (story start, rest, time skip or story beat) is the one transition between scenes, within --m-scene: the quiet rule draws across (with the place name if the place changed), then the opening narration appears as normal (M-10). Earlier lines stay as they are. The only other authored moments are the fall (the player is incapacitated), the level-up (M-38) and an achievement (M-38a).
- **M-41** Moving between zones, crossing a frontier or reaching a new place in the same scene gets no transition: the header's place line changes quietly, and a new place gets its named rule in the story, drawn with no motion of its own.
- **M-42** The opening narration at story start uses the scene-break transition once.

**Motion tokens**

- **M-50** All durations and easings are named CSS variables in :root; no literal durations in components. Starting values: --m-feedback 120ms, --m-state 200ms, --m-beat 220ms, --m-sentence 180ms, --m-reveal-cap 1500ms, --m-stagger 350ms, --m-results-cap 3500ms, --m-count 600ms, --m-trail 700ms, --m-scene 650ms, --m-fall 1400ms, --m-ease cubic-bezier(0.16, 1, 0.3, 1), --m-ease-exit cubic-bezier(0.4, 0, 1, 1).
- **M-51** Exits are faster than entrances.

**Replays, undo and loading**

- **M-60** Loading or reloading, "Show earlier turns", opening any fold (Undone, a turn's changes, Rolls), restoring a backup, /undo, the GM view and a read-only second window all draw the final state with no animation. Turns that reach a read-only window from the other PC land with no animation too.
- **M-61** Only the newest live turn ever animates.
- **M-62** Turns played by "Watch an agent play" are live turns and animate like the player's. The agent's send follows M-12: anything still running finishes at once.

**Always**

- **M-70** Animate only transform, opacity and colour (colour for state changes). Never animate width, height, margins, positions or other layout properties; a bar moves by scaleX on its fill. No glows and no shadows, moving or still, except the toast shadow.
- **M-71** No bounce or elastic easing.
- **M-72** When prefers-reduced-motion is reduce, or the in-game Motion switch is off, nothing moves: reveals are instant, numbers jump to their final value, and each beat is a colour change only (no movement or scale). The fall and the scene break become a plain cut. The Motion switch sits in the header beside Show rolls, is kept per viewer, and starts from the system setting.
- **M-73** Every animation must be interruptible and must end in exactly the state a skip would produce.
- **M-74** Every element is set to its final state first, and the animation plays on top of it. A value animates only when it differs between the screen before and after the turn, never because the screen redrew, and a redraw never restarts or cuts short a running beat.

### Scenario tests

One hundred and three tests: the original eight, updated, eight for the rev. 2 changes, ten for Explore mode, twenty for scene setup, fourteen for the actor-control review, one for scene-plan bands, thirteen for the routines review, ten for the hit roll, fourteen for gear and five for fallback behavior. Each runs against logged agent outputs, so it is repeatable.

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
| 28 | Place change is not a scene | The player walks from the bar's zone to the street's zone (two places, one stage): no event roll, no Weaver call |
| 29 | The fight spills outside | An engaged NPC follows the player from the bar into the street; its placeId changes with its zone, and the turn stays Tactical |
| 30 | Background extension | With the player in a zone linked to a frontier, one Weaver call starts after the save, is logged, and is not applied before the player crosses |
| 31 | Crossing reuses the tier | Crossing applies the held extension with the scene's tier; no event roll is made |
| 32 | Late extension | The player crosses before the extension returns; the turn waits for it, and no fallback is used |
| 33 | Grades must fit the tier | A Failure-tier plan with gain major fails validation, gets one repair retry with the errors, and the corrected plan applies |
| 34 | Fallback is flagged | A plan that fails twice yields the fallback stage, and all four flags appear: stage record, weaver\_fallback log, GM banner, play-screen marker |
| 35 | Stakes only | A Failure-tier plan whose threats are unaware and unalert passes validation |
| 36 | Event-roll modifiers | A perk naming the event roll changes its total; a Wounded health level and a terrain bonus do not |
| 37 | Natural edge | A natural 01 on the event roll lowers the tier by two |
| 38 | Hidden terms | A public zone description containing one of the plan's hiddenTerms fails validation |
| 39 | Opening narration covers who is seen | Every full presence event appears in the Narrator's narrated list; a narration that omits one fails the fact check |
| 40 | Nothing hidden in the opening | The logged NarrationView at scene start holds no tier, grade, event summary, Weaver note or opening belief |
| 41 | Labels until names are known | The opening uses the stranger label; after an Agent Voice line with introduces = \[speaker\], the next NarrationView uses the name |
| 42 | Sneaking arrival | A sneaking player crossing a frontier triggers detection tests; the plan's opening beliefs are not applied to those observers |
| 43 | One belief writer | Opening beliefs on open entry are written through updateBeliefs only (unit test) |
| 44 | Undo rerolls the hand | Undoing the scene-start turn and redoing it makes a new event roll and a new Weaver call |
| 45 | Replay of a scene start | Saved state, RNG state and the logged Weaver output reproduce the same stage, with no Weaver call |
| 46 | Stage trim | Past MAX\_STAGE\_ZONES, the farthest zones without engaged actors drop off, their links become frontiers, and re-entry loads them with no Weaver call |
| 47 | Words beside an attack | The player speaks while attacking: the words are a bark, no dialogue call runs, and no NPC view contains them |
| 48 | Barks copy nothing | An NPC shouts a warning while attacking; listeners' beliefs are unchanged |
| 49 | Deed instead of a reply | An addressed Responder attacks instead of answering: no line is spoken, and the attack resolves at its own initiative |
| 50 | Addressee's Planner | On a dialogue intent the addressee's background Planner call is cancelled; on a clarify question it is kept |
| 51 | Impression only | A deceive check reaches the dialogue call as an impression; the logged input contains no action type |
| 52 | Two bands addressed | Two spokesperson calls run in parallel, each with its own impression; replies resolve in initiative order |
| 53 | Calm bandmates \[Proposed\] | A Voice spokesperson switches to a leave routine; a calm bandmate who heard follows next turn; one who didn't keeps its routine |
| 54 | Allies engage | Guards hostile to bandits engage them without the player present; the turn is Tactical and the guards get Planner calls |
| 55 | Companion follows | The player moves two zones; a following companion walks one link per turn toward its believed zone, never jumping |
| 56 | Back to the post | A guard pulled off its post walks back and takes up the zone and activity its routine gives for the current turn (from its anchorTurn) |
| 57 | Inert when down | An incapacitated guard gets no order, its ambush trigger doesn't fire, it isn't engaged, and addressing it makes no dialogue call |
| 58 | Derived agenda | An NPC voiced by the Voice gains a plan; next turn the Responder voices it; no save field holds hasAgenda |
| 59 | Place facts stay player-side | No OppositionView, DialogueView or ActorView contains a place fact or headline |
| 60 | Secret slips \[Proposed\] | A persuade check that meets a check\_passed reveal sets SLIPS; the secret is revealed and the Narrator's leak scan passes |
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
| 77 | No clamp | Great Success plus a natural 00 gives Critical Success with beyond 1; the packet shows Critical Success+ |
| 78 | Ladder ends | A gap of +6 or −6 uses the ±5 entry |
| 79 | Named part | At gap −2 a hit rolled on the general area moves to the named left leg; one rolled on an arm stays |
| 80 | Aim is code-set | The Parser output never carries aimed; /aim sets it for one turn only |
| 81 | Forbidden part | An aimed head attack against a dodge tie lands in the general area |
| 82 | Shield routing | A block with a shield at gap 0 damages the shield's pool and not the health track |
| 83 | Cover | A ranged attack into a cover-2 zone adds +2 to the gap |
| 84 | No numbers to the Narrator | The combat packet in NarrationView holds no roll, margin, damage, pool or HP value (unit test) |
| 85 | Packed sword does nothing | A sword stowed in the inventory adds no skill bonus to a melee hit roll; drawn, it does |
| 86 | One copy counts | Two identical lucky charms give the same event-roll modifier as one |
| 87 | Carried charm | A charm whose entry names the event roll and is active when carried modifies the roll at scene setup; one without the event roll never does |
| 88 | Tool auto-pick | A lockpick action with two lockpick kits carried uses the better one; with both hands full, the off-hand item is stowed and no action is spent on it |
| 89 | Crippled arm holds | A shield arm goes Crippled: the shield stays held, no block is offered, the hit table gains no change |
| 90 | Destroyed arm drops | A Destroyed sword arm puts the sword on the zone's ground; an observer perceives an item\_dropped event; pick up returns it |
| 91 | Free gear ops | A turn with draw, swap and pick up plus an attack resolves one main action; equip on armor takes the main action |
| 92 | Reach | A spear (2.8 m) can't reach the next zone; a shortbow (50 m) hits a target one linked zone away with sight; the same shot through a link without sight becomes a wasted action |
| 93 | Thrown | A thrown dagger ends on the ground of the target's zone, hit or miss |
| 94 | Uncovered part | A hauberk covering general area and arms: an aimed head hit takes no armor, a torso hit does |
| 95 | Stacked armor | An actor whose race has natural armor wearing armor takes damage reduced by worn, then natural, floor 0, not rounded |
| 96 | Armor pool | A head hit on a heavy helm drains the helm pool before the head pool; the health track ignores the helm pool |
| 97 | Concealed blade | An NPC's view omits a concealed blade until the NPC perceives an attack with it; after that its belief keeps it |
| 98 | Minted reward cap | A quality-3 variant on a moderate-gain scene is lowered to quality 2, and a weapon boosts of "keen edge" becomes hitAdj; the plan applies with no repair call |
| 99 | Fallback attack | An engaged slime with the player in its zone attacks the player with unarmed\_natural, targetPart null; the order's source is fallback |
| 100 | Fallback target | An engaged minor actor that a companion hit last turn attacks the companion, even with the player in the same zone |
| 101 | Fallback close in | An engaged minor actor whose belief puts the player two links away moves one link along the shortest path, never into a frontier; in that zone with nobody there, it searches |
| 102 | Late Planner fights on | A significant engaged actor whose Planner call is late runs its type's combat list that turn instead of holding |
| 103 | Broken flees | A broken engaged actor with an exit slot moves one link toward it and holds once there; a slime never flees |
| 104 | Improvised weapon | The Parser's improvised chair leg becomes a held improvised\_medium story item with hitAdj IMPROVISED\_HIT\_ADJ and no kit bonus, and the attack uses it |
| 106 | XP and levels | Rating: a slime's is the effort of its one offensive skill, a guard's is higher, misc skills add nothing; kill XP applies the taper and KILL\_XP\_MULT; a slime the player hit and downed pays its kill XP once, plus the first-defeat achievement; ten defeats of slimes earn first\_defeat:slime, defeats\_10:slime and defeats\_10 once each, named for the slime; a foe with a race also earns its first race defeat; a foe downed by someone else or broken pays nothing, a surrender pays; LEVEL\_XP + 5 XP levels into the chosen unlocked class, which becomes current, with a perk point at level 2 |
| 105 | Story pacing | Quiet turns count up and an attack resets them; a quiet\_turns 2 beat fires on the third turn start and, with endsScene, marks a break; rest marks a break; a stall marks one only with no live beat left; the director then starts a new scene with one Weaver call |
| 107 | Opposed standoff | An opposed guard who notices the player is alarmed (its onAlert fires) but not engaged, so the turn stays Explore; made hostile, it engages |
| 108 | Look around | Someone sitting still one zone away is a shape; a successful look shows them clearly and they stay seen while they stay put; a move the player can't see clearly forgets them; looking is a sight roll, not a check |
| 109 | Skill progression | A use marks a skill only when the opposition is within MARK\_WINDOW of raw or true skill, once, and only for the player; a hit costing ENDURANCE\_MARK\_PCT marks endurance; a marked skill whose roll beats its target gains 1d3 (SKILL\_GAIN\_DIE) and shows "Sight 38 → 41" plus "New perk unlocked" past a milestone; a failed roll shows nothing; marks clear |
| 110 | Healing | Rest heals HP and working parts but not a Crippled part; a clinic lifts it; a bandage heals its row in the turn it is used, is used up, and shows "Bandage: Hurt → Bruised"; with nothing to heal it stays in the pack and says so (Q3, 08/11/2026) |
| 111 | Game clock | Each action costs its durations row; waiting until dawn moves the clock to dawn, breaks the scene and shows "Time passes: 11 h (Day 2 · Dawn)"; a hostile in the zone blocks it; outdoor zones are dark at night unless lit; the Narrator sees the day and time of day; the Weaver picks the hour only at story start; a night-only routine set by day is a routine error; rest cools down in game minutes; natural recovery heals 0.5% an hour at endurance 50, never a Crippled part, fights included |
| 113 | Action economy | A ranged attack in reach drops the move; out of reach the move stands and the attack is dropped; a move two links away with no action is a dash, stopped by a Crippled leg; "after" resolves the action before the move |
| 117 | Closing during the opening | The player's build is kept until turn 0 is saved; a game closed during the opening starts that opening again when reopened, instead of returning to character creation |

### Deliverables and acceptance criteria

Done means every scenario test passes except those waiting on other work: 46 and 53 test rules still \[Proposed\]. Also, every non-dialogue turn that doesn't start a scene shows checked narration after one Parser call plus one full Narrator call.

**First build scope.** A fantasy village with a guard, a trader and a tavern patron to talk to. The player is a swordsman, and slimes living around the village are hunted. Hunting gives XP (Part 1 §5) but no skill changes (recordUse() only logs). The slimes' routine set, slime\_wander, is the test of the Agent Weaver integration (Appendix: prototype routine bank).

Build in this order, so the game is playable with stubs before any agent is wired in:

- [ ] State types, seeded RNG with saved state, agent log
- [ ] Ruleset: TIERS, eventRoll, roll, attack, check and contested built (Part 2, First-build ruleset); applyEffects and recordUse stubbed
- [ ] Perception per event, the single belief writer, communication events and belief decay
- [ ] The six deny-by-default view builders (DialogueView built from ActorView; bark events never copied into NPC views)
- [ ] isActive; bands, relations and overrides; engagement
- [ ] Resolution engine with the simultaneous-order rules, order merging and the exchange slot
- [ ] Hidden store, trigger checker (turn start and mid-turn), fired log and secret reveal
- [ ] Routine bank types, the import validator and the prototype bank (Appendix)
- [ ] Desired-state routines (schedule, follow, wait) with slot bindings, route expansion and code-set anchors, alarm state, onAlert and returnTo; detection on major actions and ambush resolution (Explore mode)
- [ ] Scenes, the stage, frontiers and the event roll (ruleset.eventRoll)
- [ ] Item library and blueprints, the active-effect reader, slots and gear ops, ground items, the damage step with armor (Part 5)
- [ ] Fallback combat list per actor type (Fallback behavior)
- [ ] Agent Parser, Planner, Responder, Voice and Narrator wrappers, prompts as constants, schemas validated
- [ ] Agent Weaver wrapper, stage-plan validator and the flagged fallback stage
- [ ] Mode switcher, the call cap, spokesperson selection and MAX\_SPOKESPEOPLE
- [ ] Planner scheduler, and the BACKGROUND\_WINDOW and DIALOGUE\_WINDOW gates
- [ ] Leak scan, fact checks, the Voice fact check and the templated fallback narration
- [ ] Save, load, undo and automatic backups (Part 4 §10–11)
- [ ] Creation screen and play screen (Part 2, Play screen)
- [ ] GM debug view
- [ ] The scenario tests passing, as Done above sets out

Ask before you:

- change any ruleset number;
- add a Claude call to any turn type;
- send anything from state.hidden to Agent Parser, Agent Narrator or Agent Voice;
- settle anything listed under Deferred items.

## Part 3 — HP system with partial-damage penalties

### Chosen design: health track + body parts

Every successful hit damages the body part it lands on and, depending on that part's impact, the health track. Total HP comes from endurance and the body type (Total HP); part pools are shares of total HP set by size (Body parts). Health-track levels and part states are % of those pools. Code owns all of it, including a database of body types: Agent Weaver names the body type, and code knows its parts.

- **Health track (World of Darkness):** levels by % of HP lost; one wounds modifier on every roll (Part 1 §4, Layer 2b; rolls only, not checks); each level is a trigger for perks, tactics and story.
- **Body parts:** every body type has a general area plus a list of parts. Each part has a size (hit chance and aim penalty), an impact (how its damage counts on the health track) and a role (what its states do); a part can have several roles. Parts are Healthy, Damaged, Crippled or Destroyed.
- **General area:** always present, stateless, normal impact, and always at least 30% of the hit table. Any damage that isn't aimed at, or doesn't land on, a specific part counts here.
- Attack and defense are two rolls; damage is not rolled. The attack roll is contested by the defender's dodge or block roll, and the gap between their tiers sets the multiplier and can move or restrict the location. Damage is fixed by weapon and armor. Perks can act on the attack roll, the defense roll, the gap or the damage values, each on its own.
- **One damage type** for now.
- WoD's sixth level "Crippled" is renamed **Critical**, so "Crippled" only ever means a body part.

### Total HP

```
HP = (HP_BASE + HP_PER_END × endurance) × race HP multiplier
```

HP\_BASE 50, HP\_PER\_END 1 (*placeholders*); race HP multiplier Human and Elf ×1, Slime ×0.6, Dragon ×3; every race has one (BR2, Ali 08/11/2026). Endurance 0 → 50 HP, 50 → 100 HP, 100 → 150 HP.

### Health track

Total HP is divided into levels by the share of HP lost, following World of Darkness.

| Level | HP lost | Wounds modifier (roll points) | Example hooks |
| --- | --- | --- | --- |
| Unhurt | 0% | 0 | — |
| Bruised | 1–15% | 0 | Free buffer; a toughness perk can widen this band |
| Hurt | 16–30% | −5 | Perk: ignore the Hurt penalty |
| Injured | 31–45% | −10 | Fear: reaching Injured, Wounded or Mauled costs morale (rolled) |
| Wounded | 46–60% | −15 | Perk: +10 to melee hit rolls while Wounded or worse. Story flag "visibly hurt": NPCs react |
| Mauled | 61–75% | −20 | +20 to intimidate a Mauled foe; Mauled enemies may surrender |
| Critical | 76–99% | −30 | One action per turn; last-stand perks switch on; fear: reaching Critical costs more morale (rolled) |
| Incapacitated | 100–149% | Out of the fight | Lethal fight: the story ends; otherwise a survival roll (D-54) |
| Dead | 150% | Out for good | Never shown in the UI (a dead actor shows as Incapacitated, "Down" for others); the Narrator does see it. No healing row heals it (`revivesDead` is no on every row, a lever for resurrection later) |

HP lost keeps counting past 100% while an actor is down, up to 150%, where it is Dead (Ali, 08/11/2026; first set at 200%). A destroyed essential part (head, neck) is Dead.

The penalty is a roll modifier of type wounds (Part 1 §4, Layer 2b), diminishing together with body-part role penalties. It does not apply to no-dice checks (settles OQ-15).

Bands are 15% wide; Critical takes the remaining 24% so a last stand lasts a little longer. Penalty values are placeholders; they stack by Part 1 §4, Stacking within a type. The health track never modifies the event roll (Part 1 §4).

**Morale** (Ali, 10/11/2026, morale bar MB1–MB43). Morale is a second, mental health bar that every actor has, the player included (MB11). Max morale = MORALE\_BASE (50) + MORALE\_PER\_RESOLVE (1) × Resolve (raw), as HP comes from Endurance; an NPC template sets its starting Resolve (MB4; a high Resolve is not immunity), and raw Resolve also sets the Nerve tier (Part 4, Personality). Fears cost flat points (MB5), one row each in the library fears table: reaching Injured to Mauled 25 and Critical 50 (rolled, only while engaged, the player while someone is fighting them; the health range can move by steps with a perk's or achievement's fearFrom, MB21), a bandmate going Down 25 or breaking 25 when the actor perceives it (MB23), a hit that leaves the actor's own parts Crippled or worse (rolled once per hit, paying for each part by its impact: non-essential 5, normal 15, essential 30 for a 6-part body, × 6 ÷ the body's part count; a part Destroyed rolls again at 1.5 × those costs, read from the Crippled row; Ali, 11/11/2026), losing to an intimidation 10 per tier of the gap, and downing a foe gives back 10. A rolled fear makes the morale roll (Resolve, with renown on every morale roll of a foe fighting the player, MB24, and rally) and pays the cost × MORALE\_TIER\_MULT for its tier: Critical Failure 2 (+0.5 for each step beyond), Failure 1.5, Near Miss 1, Success 0.5, Great Success 0.25, Critical Success 0. The level is the share of max morale lost (MORALE\_TRACK): Calm, Uneasy 15%, Tense 30%, Rattled 45% (−5), Afraid 60% (−5), Terrified 75% (−10), Panicking (−15), Broken at 100% (Shattered banked, MB2). The penalty is type wounds, so it stacks with the health penalty and hits the morale roll too: fear feeds on itself (MB3). Reaching Broken replaces the old instant break (MB1): an NPC is broken for the scene and flees (Fallback behavior, rule 1); if the roll that broke it was Critical Failure or worse it surrenders instead; its perceiving bandmates pay the bandmate-broken fear. The player at Broken keeps control but cannot attack (MB12), and a break counts as defeated (achievements). **The player's yield** (MB40–MB43): saying "I yield" in a real fight (the Parser's yields, as in a spar) or typing /yield asks the foes who hear it (state.yielding, src/engine/yield.ts): every foe fighting the player (hostile and engaged), and hostile foes who perceive the player by any sense (the yield said at normal volume) and are fighting someone on the player's side (YD1, Ali, 11/11/2026). A hostile who is only tracking or hunting the player, such as one listening from another room, does not hear it (BG-4). A taken yield also covers the taker's hostile bandmates who are together with it (YD2, YD7) and did not refuse it themselves; bandmates apart keep fighting. Once everyone who heard the yield has taken it, the player's fight ends that turn (YD3); a hostile who never heard it starts a new fight. Who counts as a foe in the fight log stays parked (YD4). A foe run by Claude, of an Intelligent race, answers in its next output (acceptYield; no answer is a refusal); code-run foes and lesser races fight on. A taken yield is a truce for the rest of the scene: neither is hostile to the other, the fight ends, and it counts as defeated. Once yielded, the player cannot attack a foe that took the yield or has yet to answer, and a foe that took it cannot attack the player (MB43). What happens after a yield is OQ-30. Broken is a win condition: a broken actor counts on neither side of engagement. Surrender and a break also turn its stance toward everyone it was hostile to into **yielded** (Q1, Ali 08/11/2026); a broken actor still flees from those it yielded to: a yielded actor never attacks and is not a threat, so it blocks no rest or waiting; it still pays defeat XP; attacking it again turns it hostile, and talk steps it from opposed. Recovery comes from the library **composure** table, apart from healing so morale tunes on its own (Ali, 11/11/2026, D-183): natural composure is its hourly row (0.1% of max morale per Resolve point an hour, 5% at 50, MB8); Danger passed, when an engagement ends, gives back MORALE\_ENGAGEMENT\_END\_PCT (25%, MB9); Rest gives REST\_MORALE\_PCT (50%) and Clinic CLINIC\_MORALE\_PCT (100%) (MB34). A healing row names the composure row its action also restores (`composure`), so a rest restores health from the healing table and morale from the composure table in one action. One engine call (calm) applies a row; a perk that restores morale directly calls calmFromPerk and counts under the Perks row (CP5, count only); a unit test (morale-writes) fails if code restores morale anywhere else. Downing a foe and being rallied still restore through the fears table (negative cost). When the scene ends, yielded becomes opposed (a grudge), broken and surrendered end (Q4), a bar still at Broken moves up to Panicking (one point short), and the actor goes to its exit slot (with no off-stage yet, D-46/D-67, that is how it leaves). Others see an actor's morale only from Afraid down (MORALE\_SHOWN\_FROM, MB16); the actor itself always sees its own. Yielded is not on the STANCES scale: agents cannot choose it. What else the player can do with it is deferred (D-98).

**Healing** (Ali, 07/11/2026, "Healing: options" H1–H15). Every source is a row of one library table (healing): HP %, part-pool %, its reach (the worst part state it heals, a key of the PART\_STATES scale, so a perk can shift it by steps), whether it works in a fight, and the place kinds it needs; one engine rule applies a row, so amounts stay consistent (B5) and stronger tiers are new rows. Rows now (placeholders): rest 25/25 (its morale from the composure Rest row), clinic 100/100 (morale from the composure Clinic row) and lifts Crippled parts (resting in a place of kind clinic or infirmary), bandage 10/10, usable in a fight as the main action and used up (an item names its row with `heal`; the player starts with STARTING\_BANDAGES 2). A part worse than the row's reach is skipped; a Crippled or worse part a row reaches starts again from 0 (H4). Rest and bandage reach Damaged; the clinic reaches Crippled. A rest action (the turn's main action) needs no active hostile in the zone and waits REST\_COOLDOWN\_MIN (*placeholder*, 240) game minutes (H5, T7). **Natural recovery** (H12–H15) is the hourly row passive: every active actor on the stage heals endurance (true skill) × 0.01 % an hour (0.5% at 50) of HP and of each part it reaches (never Crippled or worse), all the time, fights included, as the clock moves; a line shows only when a health level or part state changes. The composure table's natural composure row does the same for morale from Resolve (Part 3, Morale). NPCs use the same table when they rest; healing off stage waits for D-67 (H8). A Destroyed part stays gone unless a special perk, item or story event brings it back (settles OQ-6). The turn shows a plain line such as "Bandage: Hurt → Bruised"; its look is the designer's (H11). Later: a first-aid skill (H9, D-14), bleeding and other statuses (H10, D-15). **Healing by source** (Ali, 10/11/2026, D-172): achievements count the HP the player actually gets back, as a flat number (the health % healed × their total HP; body parts not counted), kept apart by where it came from: the healing row's id (rule `healed`, by `heal_source`, name placeholder {source}). Rest, natural recovery, clinic and bandage each keep their own count. Healing from perks counts under the Perks row (HL6, `countOnly`: never applied itself), and only for perks that heal directly (Second Wind's jump). A perk that boosts another source counts as that source: Fast Healer's doubled natural recovery is all natural recovery (Ali). Every perk that heals directly goes through one engine call (healFromPerk), so a new healing perk counts here with no extra code; a unit test (hp-writes) fails if code lowers health lost anywhere else. A rest bonus from an achievement (`restPct`) still counts as rest.

**Visibility:** for other characters, Claude is told the level only from Wounded down; Bruised to Injured stay hidden, though code still applies their penalties.

**Thresholds as triggers**

- Perks read the level: they can ignore a level's penalty, widen a band, or switch on a bonus at a level.
- Tactics read the level: enemy AI retreats, surrenders or turns desperate at set levels, and players get options against hurt foes.
- Story reads the level: crossing into Wounded or worse sets flags that scenes, companions and NPCs can check.

Code fires one event per change, `threshold_crossed {who, from, to}`; perks, AI and story scripts listen for it.

### Body parts

Every part carries a size, an impact and one or more roles, all stored in code. Each part's pool is a share of total HP set by its size: Extra small 15%, Small 20%, Normal 30%, Big 50% (placeholders; Tiny is not in use). Its state is measured as % of its own pool. The general area has no pool and no state.

Role penalties (Damaged and Crippled columns of the role table) are roll modifiers of type wounds.

An essential part (head, neck; the impact column) that is Crippled or worse adds a further wounds modifier of −5 (CONFIG.ESSENTIAL_CRIPPLED_PENALTY) to every roll the character makes, once however many essential parts are crippled. Tough It Out counts the part one step milder, as for role penalties. The D-54 survival roll stays modifier-free.

At reference HP 100: head 20, each arm 30, each leg 30, neck 15. A medium blow (25) Cripples a head and a second Destroys it; a limb goes Damaged, Crippled, Destroyed over three blows.

**States**

| State | Part pool | What Claude sees |
| --- | --- | --- |
| Healthy | Above 50% | Healthy |
| Damaged | 50% to 1% | Healthy: Claude is never told; code still applies it |
| Crippled | 0% to −99% | Crippled |
| Destroyed | −100% or lower | Destroyed |

A Destroyed part no longer exists: code removes it from the hit table and rebuilds the table without it. Its roles stay lost for good.

**Size: hit chance and aim penalty**

| Size | Hit weight | Aim penalty (hit roll) | Example |
| --- | --- | --- | --- |
| Tiny | 0.25 | −40 | An eye, a finger (not in use yet) |
| Extra small | 0.5 | −35 (placeholder) | Human neck |
| Small | 1 | −30 | Human head, a dragon's tail |
| Normal | 2 | −20 | Arms, legs, wings |
| Big | 4 | −10 | A giant's oversized arm |
| General area | 30% minimum, +4 weight if marked big | 0 | Human torso; a dragon's body |

The aim penalty is a roll modifier of its own type (aim).

Size is set per body type, not per part name: one body type can have big arms and small legs.

**Impact: link to the health track**

| Impact | Damage counted on the health track | When Destroyed |
| --- | --- | --- |
| Non-essential | None: the part absorbs it | Part is gone; total HP untouched |
| Normal | 1× | Part is gone |
| Essential | 1.5× | Total HP drops to 0 |

**Roles: what each state does**

| Role | Shared | Damaged | Crippled | Checks it applies to |
| --- | --- | --- | --- | --- |
| Sense (head) | Yes | −10 | −20 to all checks | Perception and mental checks when Damaged; every check when Crippled |
| Grip (arm) | No: per limb | −10 | Unusable: keeps holding its item but can't attack, block or use a tool with it; no two-handed actions. A Destroyed arm drops what it held to the ground (Part 5 §4). | Anything done with that limb: melee, shooting, climbing, fine work |
| Move (legs) | Yes | −10 | −20 to dodge (movement effects: D-99) | Dodge, athletics, stealth, fleeing |
| Fly (wing) | Yes | −10 to flying | Can't fly | Flight |
| Strike (tail, horns, bite) | No: per part | −10 to that attack | That attack is unavailable | Attacks made with the part |
| Speech (head) | Yes | −10 | −20 | Speech rolls: persuasion, intimidation, barter (Ali, 08/11/2026). With a Crippled head a speech roll takes both −20s, stacked within the wounds type (SR4) |

- **Several roles:** a part can carry more than one (a dragon's head is Sense and Strike, for its bite); each role's effects apply.
- **Shared roles:** the penalty is split between the parts that have the role. A dragon has two Move parts, so one Damaged pair of legs gives −5, not −10.
- **Per-limb roles** (Grip, Strike) are not split: each limb acts on its own. Two-handed actions take the worse arm's penalty.
- Code tags every skill with the roles it uses, so a Damaged left arm never touches a persuasion check.

On/off effects of shared roles (no running, can't fly) switch on when Crippled and Destroyed parts reach 60% of the role's parts, with a Destroyed part counting twice. A dragon with one Crippled wing still flies (50%); one Destroyed wing grounds it (100%). A spider needs 5 of 8 legs Crippled, or 3 Destroyed.

### Building the hit table

1. The general area takes its 30% minimum.
2. Every other part still in existence gets its size weight; a big general area also gets weight 4 on top of its minimum.
3. The remaining 70% is split in proportion to weight and rounded to whole numbers that sum to 100.
4. Parts are laid out in database order, general area last; a separate d100 location roll picks the band, read as rolled (a 37 hits the part whose band holds 37; no digit reversal).
5. When a part is Destroyed, the table is rebuilt from step 1 without it.
6. A shield is never on the hit table; it takes only hits routed to it by a block.

**Humanoid**

| Part | Size | Impact | Roles | Location roll |
| --- | --- | --- | --- | --- |
| Head | Small | Essential | Sense, Speech | 01–07 |
| Left arm | Normal | Normal | Grip | 08–22 |
| Right arm | Normal | Normal | Grip | 23–37 |
| Left leg | Normal | Normal | Move | 38–52 |
| Right leg | Normal | Normal | Move | 53–67 |
| Neck | Extra small | Essential | — | 68–70 |
| General (torso) | — | Normal | — | 71–00 |

Humanoids have a left and a right leg, each with its own pool (Ali, 07/11/2026). Move is a shared role, so one Damaged leg gives half the Move penalty; one Crippled leg (50% of the role's parts) does not stop running, one Destroyed leg (counted twice) does. Saves from schema v3 are converted: both legs start from the old legs pool, and armor that covered legs covers both.

The neck is adjacent to the head and the general area. Head and neck are separate in every calculation.

**Dragon (example)**

| Part | Size | Impact | Roles | Location roll |
| --- | --- | --- | --- | --- |
| Head | Normal | Essential | Sense, Strike, Speech | 01–09 |
| Left wing | Normal | Non-essential | Fly | 10–18 |
| Right wing | Normal | Non-essential | Fly | 19–27 |
| Forelegs | Normal | Normal | Move | 28–36 |
| Hind legs | Normal | Normal | Move | 37–46 |
| Tail | Small | Non-essential | Strike | 47–51 |
| General (body) | Big | Normal | — | 52–00 |

The dragon's big body gives its general area 49% (30% minimum + 19%). Crippling a wing hurts its flight without costing it any HP; destroying the tail removes it from the table, and the other parts' bands grow to fill the gap.

### Body type database

Code keeps every body type, its parts and the role table. Agent Weaver names the body type by catalog id in the stage plan; code loads the entry, builds the hit table, and tracks every part from then on.

```json
{
  "roles": {
    "sense": {"shared": true},
    "grip": {"shared": false},
    "move": {"shared": true},
    "fly": {"shared": true},
    "strike": {"shared": false},
    "speech": {"shared": true}
  },
  "bodyTypes": {
    "humanoid": {
      "general": {"name": "torso", "size": "normal"},
      "naturalAttacks": [{"id": "punch", "tree": "unarmed", "class": "punch", "skill": "unarmed_strike", "reach": 0, "hands": 0},
                        {"id": "grapple", "tree": "unarmed", "class": "grapple", "skill": "unarmed_grapple", "reach": 0, "hands": 0}],
      "parts": [
        {"id": "head", "size": "small", "impact": "essential", "roles": ["sense", "speech"], "adjacent": ["general", "neck"]},
        {"id": "left_arm", "size": "normal", "impact": "normal", "roles": ["grip"]},
        {"id": "right_arm", "size": "normal", "impact": "normal", "roles": ["grip"]},
        {"id": "left_leg", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "right_leg", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "neck", "size": "extra_small", "impact": "essential", "roles": [], "adjacent": ["head", "general"]}
      ]
    },
    "amorphous": {
      "general": {"name": "body", "size": "normal"},
      "naturalAttacks": [{"id": "slam", "tree": "unarmed", "class": "slam", "skill": "unarmed_natural", "reach": 0, "hands": 0}],
      "parts": []
    },
    "winged_quadruped": {
      "general": {"name": "body", "size": "big"},
      "parts": [
        {"id": "head", "size": "normal", "impact": "essential", "roles": ["sense", "strike", "speech"]},
        {"id": "left_wing", "size": "normal", "impact": "non_essential", "roles": ["fly"]},
        {"id": "right_wing", "size": "normal", "impact": "non_essential", "roles": ["fly"]},
        {"id": "forelegs", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "hind_legs", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "tail", "size": "small", "impact": "non_essential", "roles": ["strike"]}
      ]
    }
  }
}
```

adjacent lists the parts a hit can move to at gap −2. Default when absent: the general area only. The general area is adjacent to every part. A body type is the shape only (BR1, Ali 08/11/2026): parts, general area, silhouette and the natural attacks the shape always has. Shape names are generic so later races can reuse them (BR4): the Slime race is amorphous and the Dragon race is a winged quadruped. Toughness (hpMultiplier), natural armor and a race's own natural attacks are on the race (BR2, BR3, BR6).

**Body types not in the database**

1. Agent Weaver names a type that is not in the catalog.
2. Stage-plan validation fails; the one repair retry sends the list of existing types, and the Weaver picks the closest fit. No extra call.
3. Code runs the encounter on that type and flags the substitution to you (the name asked for and the type used), so you can enter its own data. Data entered mid-story goes to the story's blueprints (Part 4 §2); only you promote it to the library.

### Weapons, armor and shields

Weapons, armor and shields are items (Part 5): attack modes and reach in §5, armor, shields and the damage step in §6, item data in §7. This section keeps the weapon class table and the shield as a part.

| Class | Damage | Hit | Against block |
| --- | --- | --- | --- |
| Light | 20 | +10 | — |
| Medium | 25 | 0 | — |
| Heavy | 30 | −10 | gap −1 |

Natural attacks have their own classes: punch (damage 15, hit +10), slam (damage 20, hit +10) and grapple (damage 5, hit 0; any humanoid can grapple, and the Hold perk, A8, locks the target in place). All values are *placeholders*. Reach is set per attack mode (Part 5 §5).

**Shield as a part:** Non-essential, pool from the item. When the defender blocks with a shield, a hit at gap 0 or better goes to the shield (**\[Proposed\]** for gaps +1 to +5). Its states: Damaged −10 to block (wounds type), Crippled: can't block with it, Destroyed: the item is lost. The arm holding it must be a working Grip part.

### Defense

- A defense is a free reaction with the actor's standing defense (dodge or block).
- Dodge takes Move-role penalties and armor weight.
- Block needs a working Grip arm holding a shield or weapon.
- Against missiles: dodge gets +10 situational; block works as against melee.
- Outnumbered: each defense after the first in a turn takes a situational penalty (*placeholder*).
- Unaware: the defense roll takes a situational penalty (*placeholder*).
- Heavy weapons against block: gap shift −1.

The gap ladder is binding (gap = defense tier − attack tier; a gap past ±5 uses the ±5 entry):

| Gap | Dodge | Block |
| --- | --- | --- |
| −5 | 2× | 2× |
| −4 | 1.5× | 1.5× |
| −3 | 1×; hit moves to the named part anywhere | 1×; hit moves to the named part anywhere |
| −2 | 1×; hit moves to the named part if adjacent | 1×; hit moves to the named part if adjacent |
| −1 | 1×, no location limit | 1×, no essential parts |
| 0 | 1×, no essential parts | 1×, Non-essential parts only, else general area |
| +1 | 0.8× (graze; never an essential part, like the tie: settles OQ-17) | 0.75× |
| +2 | 0× | 0.5× |
| +3 | 0× | 0.25× |
| +4 | 0× | 0.2× |
| +5 | 0× | 0.15× |

At −4 and −5 the named-part move also applies, anywhere **\[Proposed\]**. A part forbidden by the defense sends the hit to the general area.

### Reach, range, cover and light

An attack reaches targets within its attack mode's reach (Part 5 §5), with sight on every link of the shortest path.

- **Situational roll modifiers (ranged):** a hostile actor within 2 m of the shooter, close enough to strike or grab, −10 (RD5: HOSTILE\_NEAR\_M, HOSTILE\_NEAR\_MOD; Point Blank removes it). Range (`rangeMod`, CONFIG.RANGE\_SHARE\_MODS): the distance as a share of the mode's reach, both from real metres: up to 25% 0, 50% −5, 75% −10, 100% −15. A longbow (90 m, 11 links) at 48 m is −5 where a shortbow (50 m, 6 links) is −15 \[Proposed\].
- **Light** (any roll that needs sight): dim −5; dark −10. The attacker uses the target's zone; a defender uses the attacker's zone.
- **Cover** (ranged attacks only): the target's zone cover 1 → gap +1, cover 2 → gap +2.

### Damage flow and the roll packet

Code runs the whole exchange; Claude gets one packet afterwards and narrates from it.

1. **Setup** (once per body type): Agent Weaver names the body type in the stage plan; code loads it from the database and builds its hit table.
2. Attack roll (Part 1 §4, Layer 2b) with the weapon's skill. Aimed: add the aim penalty for the part's size. Tier shifts. Failure or worse: miss, end here.
3. Defense roll with the standing defense, then its tier shifts.
4. Gap = defense tier − attack tier + gap shifts; read the gap ladder (past ±5: the ±5 entry). A 0× result ends here as dodged.
5. Location: aimed → the aimed part; else the location roll on the hit table. At gap −2 move to the named part if adjacent; at −3 or lower, to the named part anywhere. A part the defense forbids → the general area. Blocking with a shield → the shield.
6. Damage: by the damage step in Part 5 §6 (class damage and bonuses, the tier-gap multiplier, worn then natural armor, floor 0 with no rounding, armor pools).
7. **Body part:** apply the damage to that part's pool (the general area skips this) and update its state; a Destroyed part is removed and the hit table rebuilt. Fire `part_state_changed` if the state changed.
8. **Health track:** add the damage × impact (non-essential 0, normal 1, essential 1.5); a Destroyed essential part sets HP to 0. Fire threshold\_crossed if the level changed.
9. **Listeners:** perks, enemy AI and story scripts react; each reaction becomes an event.
10. **Packet → Agent Narrator.**

A source is deciding if removing it alone would change the attack tier, the defense tier, or the gap's row on the ladder (miss, multiplier or location). Natural edges are listed as "lucky" or "fumble". Damage values never reach Claude.

Change lines carry the effect text, so the narration never contradicts what code enforces. Code only sends what Claude is allowed to see: Healthy → Damaged is never sent, though its penalties still apply in code, while Damaged → Crippled is sent because Crippled is visible.

Visibility rules apply only to other characters: the player's own character is always fully visible to Claude, Damaged parts and lower health levels included.

```
{
  "event": "evt_0412",
  "actor": "player",
  "target": "the scarred bandit",
  "action": "aimed melee attack",
  "weapon": "arming sword",
  "armor":  null,
  "shield": null,
  "attack":  { "tier": "Great Success",  "natural": null, "deciding": [] },
  "defense": { "type": "dodge", "tier": "Success", "natural": null, "deciding": [] },
  "outcome": "full hit",
  "location": { "part": "left_leg", "how": "aimed" },
  "changes": [],
  "events": []
}
```

Outcome labels: missed, dodged, grazed, blocked, full hit, heavy hit (gap −4), crushing hit (gap −5). Location how: rolled, aimed, redirected, restricted, shield. The packet carries no numbers: no d100, margin, skill, needed number, damage, multiplier, pool or HP. Here changes is empty because the bandit's left leg only went Healthy → Damaged and he is only Hurt; both are hidden for anyone but the player. The packet also has armor and shield beside weapon. All three hold public item names only: the item used (a natural attack gives its mode's name), the worn armor covering the struck part, and the shield when the hit went to it; null when there is none (Part 5 §8).

## Part 4 — Save data model

How the game saves and loads. Part 4 replaces the single GameState document as the saved shape. Items marked \[Proposed\] follow the convention above: built as written, easy to change. Values marked placeholder are config, not constants. This part changes no ruleset number. A scene start saves inside its triggering turn's normal save: one commit, no new save path. Backups (section 11) are unchanged.

### 1. Principles

- **Code is the game's memory.** Every Claude call starts empty. Each turn, code builds every agent's view from the save.
- **Unsaved means forgotten.** Anything Claude says that code doesn't save is lost. What must stay true is saved as data; Claude may re-describe it freely.
- **Saving costs no tokens.** Only what a view sends costs tokens. A crippled wing on an absent dragon costs nothing; on a present one, one line.
- **No model writes the save.** Agents return requests and proposals. The validator and engine decide; only the engine writes (section 8).
- **Numbers become words at the view.** Views send states ("Crippled"), never pools, HP or Burden.

### 2. What is saved

The save has two layers. The library holds blueprints shared by every story. A story holds everything that happens in one playthrough. One story runs at a time **per owner** (Ali, 10/11/2026, replacing "one story at a time"): the player's own story, and at most one story the autopilot agent plays on its own save (StoryMeta.owner 'agent'; absent = the player's). Opening the game always resumes the player's story; the agent's story opens only from the autopilot bar, and "On my story" returns. While the agent's own story is on screen, yellow marks it: the pressed "Its own story" choice and the header's "Watch an agent play" switch (no banner row). Each owner has its own pending start (pending/start, pending/agent), and a reset archives only the story on screen. **Watch an agent play (autopilot)** (Ali, 10/11/2026): a bar under Who's here on the Play screen. The agent (AgentName 'autopilot', src/agents/autopilot.ts) gets the last 14 story lines and a playstyle (the playtest personas: Curious, Eager, Bloodthirsty, Patient, Shopper) and answers JSON {command, say}. The command is typed into the action box where the player can see it and sent like Send; say is the agent's commentary, 2 or 3 short sentences of at most 60 words: first what just happened (how its last move turned out, what the people around did), then what it does now and why (Ali, 11/11/2026: the watcher only hears it), shown under the bar and read aloud with the browser's speech voices (Voice on/off). Controls: On my story / Its own story, playstyle, 2/5/10 s between turns, Play/Pause, One turn, Close. It pauses when the character falls, when play stops, or after two failed calls. On its own save the agent spends its perk points itself (the open milestone of its highest skill, as the playtest does); on the player's story it never spends them. While it plays, the action box is the agent's. A reload or a new version of the page in the same tab carries on where the bar was: still open, still playing, on the same story (kept per tab, so opening the game afresh still opens the player's story). **Hall of fame** (Ali, 10/11/2026): resetting a story whose character is down writes a fame entry on its meta (StoryMeta.fame: name, title, classes and level, best true skills, perks, achievements, scars, defeats, day, turn, place and the blow that dropped them); the Hall of fame page lists every fallen character of either owner, newest first, and opens even with no story running. **Name and gender** (Ali, 10/11/2026): the creation screen asks for the character's name and gender (Man, Woman, Other = he, she, they); the build's pronouns become the player's Actor.pronouns, which others use for them.

| Data | Layer | Saved | Notes |
| --- | --- | --- | --- |
| Ruleset numbers | Library | Yes | Retuning applies to the running story |
| Body types, races, classes, perks, skills, item and NPC templates | Library | Yes | Edited only by the designer; stories always use the latest version |
| Story blueprints | Story | Yes | Items Claude minted, body types filled in mid-story. Never leave the story unless the designer promotes them |
| Player | Story | Yes | Core, Progression, Journal (section 4) |
| Temporary NPCs | Story | Yes | Core, Mind (section 4) |
| Recurring NPCs | Story | Deferred | Every NPC gets a stable id so it can be promoted later |
| Places, state slots, facts | Story | Yes | Skeleton and canon, never descriptive prose (section 5) |
| Hidden store, quests, flags | Story | Yes | Plans, triggers, secrets, memory lists, agreements, fired log |
| Bands, clocks, settings | Story | Yes | Settings: difficulty, SHOW\_MECHANICS, tone |
| Engine state | Story | Yes | Turn, mode, RNG seed and state, pending, stage, scene caps |
| Turn records | Story | Last N | N is a placeholder (section 6) |
| Story text | Story | Yes, all of it | The play screen's story column, in documents of HISTORY\_CHUNK\_TURNS turns (section 10). Ali, 07/11/2026, easy open questions Q18 |

- **Story isolation.** Every story-scoped read and write takes the story id. Each story lives under its own storage namespace. No function reads across stories. Views are built only from the loaded story.
- **Lookup order.** An id resolves in the story's blueprints first, then in the library.
- **Reference, don't copy.** A story stores library ids, never copies of entries, so library edits reach it at once. The one exception is a unique NPC's rolled values (section 4).

### 3. Raw and derived fields

The save stores only what can't be rebuilt. Everything recomputable is derived on every use and never written.

| Kind | Fields | Rule |
| --- | --- | --- |
| Derived | True skill, effective skill, Total, Burden, cap in effect, health-track level, part states, hit table, active item effects, gear bonuses, protection per part, hands and slots in use, race perk, class perks, character level, excluded skills | Never saved. Effective skill differs per check, so it can't be cached |
| History | Raw skills and their states, StartingTotal, all-XXX perks, level perks chosen, marks, classes and class levels, race, body type, part pools, minted item blueprints, item instances, shield and armor pool states | Saved as plain fields |
| Grey zone | XP, unspent perk points, Potential | Saved, with a source trail where the value can change |

- Potential is saved as a base plus a list of {source, delta, turn} adjustments, so a perk or event change can be traced or reversed.
- Character level is the sum of class levels unless a perk changes it, so it is derived.
- Values used at resolution (the Burden snapshot, the effective skill of a check, the event roll) go in the turn record, not on the sheet.
- Retuning never recalculates saved progress. Levels are stored and never lost. A retuned XP curve changes only the distance to the next level; if a character's XP already passes the new threshold, it levels up at its next XP award, not on load. A retuned perk-point rule applies only to future levels: points already earned and perks already bought stay.

### 4. Actor sheet

The player and every NPC share one sheet shape: a Core every actor has, plus optional modules. Roll code reads Core only, which guarantees one resolution path for everyone.

| Module | Who has it | Holds |
| --- | --- | --- |
| Core | Every actor | Race, body type, skills and states, classes, stored perks, condition, inventory, standing defense, public label |
| Progression | Player; NPCs only if NPCs improve (deferred) | StartingTotal, Potential, XP, unspent perk points, marks |
| Mind | NPCs | Control, morale, beliefs, overrides, knows facts, current routine and its anchor, routines list, slot bindings, alarm state. The agenda flag is derived, not stored; the band moved to the Actor |
| Journal | Player | Secrets learned, facts witnessed, last-seen state slots, names known |

Promoting an NPC to recurring adds a module; it never converts the sheet. A companion needs no module: it is any member of the player's band.

**Race and body type** (BR1–BR9, Ali 08/11/2026). The body type is the shape; the race is what the being is. Every race names exactly one body type (BR5), its HP multiplier (BR2), optional natural armor (BR6), its own natural attacks and fallback attack skill on top of the shape's (BR3), and innate perks and quirks. An NPC template and the player's build name a race, and the body type comes from it. Races today: Human and Elf (humanoid, ×1), Slime (amorphous, ×0.6), Dragon (winged quadruped, ×3). Defeat achievements count both the body type and the race (BR8). Tree access rules may name either (BR9); a tree the shape already blocks is not blocked again on the race.

**Skills.** General skills are open to every actor unless a perk or race excludes them. Each class adds its own tree of three skills. Exclusions are derived from the library and never stored.

**Skill tree access** (Ali, 08/11/2026, "Skill tree access" TA1–TA11). Every tree has its own access rule in the library (TreeDef.access), and each tree is coded on its own. A rule has up to three lists of conditions: **Must** (every one holds), **Either of** (at least one holds, when listed) and **Blocked by** (any one closes the tree). A block always beats an opening (TA2). A tree with no rule is open to everyone. A condition names one source: a race, a body type, a class with a minimum class level (default 1; the class counts while Current or Previous, never Unlocked, TA3), or a perk (quirks included); a new kind of source is one more case in one check. A skill in a tree the actor can't use counts as 0 (rolls, HP, the rating) and can't be raised; its points are kept and come back with access (TA4 a). Rules are per tree (TA8), with one exception: a skill can carry its own rule on top of its tree's (SkillDef.access, SR1 below). Rules hold for the player and every NPC: a test fails if a template gives a skill its actor can't use (TA9). Trees a character can't use are hidden on the creation screen and the character sheet unless the character has points in them; those show "Blocked by: …" or "Needs: …" (TA10). Today's rules: Swordsman must have class Swordsman; Slime senses must have race Slime (BR7); Natural weapons (unarmed\_natural, TA5) needs either body type amorphous (its slam) or race Dragon (its own attacks); body type amorphous blocks Melee, Ranged, Unarmed, Perception, Speech and Tools (no hands, voice, eyes or ears, TA6). A block the shape gives is not repeated on the race (BR9). **Speaking races** (Ali, 08/11/2026, SR1): each race is tagged if it can speak (RaceDef.tags 'speaks': Human and Elf yes, Slime and Dragon no), and a condition can name a race tag. Intimidation is open to anyone with the Speech tree; persuasion and barter must have a speaking race. Banked: TA7 (Tools, lockpicking) and TA11 (nested groups of conditions), D-113.

**Classes.** Each class an actor knows is saved with its state and its class level:

| State | Meaning |
| --- | --- |
| Unlocked | Offered at level-up. Same as not having it: tree unusable, class level 0 |
| Current | Exactly one. Receives every new level for persistent characters |
| Previous | A former current class. Keeps its levels; its skills stay usable |

Putting a level into an unlocked class makes it current, and the old current class becomes previous. Class perks come at class levels set in the library (normally 10 and 20) and are derived. Previous-class skills keep improving like any other skill. Returning to a previous class is deferred.

**First-build classes.** Swordsman, the player's class: its tree holds only riposte (Ali, 10/11/2026; it augments Parry, D-170). Feint and disarm are removed for now and parked as skill ideas for future classes (D-157; ids SK22 and SK24 retired). **Sword-dancer tree** (Ali, 10/11/2026): mirrors the Swordsman with one skill, Blade Dance (formerly Slip Counter), Riposte's twin for dodging instead of parrying (it augments Dodge, D-170); its 60 perk Step and Cut mirrors Answer the Blow (strike back at once off a clean dodge with a light or medium weapon), and it sets class floors of melee\_medium 25 and block 15. Slime, every slime's class: its tree, Slime senses, holds tremor (tier 0; every slime has 50, Ali 08/11/2026). Taste was removed for now (Ali, 08/11/2026); the other skills are open.

**Player creation.** The player builds the sheet by point-buy on the creation screen (https://claude.ai/artifact/HW45ivigqwZ5VDo4PWPv9u): 250 points over the open skills, no skill above 60 at creation, the class floors as minimums, and exactly 3 Tagged skills. The screen opens on a recommended build and shows HP, attack, standing defense and the odds against one slime as points move. The story starts only when every point is spent and 3 skills are tagged. StartingTotal is the sum of the untagged skills at that moment. The player starts with an arming\_sword and a round\_shield held, a gambeson worn, and 20 coin (placeholder). The player starts at level 4 (START\_LEVEL, EQ13, Ali 08/11/2026) with the perk points of levels 2 and 4. **Starting classes** (Ali, 09/11/2026). The creation screen offers two starts. Swordsman: 250 points, level 4, floors Medium Weapons 40 and Block 40. Late bloomer: the unique class Unwritten Legend, 50 points, level 1, no floors, and its level 1 perk Quick Study (a marked skill whose raw value is below 15 gets two improvement rolls, each with its own gain). A class's creation points and starting level are ClassDef.creation (defaults CREATION\_POINTS and START\_LEVEL); its stranger label is ClassDef.label. **Class-level perks:** ClassDef.levelPerks lists perk ids by class level; a character gets them (source 'class') when the class reaches that level, at creation or on a level up. **Class IDs** (Ali, 09/11/2026): every class has a fixed ID (`CL` in src/library/classIds.ts: Swordsman CL1, Unwritten Legend CL2, Sword-dancer CL3, Commoner CL4, A Nobody CL5, Trader CL6); code and saves use the ID, so a class can be renamed in the library alone. **Class tiers** (Ali, 09/11/2026): every class has a tier on the ordered scale CLASS\_TIERS (lowest to highest: Common, Trained, Seasoned, Renowned, Heroic, Legendary; ClassDef.tier stores the key tier\_0 to tier\_5), shown on the creation screen and the class picker, to compare classes and to place NPC templates later. Commoner Common, Trader Common, Swordsman Trained, Sword-dancer Trained (mirrors the Swordsman), Merchant Trained, Guard Trained, A Nobody Seasoned, Unwritten Legend Legendary. **Class unlocks:** ClassDef.unlock lists true skill per skill; a player without the class unlocks it (state unlocked, level 0) when every one is met, checked after improvement rolls. Swordsman unlocks at Medium Weapons 40 and Block 40. ClassDef.unlockAny is a list of either-of groups: in each group at least one skill must also be met. **Unlocks are floors** (Ali, 10/11/2026): a class's skill floors are its own floors plus its unlock conditions (`classFloors`), so every character of a class meets what unlocks it. An either-of group is met when one skill in it reaches its value. A template with a class has its minimums raised to them (`templateMinimums`; an unmet group raises the skill the template has most of), and the village guard template carries the Guard class. ClassDef.unlockPerkWith needs an active perk whose numbers reach the listed ones (PerkDef.hearingReach: zone links added to hearing; Keen Ear 1, and hearing reach sums it over perks). **Merchant** (Ali, 10/11/2026): a tier 1 class (top level 10) unlocked by the Trader capstone Known at Every Stall (PK99), which Trader (tier 0, top level 5) grants at level 5; Merchant has unlockPerk set to it, as A Nobody has with Nobody Special. ClassDef.unlockClass (class levels other classes must reach, a number or 'max' for that class's top level) is kept unused for D-159. Its tree (Merchant, TR15) holds one skill, Shrewd Dealing (SK33), Merchant's advanced barter. **Guard** (Ali, 10/11/2026): a tier 1 class (CL8) that unlocks with any weapon skill at 40 (Light, Medium or Heavy Weapons, or Light, Medium or Heavy Ranged), any armor skill at 40, Block or Dodge at 30, and a perk that sharpens hearing (`hearingDb`: Keen Ear, which patrolling templates have). No tree or floors yet. **Skills augmenting skills** (Ali, 10/11/2026; a frequent theme to come): a skill can list `augments` [{ skill, share, rollKinds }]: its true skill × share (default 1) × its tier is added to the effective skill of every roll or check that asks for the augmented skill, or only rolls of the listed roll kinds (RollKind) when some are listed. The augmenting skill's tree must be open. Shrewd Dealing augments Barter at share 1 on every roll. **How augmenting skills learn** (Ali, 10/11/2026, AU1–AU5, option B): the roll gets one learning window from its sums, built like any skill's window: the low end is the rolled skill's raw plus each augment's raw × share × tier, minus MARK\_WINDOW; the high end is the rolled skill's max(raw, true) plus each augment's max(raw, true) × share × tier, plus MARK\_WINDOW. Every augment that added to the roll is marked when the opposition is inside that window; the opposition is a check's difficulty, or the other side's true skill plus what its own augments added (AU2). A tie (tier gap 0) marks every skill and augment that went into the roll (AU4). An augment not yet on the sheet counts as raw 0 and learns once its tree opens (AU3). An augment limited to roll kinds learns only from rolls of those kinds (AU5). The rolled skill keeps its own window and opposition (markAugments in src/ruleset/improve.ts). **Sword-dancer** (Ali, 09/11/2026): a class that unlocks at Dodge 40 and Light or Medium Weapons 40. It mirrors the Swordsman: its skills and perks are meant to be the Swordsman's, so the two are designed together. It has no tree, floors or creation start yet. **Starter kit** (Ali, 09/11/2026; pairs rule 10/11/2026): items tagged 'starter'. **Rule for every gear class, including new ones: the starter kit holds one item needing 25 (Common) and one needing 50 (Fine) in that class, and nothing above 50.** Improvised weapons are exempt. Today: light melee dagger / short sword; medium melee hand axe / arming sword, spear; heavy melee woodsman's axe / greatsword; light ranged shortbow / recurve bow; medium ranged flatbow / longbow; heavy ranged light crossbow / stirrup crossbow; light armor gambeson / boiled leather (plus Crude rough clothes); medium armor brigandine / mail hauberk; heavy armor lamellar coat / half plate; shield round shield / kite shield (tests/scenarios/s143 checks it). After creation the player gets, per gear class, only the highest-level starter item whose equip requirement the build meets (`starterKit`): the weapon whose required skill is highest is held (then the higher level), a met shield goes in the other hand unless the weapon takes two hands, the highest-level armor met is worn, and the rest is carried. The recommended swordsman gets the arming sword, round shield and gambeson, and carries the spear. Crude rough clothes (need 0, stop nothing, no Dodge cost) are in the starter kit too, so the late bloomer starts in them with no weapon (Ali, 09/11/2026). Crude weapons (cudgel, rusty knife) are library items outside the starter kit. **Equipment balance lever** (Ali, 09/11/2026): a standard-kit piece's bonus is EQUIP\_FACTOR × its need (EQUIP\_FACTOR 0.4 for now; it replaces the flat KIT\_BONUS 25), so all equipment is rebalanced with one number: Crude 0, Common +10, Fine +20, Superior +30, Masterwork +40. Kit pieces still share one bonus per roll, the best of them. A minted item of quality 3 or 4 is a level up (EQ11), so its bonus rises one step too. **Quality lever** (QE1): a minted weapon's hit bonus is QUALITY\_HIT\_FACTOR (0.04) × its need × its quality (1–4), and quality 3–4 still moves it a level up (EQ11), so a fine sword gives +2/+4/+9/+12 hit. Damage boosts and armor and tool quality keep their tables for now (QE2 open). **Rule of thumb for all gear:** an item's stats scale with its need. Armor will get its own lever and shields a lever for their pool (QE3, under discussion). The recommended build (`recommendedBuild`, one source for the screen and tests) meets its starting gear: melee\_medium 50, block 40, dodge 25, endurance 50, sight 30, hearing 30, light\_armor 25; tags melee\_medium, block, endurance.

**NPC generation.** All generation runs in code. A template gives a body type and class, a minimum for each skill, a level, bonus points, three focus picks, a personality, a loadout and a control setting. Two kinds of NPC:

- **Unique** (a bandit): rolled once at spawn, then its values are saved and frozen.
- **Copy** (a wolf, a slime): saves only the template id and live state, and follows the latest template.

A template may carry a loadout: a list of library item ids given to every NPC made from it (Part 5 §8) \[Proposed\].&#32;

**Unique generation** (code, seeded), modelled on Iliad Quest's NPC rolls:

1. Every skill starts at the template's minimum; a skill with no minimum is raw 0. Minimums give each NPC its basic function, so a lopsided NPC is fine.
2. Points = level × POINTS\_PER\_LEVEL + bonusPoints (POINTS\_PER\_LEVEL 10, a balance lever in CONFIG; Ali, 08/11/2026). The level is fixed per template for now; level rules come later. bonusPoints lets a well-trained template (a guard) outskill a higher-level one (a bandit).
3. The template names three focus picks, each a tree and a preferred skill in it (Iliad Quest rolls three focused skill groups and the GM picks the skill).
4. Points go out in 5-point chunks, and a seeded d3 picks the focus pick for each chunk, so spending is uneven. No skill goes above 100.
5. The three preferred skills are Tagged. Perk points from the level are saved; NPC perks are deferred.

A copy does not roll: its skills are the template's minimums, read live.

**Personality** (Ali, 11/11/2026, questions PL1–PL19, page "Personality Lines"). Every actor, the player included, holds points in two layers (Core.personality), and everything shown is read from them (src/ruleset/personality.ts):
- **Nerve** (how a character meets risk; PL1–PL4): one axis from Cautious (−100) to Daring (+100). It leans at PERSONALITY\_LEAN (20) or more from 0, which gives three lines: Cautious, Steady (no lean) and Daring. Raw Resolve picks the tier on the line (NERVE\_TIER\_FROM: 0, 20, 40, 60, 80, 100; one ordered scale per line in NERVE\_LINES): Cautious Skittish, Timid, Careful, Prudent, Cool-headed, Unflappable; Steady Jittery, Settled, Steady, Stalwart, Unbreakable, Immovable; Daring Blustering, Brash, Spirited, Bold, Fearless, Death-defying. Resolve 100 and up is superhuman (Ali, PL3); past it, every NERVE\_BEYOND\_STEP (50) adds a + (PL20). The morale level is the mood and never moves the tier (PL4). Names are set by the lore thread (PL18).
- **Personality** (how a character behaves; PL6, PL7): six axes from −100 to +100, a library table (PA…): Honesty (deceitful ↔ honest), Pride (humble ↔ proud), Temper (patient ↔ quick to anger), Sociability (quiet ↔ talkative), Discipline (impulsive ↔ disciplined), Curiosity (set in its ways ↔ curious). Plus one or two **values** (PL19, VL…): duty, wealth, family, faith, power, freedom, safety, pleasure, knowledge, kindness (PL28). Ali asked for more (PL28), so the list now covers all 19 values of Schwartz's refined theory (Schwartz et al. 2012) plus family: glory (achievement), adventure (stimulation), reputation (face), humility, nature, justice (universal concern), tolerance, loyalty (dependability), courtesy (interpersonal conformity), order (societal security) (PL29).
- **Words** (PL9): a trait under 20 from 0 is left out; 20–39 "a bit", 40–69 the plain word, 70 and up "very" (TRAIT\_WORDS). **Named types** (PL10, PY…) are library rows of conditions on the axes, Nerve and raw Resolve, each with a behaviour hint; the agent gets the ones met, at most PERSONALITY\_TYPES\_SHOWN (2), strongest first. Rows approved by Ali (PL21–PL27): Prideful, Mature, Childish, Honourable, Schemer, Bully, Busybody.
- **What it does** (PL13): words only. The Planner and Responder get one line in CHARACTER, such as "Nerve: Timid (Calm right now). A bit talkative. Values: wealth." The Voice does not (Q1). Code-run NPCs are unaffected; numeric effects are D-205.
- **Where points come from**: an NPC template gives its points and its starting Resolve (PL11). The Weaver may name a Nerve line (±NERVE\_LINE\_POINTS, 40), up to two types (each sets the traits it names to its threshold) and up to two values for a new actor (PL12). The player sets them at creation (CreationBuild.personality; left out = no lean) (PL14). Perks, the current class and achievements add points while held (PerkDef, ClassDef, AchievementDef `personality`; achievement chains include lower levels by reference) (PL15, PL16). Acting in or against character moves nothing (PL16).
- **The player's personality in play** (Ali, after playtests runs 34 and 35): narration flavour only. The Narrator gets player.personality (the sheet's words) and may colour how the player's actions are told, e.g. a cautious character who lashes out does it with a shaking hand. It never changes, softens, refuses or undoes an action, and the Parser never sees it.
- **Who sees it** (PL17): the player sees their own on the sheet, never an NPC's. The Character page card has a Personality block: the Nerve tier and line ("Steady · Daring nerve"), the trait words, the values, and each named type with its hint (src/ui/personality.ts).
- **Creation picker** (PL14): below the skill groups, a Personality section: a Nerve line picker (Cautious, Steady, Daring; ±NERVE\_LINE\_POINTS) with the tier the current Resolve gives, up to two values, and a slider per axis (−100 to +100, step 5) showing its word live. A line under it reads the result back as the sheet will ("Honest, proud. Values duty and freedom. Types: Honourable, Prideful."). Clear resets to no lean. The picks carry over when the starting class changes; validateBuild refuses points outside −100 to +100, unknown traits and more than two values.

**Slime template** (first build): a copy of race Slime (body type amorphous) with no class (BR7: the Slime class is gone; the Slime senses tree needs race Slime), level 0, Resolve 50 and no personality points (Steady; slimes are no longer fearless). Skills: unarmed\_natural 30, dodge 0, everything else 0. HP multiplier 0.6 (30 HP). Its slam uses the slam class: damage 20, hit +10, reach 0.

**Village templates** (first build; every number a placeholder). All three are copies of race Human (body type humanoid) with no class:

**Template rules** (Ali, 08/11/2026). Anyone with fighting experience (guard, thief) is at least level 4, and a villager at least level 2. A template can list perks (`perks`) that every NPC made from it has. Any template that patrols (its role has a routine set with the patrol routine), now and later, lists Keen Ear, and a test enforces it. Copy templates spend their level points too (Q3, Ali 08/11/2026), with a seed fixed per template id, so every copy of a template is alike. Copies follow their template live: on load, each copy's skills are rebuilt from the template and the current POINTS\_PER\_LEVEL, and missing template perks are added (`refreshCopies`), so changing the lever reaches existing templates and NPCs. Unique NPCs keep what they rolled. With the lever at 10 a guard has melee\_medium 70, medium\_armor 50, block 50, sight 40 and pays 92 kill XP. Every template carries the skill its loadout asks for (AR9), and a test checks it (EQ5).


- **guard:** level 4, bonus points 10, perk Keen Ear; minimums melee\_medium 50, medium\_armor 50, block 30, dodge 20, sight 30, hearing 30, intimidation 30, persuasion 20; focus picks melee/melee\_medium, defense/block, perception/sight; Resolve 50, Discipline 40, value duty \[Proposed\]; loadout arming\_sword, mail\_hauberk; control agent.
- **trader** (the barkeep): level 2; minimums sight 25, hearing 25, barter 40, persuasion 30; focus picks perception/hearing, melee/melee\_light, defense/dodge; Resolve 30, Nerve −40, Sociability 20, value wealth \[Proposed\]; no loadout; control code.
- **patron:** level 2; minimums unarmed\_strike 20, sight 20, persuasion 30; focus picks unarmed/unarmed\_strike, defense/dodge, perception/sight; Resolve 30, Nerve −40, Sociability 20, value pleasure \[Proposed\]; no loadout; control code.

### 5. Locations and story memory

Every turn happens at one node of a location tree (the place of the player's zone), so a castle in one city is never confused with a castle in another. A scene can cross several nodes.

**Place tree.**

- Nodes have opaque ids and a parent link. Depth is unlimited; each node has a kind (country, settlement, place, and any added later), and the library says which kinds may nest under which.
- Each of Part 2's zones belongs to one place. The stage (the zones in play) may hold zones from several neighbouring places; a fact is saved at the place of the zone where it happened.
- Actors are not in the tree. Each actor holds a placeId pointer, which always equals the place of its zone; every move updates it, so people and creatures move freely between cities.
- When Claude names a place ("the castle"), code resolves it in the current settlement first, then upward. Claude never handles ids.

**Renames.** Places and people keep a current name plus past names. Old names still resolve. Fact text stores references, not names (met {npc:leona} at {place:gilded\_cup}), filled in with current names when a view is built, so a rename never needs a rewrite.

**State versus history.** Two records are kept apart so old details can't contradict new ones:

| Record | Holds | Rule |
| --- | --- | --- |
| State slots | What is true now (gilded\_cup.north\_wall: repaired) | One value per slot; a new value overwrites. Written by code from events, or by a validated set\_place\_state proposal naming subject and attribute |
| History facts | What happened ("the brawl broke the north wall") | Append-only, past tense, never edited |
| Player memory | The last value the player saw per slot, and when | Lets narration avoid "knowing" about a change the character never saw |

Whether every slot tracks player memory, or only narrated slots, is deferred.

**Facts and promotion.** A fact is saved once, at the node where it happened, linked to the entities it involves. Location facts are things the player witnessed or was told; world truth the player doesn't know stays in the hidden store. Promotion copies a short headline to an ancestor node:

- Code rules promote the important events: first meeting with a named NPC, a named death, a quest step, a revealed secret.
- Claude may propose promote\_fact; the validator accepts it within a per-scene cap (placeholder).

**What a view receives.** PlayerView, NarrationView and WeaverView receive all facts for the current place, the top few headlines of each ancestor, and any fact linked to an entity present. Leona's "met at the Gilded Cup" arrives with her in another country. NPC views (OppositionView, DialogueView, ActorView) never receive facts or headlines: facts record what the player witnessed or was told.

### 6. Persistence

The save is many small versioned pages in the artifact's database, committed by flipping one bookmark. State is never rebuilt by re-running old turns, because the library always moves to its latest version and replay under a newer library would change the past.

**Three records.**

| Record | Holds | Kept |
| --- | --- | --- |
| Snapshot (head bookmark) | The page versions that make up the story at turn start | Current and one turn back |
| Turn record | Player text, agent outputs, RNG state before, events with effects, facts added, library version | Last N (placeholder) |
| Story history | Facts and promoted headlines | Never pruned |

**Where it lives.** The artifact's db capability, not browser storage and not a self-republishing page. Database paths (even segment counts, as the platform requires):

```
library/meta                          libraryVersion, alias table
library/<kind>.<id>                   one library entry, e.g. library/body_type.dragon
stories/<storyId>                     story meta
stories/<storyId>/control/head        the bookmark
stories/<storyId>/control/lock        turn lock (lease)
stories/<storyId>/pages/<key>@<turn>  one page version, e.g. actor.rook@41
stories/<storyId>/turns/<turn>        one turn record
stories/<storyId>/backups/<turn>      one in-database backup (section 11)
stories/<storyId>/history/<n>         story text for turns n×HISTORY_CHUNK_TURNS onward
```

Page keys: engine, hidden, actor.\<id>, place.\<id>, facts.\<placeId>.\<n>, blueprint.\<id>.

**Platform limits** (artifact runtime contract 0.2.96):

- 256 KiB per document, 32 levels deep; paths up to 16 segments of 200 bytes.
- No transactions; last writer wins. Hence the bookmark commit.
- An artifact's database holds at most 25,000 documents in total, shared by the library and every story. Documents per collection, total size and write rate are also capped, but those numbers are not published.
- Leases give a single-writer lock.

**Undo.** One turn. It points head back at the previous bookmark and drops that turn's record. The RNG does not roll back: the engine page keeps the undone turn's RNG state, so a retried action rolls new dice. Undo after a library edit is allowed; the restored state uses the new library from the next turn. Undoing the turn that started a scene rerolls the event roll and runs Agent Weaver again, like any other dice. Undoing a turn that crossed a frontier reuses the held extension, if this session still holds it.

**Removed.** No named save slots and no /save export. Backups are automatic (section 11).

**Two windows.** The turn lock makes a second window read-only while the first plays.

### 7. Versioning and migration

Three things can change under a running story, and each has its own rule.

| What changes | Example | Rule |
| --- | --- | --- |
| Save shape | Code adds or moves a field | Numbered migration steps, run in order on load (v3 → v4 → v5). Defaults for missing fields are allowed only inside a step |
| Library entries | A dragon gains a tail; a perk is revised | Reconcile on load (table below) |
| Ruleset numbers | K, tier tables, penalties | Derived values follow automatically. Saved levels, XP and perk points keep their values; a new XP curve or perk-point rule applies from the next level (section 3) |

**Library reconcile rules.** The library keeps a status per entry, so saves always know where an id went.

| Entry status | Effect on a save |
| --- | --- |
| Added | New body part starts Healthy; new skill starts at its default |
| Revised | New effect applies at once (effects are derived) |
| Renamed | Library keeps old id → new id; saves follow the alias and keep raw values |
| Replaced | Old id points to its successor; saves move to the new entry |
| Deleted | Perk, skill or class stays dormant on the sheet: kept, not applied, shown in the GM view. A removed body part's pool is dropped |

**Resets.** A change too big to migrate may reset the story, but only after the designer confirms it. Code never resets on its own. If a migration can't run, the game refuses to load, leaves the save untouched, and asks. A confirmed reset archives the old story: its pages and backups stay under its own id, and play starts a new story id (D-73). The GM view has a **Start a new save** button (Ali, 08/11/2026): it warns that the current story ends and play can't return to it, offers Download backup, and only a second click archives the story (its meta gets `archivedAt`, so the newest story list skips it) and goes to Create. The "You fell" screen's Reset does the same.

**Safety bookmark.** Before migrating, load keeps the pre-migration bookmark. It is dropped after the next good turn.

### 8. Integrity

Only the engine writes the save, every load is checked, and the save stays inside platform limits.

**One write door.**

- The store accepts only typed engine operations. Agent outputs are a different type, so the compiler rejects passing one to the store.
- Agents receive copies built by the view builders, never live state.
- Claude in chat may read saves to debug and may write library entries when asked. It never writes story pages.
- The head lists a checksum for every page. A page changed from outside (by hand, or by Claude in chat) or torn by a half-finished save fails the check on load.

**Checks on every load.**

| Check | Examples | On failure |
| --- | --- | --- |
| Checksums | Every page matches its hash in the head | Refuse to load, ask the designer |
| Shape | Every page matches its schema version | Refuse to load, ask the designer |
| Invariants | Exactly one current class; character level = sum of class levels unless a perk says otherwise; every page carries the loaded story id; every actor's placeId equals its zone's placeId; every stage zone id resolves to a zone on its place page; no slot used twice per actor; every slot names a part the actor still has; no part covered by two worn items; stackables hold qty ≥ 1 | Refuse to load, ask the designer |
| References | Every id resolves: place, actor, fact, library entry (through alias or dormant) | Repair and report: drop the dangling link, list it in the GM view |

Raw skill above 100 is logged as a warning, not refused, because workaround mechanics for the mortal limit are coming. When a load is refused, the designer chooses: the undo bookmark, the safety bookmark, or a confirmed reset.

**Size budgets.**

| Item | Budget | When reached |
| --- | --- | --- |
| Any page | 256 KiB (platform) | Busy places split facts into more facts.\<placeId>.\<n> pages |
| Turn records | Last N (placeholder) | Oldest records are deleted; story history stays |
| Story text | HISTORY\_CHUNK\_TURNS turns per document (20) | A new document starts; nothing is pruned. If one document passes 256 KiB its lines keep their text and lose the code-built extras (mechanics, heard lines, changes) |
| Claude proposals | Fact text and name length; promotions and minted items per scene (placeholders) | The validator rejects the proposal |
| Whole story | 25,000 documents per database, shared by the library and every story; total size and per-collection caps unpublished | Saving stops and the game says so. Data is never dropped silently |

### 9. Types

These types replace Part 2's GameState and Actor as the saved shape. Belief, Fact, Zone, ZoneLink, Band, HiddenStore, GameEvent, AgentTurnLog, Tier and EventRollResult keep their Part 2 definitions. Fields marked reserved hold a place for an open question and are not used yet.

```ts
// ---------- ids ----------
type StoryId = string;
type ActorId = string;
type PlaceId = string;
type FactId = string;
type LibraryRef = string;   // id in the story's blueprints or the library (story first)
type SlotKey = string;      // '<subject>.<attribute>', e.g. 'gilded_cup.north_wall'
type Turn = number;
type Grade = 'none' | 'minor' | 'moderate' | 'major' | 'extreme';   // [Proposed] challenge and gain scale

// ---------- library (shared by every story) ----------
type LibraryMeta = {
  libraryVersion: number;   // bumps on every library edit
  status: Record<LibraryRef, EntryStatus>;
};
type EntryStatus =
  | { state: 'active' }
  | { state: 'renamed'; to: LibraryRef }
  | { state: 'replaced'; by: LibraryRef }
  | { state: 'deleted' };   // saves keep the id dormant

type ItemDef = {                       // library entry or story blueprint (kind 'item'); Part 5
  id: LibraryRef;
  kind: 'weapon' | 'armor' | 'shield' | 'accessory' | 'tool' | 'consumable' | 'misc';
  name: string; look: string;          // public text
  bulk: 0 | 1 | 2 | 3;                 // no carry limit yet
  value: number;                       // base price in coins; placeholder, unused until trade
  stackable?: true;
  consumable?: true;                   // removed on use
  concealed?: true;                    // hidden from others until used
  visible?: true;                      // accessories: shown to others
  slot?: 'armor' | 'accessory';
  hands?: 1 | 2;
  effects?: ItemEffect[];
  weapon?: { modes: AttackMode[] };
  armor?: { covers: string[]; reduction: number; multiplier: number;
            weight: ArmorWeightKey;   // ARMOR_WEIGHTS: light, medium, heavy
            pools?: Record<string, number> };   // part id -> pool in points, the same for every wearer
  shield?: { pool: number };                     // pool in points, the same in any hand
  base?: { itemId: LibraryRef; quality: 1 | 2 | 3 | 4; boosts: string };   // minted variants
  tags?: string[];
};

type ItemEffect = {
  kind: 'skill' | 'rollMod';           // rollMod only when the entry notes it
  skill?: LibraryRef;                  // kind 'skill'
  roll?: 'hit' | 'dodge' | 'block' | 'perception' | 'stealth' | 'event';   // kind 'rollMod'
  value: number;
  active: 'worn' | 'held' | 'inUse' | 'carried';
  scope: 'withItem' | 'any';
};

type AttackMode = {
  id: string;
  tree: 'melee' | 'ranged' | 'unarmed';
  class: 'light' | 'medium' | 'heavy' | 'punch' | 'slam' | 'grapple';   // natural attacks use their own class; unarmed with no class: the unarmed profile
  skill?: LibraryRef;                    // unarmed only: which placeholder skill
  reachM: number;                        // metres, from real weapons
  reach: number;                         // metres in use: reachM + a thrown weapon's perk metres (modeReach)
  hands: 0 | 1 | 2;                      // 0 for natural attacks
  thrown?: true;
  damageAdj?: number;
  hitAdj?: number;
  partId?: string;                       // natural attacks: the Strike part used
};

// ---------- story control ----------
type StoryMeta = {
  storyId: StoryId;
  title: string;
  schemaVersion: number;
  createdAt: string;        // ISO date
  settings: { difficulty: string; showMechanics: boolean; tone: string };
};

type PageRef = { version: Turn; hash: string; bytes: number };
type Bookmark = { turn: Turn; pages: Record<string, PageRef> };   // page key -> version

type Head = Bookmark & {    // writing this is the commit
  storyId: StoryId;
  schemaVersion: number;
  libraryVersion: number;
  undo: Bookmark | null;    // one turn back
  safety?: Bookmark;        // pre-migration, dropped after the next good turn
};

// ---------- pages ----------
type EnginePage = {
  storyId: StoryId;
  turn: Turn;
  mode: 'explore' | 'dialogue' | 'tactical';
  rngSeed: number;
  rngState: number;         // NOT restored by undo
  pending: { turn: number; mode: 'explore' | 'dialogue' | 'tactical'; engaged: string[]; fired: string[] };
  stage: {
    zoneIds: string[];      // zones in play; may span several places
    tier: Tier;             // this scene's event-roll tier
    sceneNumber: number;
    sceneStartTurn: Turn;
    fallback?: { reason: string; turn: Turn };   // set when the fallback stage was used
  };
  sceneCaps: { promotions: number; minted: number };   // reset at scene start
  clocks: Record<string, number>;
  flags: Record<string, string | number | boolean>;
  bands: Band[];
  quests: Quest[];   // src/types/state.ts: id, state, text, giver, dealId, goal, progress, level, startTurn, after?, pay?, due?, pinned?
};

type HiddenPage = { storyId: StoryId } & HiddenStore;

type BlueprintPage = {
  storyId: StoryId;
  id: LibraryRef;
  kind: 'item' | 'body_type' | 'npcTemplate';
  data: Record<string, unknown>;   // same shape as the library entry of that kind
};

// ---------- actor ----------
type NameHistory = { current: string; past: { name: string; untilTurn: Turn }[] };

type Actor = {
  id: ActorId;
  storyId: StoryId;
  kind: 'player' | 'npc';
  names: NameHistory;
  label: string;                     // public stranger label, e.g. 'a scarred dockhand'
  knownOnSight?: boolean;            // name known without an introduction
  placeId: PlaceId;                  // always the place of `zone`
  zone: string;                      // zone id (Part 2)
  posture?: 'open' | 'stealthy';     // player only (Part 2)
  bandId: string;                    // moved from Mind; the player belongs to the player band
  core: Core;
  progression?: Progression;         // player; NPCs only if NPCs improve (deferred)
  mind?: Mind;                       // NPCs
  journal?: Journal;                 // player
};

type SkillState = 'tagged' | 'normal' | 'flawed';
type SkillEntry = { raw: number; state: SkillState; dormant?: boolean };

type Core = {
  raceId?: LibraryRef;               // absent for actors with no race
  bodyTypeId: LibraryRef;        // body plan; set by the race when there is one
  templateId?: LibraryRef;           // NPCs: the template it came from
  generation?: 'unique' | 'copy';    // unique: values below are frozen; copy: skills read from the template
  skills: Record<LibraryRef, SkillEntry>;
  classes: ClassEntry[];
  perks: OwnedPerk[];                // stored perks only; race and class perks are derived
  condition: SavedCondition;
  inventory: ItemInstance[];
  standingDefense: 'dodge' | 'block';   // Part 2, Agent Planner; default [Proposed]: the higher effective skill
};

type ClassEntry = {
  classId: LibraryRef;
  state: 'unlocked' | 'current' | 'previous';   // exactly one 'current'
  level: number;                                // class level; 0 while unlocked
  dormant?: boolean;
};

type OwnedPerk = {
  perkId: LibraryRef;
  source: 'level' | 'mastery';       // 'mastery' = all-XXX perks, never removed
  gainedTurn: Turn;
  treeId?: LibraryRef;               // mastery only
  tier?: 50 | 100 | 150;             // mastery only
  dormant?: boolean;                 // set on load when the library entry is deleted
};

type SavedCondition = {
  hpLostPct: number;                 // health-track level is derived from this
  parts: Record<string, number>;     // body-part id -> pool %, state derived
  destroyed?: string[];              // reserved: Destroyed latch, pending Healing
  status: string[];
};

type ItemInstance = {
  id: string;
  itemId: LibraryRef;
  qty?: number;                      // stackables only
  equippedIn?: string[];             // 'hand:<gripPartId>' | 'armor' | 'acc:<n>'; absent = carried
  pools?: Record<string, number>;    // % left: 'shield', or a covered part id
};

type Progression = {
  startingTotal: number;             // record only; never changes
  potential: { base: number; adjustments: { source: string; delta: number; turn: Turn }[] };   // base: POTENTIAL, or this character's own value
  xp: number;                        // toward the next level
  unspentPerkPoints: number;
  marks: LibraryRef[];
  xpLog?: { source: string; amount: number; turn: Turn; levelUp?: { classId: LibraryRef; level: number } }[];   // source trail (B8)
  achievements?: { id: string; key: string; of?: string; turn: Turn }[];   // each once (B4); name and level read from the library row `key`
  defeats?: Record<string, number>;   // 'all', 'body_type:<type>', 'race:<race>'
  nextClass?: LibraryRef;            // the class the next level goes to (X9)
};

type Mind = {
  control: 'agent' | 'code';
  moraleState?: 'broken' | 'surrendered';   // set when the morale bar reaches Broken (Part 3, Morale); cleared when the scene ends
  knowledge: Record<ActorId, Belief>;
  overrides?: Record<ActorId, 'hostile' | 'opposed' | 'neutral' | 'friendly'>;  // sparse; else band relations
  knows: Fact[];
  routine?: { id: string; anchorTurn: Turn };            // anchor set by code (Part 2, Anchors); zone removed
  routines?: string[];                                   // the routine set's routines; player band: the companion set
  routineSetId?: LibraryRef;                             // the set those routines came from
  slots?: Record<string, string | string[]>;             // slot -> zone id, or zone ids for a route;
                                                         // shared by every routine in `routines`;
                                                         // 'here' is written by code on a switch to a wait routine
  alarm?: { armed: boolean; lastAlarmTurn?: Turn;
            returnTo?: { id: string; anchorTurn: Turn } };   // set on alarm, cleared on calm or an agent switch
};
// Removed from Mind: the old group id (now Actor.bandId) and hasAgenda (derived).

type NpcTemplate = {                 // library entry or story blueprint (kind 'npcTemplate'); Part 4 §4
  id: LibraryRef;
  bodyTypeId: LibraryRef;
  raceId?: LibraryRef;
  classId?: LibraryRef;              // its class tree, e.g. 'slime'
  generation: 'unique' | 'copy';
  minimums: Record<LibraryRef, number>;   // skill -> starting raw; absent = 0
  level: number;                     // fixed per template for now
  bonusPoints: number;               // added to level x POINTS_PER_LEVEL; uniques only
  focus: { treeId: LibraryRef; skill: LibraryRef }[];   // three picks; uniques only
  resolve: number;                 // starting Resolve (Part 3, Morale)
  personality: Personality;        // Nerve, trait and value points (Part 4, Personality)
  loadout?: LibraryRef[];            // [Proposed] items given at spawn (Part 5 §8)
  potential?: number;                // overrides POTENTIAL for NPCs made from it
  control: 'agent' | 'code';
  label: string;                     // public stranger label
};

type Journal = {
  secretsKnown: string[];
  factsWitnessed: FactId[];
  remembered: Record<SlotKey, { value: string; seenTurn: Turn }>;
  namesKnown: ActorId[];             // actors the player knows by name
  clearSight?: Record<ActorId, ZoneId>; // actors seen clearly and where; kept until they move unseen (Q17)
};

// ---------- places and memory ----------
type Place = {
  id: PlaceId;
  storyId: StoryId;
  kind: string;                      // 'country' | 'settlement' | 'place' | ...
  parentId: PlaceId | null;
  names: NameHistory;
  zones: Zone[];                     // Zone and ZoneLink from Part 2
  state: Record<SlotKey, { value: string; setTurn: Turn; setBy: string }>;
  headlines: FactId[];               // facts promoted to this node
};

type StoryFact = {
  id: FactId;
  storyId: StoryId;
  placeId: PlaceId;                  // where it happened
  turn: Turn;
  text: string;                      // past tense; '{npc:leona}' refs, never names
  refs: string[];                    // linked entity ids
  source: 'rule' | 'proposal';
  promotedTo: PlaceId[];
};

type FactsPage = { storyId: StoryId; placeId: PlaceId; facts: StoryFact[] };

// ---------- turn record ----------
type TurnRecord = {
  storyId: StoryId;
  turn: Turn;
  libraryVersion: number;            // exact replay only under this version
  rngBefore: number;
  playerInput: string;
  agentLog: AgentTurnLog[];
  events: GameEvent[];
  factsAdded: FactId[];
  eventRoll?: EventRollResult;       // set on the turn that started a scene
};
```

### 10. Save and load flow

A save counts only once the head is written, so a crash at any earlier step leaves the last good save intact.

**Save, once per turn:**

1. Hold the turn lock: acquire control/lock at turn start and renew it while the turn runs. If it is busy, this window is read-only.
2. Resolve the turn in memory (Part 2), including scene setup or stage extension when the turn starts a scene or crosses a frontier. A turn stopped by a clarify question saves nothing.
3. For each page whose content changed: serialize it, check it is under 256 KiB (split facts pages if not), hash it, write pages/\<key>@\<turn>.
4. Write turns/\<turn>.
5. Write control/head: the new turn, the full page map, undo = the previous head's bookmark. This is the commit.
6. Clean up: delete page versions that no bookmark (head, undo, safety) points to, and turn records older than the last N.
7. After the narration is shown, write the story text: every history/\<n> document the turn's new lines fall in, rewritten whole. It is not part of the commit, so a failure costs only text. Loading a story reads every history document, so a reload shows the whole story column (Q18).

On unavailable, retry the failed write once. On quota\_exceeded, stop, keep the last good head, and tell the player.

**Undo:**

1. Hold the turn lock.
2. Read the undone turn's final RNG state from the current engine page.
3. Point head at the undo bookmark, with undo set to null.
4. Write a new engine page version carrying that RNG state forward, and add it to the head.
5. Delete the undone turn's record.

**Load:**

1. Read control/head, then every page it lists. Verify each checksum.
2. If the save's schema version is older: keep a safety bookmark, run the numbered migration steps in order.
3. If the library version changed: reconcile every library reference (section 7).
4. Validate shape, invariants and references (section 8). A structural failure stops here with the save untouched, and the designer chooses: undo bookmark, safety bookmark, or a confirmed reset.
5. If steps 2 to 4 changed anything, write the changed pages and a new head, as in save steps 3 and 5.
6. Build in-memory state from the pages. The game is ready.

### 11. Backups and playing from several PCs

One player, signed in to the same Claude account on every PC. Backups run on their own; the player never has to remember them.

**Several PCs.**

- The story lives in the artifact's database, not on the PC, so opening the game on any PC signed in to the same Claude account continues the same story.
- Nothing needed to resume a story is kept in browser storage. Browser storage holds only per-PC conveniences, such as panel layout.
- The turn lock lets one PC play at a time. A second PC that opens the game mid-turn is read-only until the lock's lease ends. A PC closed mid-turn loses nothing: that turn never committed, and its lease expires.

**Automatic backups, two layers.**

| Layer | What is copied | When | Kept | Protects against |
| --- | --- | --- | --- | --- |
| In-database backup | Every page the head lists, packed into as few documents as fit under 256 KiB, at stories/\<storyId>/backups/\<turn> | Every BACKUP\_EVERY turns (placeholder), and on load before any migration | Last K per story (placeholder) | A bad migration, corrupted pages, mistakes beyond one-turn undo |
| Off-artifact backup \[Proposed\] | A scheduled task copies every story's current pages and the library into a separate backup artifact's database | Daily (placeholder) | Last K per story (placeholder) | Deleting or losing the game artifact |

- Backups are written only by engine code or the scheduled task, never by an agent.
- A restore runs the same checks as a load (section 8). It writes a new head pointing at the backup's pages, and keeps the current head as the safety bookmark.
- The GM view lists backups and restores one on request. Backups are never shown to the player during play, so they can't spoil hidden plans or secrets.
- In-database backups count toward the 25,000-document cap; size BACKUP\_EVERY and K together with N (OQ-9).
- Optional manual copy: an owner-only "Download backup" button in the GM view. It asks to confirm each time, so it supplements the automatic layers rather than replacing them.
- Before relying on the off-artifact layer, the build confirms that a scheduled task can read the game's database and write the backup artifact's database.

## Part 5 — Gear

### 1. Principles

- Gear is data in the library (or a story blueprint) plus a small instance in the story. Code reads it; no model decides a gear number.
- One gear path for everyone: the player and every NPC use the same effect reader, slots, gear ops, damage step and views.
- Numbers become words at the view. Agents see item names, public looks, kinds, class and weight labels and mode ids, never values.

### 2. When an effect is active

Every item effect declares one activation state. Code collects an actor's active effects from its inventory before each check or roll.

| State | Active while | Examples |
| --- | --- | --- |
| worn | the item is in the armor slot or an accessory slot | armor, rings, cloak |
| held | the item is in a hand | weapon, shield, torch |
| inUse | only for the action that uses the item | lockpicks, rope, potion |
| carried | anywhere in the inventory, only if the entry says so | charm, holy symbol, curse |

- **Tools.** For an action whose skill an inUse effect names, code picks the actor's best carried tool for that skill unless the action names one. The tool needs a free usable hand; if both are full, code stows the off-hand item as part of the action (free). \[Proposed\]
- **One copy counts.** A second instance of the same item id adds nothing. \[Proposed\]
- **Event roll.** An effect may modify the event roll only when its entry names it. Such an effect may be carried. Code reads the player's inventory once, at scene setup step 2. Only the player makes this roll.

### 3. What an effect can do

Three kinds, all subject to §2's activation and to a scope (withItem: only actions made with this item; any: every roll or check of that kind while active).

1. **Skill bonus (default).** A flat bonus or penalty to named skills, entering effective skill (Part 1 §3). It counts in full in checks and at the roll's skill weight in rolls. The standard kit bonus is one +25 per roll, shared by all kit pieces, so two kit pieces that both apply still give +25 (Part 1 §3). Armor weight is a skill penalty on Dodge: light −5, medium −10, heavy −20 (*placeholders*).
2. **Item stats.** Read by the combat flow, never stacked as modifiers: weapon modes (§5), armor protection and pools, shield part (§6).
3. **Noted roll modifier (rare).** A flat modifier on one roll kind (hit, dodge, block, perception, stealth, event), of type gear (Part 1 §4, Layer 2b), only when the entry says so. The weapon hit adjustment is one: it applies at full value on the hit roll.

Every gear modifier enters the check or roll request as its own entry, naming its item and state, e.g. "Gear (held): arming sword". How gear modifiers combine with perks and statuses is decided by the modifier-stacking rules, not here. Initiative is not a gear target yet (D-85).

### 4. Slots, hands and gear ops

- **Hands.** One hand per Grip part of the actor's body type (humanoid 2; wolf, dragon 0). An item or attack mode says hands: 1 or 2; two-handed needs two usable Grip parts.
- **Worn slots.** One armor slot, plus ACCESSORY\_SLOTS accessory slots (*placeholder*, 3) not tied to body parts.
- **Crippled Grip arm.** It keeps holding its item but can't use it: no attack, block or tool use with that arm, and no two-handed actions. A Destroyed arm drops what it held to the ground of the actor's zone; an item\_dropped event is perceived like any other.
- **Gear ops (free).** draw, stow, swap, wear or remove an accessory, pick up (from the ground or from a downed actor in the zone). Code applies them at the actor's initiative, before its action. They cost no action.
- **equip (main action).** Putting armor on or taking it off. Its final cost belongs to the action-economy discussion.
- **give (main action).** Moves an item to another active actor in the same zone.
- **Ground items.** Each zone holds a list of item instances lying there. They are saved with the zone on its place page.

### 5. Weapons

- **Class table.** In Part 3, Weapons, armor and shields (ruleset config): damage and hit by class, and block's tier gap counts one less against heavy.
- **Skills.** Combat-Melee, Combat-Ranged and Combat-Unarmed trees, each with three skills. The skill of an attack is the tree plus the class (melee\_heavy, ranged\_light). The three Combat-Unarmed skills are placeholders that behave the same for now, sharing one unarmed profile (*placeholder*: 15 damage, +10 hit). A natural attack uses its own class's damage and hit instead (Part 3, Weapons, armor and shields): the humanoid's punch is class punch, the slime's slam is class slam. Worn hand gear such as gauntlets may change unarmed damage later (D-97).
- **Attack modes.** A weapon lists one or more modes, each with its own tree, class, reach and hands, plus optional bonuses on top of the class table (damageAdj, hitAdj). Dagger: melee light, and Throw. **The Throw action** (Ali, 10/11/2026): the throw's rules live on the Throw row of the attack modes table (`attackModes`), so every weapon that lists Throw gets them and nothing is coded into the gear. Reach (RD6, Ali 11/11/2026): each throw mode's own throw range in metres (CONFIG.THROW\_M), aimed at a man-sized target: spear or javelin 17.5 (the Roman pilum's effective range, 15–20 m), knife 7 (the longest standard distance in European knife-throwing rules), improvised 5 (placeholder, no source); a throwing axe would be 12 (the francisca). Perks' `throwReach` adds metres, and gear `modeReach` turns it into links once: spear 2, knife and improvised 0 (their own zone until positions exist). Roll: the first **combined skills roll**: THROW\_BLEND weapon (0.75) × the weapon's own effective skill (its gear class skill: a dagger Light weapons) + THROW\_BLEND ranged (0.25) × the effective ranged skill of the same class (Light ranged). Each part takes its own stand-ins and only the gear that boosts its own skill, and both skills that rolled can learn. `AttackMode.blend` carries a combined roll, so later actions can use one too. A thrown item leaves the thrower's hands and lands on the ground of the target's zone, hit or miss (item\_landed), where anyone can pick it up. \[Proposed\]
- **Reach.** Each mode has a real reach in metres (`reachM`, from real weapons): fist 0.7, dagger 1.0, short sword 1.3, arming sword 1.6, greataxe 2.2, greatsword 2.3, spear 2.8; shortbow 50, flatbow and light crossbow 60, recurve and stirrup crossbow 70, crossbow 80, longbow 90 (effective ranges against a man, not the longest shot). Reach is compared in metres with the distance to the target with sight between them (sightDistM): a spear reaches 2.8 m into the next zone across a doorway, a sword only 1.6 m. Ranged modes take the range modifiers in Part 3 (Reach, range, cover and light). Item value counts whole zone links of reach (ruleset/range `reachLinks`). \[Proposed\]
- **Thrown.** A thrown mode moves the item to the ground of the target's zone. There is no other ammunition.
- **Natural attacks.** A body type lists the natural attack modes its shape always has, and a race may add its own (BR3). A mode tied to a Strike part follows Part 3's Strike role (Damaged −10, Crippled unavailable). A humanoid's unarmed mode has no part. \[Proposed\]
- **Blocking.** Any held melee mode can block, which meets the "shield or weapon" rule. Ranged, thrown and unarmed modes can't.
- **Default mode.** If an order names no mode, code uses the first held mode whose reach covers the target, else the unarmed mode.

### 6. Armor, shields and the damage step

- **Coverage.** An armor item lists the parts it covers ('general' for the general area). Hits on uncovered parts take no armor. Head cover comes only from the armor slot.
- **Protection.** One reduction and one multiplier per armor item. Placeholders: light 2 and ×0.8, medium 4 and ×0.65, heavy 6 and ×0.55.
- **Armor pools.** An armor item may add a pool to a covered part (a heavy helm on the head). The pool is a fixed number of points on the item entry, the same whoever wears it. After protection, damage drains that pool first; the rest reaches the part. The pool never counts on the health track. An empty pool absorbs nothing until repaired (D-89). \[Proposed\]
- **Shields.** A held shield adds its Non-essential part to the holder, off the hit table; a block at gap 0 or better sends the hit to it (Part 3, Weapons, armor and shields). Its pool is a fixed number of points on the item entry, the same in any hand. The pool's state is saved on the item instance, so damage survives swaps. A Destroyed shield is lost.
- **Natural armor.** A race may list natural armor with the same fields (BR6). It stacks with worn armor: worn first, then natural.
- **Damage step** (replaces Part 3's damage roll):

```
base  = WEAPON_CLASSES[mode.class].damage + mode.damageAdj + damage perks
dmg   = base × gapMultiplier(defense outcome)                 // Part 3, Defense
if worn armor covers the struck part:    dmg = (dmg − worn.reduction) × worn.multiplier
if natural armor covers the struck part: dmg = (dmg − nat.reduction)  × nat.multiplier
dmg   = max(0, dmg)          # no rounding: fractions allowed (Ali, 07/11/2026)
if an armor pool covers the part: the pool absorbs first, the rest goes on
then Part 3: part pool, then the health track × impact (unchanged)
```

**Damage perks.** A perk can change damage at any step above: base, the gap multiplier, armor (reduction, multiplier or pool) or the final number. Each damage perk names its step, and code applies it there **\[Proposed\]**.

Reduction before the multiplier bites light weapons hardest, so heavy weapons earn their hit penalty against armor. With the placeholders, a medium weapon drops a 100-HP fighter in 4 full hits unarmored, 6 in light armor, 8 in medium and 10 in heavy.

### 7. Item data

- **ItemDef** (library entry or story blueprint) holds everything fixed about an item. **ItemInstance** (story) holds only what changes in play. Part 4 §9 has both types.
- **Stackable items** (coins, potions) are one instance with a quantity, merged by item id, never equipped as a stack. Everything else is one instance per object.
- **bulk** 0–3 on every item. No carry limit for now: capacity is infinite (D-84).
- **Durability** only for pooled items: shield parts and armor pools. Repair is deferred.
- **Consumables** are a flag: the item is removed on use. Their effects wait for Healing and Status effects.
- **Coins** are a stackable library item, bulk 0. **value** is a base price in coins on every item (*placeholder*); no code reads it until trade exists.
- **Concealed items** stay out of other actors' views while held or worn, until used in an event that actor perceives; that observer's Belief.revealed then keeps it. Accessories are hidden by default unless tagged visible.
- **Minting** (for now): a variant = a base library item + quality tier 1–4 + public name and look. Code reads the tier's bonuses and writes a story blueprint (gear stats scale with need: a weapon's hit QUALITY\_HIT\_FACTOR × need × quality; armor's reduction ARMOR\_FACTOR × need + ARMOR\_QUALITY\_FACTOR × need × quality; a shield's pool POOL\_BASE + POOL\_FACTOR × need + POOL\_QUALITY\_FACTOR × need × quality; a damage boost QUALITY\_DAMAGE\_FACTOR × need × quality × DAMAGE\_CLASS\_FACTOR[class] × DAMAGE\_TREE\_FACTOR[melee or ranged], fractions kept; tools still use QUALITY\_TABLE), within the per-scene minted cap. A minted item with no close library match uses the nearest generic base: improvised\_light, improvised\_medium or improvised\_heavy for an odd weapon, curio (misc, no effects) for a thing with no game effect (Ali, 07/11/2026, loot L2).
- **Improvised items** (Ali, 07/11/2026, loot L3): when the player fights with a scene object not in the view, the Parser names an improvised base by size and a short name. Code writes a story blueprint (that base, the given name as name and look), puts it in the player's inventory and swaps it into hand before the attack. Improvised bases roll the Improvisation skill (Combat – Unarmed), carry hitAdj IMPROVISED\_HIT\_ADJ (*placeholder*, −10) and no kit bonus.
- **Boon** (Ali, 07/11/2026, loot V8): a reward's worth to the player. An item's Boon is its hand-set boon when it has one, else its value ÷ BOON\_COIN (20); a reward's Boon is that × qty, × BOON\_QUALITY (2/3/5/8) for a minted item of quality 1/2/3/4. Fractions are allowed. A plan's rewards together stay within BOON\_BUDGET by gain: none 0, minor 2, moderate 5, major 10, extreme 20. Boon is the only limit on rewards (no count cap). Only Weaver rewards count: NPCs' own template gear does not. All numbers are *placeholders*, to tune after playtests. The Weaver's item catalog lists each item's boon.
- **Equip requirements** (Ali, 08/11/2026, EQ1–EQ13; `src/ruleset/requirements.ts`). Each weapon, armor and shield has an equipment level from EQUIP\_LEVELS (Crude, Common, Fine, Superior, Masterwork), which asks for EQUIP\_NEED true skill (0/25/50/75/100, *placeholder*). The skill comes from the item's gear class (`gearClass`, a GC id in the library `gearClasses` table): the class sets which skill an item asks for and the level sets how much, so a new item only names a class and a level. The classes are light, medium and heavy melee and ranged weapons, improvised weapons, light, medium and heavy armor, and shields; an item with no class asks for nothing. Each class is tagged by use (`use`: melee, ranged, improvised, armor or shield), so a melee weapon stays melee gear even when thrown (Ali, 10/11/2026); the QE2 melee/ranged damage factor reads this tag. True skill counts, and a stand-in counts at its usual share (EQ3). A minted item of quality 3 or 4 is one level above its base, up to Masterwork (EQ11). Common: dagger, shortbow, gambeson, round shield, improvised weapons; Fine: arming sword, spear, hidden blade, longbow, mail hauberk; Superior: greataxe, crossbow, plate harness. Anyone can equip anything (EQ2); every roll with an item you fall short on is one outcome step worse per EQUIP\_SHORT\_STEP (10) points short or part of it (EQ12 c), and worn armor you fall short on reaches Dodge and stealth rolls. Points above the requirement do nothing for now (AR4 d, Ali 09/11/2026). An armor skill grows from hits (AR5): a hit on a part your worn armor covers marks the armor skill for its weight when the attacker's true skill or the armor's requirement is within MARK\_WINDOW of your raw or true armor skill (either one, Ali 09/11/2026).
- **Needs data.** Every story item blueprint (minted or improvised) is listed on the GM page under Needs data, so the designer can give it its own data and promote it.

QUALITY\_TABLE (*placeholder*): per tier 1/2/3/4, weapon hitAdj +2/+4/+6/+8 or damageAdj +1/+2/+3/+4 (the variant names which); armor reduction +1/+1/+2/+2; tool skill bonus +5/+10/+15/+20. Highest tier allowed by the scene's gain grade: minor 1, moderate 2, major 3, extreme 4.

### 8. Agents

- **Requests.** Agent Parser, Agent Planner, Agent Responder and Agent Voice share the same gear fields: action.item, action.mode, and a gear list of free ops. Code minds choose gear in code. The legality check rejects an item the actor doesn't hold or can't see and a mode the item lacks.
- **Own gear in views.** The full inventory by name and kind, where each item is equipped, mode ids, class and weight labels. No values.
- **Others' gear in views.** Only on actors perceived fully: held items, shield and armor by public look; accessories only when tagged visible; concealed items only once revealed; stowed items never. Items on the ground of perceived zones, by name.
- **Agent Narrator.** Describes gear by public name and look only: the weapon, armor and shield named in the roll packet, item\_dropped and give events, visible gear of perceived actors. Its fact check already rejects item names outside the view.
- **Agent Weaver.** Rewards are typed (Part 2, Agent Weaver): an item id or a minted variant, a quantity, and a place (carried by a cast actor, or on the ground of a planned zone). NPC loadouts come from their templates' loadout field \[Proposed\]. Loot is gear in place: a downed actor keeps its inventory, and pick up takes from it.

## Deferred items

These can wait until after the first build. Each item has a fixed ID (D-n) that is never renumbered or reused. Build the related parts as written or with placeholders, keep them easy to change, and ask before settling any of them.

**Excluded for now:** criticals; skill-check margins; more than one damage type.

| ID | Item | Part | Status | Notes |
| --- | --- | --- | --- | --- |
| D-1 | Setting, genre, skill trees and skill names | 1 | Deferred | Slot into the framework later. Also supplies turn 0's premise and starting place |
| D-2 | Training actions | 1 | Partly settled | Settled 07/11/2026 (SP1–SP6): use marks a skill (Part 1 §6). Still open: training only under a tutor (SP1), designed later. Was: what triggers them and what marks a skill; related to improvement-roll timing below |
| D-3 | Soft cap and hard cap | 1 | Deferred | Values and behaviour |
| D-4 | Burden fine-tuning | 1 | Deferred | K, default 20 |
| D-5 | Potential at creation | 1 | Partly settled | A fixed POTENTIAL (300, placeholder) with a per-character override (Part 1 §6); the value waits for a balance pass |
| D-6 | Beyond the mortal limit (100) | 1 | Deferred | Also makes the All-150 tier unreachable through training |
| D-7 | Difficulty tier names and target numbers | 1 | Deferred | Names are the challenge grades (Part 1 §4, Layer 2); values are placeholders until set |
| D-8 | Sneaking; Stealth skills and Perception's third skill | 1–2 | Partly settled | Stealth tree settled (Ali, 08/11/2026, ST1–ST10; Part 2, Stealthy posture). NPC stealth settled (NS1–NS10, 08/11/2026). Still open: Perception's third skill, what a larger contest gap does, and combined skill checks (such as sight with hearing) |
| D-9 | All-XXX checks use raw skill | 1 | To confirm | Assumed in Part 1 §5 |
| D-10 | XP sources and achievements | 1–2 | Partly settled | Settled 07/11/2026 (XP proposal X1–X10, Part 1 §5): defeats, library achievements, levels into a chosen class; kill XP from stat ratings (X18–X23); Weaver scene achievements dropped for D-108 (Ali, 07/11/2026); still open: quest XP (X8, held). Was: Part 1 §5 has Claude propose achievements for XP, but no agent output in Part 2 includes an achievement request, so XP currently has no source. Decide which agent or engine rule awards XP. Voyage playtest (07/11/2026): B4, an achievement or milestone must be granted only once; B8, XP must reconcile against its source trail |
| D-11 | Minting improvised items and NPCs | 1 | Partly settled | Claude proposes a new item or NPC and code assigns stats from a tier template. Minted content is a story blueprint, never written to the library. Items: a variant is a base library item + quality tier from QUALITY\_TABLE (Part 5 §7); further detail deferred with Loot and item creation. Voyage playtest (07/11/2026): C3, using the scene (terrain, objects) earned named modifiers; related OQ-22. Settled 07/11/2026: generic bases, improvised weapons and the Needs data list (Part 5 §7). Still open: NPCs, improvised tools and objects used other than as weapons |
| D-12 | Content database for items, loot and prices | 1 | Partly settled | Part 5 (Gear) sets the item data shape (Part 4 §9) and a prototype bank. Still deferred: loot tables, shops, trade, prices beyond the value placeholder |
| D-13 | Faction clocks | 1 | Deferred | Time advances with turns and faction clocks tick on their own. A faction here is a grand faction, unrelated to bands |
| D-14 | Skills and classes | 1, 4 | Deferred | Separate thread: general skills, class trees, how classes unlock. Exclusions settled 08/11/2026 as Skill tree access (TA1–TA11, Part 4 §4). Voyage playtest (07/11/2026): B11, ability requirements and cooldowns |
| D-15 | Status effects | 1, 4 | Deferred | Blessings, buffs, curses, debuffs: library entries, duration, and which rolls they modify, the event roll among them |
| D-16 | One Planner call per actor | 2 | Provisional | Evaluate later against one call per group of actors who can talk to each other, or a commander layer; also decides shared plans, whether a spokesperson's answer can bind its band (commander layer), and coordination between allies, who also commit blind |
| D-17 | Fallback combat list | 2 | Under review | Which actors count as minor, and how rich their behaviors are. The prototype uses a fixed combat list in code (Fallback behavior). Later: a per-type, data-driven rule order once many body types fight; tacticsLevel variants, such as level 3 calling for help first |
| D-18 | Call cap (MAX\_PLANNER\_CALLS) | 2 | Under review | The value, and which actors get calls first. Counts engaged significant actors only. Overflow runs its type's combat list \[Proposed\] |
| D-19 | Action economy | 2 | Settled | Settled 07/11/2026 (AE1–AE12, Part 2 Action economy): slots, ranged attacks don't move, dash, act-then-move for the player. Earlier: speech is an action and takes the main action, for everyone; words beside another action are a bark. The rest stays parked: a per-turn action limit is being considered, each action using 0–100% of it by type; covers move plus action and move timing |
| D-20 | Deferred actions | 2 | Parked | Run next turn unless new input, show as a queue, or drop; queuing many and typing "continue" is an exploit |
| D-21 | Player names something that doesn't exist | 2 | Parked | A clarify question can reveal what exists in the world. Voyage playtest (07/11/2026): F1, the player liked an impossible action failing inside the story instead of a clarify question |
| D-22 | What code produces, agents see, player sees | 2 | Parked | Separate document; includes roll numbers for Agent Narrator, SHOW\_MECHANICS and on-screen panels. Part 3's roll packet specifies part of this; Agent Narrator never gets roll numbers (Part 3, The packet). Includes whether the player sees the event roll. Voyage playtest (07/11/2026): A1 one-line check summary, A2 typed update cards, D9 speaker labels and plain text, E3 location header, G2 quest text, G3 player-facing wording for rules text. Decided by Ali (07/11/2026, Voyage C2): no enemy health bars, by design; characters only know what they perceive |
| D-23 | Fallback narration form | 2 | Parked | Template text breaks immersion |
| D-24 | Streaming | 2 | Provisional | Off for now; revisit after playtests. Voyage playtest (07/11/2026): A5, narration paced line by line. Pacing settled 10/11/2026: sentence-by-sentence reveal after the turn lands (Play screen motion, M-10, M-11); streaming itself stays off |
| D-25 | Improvement-roll timing | 2 | Settled | Settled 07/11/2026 (SP3, SP7): at the end of each engagement and at scene breaks; NPCs don't improve yet. Was: After each use, at scene end or at rest; whether NPCs improve. Part 1 §6 runs improvement at the end of a training action |
| D-26 | Ruleset module | 2 | Partly settled | First build: TIERS, eventRoll, roll, attack, check and contested are built (Part 2, Resolution engine, First-build ruleset); the rest stays stubbed |
| D-27 | Body-part targeting | 2 | Settled | targetPart and aimed in the agent outputs (Part 2); aim penalty, gap ladder and location (Part 3) |
| D-28 | Event log retention | 2, 4 | Partly settled | Keep the last N turn records (placeholder); story history is never pruned. N stays deferred |
| D-29 | Who spawns enemies and weaves the story | 2–3 | Partly settled | Agent Weaver plans events, casts, stages and body types. Still deferred: story beats and who calls sceneBreak (story-weaving thread) |
| D-30 | Scene breaks | 2 | Partly settled | Settled 07/11/2026 (P7): rest, beats with endsScene, and the stall fallback (Scenes); time skip (T6, Game clock). Still open: NPCs reacting on their own after a fight (P7 B2) |
| D-31 | Random rolls during a scene | 2 | Deferred | Iliad Quest-style encounter rolls while travelling or mid-scene. For now only the scene-start event roll exists |
| D-32 | Computed grade check | 2 | Partly settled | Measuring a plan's challenge and gain from its cast and rewards. Settled 07/11/2026 (loot V8): rewards are held to the gain's Boon budget (Part 5 §7). Still open: measuring the cast's challenge, a passing stub until then |
| D-33 | Weaver effort | 2 | Dropped | Closed by Ali (07/11/2026, easy open questions Q10). The runtime accepts only low, medium and high, and the Weaver already uses high. Reopen if the runtime adds a higher level |
| D-34 | Definition of a major action | 2 | Deferred | Which actions end the stealthy posture is settled (Part 2, Stealthy posture). Still open: whether an observer arriving in view counts. Stub: every player action is major |
| D-35 | Marks and missed check-ins | 2 | Deferred | Bodies, forced doors and missing colleagues that unaware actors could notice. Left out of the first prompt to keep it simple |
| D-36 | Planner for failed ambushes | 2 | Deferred | Code onAlert order for now. Options reviewed: interrupt the turn at detection, a speculative Planner call in the background, or a fixed reaction stage in every turn |
| D-37 | Call count visible in network tools | 2 | Dropped | Closed by Ali (07/11/2026, easy open questions Q11). The play screen header shows the call count on purpose, so hiding it from network tools no longer matters |
| D-38 | CALM\_TURNS | 2 | Dropped | Deleted by Ali (07/11/2026, easy open questions Q12). Nothing used it; the alarm calm-down uses DECAY\_TURNS |
| D-39 | BACKGROUND\_WINDOW value | 2 | Deferred | Config; set at or above Agent Planner's usual latency after playtests |
| D-40 | Hide and detection tests | 2 | Partly settled | One stealth contest per observer per event (ST4, Ali, 08/11/2026); a hide also tests observers already aware. A shot from stealth gets its own notice contest (ST7). Still open: revisit with the definition of a major action |
| D-41 | Out-of-character agent (/ooc) | 1–2 | Deferred | Code-only /help for now. An OOC agent would add a Claude call. Voyage playtest (07/11/2026): F3 a plain-text OOC question in the action box used a turn; F4 a side chat that answers questions without a turn |
| D-42 | Reloads and pending Planner outputs | 2, 4 | Deferred | Proposed: write each Planner output to a pending.\<turn> page outside the head bookmark and reuse it until the turn commits. This stops a reload from rerolling enemy plans and keeps test 13 across reloads. Until then a reload calls the Planners again |
| D-43 | Late and failed agent outputs | 2 | Settled | Settled by Ali (07/11/2026) as built: a late Planner output is discarded whole and the actor uses its combat list; the Responder and Voice share one fallback: one retry, then a neutral line as a talk action. Every late or failed Planner, Responder or Voice call is also filed for review in the play artifact's db (code planner\_late or agent\_fallback). Every bug is numbered (see Bug log): bugs/BG-\<n> from one counter (bugs\_meta/counter), status open until a build thread marks it fixed or wont\_fix (src/save/bugs.ts). A Weaver plan that fails validation (it went outside its catalogs, scales or ids) is filed as weaver\_off\_catalog even when the repair call fixes it |
| D-44 | Undo and Planner outputs | 2, 4 | Deferred | Proposed: the redone turn reuses the stored Planner outputs; Parser, dialogue and Narrator calls run fresh. Until then undo calls the Planners again |
| D-45 | Retries and timing | 2 | Deferred | Any retry adds a call. Two are skewed: the Voice's fact-check regeneration happens only to NPCs without secrets, and the Narrator's leak-scan regeneration is likelier near secrets. Reviewed: no regeneration while the player waits; gates sized for one retry |
| D-46 | Routines outside the stage | 2, 4 | Deferred | Whether actors off the stage keep running routines each turn, and whether a stage trim may cut off a zone bound to an active actor's slot. Interim: an actor with no path holds its zone (Part 2, Explore mode). Related: D-67 and OQ-13 |
| D-47 | Raw step lengths | 2 | Deferred | A library-only override that lets a step hold an exact turn count beside its duration id, for rhythms the four ids can't express |
| D-48 | Large-bank filtering | 2 | Deferred | Code pre-filters routine sets by place tag before the Weaver call once the bank is too large to send whole |
| D-49 | Time of day within a scene | 2 | Deferred | Routines that change with the clock mid-scene (T9: later); for now, the set is chosen at scene start and its time tags must fit the time of day |
| D-50 | Leaving the stage | 2 | Deferred | An exit routine that takes an NPC off the stage through a frontier; today orders into a frontier are dropped (OQ-13) |
| D-51 | Companion warning on alert | 2 | Deferred | A one-off onAlert for companions (a warning shout), to revisit after stealth playtests |
| D-52 | Band formations | 2 | Deferred | Coordinated band routines; folded into the existing shared-plans question |
| D-53 | routineGap review | 2 | Deferred | How gap notes reach bank drafting: a GM-view list grouped by what the Weaver asked for |
| D-54 | Player incapacitated | 2, 3 | Partly settled | What the next turn is when the player is down: death, capture or rescue. Tied to the Weaver and Healing. Settled for the first build: the stage plan marks each opposing band lethal or not (Part 2, Agent Weaver). Lethal, the default: the story ends on a "you fell" screen that offers /undo or reset. Not lethal: one survival roll, roll() with no skill and no modifiers; Near Miss or better survives and wakes in a safe place at Critical, Failure or worse ends the story the same way. Built 09/11/2026 (SP12, Part 2 Lethal): the fight is lethal when an active actor hostile to the player belongs to a lethal band; the safe place is the first zone of a new place the Weaver plans (target.wake). Capture and rescue stay deferred |
| D-55 | Triggers beyond the player | 2 | Deferred | player\_seen\_in\_zone and $player only watch the player; NPC-versus-NPC fights may need "enemy seen in zone" |
| D-56 | Total HP and its split between body parts | 3 | Settled | Part 3, Total HP and Body parts; the values wait for the balance pass (D-77) |
| D-57 | Damage calculation | 3 | Settled |  Part 3, Damage flow, and Part 5 §6, the damage step; values wait for D-77 |
| D-58 | Healing | 3 | Partly settled | Settled 07/11/2026 (H1–H15, Part 3 Healing): one healing-source table with a reach on the part-state scale; rest, clinic, bandage, natural recovery from endurance. Still open: first-aid skill, bleeding. Voyage playtest (07/11/2026): B5, healing amounts must be consistent |
| D-59 | How positive and negative modifiers combine per action | 3 | Settled | Part 1 §4, Stacking within a type; the values per type stay with D-75 |
| D-60 | Critical: "one action per turn" | 3 | Settled | Settled 07/11/2026 (AE11): "lose your next action" means the next main action |
| D-61 | Recurring NPCs | 4 | Deferred | Stable NPC ids now; promotion adds modules. Voyage playtest (07/11/2026): D2, an NPC remembered a lie 15 turns later. Quests held by NPCs wait for this (D-142) |
| D-62 | Temporary NPC linked to the place last seen | 4 | Deferred |  |
| D-63 | Telling temporary from recurring NPCs | 4 | Deferred |  |
| D-64 | NPC generation from templates | 4 | Partly settled | Settled in Part 4 §4: minimums, points, focus picks, random spend, personality, unique vs copy. Still deferred: level rules (level is fixed per template for now) and NPC perks |
| D-65 | Returning to a previous class | 4 | Deferred |  |
| D-66 | Swordsman class skills | 1, 4 | Deferred | Riposte is named but has no effect; the player can raise it, and it does nothing yet (feint and disarm removed) |
| D-67 | Offscreen world changes | 4 | Deferred | Who changes a place while the player is away; tied to "who spawns enemies and weaves the story". Related: OQ-13 |
| D-68 | Player memory per state slot | 4 | Deferred | Every slot, or only slots the narrator described |
| D-69 | Place templates in the library | 4 | Deferred |  |
| D-70 | Setting-specific library content | 4 | Deferred | Tags so a story draws only fitting entries |
| D-71 | Visibility of saved fields | 4 | Deferred | Separate thread, with "What code produces, agents see, player sees": tags plus builders, default for untagged fields, whether an NPC sees its own Damaged parts |
| D-72 | Undo depth | 4 | Deferred | One turn for now |
| D-73 | Reset: archive or delete | 4 | Settled | Settled by Ali (07/11/2026, easy open questions Q13): archive. A confirmed reset starts a new story id and keeps the old story's pages and backups under its own id, so a misclick can be recovered. Play shows only the newest story |
| D-74 | Turn-record count N and proposal caps | 4 | Deferred | Placeholders; set after measuring the platform caps |
| D-75 | Diminishing-returns values per modifier type | 1 | Deferred | Roll perks, wounds, situational, aim |
| D-76 | Outnumbered and unaware values | 3 | Deferred | For the defense roll |
| D-77 | Damage and HP balance pass | 3 | Deferred | After playtests: weapon damage and hit values, armor, HP\_BASE and HP\_PER\_END, part shares. Voyage playtest (07/11/2026): B7. Decided by Ali (07/11/2026): HP, part pools and damage may be fractional, with no rounding anywhere (was OQ-25) |
| D-78 | Critical effects | 1 | Deferred | For Critical Failure and Critical Success; excluded from the hit roll review |
| D-79 | Near-Miss-hit cost | 3 | Deferred | Whether a Near Miss attack that lands leaves the attacker exposed; left out for now |
| D-80 | Tiny parts | 3 | Deferred | Their pool share, when the first Tiny part is used |
| D-81 | Partial cover by part | 3 | Deferred | Such as a wall hiding the legs |
| D-82 | Combat skill names | 1 | Deferred | For the melee, ranged and unarmed trees, set per setting |
| D-83 | Multiple attacks per turn | 2 | Settled | Settled 07/11/2026 (AE4): extra attacks come only from perks and class skills (Flurry) |
| D-84 | Carry limit and encumbrance | 5 | Deferred | bulk exists on every item; capacity is infinite. Later: a carry limit per body type, perk and item adjustments, what counts toward load, what happens past it |
| D-85 | Initiative as a gear target | 5 | Deferred | Heavy armor slowing initiative, and similar |
| D-86 | Conditional and granted effects | 5 | Deferred | Effects that apply only vs a body type or in darkness; gear that grants statuses, perks or actions; movement and flight modifiers |
| D-87 | Dual wielding and versatile grips | 5 | Deferred | Off-hand attacks and penalties; weapons usable one- or two-handed with a bonus for two |
| D-88 | Armor depth | 5 | Deferred | Layers, armor-piercing weapons, damage types (already excluded for now). Armor noise settled (AN1–AN4, Ali, 08/11/2026); quieter-armor perks later (AN5) |
| D-89 | Durability and repair | 5 | Deferred | Wear on items other than pools; refilling shield and armor pools |
| D-90 | Containers, charges, keys, crafting | 5 | Deferred | Bags inside bags, items with uses, keys bound to doors, making items. Crafting plan (Ali, 07/11/2026, loot L4): a recipe consumes inputs and makes a check; outcome tier ID sets the quality (−1 plain base, 0 → 1, 1 → 2, 2 → 3, 3 → 4); failure tiers lose the inputs |
| D-91 | Consumable effects | 5 | Deferred | Healing and timed buffs; waits for Healing and Status effects |
| D-92 | Loot and item creation | 5 | Deferred | Loot tables, minting detail, items with no library base. Minting is base item + quality tier for now |
| D-93 | Shops, trade and prices | 5 | Partly built | Buying built from PY1–PY11 (09/11/2026): Trader-class sellers with wares, a services catalog, buy with no roll, price = value × 2, haggling, coin words in narration, paid clinic care. Selling built from SL1–SL11 (10/11/2026): Traders buy the kinds they sell at value × 0.5 from a 50-coin purse, sold items join their stock, worn gear comes off first, haggling and Hard Bargain apply both ways; a minted item's value is its base value × 2 × quality. Value from benefits built from SL12–SL14 (10/11/2026): an item's value is its benefit numbers in coin, summed (ITEM_VALUE in config: kit and stated skill bonuses, roll bonuses, reach, armor stopped and cut per part, pools); consumables and items with no benefit numbers keep hand-set values; the basket-hilted sword (+5 Block while held) is the test piece. Still to do: prices by place (D-149). Earlier: Approved by Ali (07/11/2026, playtest run 14 Q2): buying and trading for coin, goods or services, using the barter skill. Run 14: the player "bought a round of ale" for about 10 turns, but no ale appeared and his 20 coins never changed. Buying, selling, haggling, prices by place. value is a placeholder until then. Voyage playtest (07/11/2026): B3, a payment must happen once; B13, prices out of scale |
| D-94 | Hidden rewards and theft | 5 | Deferred | Containered or hidden rewards and searching for them, stealing, NPCs noticing a missing item, partial-perception gear cues (“a glint of steel”) |
| D-95 | ACCESSORY\_SLOTS value | 5 | Deferred | Placeholder 3; may vary by race or perk |
| D-96 | Ranged details | 5 | Deferred | Reloading. Range modifiers are set in Part 3 (Reach, range, cover and light); partial cover has its own row |
| D-97 | Gauntlets and unarmed damage | 5 | Deferred | Worn hand gear such as gauntlets may change unarmed damage while worn. Until such items exist, every unarmed attack without a class uses the unarmed profile (15 damage, +10 hit) |
| D-98 | Surrendered actors | 3 | Partly settled | Settled 08/11/2026 (Q1, option A): surrender makes the actor yielded for the scene, then opposed, and it leaves (Morale). Still open: what the player can do with it (take it prisoner, question it, let it go) |
| D-99 | Movement speed | 3 | Deferred | How movement speed works beyond one zone link per turn, and how injured legs slow it; the Move role's movement effects wait for this |
| D-100 | Command buttons | 2 | Built | Decided by Ali (07/11/2026, Voyage A3): plan buttons on the Play screen that show the available commands (Part 1 §7). Built 07/11/2026 as the Commands panel |
| D-101 | Game clock | 2, 4 | Partly settled | Settled 07/11/2026 (T1–T11, Game clock): one clock, durations table, time of day, day counter, waiting. Still open: travel time. Voyage playtest (07/11/2026): E1, a trade took a day while 31 km of travel took no time; E2, NPCs said "yesterday" on day 1. Covers turn and command durations, travel time and a calendar NPCs can read. Related: D-13, D-49 |
| D-102 | Resource costs | 1 | Deferred | Voyage playtest (07/11/2026): B12, a failed spell still charged mana. There is no mana or other resource; when one exists, decide whether a failed action still pays |
| D-103 | NPC self-interest in exchanges | 2 | Dropped | Dropped by Ali (07/11/2026, easy open questions Q15). Voyage playtest (07/11/2026): D1, NPCs refused tips and bonuses. Whether Agent Responder and Agent Voice are told to keep their own interests in deals |
| D-104 | Attitude toward the player | 2, 4 | Deferred | Voyage playtest (07/11/2026): D4, a relationship score per NPC with labels; D5, threatening an NPC raised it. A Belief tracks awareness only and stance comes from bands (Part 2, Opposition); threats short of an attack have no lasting effect |
| D-105 | Quests | 2, 4 | Built | Decided by Ali (09/11/2026, page https://claude.ai/artifact/GLFAsrNc5Psto2gMMamoHE, QT1–QT28); see Part 2, Hidden state persistence, 5b. Fixes Voyage D8 (one open quest per giver) and G2 (the quest line is leak-scanned). |
| D-106 | Narration against NPC lines | 2 | Dropped | Closed by Ali (07/11/2026, easy open questions Q14). The Narrator no longer quotes lines and the play screen shows each heard line word for word, which removed the cause. Reopen if a playtest shows it again. Voyage playtest (07/11/2026): D7 |
| D-107 | Action ideas on request | 2 | Built | Decided by Ali (07/11/2026, Voyage A4; was OQ-23): a code-built list from PlayerView, shown when the player asks: people in view to talk to, exits, items held, actors in reach, grouped by tab (Talk, Move, Fight, Use) and refreshed each turn. No Claude call, so nothing can leak. Narrator rule 7 ("Do not list options") stays for the narration. Built 07/11/2026 as the Ideas panel on the Play screen (Fight, Talk, Move, Use side by side, three each) |
| D-108 | Achievement proposals | 1, 2 | Planned | Decided by Ali (07/11/2026, settles OQ-10): Claude may propose achievements, never grant them. A proposal goes to Ali for approval; once he approves, the feat is implemented as permanent code (a code rule that grants it), like the first-defeat achievement. Place state and promoted facts still come only from code rules. Which agent carries the proposal is open |
| D-109 | Whole-engagement perk effects | 1 | Planned | Decided by Ali (08/11/2026, AGG comparison A1): some 60 and 100 perks last the whole engagement instead of one roll, as AGG's do. First case: a 60 or 80 Improvisation perk that grows Dirt in the Eyes into a blinding that lasts the fight (AGG's Pocket Sand) |
| D-110 | Auto-success perks | 1 | Planned | Decided by Ali (08/11/2026, AGG comparison A2): a perk kind where the owner's first roll of one kind in each engagement counts as at least Success. Used for 60 perks in Speech and Stealth |
| D-111 | Bane bonuses | 1, 2 | Built | Decided by Ali (08/11/2026, AGG comparison A3, from AGG's deed-earned Feats): race and body-type achievements such as "Bane of {race}kind" also give a bonus against that race or type: the bonus of the lower level it builds on plus +5 skill (CONFIG.BANE_SKILL_PER_LEVEL), so I = +5, II = +10, III = +15, on attack, defense and contested rolls against an actor of that race or body type. Levels are linked (AchievementDef.after): earning a higher level switches the lower ones off, so only the highest is checked. The best race achievement and the best body type achievement both count, as one modifier type, so the weaker one counts at half (Ali, 08/11/2026; src/ruleset/bane.ts) |
| D-112 | Downtime unlock perks | 1, 5 | Deferred | Banked by Ali (08/11/2026, AGG comparison A5): perks that unlock downtime actions (rumors, importing, a market, more actions per day) wait until trade (D-93) and long rests exist |
| D-113 | Skill tree access extras | 1, 4 | Deferred | Banked by Ali (08/11/2026, Skill tree access TA7, TA11): who can use the Tools tree (lockpicking, OQ-20 placeholder; open to all but Slime for now, and off the creation screen), and nested groups of conditions beyond Must and Either of |
| D-114 | How healing is split among body parts | 1 | Deferred | Parked by Ali (08/11/2026). Now every healing row adds the same percentage to the health track and to each part pool it reaches, so a badly hurt part heals no faster than a scratched one, and natural recovery never reaches a Crippled part. Later: decide how a heal is distributed (e.g. worst part first, shared out, or by the row) |
| D-115 | All-50 perks | 1 | In progress | Decided by Ali (08/11/2026, All-50 doc https://claude.ai/artifact/R5CirgnTX2vwoG4tPp8oxR): each tree's All-50 is a bundle of parts (src/library/allPerks.ts), granted free when every skill of the tree reaches 50 true skill, with the tree's mastery achievement (src/ruleset/allSteps.ts, checked every turn end). Parts that skip rolls stay hard to trigger; each bundle has a passive, some may have two. Built: Hunter's Eye, Fighter's Frame, Past the Cover, Child of Night, Curiouser and Curiouser, Dodgy, Counter, Volley, Second Wind, Strike and Fade, Hushed Steps (the doc's Stealth "Light Feet", renamed: a Sneaking Near Miss counts as Success against a listener). Round 2 (Ali, 09/11/2026, doc https://claude.ai/artifact/Jf3gzMPRCpHBqAWqnabS8n) built: Opening Strike (first melee attack on each foe per engagement, tier shift +1), Unerring (first ranged attack per engagement at a foe that hasn't acted: its defense roll tier shift −1), Hard to Hold, Iron Knuckles, Bare-Handed Guard (+5 true Dodge, +5 effective while holding no weapon), Spotter (band-mates in the zone become suspicious of what the owner is aware of; belief update kind 'told'), Soft Landing (speech rolls at Near Miss or worse: tier shift +1). Turned down: Sure Grip, Brace and Tracker. Parked: Read Them (D-191). Round 3 (Ali, 09/11/2026, doc https://claude.ai/artifact/F7382XsDiac3p2PYNakM4L) built: Steady Guard (Melee, replaces Weapon Drill, which is dropped: +5 true Block, +5 effective when blocking with a melee weapon), Thick Hide (Defense: health lost from each hit ×0.95 after armor), Night Eyes (Perception: light one step brighter for Eyesight rolls). Parked: Light Sleeper (Perception, D-190). Easy Speaker built as option a (Ali, 09/11/2026): an owner answering a speech contest gets tier shift +1, so today it helps NPC owners; NPC speech rolls at the player are OQ-29. Read Them parked. Round 4 (Ali, 09/11/2026, doc https://claude.ai/artifact/DLSULD5XEtXn78GBRYGkJ7) built Speech's third part: Silver Words (+5 true Persuasion, Intimidation and Barter) |
| D-116 | Old-save compatibility | 1, 3 | Deferred, before release | Ali (09/11/2026): while the game is a prototype, new changes ignore older saves; a save that no longer loads is started again. Before release, every change since then needs a migration (library status renames, MIGRATIONS) or a deliberate break, and a release save test. Already in place: old name-based skill IDs load under their numbers |
| D-117 | 20 perks for the skills added later | 1 | Built | Decided by Ali (09/11/2026, doc https://claude.ai/artifact/M74jq37WnQQz7Fw99jREBj, N1–N9). Built (src/library/perks.ts A18–A22): Soft Tread (Sneaking: a Stealthy move is one noise step quieter), Melt Away (Vanishing: vanish in place, as the main action, where the zone has some cover or more or dim light or darker), Slip the Blow (Light Armor: in light armor a Dodge tie counts as a graze), Quiet Mail (Medium Armor: worn armor adds one noise step less, never below none; AN5), Turn Aside (Heavy Armor: a heavy or crushing hit on a part heavy armor covers lands as a full hit). Written, not built: Out of Nowhere (Combat Stealth, higher level), Go to Ground (Sneaking, parked for a hiding perk, D-189), Answer the Blow (Riposte 60). Natural Weapons and Tremor get no 20 perk. N10 b built: In and Out (Combat Stealth 20, A23: a melee attack while Stealthy keeps the owner Stealthy; the target becomes aware and every other observer makes a Combat Stealth contest). N11 a built: Blade Wall (Block 60, B19: Block rolls with a medium melee weapon take no outnumbered penalty) |
| D-118 | Banked perks sorted by what they are kept for | 1 | Built | Asked by Ali from the library viewer. Every write-up with no ladder yet carries `bankedAs` (milestone, allX or other) and a suggested `aimAt` (src/library/perks.ts). Milestone: 22 perks, each a later perk of its own skill, suggested for a 60 or 100 slot that skill has free. All-X candidates (All-100): Never Surprised and Night Eyes two steps (Perception), Tough It Out (Defense). Other: none for now. D7 id is now night_eyes_full, so it no longer shares an id with the All-50 Night Eyes. |
| D-119 | Total-defeats achievements give a combat roll bonus | 1, 2 | Built | Asked by Ali (09/11/2026): the total-defeats achievements (Blooded Fighter at 10, Calamity of a Hundred Blades at 100, Harvester of the Fallen at 250, Thousand-Slayer at 1000) add +1 per tier to every combat roll: I = +1, II = +2, III = +3, IV = +4 (CONFIG.DEFEATS_ROLL_PER_TIER; the tier is the achievement's place in its `after` chain). Combat rolls are attack (hit) and defense (dodge, block) rolls. Only the highest earned level counts. It is the same modifier type as the Bane bonuses (D-111), so with a Bane bonus the weaker one counts at half (src/ruleset/bane.ts) |
| D-120 | Deed achievements | 1, 2 | Built | Decided by Ali (09/11/2026, page https://claude.ai/artifact/Mf47Ua6icqcAkKqYPKncsV, AC1–AC11): unaware defeats, foes who yielded, Critical Success rolls of any skill per skill group, steps past Critical Success (once in general and per group), fights won without losing HP after a defense roll, fights won against CONFIG.OUTNUMBERED_FOES+ foes with no allies, fights survived after reaching Critical (once per fight), defeats while crippled, zones entered (50/250/1000), deals (1/10/100), days survived, class unlocks. Counted by tally (src/engine/xp.ts) and turnFeats/fightEnded (src/engine/feats.ts). XP only; roll bonuses case by case. AC12 (clean defenses) unanswered |
| D-121 | Unwritten Legend capstones | 1, 4 | Built | Decided by Ali (09/11/2026, doc https://claude.ai/artifact/NvFmnhM58Q6unTtiggHJFe, L1 and L2). Default capstone at class level 20: As Far as the Road Goes (ladder gating does not apply: a 60 to 140 perk opens when true skill reaches it). Alternates (ClassDef.capstones): Write Your Own Ending, needs 7 classes on the sheet (every class in the library unlocks at level 0); No Road Closed, needs at least one All-50 and 10 skills above 15 true skill (tree and skill access rules do not apply). New access condition kinds: classes, allStep, skillsAbove. Parked: Already in Stride (joining a class lifts its floor skills to the floors) and Every Road Walked (stand-in share +0.3 for every function). L1 c, restricted to near misses, became A Nobody's capstone Every Fall a Lesson. |
| D-122 | Class and level achievements | 1, 2 | Built | Asked by Ali (09/11/2026): classes at their top level (classMaxLevel, by tier) in all (Path Walked to Its End 1, Thrice Mastered 3, Master of Many Paths 5, The Thousand-Faced 10); per class tier, one chain: Peak of the {tier} 1, Twin Peaks of the {tier} 2, Crown of the {tier} 3 (Peak was its own achievement until Ali linked it, 11/11/2026); class tiers with a class at the top (Across Two Heights 2 (II), Across Three Heights 3 (III), Across Four Heights 4 (IV), Across Five Heights 5 (V), Every Height Climbed all six (VI); free levels +1 to +5 by place, D-153); and a different name at each 10 character levels (No Longer Green 10, Steady Hand 20, Battle-Tested 30, A Name Worth Knowing 40, Half a Hundred Roads 50, then, showing signs of the weaving (Ali), Something Tugs at the Edges 60, The Pattern Takes Notice 70, Caught in the Weave 80, A Thread That Will Not Fray 90, One Who Pulls the Threads 100, then Woven Past Counting ({level}); AchievementDef.names), earned again every 10 character levels at a new lowest reward level 0 (50 XP; AchievementDef.every). Checked in spendXp (classFeats in src/engine/xp.ts). |
| D-123 | Achievements shape personality | 1, 2 | Built | Parked by Ali (09/11/2026); designed in PL15; built with D-208: an achievement row adds Nerve or trait points (`personality`, or `personalityByKind` for by-skill rows), lower levels included by reference. NPC earning waits on D-148. |
| D-124 | Achievement reward: deeper healing | 1, 2 | Parked | Reward type T7 Hardening, parked by Ali (09/11/2026): an achievement could make every healing source reach one part state further (Damaged to Crippled, never Destroyed). Built once in PR #202 on Bones Heal Later, then taken off because that achievement doesn't deserve it; healing reach is already an ordered scale (PART_STATES), so it can come back as one field. |
| D-125 | Achievement reward: keys | 1, 2 | Parked | Reward type T4, parked by Ali (09/11/2026) until an achievement suits it: an achievement as a condition that opens a class, a tree branch, a capstone, gear or a line of talk (a scar as a Blocked-by condition). |
| D-126 | Achievement reward: learning | 1, 2 | Parked | Reward type T5, parked by Ali (09/11/2026) until an achievement suits it: an extra improvement roll, a wider marking window or a skill joining the sheet. |
| D-127 | Achievement reward: trophies | 1, 2 | Parked | Reward type T10, parked by Ali (09/11/2026) as a potential idea: an item that marks the deed, with a small effect, designed with the loot thread. |
| D-128 | Achievement rewards, round 1 | 1, 2 | Built | Decided by Ali (09/11/2026, reward types page https://claude.ai/artifact/KyTLxEYPUooz71yVVoWgVW). Fields on AchievementDef, read in src/ruleset/achRewards.ts; a replaced level stops giving its rewards. The Unseen Death (100 unaware defeats): unawareShift 1, an attack on an unaware target moves up one tier (T1), and quieter 1, moves one step quieter (T8). Shadow's Edge, a new unaware tier at 50, gives XP only. Brink chain: Not Today 1 XP only; Not Yet 3 (new), deathsDoor 7: once every 7 game days a hit that would take you Down leaves you at Critical (T2); Death Keeps Waiting 5, the same once a day. Crippled chain: Still Swinging XP only; Bones Heal Later grants the perk Past the Pain: one Crippled part (first in body order) gives no role penalty (T3). Scourge of the {body_type} Hordes: readsHealth, you see that body type's health level at every level, a deliberate exception to Voyage C2 (T9). T6 Renown: The Name That Ends Fights (50 yielded) has renown 10: every foe fighting you takes −10 on its morale rolls (Ali chose every foe, since NPCs never learn the player's name yet; MB24 made it every morale roll). |
| D-129 | Achievement tags | 1, 2 | Built | Decided by Ali (09/11/2026, page https://claude.ai/artifact/GguUfdkgJz6SdrYvScuhfE, TG1–TG9): every achievement row has `tags` (one or more) from ACH_TAGS in src/library/achievementIds.ts: Combat, Stealth, Social, Exploration, Survival, Skill, Progression. Scars use the same tags. |
| D-130 | Achievement chains carry rewards up | 1, 2 | Built | Decided by Ali (09/11/2026): a level gives every reward of the lower levels of its chain, read from their rows (not copied), so changing a lower level changes every level above it; the viewer lists the carried rewards as "(from <lower level>)". A level drops an inherited reward only by naming it in its own `excludes` (Death Keeps Waiting drops Not Yet's weekly save). Yield or Fall is XP only; Breaker of Wills gives +5 Intimidation true skill (skillAdd), carried up to The Name That Ends Fights. Bane and total-defeat bonuses keep their own rules. |
| D-131 | First sight and race intelligence | 1, 2 | Built | Decided by Ali (09/11/2026, reward variations page T11): races have an intelligence on the INTELLIGENCE scale (src/scales.ts): Unintelligent, Semi-intelligent, Intelligent (RaceDef.intelligence; slime Unintelligent, dragon Semi-intelligent, human and elf Intelligent). Reward `firstSight`: members of the achievement's race or body type, up to that intelligence, meet the owner opposed (wary) instead of hostile, until the owner attacks them. {body_type}bane and Bane of {race}kind cover Unintelligent; both Scourges cover up to Semi-intelligent and exclude the lower level's first sight. The Bane roll bonus is a separate reward and keeps carrying up. Each reward is its own entry with its own carry-up, like separate gameplay effects in common RPG engines, so excluding one never touches another. |
| D-132 | Learning from initiative rolls | 1 | Deferred | Parked by Ali (09/11/2026): whether an initiative roll can mark the skill that has the Initiative function (Speed group) for improvement. Today initiative rolls mark nothing. No skill has the function yet (Dodge only joins the Speed group), so decide this together with the first Initiative skill. |
| D-133 | More for the friend stance | 1 | Parked | Parked by Ali (09/11/2026, RS3): more things the friend stance can do. Today friend sits between friendly and loyal on STANCES, shapes NPC talk (helps at some cost to itself) and turns hostile to anyone hostile to its friend whom it is already opposed or colder to; friendly or warmer can block for you (Cover Ally), and loyal fights anyone hostile to the one it is loyal to. |
| D-134 | Never Surprised is Earshot's 100 perk | 1, 2 | Built | Decided by Ali: the banked Never Surprised (C1) becomes Earshot's 100 perk instead of an All-100 candidate. An owner unaware of an attacker whose attack noise reaches it (the NOISE_REACH table, Keen Ear adding a link, stealth aside) counts as aware: no INIT_UNAWARE in initiativeOrder and no unaware defense modifier. The ambush contest still rolls and marks; only its penalty is dropped. A Silent attack is never heard without Keen Ear. |
| D-135 | Achievement rewards round 2 | 1, 2 | Built | Decided by Ali (09/11/2026, reward variations page T13, T15, T16, T17, T19). T13 Master of the Moment ({group}): stand-ins on rolls of a skill in that group count +0.2 share (`standIn`). T15 Adept of {tree}: equip requirements on that tree's skills ask 5 less (`reqLower`); only the check moves, never the item's numbers (kit bonus still reads the item's own need). T16 Silver Tongue: +5% off what you pay traders (`pricePct`; selling gets it once selling exists). T17 new chain Few Against Many (1) / Hold the Line (10): fights won beside at least one ally while the foes outnumber your whole side; Hold the Line gives allies fighting beside you +10 on morale checks (`rally`). An ally is anyone not hostile to you who is fighting, or fought by, someone fighting you (besidePlayer in src/engine/engagement.ts); there is no ally list. T19 Seasoned: +10% healing on each rest (`restPct`), carried up to Old Blood. Rule (Ali): rewards and perks are written as + amounts (+10%), never as "from x% to y%", so they never conflict. |
| D-136 | Parked reward types | 1, 2 | Parked | Ali (09/11/2026): T12 initiative (park until an achievement fits); T14 tier floor (powerful, nothing fits yet; a balance lever that turns gap X into gap X−1 instead of a flat +1); T20 XP focus (a perk idea, not an achievement reward). |
| D-137 | More reward types | 1, 2 | Deferred | Ali (09/11/2026): come back with more reward types once there are more achievements. |
| D-138 | Worn titles | 1, 2 | Built | Decided by Ali (09/11/2026, reward variations page T18): a general option for every achievement, not a reward of one. `/title` lists the current, non-scar achievements; `/title <number or name>` wears one; `/title off` removes it (Progression.title). The title moves up its chain when a higher level replaces it. Stealth-safe: an NPC's belief about the player carries the title only when it has seen the player (source seen, status Aware or higher), never from sound, a glimpse (Suspicious) or hearsay. The narrator gets player.title and may use it now and then. |
| D-139 | Old Blood event-roll bonus | 1 | Built | Decided by Ali (09/11/2026): Old Blood (100 game days survived) gives +10 on event rolls (AchievementDef.eventRoll, an achievement modifier in eventRollMods). |
| D-140 | Multi-step quests | 2 | Deferred | Banked by Ali (09/11/2026, QT18): a quest chain with several goals in one quest. Today a quest has one goal, and a longer job is a linked follow-up quest (QT24). |
| D-141 | Your own goals | 2 | Deferred | Banked by Ali (09/11/2026, QT20): the player writes a goal on the Quests page ("Become a knight"), tracked only: no giver, no check, no XP. |
| D-142 | Quests held by NPCs | 2, 4 | Deferred | Banked by Ali (09/11/2026, QT26) under D-61: a recurring NPC (a rival, a companion) holds a quest code follows across scenes, using the same quest record with a holder field. |
| D-143 | Quest achievements | 1, 2 | Built | Decided by Ali (09/11/2026, QT19 in the quests thread): finished quests earn Job Done (1, level 0), Reliable Hand (5, I), Hand for Hire (10, II), Sought After (25, III), The One They Send For (50, IV), tallied in endQuest. Giving up five quests (abandonQuest) earns the scar Word Not Kept. Scars paid no XP then; D-151 changed that. |
| D-144 | Spar achievements | 1, 2 | Built | Asked by Ali (09/11/2026, SP9), names and counts agreed with an added 25 level, and cruel spars from 1. Spars are practice under the Thread lore, so XP is low and there is no reward beyond XP. Spars won (spar\_wins): First Bout 1 (level 0), Sparring Partner 10 (I), Yard Veteran 25 (I), Regular at the Yard 50 (II), Nobody Wants to Spar You 200 (II). Cruel spars won (cruel\_spar\_wins): Blood on the Practice Sword 1 (I), Cruel Teacher 10 (II), No One Spars You Twice 25 (II). The scar Sparring Dummy at 10 spars lost (spar\_losses: a spar that ended with a winner and you not among them). Counted in endSpar (src/engine/spar.ts). |
| D-145 | Achievement ideas N1–N9 | 1, 2 | Built | Decided by Ali (09/11/2026, ideas page 2). N1 clean defenses (a dodge or block that stops all damage): Not Here 10, Wall of Steel 100, Nothing Lands 1000. N2 unseen moves (a sneak into a zone where someone is suspicious of you and no one there is aware of you): 10/50/250; vanishes that lose everyone who saw you: 5/25. N3 spotting someone sneaking or hiding: general 10/100, per notice function 1/10/100 (my reading of "first to 1, add a III at 100"). N4 speech: (a) speech contests won per influence skill 10/100/500; (b) talked down: a hostile foe you never hit steps friendlier from your words 1/10/50; (c) any contest won against higher true skill (attacks and defenses, notice and stealth, speech, break-free, perk moves), general 1/10 and per function 1/10; (d) once hostile, now friendly 1/5; (e) surrendered to your threats 1/10, written but not counting: no threat can make a foe surrender yet. N5 copper spent buying 100/1000/10000 (1/10/100 gold); selling chain written, counts once selling exists. N6 Crippled part healed back to Healthy 1/10/50; back to Unhurt after going Down 1. N7 dropped. N8 holds (or breaking free of one) 10/100; aimed strikes landing on the called part 10/100/1000, and per part size 10/100 where small and extra small pay one reward level more and tiny two (AchievementDef.levelUp, placeholder). N9 quests: 5 for one giver; 10 different givers; a finished run of follow-up quests (QT24 `after`, counted once per first quest); done before half its time ran out (1); done with no pay promised (1). |
| D-146 | Achievements for the total earned | 1, 2 | Built | Asked by Ali (09/11/2026). Rule achievements counts every other achievement earned, replaced lower levels included. Scars and these totals do not count. A Few Threads 10 (I), Woven In 25 (II), A Thread Worth Following 50 (III), Pattern in the Weave 100 (IV), The Tapestry Remembers 250 (V); levels set by Ali. Reward level V (5,000 XP, a placeholder) added to REWARD_LEVELS for it. Counted in grantAchievement. |
| D-147 | Player surrender and morale break | 1, 2, 3 | Built | Parked by Ali (10/11/2026), then settled by the morale bar (MB11–MB14, MB40–MB43). The player has the morale bar: at Broken the player keeps control but cannot attack, and the break counts as defeated (Part 3, Morale). The player's yield is built too (Part 3, Morale): "I yield" or /yield; Claude-run foes of an Intelligent race decide, the rest ignore it; a taken yield ends the fight as a defeat, and attacking after yielding is impossible. What happens after a yield is OQ-30. |
| D-148 | Permanent NPCs vs unique NPCs | 1, 2, 3 | Deferred | Parked by Ali (10/11/2026). Ali expects achievements and scars to be earnable by permanent NPCs, not only the player. The code has no "permanent" tag; the closest is a unique template (rolled once and kept) as opposed to a copy. Open question: what makes an NPC permanent, and is it the same as unique? Earning is player-only today (tally and grantAchievement in src/engine/xp.ts write to the player); the reward readers already take any actor. NPC earning waits on this answer. |
| D-149 | Merchant class and prices by place | 5 | Deferred | Parked by Ali (10/11/2026, SL1). A merchant class needs prices that differ between places (buy cheap here, sell dear there). Today every Trader uses one price rule: buy at value × 2, sell at value × 0.5. Open: how a place sets its prices, and what a merchant class does with them. |
| D-150 | Loser scars and the first spar lost | 1, 2 | Built | Decided by Ali (09–10/11/2026). Defeated means Down, yielding, a morale break or fleeing, the same as for foes. The player has only Down and fleeing for now (D-147), so a lost fight counts when the player went Down in it (even if they woke) or it ended with a foe still up, unbroken and hostile to them. Counted once per fight in fightEnded (src/engine/feats.ts): Loser 5, Sore Loser 25, Born Loser 100 (scars; XP per D-151). Spar scars: Flat on Your Back at 1 spar lost, then Sparring Dummy at 10. The optional cost on Loser (+5 to foes' first morale check) was not built. |
| D-151 | Scars pay XP one reward level lower | 1, 2 | Built | Decided by Ali (10/11/2026), replacing "scars pay no XP". A scar pays the XP of the reward level one step below its own; a level 0 scar pays CONFIG.SCAR_XP_BELOW_ZERO (25). achXp in src/ruleset/achRewards.ts is the one function the game, the Scars page and the library viewer read. |
| D-152 | Class tier names and the tiers chain | 1, 2 | Built | Asked by Ali (10/11/2026). Class tiers are named Common, Trained, Seasoned, Renowned, Heroic, Legendary (names table only; keys tier\_0 to tier\_5 unchanged), so tier achievements read "Peak of the Trained", "Crown of the Legendary". The chain for top-level classes across tiers steps by one from 2: Across Two Heights 2 (II), Across Three Heights 3 (III), Across Four Heights 4 (IV), Across Five Heights 5 (V), Every Height Climbed all six (VI). New reward level VI pays 10000 XP (placeholder). |
| D-153 | Free levels | 1, 2 | Built | Asked by Ali (10/11/2026). A free level is a level-up that costs no XP. Achievements (AchievementDef.freeLevels, carried up a chain like every reward) and perks (PerkDef.freeLevels, while owned and active) give them. Owed = earned − Progression.freeLevelsTaken. They are taken like any level (into the class the next level goes to, with its perk points and class perks), before XP, and bank while no class has room. Ali chose (10/11/2026) that free levels never raise XP costs: the XP for the next level counts only levels not taken free (xpToNext). The tiers chain gives +1, +2, +3, +4, +5 by place (+15 in all at Every Height Climbed). |
| D-154 | NPC speech rolls at the player | 1, 2 | Partly built | Decided by Ali (10/11/2026, OQ-29 page https://claude.ai/artifact/KpDQrP5S86A2sQPRphL1vZ, NT1–NT20). An NPC run by Claude may speak with persuade, deceive, intimidate or barter aimed at the player (its plain talk never rolls; code-run NPCs never do it); when the player hears it, it rolls the type's skill and the player answers with the same skill, or Insight against a lie (pushContest, src/engine/speech.ts). One rule works both ways (NT4, applySpeech): a listener that loses to intimidation is Shaken toward the speaker, −SHAKEN_PER_TIER (5) × the tier gap on every roll against them; to persuasion Swayed, −SWAYED_PER_TIER (5) × the gap, also on every roll against them (NT15: a persuaded fighter can be talked into lowering the sword); both last until the listener's engagement ends, and the bigger one stands. A listener that beats a lie gets a tell (the Narrator's pressed.took for the player, the impression for an NPC); barter with a Trader sets prices as PY6. The Narrator gets how it struck the player in words (pressed); the speaker's view says how the player took it when it can see them (NT10). Easy Speaker covers the player as listener. NT3: each earlier try of the same kind (persuade, deceive, intimidate, barter; never plain talk) at the same listener this engagement gives the speaker −REPEAT_TRY (15) more, added up (Repeat try). NT16–NT18: a Trickery tree (TR14) with Lying (SK31, influence, speaking races) that deceive rolls; Insight (SK32, Perception's third skill, Notice group, no function so nothing stands in) answers lies; only the shady thief template has Lying. NT19: haggling stays one check both ways (no change). NT20: Shaken and Swayed show as chips on the status strip and sheet. LI4 (Ali, 10/11/2026): every lie can be caught however it is told: the Planner, Responder and Voice give any line they know is false as deceive, never talk (PUSH_RULE), and the Parser gives the player's lies as deceive (rule 19). Waiting: NT14, the intimidation aura (Design perks) and its morale side (morale thread, MB15) |
| D-155 | NPC speech rolls at other NPCs | 1, 2 | Banked | Banked by Ali (10/11/2026, NT13): NPCs pressing other NPCs (companions included) with speech rolls is outside OQ-29 |
| D-156 | Bonus levels | 1, 2 | Built | Asked by Ali (10/11/2026): the "level outside classes" option should exist as its own reward, not for the Heights chain. A bonus level is a character level no class gets (AchievementDef.bonusLevels, carried up a chain; PerkDef.bonusLevels while owned and active). It is taken at once (it never waits for a class), gives the perk point of an even character level, but no class perks and no progress toward a class's top level or capstone. Like free levels it never raises XP costs. Character level = every class's level + Progression.bonusLevelsTaken. No row gives bonus levels yet. |
| D-157 | Feint and Disarm, parked skill ideas | 1, 4 | Parked | Asked by Ali (10/11/2026): Feint and Disarm left the Swordsman tree (it holds only Riposte) and the game (ids SK22, SK24 retired). Both are parked as skill ideas for future classes. Not designed: feint would trade a turn to open a foe's guard, disarm would knock the foe's weapon away. |
| D-158 | Riposte and Slip Counter functions | 1, 4 | Parked | Asked by Ali (10/11/2026): Riposte (Swordsman) and Slip Counter (Sword-dancer) sit in both the Melee and the Defense groups (SkillDef.groups), so 40 perks of either group reach them and defeat XP counts them in Melee (their first group). Their functions (what they stand in for and roll as) are parked for later; today they have none. |
| D-159 | Blade-master class: Swordsman and Sword-dancer both at max level | 1, 2 | Parked | Asked by Ali (10/11/2026), parked: a class that unlocks when both Swordsman and Sword-dancer reach their max level (10 each today), at tier 3 (Renowned) or higher, so it caps at level 20. It would join the block-based and dodge-based styles (Riposte and Slip Counter). Name, tree, perks and capstone are not designed. Building it needs a class unlock that reads class levels (ClassDef.unlock reads skills today; the access rules already have a class-level condition) and ClassDef.tier for the tier. |
| D-160 | Morale achievements and the break scar | 1, 2 | Built | Agreed by Ali (10/11/2026); built once the morale bar landed (PR #290), on its tallies won\_panicking and morale\_breaks (AC138–AC143). Achievement chain for fights won while Panicking: Hands Still Shaking 1 (I), Fear Rides With Me 10 (II), Panic Is Just Another Weapon 25 (III). Scar chain for breaking (morale reaches Broken): First Crack 1 (0), Glass Nerves 5 (I), Nothing Left to Break 25 (II). Each break also counts toward Loser (defeated). |
| D-161 | Shattered morale level | 3 | Deferred | Banked by Ali (10/11/2026, MB2): a morale level beyond Broken, as Dead is beyond Incapacitated. Not designed. |
| D-162 | Other morale effects | 3 | Deferred | Parked by Ali (10/11/2026, MB10): words of encouragement from allies and other ways to restore or drain morale beyond the fears table, rest, clinic, engagement end and natural recovery. |
| D-163 | All-50 from any three skills of a tree | 1, 2 | Built | Decided by Ali: an All-50 is one part per skill plus one passive that fits the tree. Once any three skills of a tree reach 50 (CONFIG.ALL_STEP_SKILLS), the tree's passive and those skills' parts are granted; a fourth or later skill reaching 50 adds its own part. So a tree can have more than three skills, some behind unlock conditions. Each skill's part belongs to the skill (SKILL_PARTS in src/library/allPerks.ts), so a skill that moves to another tree takes its part along. The mastery achievements use the same three-skill rule. Trees with fewer than three skills (Defense, Fortitude and the one-skill trees) earn no All-50 for now. The part-to-skill mapping is Claude's first proposal, for Ali to adjust. |
| D-164 | Skill tree ratings | 1, 2 | Built | Decided by Ali: skill trees have a rating on the TREE_RATINGS scale (Inferior, Normal, Superior, Legendary; TreeDef.rating, default Normal). For now the rating only sets how many of a tree's skills at 50 earn its All-50 passive, its skills' parts and its mastery achievement (CONFIG.ALL_STEP_SKILLS): never for Inferior, 3 for Normal, 2 for Superior, 1 for Legendary. Every existing tree is Normal (Ali said "common"), except Slime senses, which is Inferior. |
| D-165 | Mastery achievement lines by tree rating | 1, 2 | Built | Asked by Ali (10/11/2026): each kind of All-50 (tree rating) has its own achievement line, grander the higher the rating. MASTERY_ACH is keyed by rating. Normal: Adept / Master / Grandmaster of {tree}. Superior: Paragon / Ascendant / Transcendent Sovereign of {tree}. Legendary: Chosen of {tree}, {tree} Incarnate, The Heavens Kneel to {tree}. Same steps (50/100/150), reward levels (II/III/IV) and rewards on every line. Inferior trees earn none. |
| D-166 | Lying and Insight perks | 1, 2 | Built | Answered by Ali (LI1, LI2): Lying 20 Bluff (free perk move, once per foe per engagement: Lying vs the foe's answer to a lie; unless the foe wins, it acts last next turn). Lying 60 Takes One to Know One (a lie is answered with the better of Insight and Lying). Insight 60 Plain as Day (a lie seen through is called a lie). Insight 100 Read Their Face (the stance toward the owner of anyone who spoke to it this scene shows in its view). Not Born Yesterday parked (D-187). Insight 20 still open: Ali asked for more options. Perk moves now tell the Parser what they look like (PERK_MOVES.does), after a parser test showed "Behind you!" alone was not read as Bluff. |
| D-167 | More special loot | 1, 2 | Parked | Asked by Ali (10/11/2026), parked: more special loot. In the level-speed run (guard template rebuilt per level), a foe's held and worn gear adds a flat 14 XP (arming sword and mail at GEAR_RATING_FACTOR 0.25), so gear barely matters past the first levels. Special pieces (named or rare items, with benefits beyond a gear class's 25/50 starter pairs) would make loot something worth fighting for and let a foe's gear weigh in its rating. What makes a piece special, where it drops and how its value is set (src/ruleset/value.ts) are open. |
| D-168 | All-50 parts by skill, round 1 answers | 1 | Built | Answered by Ali in the All-50 parts doc (https://claude.ai/artifact/CAvYaK2KaCXEeGB2pbznbu): Opening Strike is Heavy Weapons' part and Counter is Light Weapons'. Spotter is parked (D-192), so Earshot has no part for now. Dodgy is −10 to attack rolls on the owner. Thick Hide now cuts a hit before armor (×0.95) and Fighter's Frame cuts the health lost after armor (×0.9, melee only). Parts still to design: Improvisation, Earshot, Insight, Vanishing, Intimidation, Block, Resolve, and a Fortitude passive. |
| D-169 | Auras: Dread Presence | 1, 2 | Built | Ali's answers in the Intimidation aura doc (https://claude.ai/artifact/S5a9Zwiu7cu3pzpQ2gMoPi) and the morale page (MB19, MB36–MB39). New functions engagement_aura and offensive_aura in a new Aura group. Dread Presence is the Intimidation 100 perk and the first engagement aura (src/engine/auras.ts, AURAS table): at the start of each turn, each target opposed or hostile to the owner and aware of it, within CONFIG.AURA_REACH_M (8 m, today's one link) by distM (RD1: the aura skill will set the size once RD9's formula is chosen; D-193), checks once per engagement. The owner's Intimidation is rolled against the target's Resolve (its morale roll, renown included). A win leaves the target Shaken toward the owner (−5 × gap, the bigger Shaken stands) and costs it FR.dread_presence, 10 morale per tier. Both skills mark. NPCs can own it. Battle Cry moves to Intimidation 140 as the offensive aura; Ali wants it buffed (ideas in the doc). |
| D-170 | Parry and the Block rework | 1, 2, 3 | Built | Asked by Ali (10/11/2026), answered PA1–PA12 in the Parry doc. Parry (SK35) is a new Combat – Defense skill (the tree has three skills again): a held melee weapon parries a melee blow, and Block is shields only. Parry's gap ladder cuts less than Block at small gaps (+1 ×0.85, +2 ×0.65), stops the blow fully from +3 (outcome parried) and punishes failures harder (0 ×1, −1 ×1.1, −2 ×1.25, −3 ×1.5, −4 ×2, −5 ×2.5; placeholders). A parry at PARRY_STRIKE_GAP (+3) or better gives the defender one free melee attack back with the parrying weapon (a fist after a barehanded parry), once per turn; a free attack can earn one too, since once per turn ends any chain. Parry can't stop a ranged attack: the defense falls back to the usable one with the highest effective skill, as does a standing defense whose item is missing. Heavy weapons are −1 gap against Parry as against Block. Dodge, Block and Parry never stand in for each other. Riposte augments Parry at full share; Slip Counter is renamed Blade Dance and augments Dodge at full share. Answer the Blow (Riposte 60) brings the strike 2 gaps sooner with a medium weapon (ANSWER_THE_BLOW_DROP); Step and Cut is unchanged. Turn the Blade, Guard Drill and Steady Guard move from Block to Parry (Steady Guard's roll bonus needs a medium weapon); Blade Wall is the Parry 60, Shield Wall the Block 60 and Slip the Crowd the Dodge 60 (no outnumbered penalty). Open-Hand Guard parries barehanded. Cover Ally stays a Block perk (a shield). Swordsman unlocks at and floors Medium Weapons 40 + Parry 40 (story: blade against blade); Guard unlock takes Block, Dodge or Parry 30; the village guard template and the recommended build use Parry, so the recommended swordsman starts without a shield. Parry 20 is parked (PA13), and Parry's All-50 part is not designed yet. |
| D-171 | All-50 parts round 2 and the Battle Cry buff | 1, 2 | Built | Answered by Ali (10/11/2026) in the All-50 doc (PT1–PT6) and the Intimidation aura doc (I9). Built: Junk Arsenal, Improvisation's part (improvised hits, including throws that blend Improvisation, deal ×1.2 before armor, JUNK_ARSENAL_MULT); Know the Step, Earshot's part (someone the owner knows by name is named when only heard: the event, its plain line and any words heard); Last to Fall, the Fortitude passive (at Wounded or worse, morale losses ×0.75, LAST_TO_FALL_MULT). Insight's part is parked (PT3); Vanishing (PT4) and Resolve (PT5) went back to Ali with a coding note and new options. Battle Cry (Intimidation 140, offensive aura) is redesigned, not yet built: every foe that perceives the Loud roar, at any level and any distance, rolls Resolve against the owner's Intimidation and loses 10 morale per tier on a loss; every ally that perceives it gets 10 morale back and loses any Shaken. |
| D-172 | Healing counted by source | 1, 2 | Built | Asked by Ali (10/11/2026): for achievements, track healing from resting, from natural recovery and from perks separately. Built as one tally per healing-table row (rule `healed`, by `heal_source`), counting health % actually healed; perk healing counts under the new Perks row HL6, only from perks that heal directly (Second Wind); Fast Healer counts as natural recovery. No achievements use it yet. |
| D-173 | Overheard (Insight 20) | 3 | Built | Ali's LI5 answer (10/11/2026, "20 perks for Lying and Insight"): option a. A lie (deceive) told to someone else and heard by an owner of Overheard (the words or the voice's sound) gets the speaker's Lying against the owner's answer to a lie; the one lied to and anyone who already answered it are skipped, and the speaker rolls once for all owners. An owner that wins sees through it: the hint, or plainly with Plain as Day (player: narration `overheard`; NPC: event `tell`). LI4 (every plain-talk lie rolled by default) went to the NPC speech thread. |
| D-174 | Healing achievements | 1 | Built | Asked by Ali (10/11/2026): achievements for healing by source, counted in HP as a flat number. AchievementDef.only limits a by-kind row to one kind. Rest (HL1): A Good Night's Sleep 100 HP (0), Sleeps Through Anything 1000 (I), The Long Rest 10000 (II). Natural recovery (HL4): Knits Back Together 50 (0), Walks It Off 500 (I), The Body Remembers 2500 (II). Perks (HL6): Borrowed Strength 50 (0), Tricks of the Flesh 500 (I), Unkillable by Habit 2500 (II). Counts are placeholders (AC150–AC158). |
| D-175 | All-50 round 3 | 3 | Built | Ali's PT8, PT10, PT11 answers (10/11/2026, "All-50 parts by skill"). Resolve's part Grit: Endurance augments Resolve at 0.25 (GRIT_SHARE), built as a perk augment (PerkDef.augments, read by augmentsOf and augment learning). Parry's part Against the Grain: no heavy-weapon gap shift on the owner's parries. Block's part Iron Rim: the shield pool takes ×0.75 (IRON_RIM_MULT). Swordsman unlocks at Parry 40 and Medium or Heavy Weapons 40 (floors stay Medium 40 + Parry 40), and Blade Wall works with a medium or heavy weapon. PT9: Strike and Fade kept as is; a test now pins that a shot from hiding keeps the shooter hidden and nobody rolls twice in a turn. PT7 (Vanishing's part) gets new options. |
| D-176 | Gut Feeling (Insight) | 3 | Coded, parked | Ali's LI6 answer (10/11/2026): option b. At the start of each turn the owner rolls Insight against the stealth of each hidden watcher: opposed or hostile to the owner, aware of it, with sight of it at any distance (RD3, Ali 11/11/2026: no range limit, or it would be weak as a high-level perk), unseen by it. A win is a private hunch event from the watcher's zone (never who), and the owner turns suspicious of the watcher there; each watcher sets it off once a scene (src/engine/hunches.ts). LI7: Ali wants it at Insight 20, which Overheard holds, so it stays out of BUILT_PERKS until its place is settled. |
| D-177 | Stronger-foe achievements | 1 | Built | Asked by Ali (10/11/2026): achievements for surviving and for winning fights against hostile foes a rating X above you, and Y% above you. Power = rating + gear rating, on both sides: one shared measure (power in src/engine/xp.ts) that defeat XP reads too, so a change to it changes both (Ali); each fight keeps the most its strongest hostile foe was above the player (points and %), and the gap is a high-water mark. Surviving = the player is on their feet when the fight ends, won or not; winning also counts on the survive chains. Chains (placeholders): survived 100/250/500 points (raised from 25/50/100, Ali: too small): Lived to Tell It (0), Walked Away From That (I), Should Have Died There (II); survived 25/50/100 %: Outclassed, Not Outlived (0), Too Stubborn to Die (I), Death Looked Away (II); won 100/250/500 points: Punching Up (I), The Bigger They Are (II), Giantkiller (III); won 25/50/100 %: Long Odds (I), Against All Odds (II), Nobody Bet on You (III). AC159–AC170. A starting player is about 92; the village guard about 139 (+47, +51%). |
| D-178 | Battle Cry built | 3 | Built | Asked by Ali (10/11/2026). Intimidation 140, an offensive aura triggered by its perk move (the first move that is the main action and aimed at no one: PERK_MOVES untargeted, the Parser view marks it `action`). Once per engagement. The roar is a Loud battle_cry event; every foe (opposed or hostile) that perceives it at any level rolls Resolve against the owner's Intimidation and pays FR.battle_cry (10 per tier) when it loses; every ally (bandmate, friend or better, or fighting beside the player) gets FR.rallied (10 morale back) and loses any Shaken; so does the one who roars (Ali, 11/11/2026: the roar never costs its owner morale). Gut Feeling parked by Ali until it has a place. |
| D-179 | Every-10-levels achievement climbs; reward levels −1 to XV | 1 | Built | Asked by Ali (10/11/2026): level 10 starts at reward level −1 and each later earning is one level higher (20 = 0, 30 = I … 80 = VI, 90 = VII … 160 = XIV, 170+ = XV). New reward level −1 = 25 XP (REWARD_XP.minus_1; a level 0 scar now pays it, replacing SCAR_XP_BELOW_ZERO). AchievementDef.levelStep: an `every` row climbs this many levels per earning. Ali picked table rows VII–XV ("up to XV for now"); a level past XV stays at XV. XP for VII–XV doubles each step from VI (20000 … 5120000), placeholders. |
| D-180 | Quest XP sized to the player's level | 1 | Parked | Asked by Ali (10/11/2026): quests stop mattering at high levels. Proposed (QX1): a quest pays a share of the player's next level by reward level (zero 25%, I 50%, II 100%, III 250%, IV 500%), reading levelCost so the XP curve flows through. Ali parked it until the difficulty scaling matures. The cut for weak foes (QX2) is built. |
| D-181 | Achievement details on the play screen | 1, 3 | Built | Asked by Ali (10/11/2026): the play card shows no description or tier, and clicking it should show why it was earned. Each LogLine achievement now carries its reward level (key and name), XP, scar flag, what it asks for (earnedAtText: count + ACH_RULE_TEXT, singular from ACH_RULE_ONE at a count of 1, the kind it was earned for) and why (the turn, and the tally reached, stored on the earned entry as `reached`, named only when it went past the count), plus its reward lines (engine achievementInfo). The play card shows the tier and what it asks for; a click opens the details pop-up with why, XP and rewards; its arrival is M-38a. |
| D-182 | Overwhelm and linked perks | 3 | Built | Ali's MR2–MR5 answers (10/11/2026): Overwhelm is the Resolve 100 perk, named Overwhelm, and works with every aura (Dread Presence, Battle Cry, later ones): an aura roll won by OVERWHELM_TIERS (3)+ tiers against a target whose max morale is at most OVERWHELM_MORALE_SHARE (0.5) of the owner's takes all the target's morale; an NPC surrenders, the player is Broken. MR5 (Resolve 20 perk) parked as D-188 with its options, each saved as a banked perk row in src/library/perks.ts: Steady Nerves (MR5a, PK116), Used to the Pain (MR5b, PK117) and Run Later (MR5c, PK118; the page called it Not Yet, renamed because an achievement already has that name). Linked perks (Ali): owning a set of perks grants one more perk (grant) or merges the set into one (merge: the set goes dormant); src/library/perkLinks.ts, applied by syncPerkLinks after a perk is taken or undone and at each turn end. First link LK1: Dread Presence + Overwhelm grant Crushing Presence, +5 true skill to every aura skill (src/library/auras.ts AURA_SKILLS: Intimidation). |
| D-183 | Morale restored, HP lost and morale lost achievements | 1, 3 | Built | Asked by Ali (11/11/2026): morale restoration gets its own library table (composure: Rest, Clinic, Natural composure, Danger passed, Perks), so rest restores both bars but each tunes on its own table (Part 3, Morale). Achievements count morale restored by source as flat points (rule `calmed`, by `morale_source`), copying healing by source: rest 100/1000/10000 (Sleep On It 0, Rested Nerves I, Peace of Mind II), natural composure 50/500/2500 (Catch Your Breath, Shakes It Off, The Mind Remembers), perks 50/500/2500 (Borrowed Courage, Tricks of the Mind, Unshakable by Habit). Also asked: HP lost in flat HP from hits (rule `hp_lost`: Bled For It 100 / Hard to Count the Wounds 1000 / Made of Old Wounds 10000) and morale points lost to fears (rule `morale_lost`: Nerves Worn Thin 100 / Seen Too Much 1000 / Fear Is an Old Friend 10000), all levels 0/I/II. Counts are placeholders. HL5 is retired (it moved to CP3). |
| D-184 | Armor skill while worn and how it improves (AR4, AR5) | 1 | Parked | Parked by Ali (08/11/2026) when the Armor – Conventional skills were added: what light, medium and heavy armor skill does while the armor is worn (AR4) and how the skill improves (AR5). Equip requirements read the skill today; nothing else does. |
| D-185 | NPCs moving after their action (AE3) | 1 | Parked | The player's move comes first unless the Parser marks it `after` ("strike, then step back"). NPCs always move first for now; letting them move after needs the same field from the Planner. |
| D-186 | What happens after the player yields (OQ-30, MB42) | 1 | Parked | Parked by Ali (10/11/2026). Options: taken prisoner, robbed, let go, or something else. Today a yield ends the fight (D-147). |
| D-187 | Not Born Yesterday (Insight perk, LI2c) | 1 | Parked | Parked by Ali (D-166). When someone persuades the owner, the owner answers with the better of Persuasion and Insight, each at full value. Banked row PK104 in src/library/perks.ts. |
| D-188 | Resolve 20 perk (MR5) | 1 | Parked | Parked by Ali (D-182), with three options, each a banked row: (a) Steady Nerves (PK116): the Rattled and Afraid roll penalties don't apply to the owner. (b) Used to the Pain (PK117): the owner's own wounds start costing morale one health level later. (c) Run Later (PK118, "Not Yet" on the morale page): once per fight, a morale loss that would break the owner leaves it at Panicking. Recommended a; b and c could become Resolve 60. |
| D-189 | Go to Ground (Sneaking perk, D9) | 1 | Parked | Parked for a hiding perk (D-117). When the owner Hides outside an engagement, an observer who was only suspicious and loses the contest drops to unaware. Banked row PK87, suggested for Sneaking 60. |
| D-190 | Light Sleeper (Perception All-50 part) | 1 | Parked | Parked by Ali (D-115, offered again in the Earshot round and not picked): noise wakes the owner, and it is never caught asleep and unaware. No library row yet. |
| D-191 | Read Them (Speech All-50 part) | 1 | Parked | Parked by Ali (D-115, All-50 round 2). Its text is in the round 2 All-50 doc; no library row yet. Speech's parts went to Easy Speaker, Soft Landing and Silver Voice instead. |
| D-192 | Spotter (Earshot All-50 part, T5b) | 1 | Parked | Parked by Ali (D-168): band-mates in the zone become suspicious of what the owner is aware of (belief update kind 'told'). Coded (PK57, shareSpotted in src/ruleset/allSteps.ts) but no skill carries it, so it is never granted; Earshot has no part for now. |
| D-193 | Further aura reach (I3) | 1 | Parked | An engagement aura reaches CONFIG.AURA\_REACH\_M metres (8, D-169); RD1: Ali will size it by the aura skill in a formula (square root favoured, RD9). A factor that stretches it further (a perk or a stronger aura) is parked. |
| D-194 | Long-distance trades (S1, S2) | 1 | Parked | Parked by Ali with the trade reach answers: buying works by calling an order (RD2, Ali 11/11/2026): the seller must hear it clearly at CONFIG.ORDER\_NOISE (normal voice, trade `orderReach`), and the one bought for must be as near the buyer or the seller. Trading farther (messengers, letters, other towns) is parked. |
| D-195 | XP curve rework (XC1, XC2) | 1 | Parked | Ali said the curve "scales too harshly at first", then parked the subject (11/11/2026) after the options page (https://claude.ai/artifact/HC8rtovrrLrFKRVwB7RkaZ). Options left open: XC1 levelCost = 250 + 50 × level (recommended) instead of 100 × level; XC2 LEVEL_RATING_SHARE 0.005 instead of 0.02. Any change stays inside levelCost, which quest XP reads. |
| D-196 | Affiliations and groups | 1 | Parked | Parked by Ali (11/11/2026). Two layers beside the band (Actor.bandId, the people together right now, YD7). An affiliation is grander than a faction, or runs in parallel to factions: an order, a guild, a church or a crown, which can span several factions. A group is bigger than a band and can be temporary: a team formed for a job, a hunting party, a crew for one quest. Open questions: how each sets relations, whether an actor can hold several, and how a group forms and breaks. |
| D-197 | All-100 and All-150 steps; Perception All-150 Every Sense One | 1, 3 | Built | Asked by Ali (11/11/2026): All-100 and All-150 work like the All-50 (a tree passive at each step plus each skill's own part, granted once enough of the tree's skills reach the step, by its rating). The first All-150 part is Every Sense One (PK119), the 150 part of both Eyesight and Earshot (STEP_PARTS[150]; either at 150 brings it with the Perception All-150, bundle Nothing Unwitnessed, which has no passive yet): what the owner sees it hears and what it hears it sees. perceptionOf gives the owner the better sense's level by both senses (full reads as sight, so the player's clear sightings count it; partial reads as sound, so spoken words come through), and every sight or hearing function roll counts both senses' skills at full value (rollFnSkills), so light only matters when a sight skill rolls. Names are placeholders. |
| D-198 | Bleeding, and status effects from other games | 1 | Parked | Parked by Ali (11/11/2026). Bleeding as a status effect (a wound that keeps costing health over time until treated) belongs with a set of status effects, alongside the few timed effects there are today such as Leg Bolt's slow. Not built. Before designing it, look up how popular games of different genres handle status effects (for example action RPGs, tactical and CRPGs, roguelikes, survival games, tabletop RPGs) and bring the findings back as options. |
| D-199 | Wall kinds and wall strength | 1 | Parked | Parked by Ali with ZP4 (11/11/2026): draft different kinds of walls (how much sound and sight they stop) together with a later update that measures wall strength. Today every wall or door crossed costs sound LINK\_SOUND\_LOSS\_DB (12). |
| D-200 | Attention | 1 | Parked | Parked by Ali with RD8 (11/11/2026): someone busy, asleep or looking the other way would only glimpse what they would otherwise see clearly. Sight today assumes everyone is looking. |
| D-201 | Mounts and transportation devices | 1 | Parked | Parked by Ali with TV2 (11/11/2026): horses, carts, boats and the like change travel speed; they plug into the movement speed factor (engine/speed `speedFactor`). |
| D-202 | Who travels together, and setting off at an agreed time | 1 | Parked | Parked by Ali with TV6 (11/11/2026): review how grouping works (Ali thinks being bandmates is not the right condition for travelling together), and let people agree to set off at a specific time. |
| D-203 | Landmarks on roads | 1 | Parked | Parked by Ali with TV7 (11/11/2026): stopping at a landmark you have never seen. Encounter rolls are the highlights of a trip for now. |
| D-204 | Nerve by area of life | 4 | Parked | Parked by Ali (PL5, 11/11/2026, "I like it"). Risk differs by area (DOSPERT: ethical, financial, health and safety, recreational, social). Options: a keep one Nerve (physical danger) as now; b split Nerve into areas, each its own axis with its own line; c one Nerve plus area modifiers on top. |
| D-205 | Numeric effects of personality | 3, 4 | Parked | Parked by Ali (PL13, 11/11/2026, low priority: Claude already plays personality for agent NPCs). Options: a words only (now); b Nerve tiers move numbers such as when a code-run NPC flees or morale costs; c named types carry small roll modifiers. |
| D-206 | Attachment, and how strongly stances drive actions | 2, 4 | Parked | Parked by Ali (PL8, 11/11/2026) for its own deep dive: stances feel too rigid and binary. HEXACO Emotionality's attachment half (sentimentality, dependence) could set how hard a stance drives what someone does for or against another. Options: a an Attachment axis in personality; b a strength on each stance; c both. Needs its own design thread. |
| D-207 | Zone level ratings (a difficulty level per zone or area) | 3 | Parked | Parked by Ali (11/11/2026), who does not like it: the goal is a living world with a story, not areas graded by level. Difficulty comes from who is there and what is happening (the event roll and the Weaver), not from a zone's rating. |
| D-208 | Which achievements give personality points | 1, 2 | Built | Answered by Ali (AP1-AP20, 11/11/2026). Each level of a chain adds one step (`CONFIG.ACH_PERSONALITY_STEP`, 5) on its axis while held, lower levels by reference, so a three-level chain gives 3 steps. Scars push their own way, never just a weaker copy (AP3). Unaware defeats Honesty −; yielded foes Pride +; talked down Temper −; enemy to friend Temper − Sociability +; outnumbered, held the line, stronger foes won, won while panicking Nerve +; flawless Discipline +; speech won Sociability +, and Honesty − when earned with Lying (`personalityByKind`, AP12); deals Honesty +; quests and early quests Discipline +; unpaid quest Pride −; zones visited Curiosity +; cruel spars Temper +; abandoned quests scar Honesty −; morale breaks scars Nerve −. Losing scars (fights and spars lost) Pride − (AP18). None: fights won without a blow (AP8 turned down: even a wild person can win with a battle cry), survival chains (AP10), morale lost (AP20). |

## Bug log

The play page's Bugs page (Ali, 11/11/2026): Report bug files the player's note as code player_report with the story, turn and last six lines; the list shows open bugs only, newest first; Send open bugs to Claude posts a comment sent to Claude that wakes the build thread, which triages each bug to the thread that owns it.

Every bug found or reported, in any thread or in play, gets a fixed number (BG-n). Numbers come from one counter, `bugs_meta/counter` in the play page's db: the game takes the next one when it files a bug, and a thread that finds a bug takes the next one there too (read the counter, write next + 1 pinned to the version read), so a number is never shared or reused. Always mention a bug by its BG-n.

The game files a bug at `bugs/BG-n` (status open) for every bug code it logs: any `invalid_` code, and view\_leak, invalid\_target, unlisted\_reveal, planner\_late, agent\_fallback, call\_failed, refused, invalid\_json, weaver\_off\_catalog, weaver\_fallback, weaver\_timeout, routine\_fallback, routine\_skip, reward\_repaired and quest\_goal\_gap (src/save/bugs.ts BUG\_CODES). Plain game outcomes, such as a blocked move or a refused sale, are not bugs. A build thread that reviews a filed bug adds it to this table, sets its db status (open, fixed or wont\_fix), and names the PR that fixes it.

| BG | Bug | Found | Status | Fixed by |
| --- | --- | --- | --- | --- |
| BG-1 | Fight checks that go one way (health fears, crippled-part fear, crowded shots) skipped the player, because the player holds no stances or beliefs; spars didn't count as engaged | Thread | Fixed | PR #361 |
| BG-2 | A sparring blow struck from hiding raised the alarm (SP11) | Thread | Fixed | PR #363 |
| BG-3 | "I await the outcome" after a yield got a clarify ("Nothing is pending"): the Parser had no way to let a moment pass | Play | Fixed | PR #375 |
| BG-4 | "I yield" asked a hostile who never fought the player (waiting in another room), and the sheet's "Deciding" list revealed him; he also counts in the fight log | Play | Fixed | PR #387 (YD1–YD3, YD6, YD7) |
| BG-5 | The player's fight never ended after they left it: the slimes stayed hostile and aware while fighting the guard, so fightingWith kept the engagement open and the end-of-engagement skill-up rolls never came (playtest run 31) | Playtest | Fixed | PR #387 (YD6) |
| BG-6 | Zone placement read "down the street" and "up the road" as stairs, so level street zones were stacked on top of each other | Thread | Fixed | PR #395 |
| BG-7 | The player can't walk out of the tavern front door: zones of different places sit about 36 m apart with no doorway, so the walk heads for a crossing point in the gap, a partial leg leaves the player outside the room, and the next turn resets them to its centre (playtests runs 34, 35) | Playtest | Fixed | PR #408: a zone touches the zone its exit leads from on any free side before it slides out; linked zones that still don't touch are walked edge to edge (the gap is not walked) |
| BG-8 | Scene planning failed: the Weaver named a tavern place and used its layout's zone keys (tavern.common) without naming the layout, so no zones were built and every link, slot and trigger pointed nowhere (play) | Play | Fixed | this PR |
| BG-9 | The Weaver's repair of BG-8 failed the same way, so the scene fell back to a placeholder area (play) | Play | Fixed | this PR |
| BG-10 | BG-8 again on a new story (play) | Play | Fixed | this PR |
| BG-11 | BG-9 again on a new story (play) | Play | Fixed | this PR |
| BG-12 | The player can't move to a spot inside their zone ("walk to the back of the cellar"): moves only name a zone, so the Parser returned nothing and the turn passed as holding still, five times (playtest run 36). Fixed: a move can name a spot in its zone (move.spot: near someone or a way out, away from one, or a compass side) | Playtest | Fixed | this PR |
| BG-13 | The Parser aimed attacks at a slime its view listed as Dead, so the player swung at a corpse while a live slime kept attacking (playtest run 36). Fixed: legality stops an attack on someone the view lists as Dead with "That one is already dead. Who do you mean?", and the Parser is told not to aim at the dead | Playtest | Fixed | this PR |
| BG-14 | A level tunnel was laid on top of the cellar on the same floor, because the layout read the tunnel's back exit ("back up into the cellar") as a climb while heights put both at −3 m; their doorway became the cellar's middle, so a slime from the tunnel stood 0 m from the player (playtest run 36). Fixed: once heights are settled, they alone decide whether an exit climbs | Playtest | Fixed | this PR |
| BG-15 | "Go up the cellar steps and out the front door into the street" stopped behind the bar: moves could only name a zone next to the player, so the Parser named the first step (playtest run 37). Fixed: a move can name any zone the player knows, or a way out of one it has seen (PlayerView `known`), and the walk goes through the zones between | Playtest | Fixed | this PR |
| BG-16 | A move-only turn ("walk behind the bar") was narrated as "You hold your ground and wait": the turn's unused main action made a hold event after the move (playtest run 37). Fixed: no hold after a move unless words go with it | Playtest | Fixed | this PR |
| BG-17 | A guard's shout at the gate, four rooms away, reached the player in the cellar word for word: any sound heard, even partly, carried its words (playtest run 36). Fixed by Ali's decision: words need the sound heard clearly | Playtest | Fixed | this PR |
| BG-18 | With two slimes both an arm's length away, "attack the nearest slime" and then "the slime on the left" / "on the right" each got the clarify "Which slime do you mean?", two turns running, while both slimes kept attacking (playtest run 38). The Parser has no way to break a tie or use left/right. Fixed: everyone in view has a `side` (ahead, left, right, behind) by the way the player last walked (Actor.facing, engine/position.ts sideFrom); the Parser picks one of equally fitting foes and never asks | Playtest | Fixed | this PR |
| BG-19 | "Walk to the back of the cellar" still gave move.spot {awayFrom: the player's own zone} after PR #415 (playtest run 38, as in run 37). Fixed: legality reads awayFrom the zone itself as away from the way the player came in (cameFrom[0]), and the Parser is told so | Playtest | Fixed | this PR |
| BG-20 | "Walk to the cellar steps" from behind the bar went down into the cellar: a move to a way out was parsed as a move through it (playtest run 38). Fixed: going to a way out is a spot near it in the zone it leaves from; going through it is a move to the zone beyond | Playtest | Fixed | this PR |
| BG-21 | A doorway right where the walker stood (a cellar laid under its counter with no heights) was crossed in 0 m with no move event and no trail entry, so "go back" had nothing to read (found testing BG-19). Fixed: a crossing counts as a move however short | Test | Fixed | this PR |
| BG-22 | The narration view's move events said only where each leg ended: "open the tavern door and step inside" (8.4 m along the lane, then into the common room) was told as stepping out into the lane and coming back in, and cellar to kitchen as leaving the common room (playtest run 39). Fixed: a leg that leaves a zone carries `from`, a leg inside a zone is `within` it and names the zone it is `heading` for; Narrator rule 17 reads them | Playtest | Fixed | this PR |

## Check on release

Decisions built as written for the first build, to be checked once the game is played. Unlike deferred items, these are settled for now; the check is whether they hold up in play.

| Item | Part | Rule for now | What to check |
| --- | --- | --- | --- |
| Where engagement applies | 2 | No place limit: an actor is engaged when it believes (suspicious or higher) in an active actor it is hostile to, wherever either one is | Whether distant actors make turns Tactical or spend Planner calls too often; if so, limit engagement to the stage or to the same place |
| Free gear ops | 5 | Drawing, stowing, swapping, accessories and picking up cost no action | Whether free accessory swaps (a ring before every check) or free pick up mid-fight feel exploitable |

## Open questions (answer before sharing)

These must be answered before the spec goes to a build agent. Each question has a fixed ID (OQ-n) that is never renumbered or reused; an answered question is removed and its ID retired. OQ-9 comes from the save data model (OQ-8 settled 07/11/2026 by XP X9); OQ-11 is about how Claude and code interact; OQ-13 comes from scene setup; OQ-22 from the ruleset review. Settled by Ali on 07/11/2026 and retired: OQ-4 (every attack on an unaware actor makes the ambush roll), OQ-5, OQ-6, OQ-15 (wounds: rolls only), OQ-16 (conditions stay in effective skill), OQ-14 (NPC stealth, 08/11/2026, NS1–NS10), OQ-17 (a graze never hits an essential part), OQ-20 (placeholder skill ids, renamed through library aliases) and OQ-10 (see D-108). OQ-28 (quests) was settled on 09/11/2026 (D-105). A question with a build default is built that way until it is answered.

- OQ-9: The database holds at most 25,000 documents, shared by the library and every story. The caps on documents per collection, total size and write rate are not published. The build must measure them in a throwaway artifact (a full database refuses new documents) before N, the backup counts and the proposal caps are set.
- OQ-11: Prompt caching in the Claude-call capability (sample). Settled by the runtime 0.2.96 type definitions: the capability takes no system prompt (input is a prompt string or user/assistant turns under fixed platform framing; standing instructions go in a leading user turn), has no cache\_control or other prompt-caching option, and reports no token usage. Its only documented cache is answer replay: a call with the same input (every turn), modelTier, model, effort, images and verb replays the stored answer without contacting Claude, for 5 minutes by default or up to 24 hours with cache.gcTime. Replay never helps a call whose input changes. Still open: whether the platform caches a long shared prefix on its own. The docs don't say. Measure it with the Prefix Cache Probe artifact (same prefix vs. prefix changed at the first line vs. short prompt, timed to first text, quick tier, both input forms) and record the result here. Until then, cost and latency estimates assume no prompt caching. Catalogs (templates, body types, routine sets, items) change only with libraryVersion, so they sit right after the fixed instructions as a stable prefix; they gain from prefix caching only if the probe shows the platform does it, and a library edit refreshes the prefix.
- OQ-13: Actors leaving the stage. Can NPCs follow the player across a frontier, or leave the stage on their own (pursuers, companions, fleeing enemies)? For now, orders into a frontier are dropped. Related: offscreen world changes (D-67).
- OQ-22: Changing objects and places. In the first build a check or a contest only changes beliefs and reveals secrets (Part 2, Resolution engine). How one changes an object or a place, such as a forced door, a picked lock or a stolen item, is not designed yet.
  - Build default: nothing changes; the attempt is only narrated.
- OQ-30: What happens after the player yields (MB42): taken prisoner, robbed, let go, or something else. Parked by Ali (10/11/2026) as D-186.
- OQ-29: NPC speech rolls at the player. Answered and built (D-154), except NT14 (intimidation aura and morale), which waits on the perk and morale threads.
  - Build default: NPC speech is narration only.

## Appendix: prototype routine bank

Approved as placeholders (Nov 2026): every number, including the activities' noise and visibility values and the DURATIONS placeholders, can still change. It covers one town gate, a street and a tavern, plus a slime field outside the town gate, where slimes roam to be hunted.

**Tags**

| Tag | Values |
| --- | --- |
| place | gate, street, tavern, field |
| role | guard, trader, patron, sleeper, worker, creature |
| time | day, night, any |
| event | ordinary |

Standard slots: post, route, refuge, exit, here.

**Durations** (config, placeholder)

| Id | Turns |
| --- | --- |
| brief | 1 |
| short | 3 |
| medium | 6 |
| long | 12 |

**Activities**

| Id | Look (public) | Attention | Noise | Visibility |
| --- | --- | --- | --- | --- |
| stand\_watch | keeping watch | alert | silent | normal |
| walk | walking | normal | quiet | normal |
| work | hard at work | normal | normal | normal |
| tend\_counter | tending the counter | normal | quiet | normal |
| drink | nursing a drink | distracted | quiet | normal |
| chat | chatting | distracted | normal | normal |
| sleep | asleep | asleep | quiet | low |
| rest | resting | distracted | silent | low |
| cower | keeping out of sight | alert | silent | close |
| ooze | oozing across the grass | normal | quiet | normal |

**Routines.** Steps read slot · duration · activity. A route step expands to one stop per bound zone.

| Id | Kind | Loop | Steps or activity | Alert variant | onAlert | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| guard\_post | schedule | yes | post · long · stand\_watch | hold\_post\_alert | call\_help | Stands watch at the post |
| hold\_post\_alert | schedule | yes | post · long · stand\_watch | — | null | Holds the post on alert |
| patrol | schedule | yes | route · short · walk | search\_route\_alert | call\_help | Walks the beat, stop by stop |
| search\_route\_alert | schedule | yes | route · brief · stand\_watch | — | null | Sweeps the beat fast, on alert |
| tend\_bar | schedule | yes | counter · long · tend\_counter | flee\_to\_refuge\_alert | null | Works behind the bar |
| drink\_at\_seat | schedule | yes | seat · medium · drink; seat · short · chat | flee\_to\_refuge\_alert | null | Drinks and chats at a seat |
| sleep\_in\_bed | schedule | yes | bed · long · sleep | flee\_to\_refuge\_alert | null | Sleeps in bed |
| work\_shift | schedule | yes | work · long · work; work · brief · rest | flee\_to\_refuge\_alert | null | Works with short breaks |
| flee\_to\_refuge\_alert | schedule | no | refuge · long · cower | — | null | Hides in the refuge |
| leave\_by\_exit | schedule | no | exit · long · rest | flee\_to\_refuge\_alert | null | Heads for the exit and lingers |
| wait | wait | — | rest | wait\_alert | null | Waits where it stands |
| wait\_alert | wait | — | stand\_watch | — | null | Waits on guard where it stands |
| follow | follow | — | walk | follow\_alert | null | Follows the player |
| follow\_alert | follow | — | stand\_watch | — | null | Follows the player, on guard |
| idle\_here | wait | — | rest | — | null | Fallback only; in no set |
| roam\_field | schedule | yes | route · short · ooze; post · medium · rest | roam\_field\_alert | null | Oozes across the field, then settles |
| roam\_field\_alert | schedule | yes | route · brief · ooze | — | null | Sweeps the field fast on alert; never flees |

**Routine sets**

| Id | Place | Role | Time | Slots (kind: hint) | Routines, default first | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| gate\_guard | gate, street | guard | any | post (zone: where the guard stands) | guard\_post, hold\_post\_alert, wait, wait\_alert | A guard posted at one spot |
| patrol\_guard | gate, street | guard | any | route (route: the beat's stops, in order) | patrol, search\_route\_alert, wait, wait\_alert | A guard walking a beat |
| barkeep | tavern | trader | any | counter (zone: behind the bar); refuge (zone: back room or cellar) | tend\_bar, flee\_to\_refuge\_alert, wait, wait\_alert | Runs the bar |
| patron | tavern | patron | any | seat (zone: where they sit); refuge (zone: where they would hide); exit (zone: the way out) | drink\_at\_seat, flee\_to\_refuge\_alert, leave\_by\_exit, wait, wait\_alert | A customer drinking |
| sleeper | tavern | sleeper | night | bed (zone: their bed); refuge (zone: where they would hide) | sleep\_in\_bed, flee\_to\_refuge\_alert, wait, wait\_alert | A guest asleep upstairs |
| street\_worker | street | worker | day | work (zone: the work spot); refuge (zone: home or a doorway) | work\_shift, flee\_to\_refuge\_alert, wait, wait\_alert | A labourer or stallholder at work |
| companion | — | — | — | none (here is written by code) | follow, follow\_alert, wait, wait\_alert | The player's band; not chosen by tags |
| slime\_wander | field | creature | any | route (route: across the field, in order); post (zone: where it settles) | roam\_field, roam\_field\_alert | A slime roaming the field outside the gate |

Totals: 10 activities, 17 routines, 8 sets. Every set passes the routine bank import checks (Leak prevention, validation and failure handling): shared routines read only standard slots, and every alert variant is listed in its set.

## Appendix: prototype item bank

Seventeen library items for the first build, approved as placeholders (Nov 2026); every number can still change. "Kit +25" marks a kit piece: a skill bonus to the skill of the mode used, held, withItem. All kit pieces share one +25 per roll and never stack. Real item stats and kits come later. Armor weight penalties are worn skill effects on Dodge. Pools are fixed points on the item, the same for every user.

| Id | Kind | Modes or protection | Effects | Hands | Bulk | Value |
| --- | --- | --- | --- | --- | --- | --- |
| dagger | weapon | slash: melee light, reach 0 · throw: reach 0 + 2, combined roll | Kit +25 | 1 | 1 | 5 |
| arming\_sword | weapon | cut: melee medium, reach 0 | Kit +25 | 1 | 2 | 20 |
| greataxe | weapon | chop: melee heavy, reach 0 | Kit +25 | 2 | 3 | 30 |
| spear | weapon | thrust: melee medium, reach 1 (2 hands) · throw: reach 1 + 2, combined roll (1 hand) | Kit +25 | 1–2 | 3 | 10 |
| shortbow | weapon | shoot: ranged light, reach 3 | Kit +25 | 2 | 2 | 25 |
| longbow | weapon | shoot: ranged medium, reach 4 | Kit +25 | 2 | 3 | 35 |
| crossbow | weapon | shoot: ranged heavy, reach 4 | Kit +25 | 2 | 3 | 40 |
| hidden\_blade | weapon, concealed | stab: melee light, reach 0 | Kit +25 | 1 | 1 | 30 |
| gambeson | armor, light | covers general, arms, both legs · 2, ×0.8 | Dodge −5 | — | 2 | 15 |
| mail\_hauberk | armor, medium | covers general, arms · 4, ×0.65 | Dodge −10 | — | 3 | 60 |
| plate\_harness | armor, heavy | covers general, arms, both legs, head, neck · 6, ×0.55 · head pool: 20 | Dodge −20 | — | 3 | 200 |
| round\_shield | shield | shield part, pool 30 | Kit +25 (Block) | 1 | 2 | 10 |
| signet\_ring | accessory, visible | — | none; shows the visible tag | — | 0 | 40 |
| lucky\_charm | misc | — | Event roll +5, carried, any (noted roll modifier) | — | 0 | 50 |
| lockpicks | tool | — | lockpicking +25, inUse, withItem (placeholder skill id) | 1 | 0 | 15 |
| healing\_draught | consumable, stackable | — | none until Healing is designed | 1 | 1 | 10 |
| coin | misc, stackable | — | — | — | 0 | 1 |

Not items (ruleset config and body type database): the weapon class table (Part 3, Weapons, armor and shields); the unarmed profile, 15 damage and +10 hit; the humanoid's unarmed modes "punch" (class punch, unarmed\_strike, reach 0, no hands) and "grapple" (class grapple, unarmed\_grapple, reach 0, no hands); QUALITY\_TABLE (Part 5 §7). Natural attacks and natural armor for other body types arrive with their database entries.
