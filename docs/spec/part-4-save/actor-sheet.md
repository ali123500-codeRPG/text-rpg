### 4. Actor sheet

The actor sheet: the Core and modules every actor has, race and body type, skill tree access, classes, player creation
and Starts, gods and blessings, NPC generation, personality, age and the first-build templates. Each rule starts with a
stable ID (SHEET-nn) that code, tests and reviews cite; a number is never reused.

#### Sheet shape and modules

- **SHEET-10** The player and every NPC share one sheet shape: a Core every actor has, plus optional modules.
- **SHEET-11** Roll code reads Core only, which guarantees one resolution path for everyone.
- **SHEET-12** The modules and who has them:

| Module | Who has it | Holds |
| --- | --- | --- |
| Core | Every actor | Race, body type, skills and states, classes, stored perks, condition, inventory, standing defense, public label |
| Progression | Player; a rolled NPC, to keep its level's perk points left over (NG11). NPCs don't improve yet (D-25) | StartingTotal, Potential, XP, unspent perk points, marks |
| Mind | NPCs | Control, morale, beliefs, overrides, knows facts, current routine and its anchor, routines list, slot bindings, alarm state. The agenda flag is derived, not stored; the band moved to the Actor |
| Journal | Player | Secrets learned, facts witnessed, last-seen state slots, names known |

- **SHEET-13** Promoting an NPC to recurring adds a module; it never converts the sheet.
- **SHEET-14** A companion needs no module: it is any member of the player's band.

#### Race and body type

- **SHEET-20** The body type is the shape; the race is what the being is (BR1–BR9, Ali 08/11/2026).
- **SHEET-21** Every race names exactly one body type, its HP multiplier, optional natural armor, its own natural
  attacks and fallback attack skill on top of the shape's, and innate perks and quirks (body type: BR5; HP multiplier:
  BR2; natural armor: BR6; attacks: BR3).
- **SHEET-22** An NPC template and the player's build name a race, and the body type comes from it.
- **SHEET-23** Races today (src/library/raceIds.ts): Human and Elf (humanoid, ×1), Slime (amorphous, ×0.6), Dragon (winged
  quadruped, ×5.9; AB6 a, AB17), and the animal races (NR14 a, AB14 a; body-type-database.md).
- **SHEET-24** Defeat achievements count both the body type and the race (BR8).
- **SHEET-25** Tree access rules may name either. A tree the shape already blocks is not blocked again on the race
  (BR9).

#### Skills and skill tree access

- **SHEET-30** General skills are open to every actor unless a perk or race excludes them. Each class adds its own tree
  of three skills. Exclusions are derived from the library and never stored.
- **SHEET-31** Every tree has its own access rule in the library, and each tree is coded on its own (TreeDef.access;
  Ali, 08/11/2026, "Skill tree access" TA1–TA11).
- **SHEET-32** A rule has up to three lists of conditions: **Must** (every one holds), **Either of** (at least one
  holds, when listed) and **Blocked by** (any one closes the tree).
- **SHEET-33** A block always beats an opening. A tree with no rule is open to everyone (block: TA2).
- **SHEET-34** A condition names one source: a race, a body type, a class with a minimum class level, or a perk (quirks
  included). The minimum class level is default 1; the class counts while Current or Previous, never Unlocked. A new
  kind of source is one more case in one check (class level: TA3).
- **SHEET-35** A skill in a tree the actor can't use counts as 0 (rolls, HP, the rating) and can't be raised; its points
  are kept and come back with access (TA4 a).
- **SHEET-36** Rules are per tree, with one exception: a skill can carry its own rule on top of its tree's
  (SkillDef.access; TA8; SR1, SHEET-46).
- **SHEET-37** Rules hold for the player and every NPC: a test fails if a template gives a skill its actor can't use
  (TA9).
- **SHEET-38** Trees a character can't use are hidden on the creation screen and the character sheet unless the
  character has points in them; those show "Blocked by: …" or "Needs: …" (TA10). On the Character page the words are
  added to the tree icon's tip and accessible name, with no padlock.
- **SHEET-39** Today's rules: the Swordsman tree opens through the Blade Against Blade perk, Swordsman's level 1 perk.
- **SHEET-40** Tremor senses needs race Python or Giant spider (AB11, AB19).
- **SHEET-41** Perception is open to everyone, but its skills carry their own rules: the skill Scent needs an animal
  race or Slime, and Eyesight, Earshot and Insight are blocked by body type amorphous (Scent: AB18; Eyesight, Earshot
  and Insight: TA6).
- **SHEET-42** Natural weapons and each of its skills need a body or race with an attack rolling that skill, worked out
  from the attacks (AB16).
- **SHEET-43** Hide needs a race with natural armor (AB20).
- **SHEET-44** Body type amorphous blocks Melee, Ranged, Unarmed, Speech and Tools (no hands or voice, TA6).
- **SHEET-45** A block the shape gives is not repeated on the race (BR9).
- **SHEET-46** **Speaking races**: each race is tagged if it can speak (Human and Elf yes, Slime and Dragon no), and a
  condition can name a race tag (RaceDef.tags 'speaks'; Ali, 08/11/2026, SR1).
- **SHEET-47** Intimidation is open to anyone with the Speech tree; persuasion and barter must have a speaking race.
- **SHEET-48** No nested groups of conditions: they are added when a tree first needs one (TA11; D-113 a, closed). The
  Tools tree and Lockpicking are gone (D-89 RP2), so TA7 is moot.

#### Classes

- **SHEET-50** Each class an actor knows is saved with its state and its class level:

| State | Meaning |
| --- | --- |
| Unlocked | Offered at level-up. Same as not having it: tree unusable, class level 0 |
| Current | At most one: an actor with no class has none (an NPC template without one; a Start with no class, SHEET-95). Receives every new level for persistent characters |
| Previous | A former current class. Keeps its levels; its skills stay usable |

- **SHEET-51** Putting a level into an unlocked or previous class makes it current, and the old current class becomes previous.
- **SHEET-52** Class perks come at class levels set in the library (normally 10 and 20) and are derived.
- **SHEET-53** Previous-class skills keep improving like any other skill. A previous class below its top level can be picked again on the class screen, before the level-up (D-65).

#### First-build classes

- **SHEET-60** Swordsman, a class unlocked in play (SHEET-98, SHEET-116): its tree holds only riposte, which augments Parry (Ali, 10/11/2026;
  D-170).
- **SHEET-61** Feint and disarm are removed for now and parked as skill ideas for future classes; ids SK22 and SK24 are
  retired (CI-157).
- **SHEET-62** **Sword-dancer tree**: mirrors the Swordsman with one skill, Blade Dance (formerly Slip Counter),
  Riposte's twin for dodging instead of parrying, which augments Dodge (Ali, 10/11/2026; D-170).
- **SHEET-63** The Sword-dancer tree's 60 perk Step and Cut mirrors Answer the Blow (strike back at once off a clean
  dodge with a light or medium weapon).
- **SHEET-64** \[Retired\] The Slime class is gone (BR7, Ali 08/11/2026); being a slime is the race (SHEET-520). Tremor
  is in Tremor senses (SHEET-40).
- **SHEET-65** Taste was removed for now; the other skills are open (Ali, 08/11/2026).

#### Player creation

- **SHEET-70** The player builds the sheet by point-buy on the creation screen
  (https://claude.ai/artifact/HW45ivigqwZ5VDo4PWPv9u).
- **SHEET-71** The build has 100 points over the open skills (CREATION\_POINTS, every Start; Ali 14/11/2026).
- **SHEET-72** At creation an untagged skill is at most 30 (CREATION\_MAX\_UNTAGGED) and a tagged one at most 40
  (CREATION\_MAX\_TAGGED); untagging a skill above 30 lowers it to 30 (creationCap). A tagged skill starts
  CREATION\_TAG\_BONUS (10) above the points spent on it, so one bought to 40 starts at 50; the cap, the points spent
  and the class floors count points; everything else, the starter kit included, reads the starting skill like any point
  added, and the creation row shows it (startRaw; YB1 a, Ali 20/11/2026).
- **SHEET-73** The class floors are minimums.
- **SHEET-74** The build has exactly 3 Tagged skills and exactly 3 Flawed skills: one flaw per tag (CREATION\_FLAWS; FC1
  on the Questions hub page "Flaws at character creation", Ali 18/11/2026).
- **SHEET-75** A flawed skill is any open skill that is not tagged and takes at most 20 points at creation; a skill is
  never both (CREATION\_MAX\_FLAWED; FC3).
- **SHEET-76** Each creation row has two icon toggles after the skill name, tag and flaw: dim until set, then lit gold
  or red, aria-pressed (SD9).
- **SHEET-77** The Character page shows a flawed skill's red −, whose pop-up says it learns slower and stops at 75
  (FLAW\_MARK; FC5).
- **SHEET-78** Flaws, like tags, stay for the whole story (FC6, D-379).
- **SHEET-79** Flaws earn nothing at creation; choosing quirks for benefits is a deferred item (D-378; FC2).
- **SHEET-80** The recommended build flaws Persuasion, Barter and Sneaking \[Proposed\]; a race that can't learn one
  flaws its lowest open skills instead.
- **SHEET-81** The screen opens on a recommended build and shows HP, attack, standing defense and the odds against one
  slime as points move.
- **SHEET-82** The story starts only when every point is spent, 3 skills are tagged and 3 are flawed.
- **SHEET-83** StartingTotal is Burden's Total of the starting skills, tag bonuses included (burdenTotal, D-374).
- **SHEET-84** The player starts with the starter kit their skills meet (SHEET-160) and 20 coin (placeholder), at their
  Start's level: 1 for every Start today; START\_LEVEL 4 is only the default for a Start that names none.

#### Starts

- **SHEET-90** A Start is one way to begin on the creation screen, a library table of its own, apart from classes, so a
  start need not have a specific class and character creation can grow (`starts`, IDs ST… in src/library/startIds.ts,
  StartDef; Ali, 09/11/2026; renamed from starting classes, DX1, 14/11/2026).
- **SHEET-91** A start names its class, or takes it from what it gives (the blessed start: its god's class)
  (StartDef.classId).
- **SHEET-92** A start names its creation points and level (the level is the class's), the age picker's default and its
  story line (StartDef.points and level, defaults CREATION\_POINTS and START\_LEVEL; StartDef.age, the age a build without
  one gets; no Start sets one today).
- **SHEET-93** The screen lists the starts in table order, each with its class tier, points and level.
- **SHEET-94** A blessing's tier never shows on the creation screen: the blessed start reads "a random god's blessing"
  and its Blessed class's tier, Seasoned.
- **SHEET-95** **A Start with no class**: a start with neither a class nor a blessing begins with no class, at level 0
  whatever its row says, with the default class (Commoner) open to pick (unlocked, level 0) (startLevel;
  ClassDef.fallback; CC6 b, Ali 14/11/2026).
- **SHEET-96** For a start with no class, XP banks, so levels wait until the player picks a class, and picking one takes
  every banked level at once (src/library/spawn.ts classlessStart, defaultClass).
- **SHEET-97** No start is classless, and none is planned (CC9: no).
- **SHEET-98** The Swordsman start (ST1) was removed; ST1 is retired. The Swordsman class stays and unlocks in play
  (Ali, 14/11/2026).
- **SHEET-99** Unwritten Legend (ST2, the late bloomer; the first Start, and the default): the unique class Unwritten
  Legend, level 1, no floors, and its level 1 perk Any Road Will Do, every function's stand-in share +0.2 (UL1).
- **SHEET-100** The A Nobody start (ST3) was removed; ST3 is retired. The A Nobody class stays, opened at Commoner's top
  level (CC3, Ali 14/11/2026).
- **SHEET-101** The Threadbound (ST4): the class Threadbounded (tier 4, Heroic), level 1, no floors, and its level 1
  perk What Was Always Yours, which gives a random Threadbound item of Rank IV or higher (Part 5 §9; TB7, Ali
  12/11/2026; tier: TB11).
- **SHEET-102** **The Blessed** (ST5): level 1, named The Blessed (DX1, Ali 14/11/2026; level: CC3 a; name: CC4 a).
- **SHEET-103** The Blessed begins with a random god's Tier V blessing: a god is picked at random among those who give a
  Tier V blessing, then one of that god's Tier V blessings, seeded by the story id, given with source 'start'
  (src/ruleset/blessings.ts rollBlessing).
- **SHEET-104** The god is rolled, and shown, when the story starts (CC5 a).
- **SHEET-105** The Blessed begins in that god's Blessed class, level 1 (ClassDef.blessedBy).
- **SHEET-106** While no god gives a Tier V blessing the start can't begin, and the screen greys it out (validateBuild).
- **SHEET-107** **Blessed classes**: a variant per god, "Blessed by X", tier 2 (Seasoned); one opens (unlocked, level 0)
  for any character that god blesses (DX1).
- **SHEET-108** Today only Blessed by Imbra (CL10); its capstone, about earning a higher blessing from the god, is to
  come.
- **SHEET-537** A Blessed class gives, at class level 1, a random Tier I blessing of its god (ClassDef.levelBlessings,
  rolled in classPerks: seeded by the story id at creation, by the character and turn on a level up) (domp,
  21/11/2026). While a god has no Tier I blessing, its Blessed class gives none at level 1.
- **SHEET-538** Imbra's Tier I blessing is Imbra's Measure (PK185; name and story placeholders): the true skill every
  held essence gives is raised by CONFIG.IMBRA_ESSENCE_BOOST (PerkDef.essenceBoost, read by essenceSkill; several
  boosts add in full) (domp, 21/11/2026: "increase stats from essence by 10%").
- **SHEET-109** A character's stranger label is its start class's label (ClassDef.label).

#### Class perks, IDs, tiers and unlocks

- **SHEET-110** **Class-level perks:** ClassDef.levelPerks lists perk ids by class level; a character gets them (source
  'class') when the class reaches that level, at creation or on a level up.
- **SHEET-111** **Class IDs**: every class has a fixed ID: Swordsman CL1, Unwritten Legend CL2, Sword-dancer CL3,
  Commoner CL4, A Nobody CL5, Trader CL6, Threadbounded CL9, Blessed by Imbra CL10, A Somebody CL13 (`CL` in
  src/library/classIds.ts; Ali, 09/11/2026).
- **SHEET-112** Code and saves use the ID, so a class can be renamed in the library alone.
- **SHEET-113** **Class tiers**: every class has a tier on the ordered scale CLASS\_TIERS (lowest to highest: Common,
  Trained, Seasoned, Renowned, Heroic, Legendary), shown on the creation screen and the class tree, to compare classes
  and to place NPC templates later (ClassDef.tier stores the key tier\_0 to tier\_5; Ali, 09/11/2026).
- **SHEET-114** Tiers today: Commoner Common, Trader Common, Blessed by Imbra Seasoned, Swordsman Seasoned, Sword-dancer
  Seasoned (mirrors the Swordsman), Merchant Trained, Guard Trained, A Nobody Seasoned, A Somebody Renowned,
  Threadbounded Heroic, Unwritten Legend Legendary.
- **SHEET-115** **Class unlocks:** ClassDef.unlock lists true skill per skill; a player without the class unlocks it
  (state unlocked, level 0) when every one is met, checked after improvement rolls.
- **SHEET-116** Swordsman (tier 2, Seasoned) unlocks at Parry 80 and Medium or Heavy Weapons 60, and its level 1 perk
  Blade Against Blade (PK155) opens the Swordsman tree (Riposte).
- **SHEET-117** ClassDef.unlockAny is a list of either-of groups: in each group at least one skill must also be met.
- **SHEET-118** **Unlocks are floors**: a class's skill floors are its own floors plus its unlock conditions, so every
  character of a class meets what unlocks it (`classFloors`; Ali, 10/11/2026).
- **SHEET-119** An either-of group is met when one skill in it reaches its value.
- **SHEET-120** A template with a class has its minimums raised to its class's floors; an unmet group raises the skill
  the template has most of (`templateMinimums`).
- **SHEET-121** The village guard template carries the Guard class.
- **SHEET-122** ClassDef.unlockPerkWith needs an active perk whose numbers reach the listed ones (PerkDef.hearingReach:
  zone links added to hearing; Keen Ear 1, and hearing reach sums it over perks).
- **SHEET-123** **Merchant**: a tier 1 class (top level 10) unlocked by Trader (tier 0) at its top level, 5, or by
  Barter 75 on its own (ClassDef.unlockClass, a number or 'max' for that class's top level; orUnlocks; Ali, 10/11/2026).
- **SHEET-124** Trader's capstone Known at Every Stall (PK99) no longer unlocks it and has no effect yet: a new Trader
  capstone comes later (D-358).
- **SHEET-125** Merchant's tree (Merchant, TR15) holds one skill, Shrewd Dealing (SK33), Merchant's advanced barter.
- **SHEET-126** **Guard**: a tier 1 class (CL8) that unlocks with any weapon skill at 40 (Light, Medium or Heavy
  Weapons, or Light, Medium or Heavy Ranged), any armor skill at 40, Block or Dodge at 30, and a perk that sharpens
  hearing (`hearingDb`: Keen Ear, which patrolling templates have; Ali, 10/11/2026).
- **SHEET-127** Guard has no tree or floors yet.
- **SHEET-128** **Sword-dancer**: a class that unlocks at Dodge 80 and Light or Medium Weapons 60; its level 1 perk
  First Steps of the Dance (PK156) opens the Sword-dancer tree (Blade Dance) (Ali, 09/11/2026; tier 2 from 16/11/2026).
- **SHEET-129** The Sword-dancer mirrors the Swordsman: its skills and perks are meant to be the Swordsman's, so the two
  are designed together. It has no floors of its own (its unlock acts as floors, SHEET-118) and no Start yet.

#### Skills augmenting skills

- **SHEET-130** **Skills augmenting skills** (a frequent theme to come): a skill can list `augments` [{ skill, share,
  rollKinds }] (Ali, 10/11/2026).
- **SHEET-131** The augmenting skill's true skill × share (default 1) × its tier is added to the effective skill of
  every roll or check that asks for the augmented skill, or only rolls of the listed roll kinds when some are listed
  (RollKind).
- **SHEET-132** The augmenting skill's tree must be open.
- **SHEET-133** Shrewd Dealing augments Barter at share 1 on every roll.
- **SHEET-134** **Augment kinds**: an augment entry may set `kind` (SkillDef.augments or PerkDef.augments;
  src/ruleset/gear.ts augmentK, the one equation; D-276, Ali 14/11/2026, AK1 to AK4).
- **SHEET-135** *plain* (the default) is the rule above (SHEET-131).
- **SHEET-136** *trade*: the receiving skill gains the giving skill's true skill × share × its tier, and every roll of
  the giving skill loses the same amount, always while the perk or trait is owned (share default AUGMENT\_TRADE\_SHARE
  0.5, placeholder; tradesOut).
- **SHEET-137** In a trade, points are moved, never made, and true skill is untouched.
- **SHEET-138** *percent*: the receiving skill gains the giving true skill ÷ 100 × share × its tier × the receiving
  skill's own true skill (both at 50 add 5, at 100 add 20, at 150 add 45) (share: the rate, default
  AUGMENT\_PERCENT\_RATE 0.2, placeholder).
- **SHEET-139** Two percentage augments on one skill stack, the largest in full and the next at STACK\_RATIO, and plain
  or trade augments never halve them.
- **SHEET-140** Every kind learns as below, with its factor in place of share × tier (SHEET-144).
- **SHEET-141** **First trade:** Fists Do the Talking (PK131), the trait of the Tavern Brawler essence, a placeholder:
  Strike trades into Intimidation (placeholder until D-229).
- **SHEET-142** The essence pop-up and Essences section name a held or offered essence's trait and quirk beside its
  points.
- **SHEET-143** The percentage kind is for the 120 perks (D-258).
- **SHEET-144** **How augmenting skills learn**: the roll gets one learning window from its sums, built like any skill's
  window (Ali, 10/11/2026, AU1–AU5, option B).
- **SHEET-145** The low end is the rolled skill's raw plus each augment's raw × share × tier, minus MARK\_WINDOW.
- **SHEET-146** The high end is the rolled skill's max(raw, true) plus each augment's max(raw, true) × share × tier,
  plus MARK\_WINDOW.
- **SHEET-147** Every augment that added to the roll is marked when the opposition is inside that window; the opposition
  is a check's difficulty, or the other side's true skill plus what its own augments added (AU2).
- **SHEET-148** A tie (tier gap 0) marks every skill and augment that went into the roll (AU4).
- **SHEET-149** An augment not yet on the sheet counts as raw 0 and learns once its tree opens (AU3).
- **SHEET-150** An augment limited to roll kinds learns only from rolls of those kinds (AU5).
- **SHEET-151** The rolled skill keeps its own window and opposition (markAugments in src/ruleset/improve.ts).

#### Starter kit and gear levers

- **SHEET-160** **Starter kit**: items tagged 'starter' (Ali, 09/11/2026; pairs rule 10/11/2026).
- **SHEET-161** **Rule for every gear class, including new ones: the starter kit holds one item needing 25 (Common) and
  one needing 50 (Fine) in that class, and nothing above 50.** Improvised weapons are exempt.
- **SHEET-162** Today: light melee dagger / short sword; medium melee hand axe / arming sword, spear; heavy melee
  woodsman's axe / greatsword; light ranged shortbow / recurve bow; medium ranged flatbow / longbow; heavy ranged light
  crossbow / stirrup crossbow; light armor gambeson / boiled leather (plus Crude rough clothes); medium armor brigandine
  / mail hauberk; heavy armor lamellar coat / half plate; shield round shield / kite shield.
- **SHEET-163** After creation the player gets, per gear class, only the highest-level starter item whose equip
  requirement the build meets (`starterKit`).
- **SHEET-164** The weapon whose required skill is highest is held (then the higher level), a met shield goes in the
  other hand unless the weapon takes two hands, the highest-level armor met is worn, and the rest is carried.
- **SHEET-165** \[Retired with the Swordsman start (SHEET-98)\]; the recommended build's kit is SHEET-176.
- **SHEET-166** Crude rough clothes (need 0, stop nothing, no Dodge cost) are in the starter kit too, so a build that
  meets no weapon (none of its weapon skills at 25) starts in them with no weapon (Ali, 09/11/2026).
- **SHEET-167** **Crude pieces for skills put in** (CG1-CG4): a gear class with no starter piece met gives its Crude
  piece (tag CRUDE\_KIT\_TAG) when the build put at least CRUDE\_KIT\_MIN\_SKILL (`src/config/gear.ts`) points into that
  class's own skill; stand-ins do not count (CG2). A met Common or Fine piece replaces it, one piece per class as SHEET-163
  (CG3). Two tool skills give theirs the same way (CG1 b): Filching gives bent-wire picks (a Filching bonus while
  picking, half the lockpicks'), Medicine gives CRUDE\_KIT\_BANDAGES (`src/config/clock.ts`) more bandages. Improvised and rough clothes are unchanged (clothes come to
  everyone). The Crude pieces: light melee rusty knife, medium melee cudgel, heavy melee splitting maul, light ranged
  stick bow, medium ranged green-wood bow, heavy ranged rickety crossbow, medium armor patched mail shirt, heavy armor
  rusted scale coat, shield plank shield, gauntlets rag hand wraps (CG4). Like every Crude piece they add no bonus, stop
  nothing and cost no Dodge (SHEET-166, SHEET-168). Owner's ask (21/11/2026): "grant crude equipment on character
  creation for skills above 1"; answers CG1 b, CG2 a, CG3 a, CG4 a (Questions hub, "Crude starting gear",
  21/11/2026).
- **SHEET-168** **Equipment balance lever**: a standard-kit piece's bonus is EQUIP\_FACTOR × its need (EQUIP\_FACTOR 0.4
  for now; it replaces the flat KIT\_BONUS 25), so all equipment is rebalanced with one number: Crude 0, Common +10,
  Fine +20, Superior +30, Masterwork +40 (Ali, 09/11/2026).
- **SHEET-169** Kit pieces still share one bonus per roll, the best of them.
- **SHEET-170** A minted item of quality 3 or 4 is a level up, so its bonus rises one step too (EQ11).
- **SHEET-171** **Quality lever**: a minted weapon's hit bonus is QUALITY\_HIT\_FACTOR (0.04) × its need × its quality
  (1–4), and quality 3–4 still moves it a level up, so a fine sword gives +2/+4/+9/+12 hit (QE1; level up: EQ11).
- **SHEET-172** Damage boosts and armor and tool quality keep their tables for now (QE2 open).
- **SHEET-173** **Rule of thumb for all gear:** an item's stats scale with its need.
- **SHEET-174** Armor will get its own lever and shields a lever for their pool (QE3, under discussion).
- **SHEET-175** The recommended build, for every Start: Medium Weapons 40, Parry 25, Dodge 10, Endurance 15, Eyesight 5,
  Earshot 5; tags Medium Weapons, Parry, Endurance (`recommendedBuild`, one source for the screen and tests).
- **SHEET-176** The recommended build's Medium Weapons starts at 50 (tagged, YB1), so it gets the Fine arming sword, its
  stand-ins meet the dagger and woodsman's axe, and it wears crude clothes (`tests/unit/spawn.test.ts`).

#### Random identity and race choice

- **SHEET-180** **Random identity**: the creation screen opens on a random name, gender, age and personality, all
  editable, and its Random button picks them again without touching the skill points (src/library/spawn.ts
  randomIdentity; Ali, 14/11/2026).
- **SHEET-181** Gender: Man, Woman or Other at even odds.
- **SHEET-182** Name: from a placeholder list per gender; Other draws from both (src/library/names.ts).
- **SHEET-183** Age: whole years from the race's youngest age (Youth start; no children) to just before its Old start
  (13 to 59 for a human), so no one starts in old-age decline \[Proposed\] (no children: D-316).
- **SHEET-184** A Start's own age default (StartDef.age) is no longer the opening value.
- **SHEET-185** Personality: a random archetype's targets and values on a random Nerve line.
- **SHEET-186** Race: a random playable race (SHEET-187), and the age is rolled in that race's range.
- **SHEET-187** **Race choice**: the creation screen's Race picker lists the playable races: Human and Elf
  (RaceDef.playable; CC7 a, Ali 14/11/2026).
- **SHEET-188** Slime and Dragon were playable for a while and were taken off again; they stay NPC races, and the body
  rules below stay ready for any race made playable later (playable: CC8 b; taken off: Ali, 14/11/2026).
- **SHEET-189** The build stores the race; left out, it is Human (CreationBuild.raceId, left out = Human).
- **SHEET-190** The race sets the body type, the innate perks and quirks and the age range (newPlayer, createPlayer).
- **SHEET-191** validateBuild refuses a race that is not playable.
- **SHEET-192** **A start a race can't begin**: when the start's class floors need a skill the race's body can't learn
  (a Slime has no hands for Medium Weapons or Parry), the start is greyed out for that race and validateBuild refuses it
  (raceStartBlock; CC8).
- **SHEET-193** The screen opens on the first start the race can begin.
- **SHEET-194** The recommended build for such a race moves the closed skills' points to its open skills, then to other
  open skills, up to the creation cap, and tags the highest open skills (recommendedBuild(start, race)).
- **SHEET-195** **Starter gear by body**: the starter weapon and shield go in the body's own grip parts (a Human's right
  arm then left; a Dragon's jaws, one grip, so no shield; a Slime has none, so nothing is held) (CC8).
- **SHEET-196** Only a humanoid body wears the starter armor \[Proposed\]; the rest is carried.
- **SHEET-197** Picking another race rolls an age in its range and builds the screen again, since trees and ages can
  differ, so the skill points go back to the recommended build (src/library/spawn.ts playableRaces).

#### Gods and blessings

- **SHEET-200** Gods are a library table, each with a narrow field and a standing, an ordered scale, weakest first;
  today only `minor`, "Minor god" (`gods`, IDs GD…, src/library/godIds.ts; `GodDef.rank`, GOD\_RANKS; DX1, Ali
  14/11/2026, "Essences: bested foes, extraction, balance").
- **SHEET-201** Beings above the gods govern wider concepts (to be built up).
- **SHEET-202** The blessing system beyond this is parked (D-311).
- **SHEET-203** Every current god is a **minor god**: grand to the average person, but the minimum for the divine, and
  the Divine NPC rank's anchor (400) matches it (Ali, 14/11/2026).
- **SHEET-204** The standing is game-side only: mortals call every god a god, so in-world text (looks, stories,
  narration) never says "minor".
- **SHEET-205** From Beyond up, NPCs skip the player's skill cap, so a Divine NPC plays at 400 (D-314 c, a placeholder).
- **SHEET-206** Varo (GD1), minor god of extreme fortunes, no blessings yet.
- **SHEET-207** Imbra (GD2), minor goddess of essence manipulation (named by Ali, 14/11/2026).
- **SHEET-208** A blessing is a perk with `PerkDef.blessing` = its god and its tier, an ordered scale BLESSING\_TIERS
  that counts up (CC1 b, Ali 14/11/2026).
- **SHEET-209** Tier I is the weakest, the blessed start's Tier V is mid-ladder, and higher gods' blessings go on to
  Tier VI, VII and up with no end. Rows are generated to BLESSING\_TIER\_ROWS, 30; raising it adds tiers
  (src/scales.ts).
- **SHEET-210** Tiers read as numerals only; names may come later (CC2 a).
- **SHEET-211** Lore around the gods belongs to the lore thread.

#### NPC generation and kinds of NPC

- **SHEET-220** All generation runs in code.
- **SHEET-221** A template (a preset) gives a body type and race, an optional class, a role, a theme, a rank, a minimum
  for each skill, a personality, a loadout and a control setting (NPC Generation NG1–NG21, Questions hub page
  npc-generation-rework).
- **SHEET-222** **Rolled** (a bandit): each NPC made from it rolls its own person once at spawn, then its values are
  saved and frozen. It was called "unique" until HF15 (Ali, 13/11/2026).
- **SHEET-223** **Copy** (a wolf, a slime): saves only the template id and live state, and follows the latest template.
- **SHEET-224** **Unique**: one specific character, a whole saved sheet spawned exactly as saved at full health, under
  its own name, pronouns, personality and age; the Weaver gives only its label, band and place (NpcTemplate.unique, a
  UniqueSheet; HF15).
- **SHEET-225** A unique is at most once per world: the Weaver's catalog lists only uniques not yet in the world
  (catalogs.uniques, with name, classes, level, power and the hidden past; player.power to set it against; HF11).
- **SHEET-226** Validation refuses a unique already in the world or cast twice (unique_in_world).
- **SHEET-227** Uniques live in the code library, in their own file (src/library/uniques.ts, HF34 a).
- **SHEET-228** Items made in a hero's own story travel in its sheet and join the library items (itemDefs).
- **SHEET-229** **Echoes**: a Hall of fame hero comes back as an echo: its sheet at death, achievements, scars, title
  and essences kept, its age at death (origin 'echo', src/library/echo.ts echoSheet; HF18–HF24, HF29, D-243).
- **SHEET-230** An echo never learns (no marks).
- **SHEET-231** An echo's gear is soulbound copies of what it had (weapons, shields, armor, accessories and tools, pools
  full); its coin and other goods stay behind (HF24 c).
- **SHEET-232** A soulbound item is usable only by its owner: it can't be picked up, looted, sold, given, dropped,
  stashed or knocked from a destroyed hand (ItemInstance.soulbound; boundTo).
- **SHEET-233** A soulbound item is not a Threadbound item's one of a kind: the hero's original is freed (HF19).
- **SHEET-234** A soulbound item fades when its owner dies.
- **SHEET-235** A Threadbound copy keeps only the abilities the hero had unlocked (its own achievements).
- **SHEET-236** A beaten echo always offers an essence (no appearance roll); its quality roll goes ECHO_ESSENCE_TIERS
  (2) tiers up, past Legendary too, and below Success still gives ECHO_ESSENCE_FLOOR (Common).
- **SHEET-237** The Weaver and the Narrator get who an echo was and how it fell as a hidden note (Weaver:
  catalogs.uniques past, rule 10; Narrator: actors[].echo, rule 32; HF2).
- **SHEET-238** A template may carry a loadout: a list of library item ids given to every NPC made from it \[Proposed\]
  (Part 5 §8).
- **SHEET-239** **Named presets for the rosters**: the people and beasts the roster hooks and groups cast, so the World
  builder and the library catalog can name them (TP7–TP20; NR17–NR20, NR27).
- **SHEET-240** The presets: hunter, healer and village headman (Village folk), knight (Lord's household, Knight Trainee
  class), bandit and bandit chief (Road bandits), watch sergeant (Town watch), pedlar (Trader class) and hired guard
  (Travellers), and wolf, wild boar, bear, dog and dire wolf (Wild beasts; the dire wolf carries the Dire prefix).
- **SHEET-241** Each preset is race, role, theme and rank only, at the rank its roster row rolls most often.
- **SHEET-242** Resolve, control and chase are the composed defaults for its role's kind (COMPOSED_NPC).
- **SHEET-243** People are rolled, beasts are copies.
- **SHEET-244** Rosters and groups still compose at their rolled ranks; a preset is there to cast by name.

#### Layered generation: rank, level and grandeur

- **SHEET-250** Every number in layered generation is a placeholder lever in CONFIG (src/library/spawn.ts presetSkills,
  templateSkills; NG1–NG9, NG20, NG21).
- **SHEET-251** **Rank**: an ordered scale RANKS (rank\_0 Untrained, rank\_1 Novice, rank\_2 Trained, rank\_3 Veteran,
  rank\_4 Elite, rank\_5 Paragon, rank\_6 Beyond, rank\_7 Mythic, rank\_transcendent Transcendent, rank\_8 Divine)
  (NG3).
- **SHEET-252** Keys are stable and order is the row position (`rankPos`): Transcendent was added between Mythic and
  Divine on its own key, so saved keys keep their meaning (D-335, placeholder).
- **SHEET-253** Each row of RANK\_ROWS gives a skill anchor and a level: 15/L1, 30/L2, 50/L8, 65/L12, 75/L15, 100/L20
  (NR44: set by Ali after a simulated fighter played typical scenarios from a 100-point creation build at level 0, with
  health, morale and stamina kept through each scenario; it reached Paragon at about L20).
- **SHEET-254** Past Paragon it is two levels for every 5 skill points, twice the Elite-to-Paragon rate, because raw
  training stops at 100 and those skills come only from essences, gear and perks: 150/L40, 200/L60, 300/L100
  (Transcendent, placeholder), 400/L140 (NR44, Ali: the earlier past-Paragon levels were too low; NR45 asks to confirm;
  Divine raised from 300 to 400 by Ali, 14/11/2026: minor gods are the minimum for the divine).
- **SHEET-255** Per-rank tables (RANK\_ROWS, RANK\_TRAITS) are keyed by rank key.
- **SHEET-256** Past the last row each step adds RANK\_BEYOND\_STEP (anchor +100, level +40) and the name gains a +
  (Divine+, Divine++); such keys count on from Divine's number (rank\_9 is Divine+).
- **SHEET-257** **Level from skills**: an NPC's level is the rank table read backwards on the average of its own
  High-band (tagged) skills (`levelAtSkill`, `levelFromSkills`; NR39 a).
- **SHEET-258** Between two anchors the level moves evenly, below Untrained it falls toward 0, past Divine it goes on by
  RANK\_BEYOND\_STEP; at least 1.
- **SHEET-259** At spawn the level reads the rolled skills (spread included); a live NPC's reads its true skills, so
  essences and growth count (`actorLevel`).
- **SHEET-260** An NPC with a class takes its class level; an echo or other unique keeps its own level.
- **SHEET-261** **Grandeur**: every role and theme has one, and an NPC takes the higher of the two (scale GRANDEUR
  mundane, ordinary, grand; `grandeur`; NR40 a).
- **SHEET-262** A seat of the Great or a village's warden (its roster entry) and a unique are always grand.
- **SHEET-263** The level from skills is multiplied by CONFIG.GRANDEUR\_LEVEL\_MULT (mundane ×0.75, ordinary ×1, grand
  ×1.25, placeholders).
- **SHEET-264** Mundane: Worker, Hunter, Healer, and the Village folk, Town folk and Travellers themes; grand: Knight;
  the rest ordinary.
- **SHEET-265** A theme may rename ranks (ThemeDef.rankNames).

#### Layered generation: roles and themes

- **SHEET-270** **Role**: which skills the NPC is built around, in three bands (library table npcRoles, IDs RO…; NG1,
  NG2).
- **SHEET-271** Roles today: soldier, skirmisher, brute, shooter, sneak, watcher, talker, worker, beast, hunter,
  healer and smith.
- **SHEET-272** **Hunter** (RO11, civilian): High Medium Ranged and Sneaking, Moderate Eyesight, Earshot and Endurance,
  Low Light Weapons and Stamina; gear medium ranged, light melee, light armor; hunters, foresters, trappers and poachers
  by label and theme (NR4 a).
- **SHEET-273** **Healer** (RO12, civilian): High Healing, Insight and Persuasion, Moderate Resolve and Earshot, Low
  Barter; barber-surgeons, herb-wives and midwives, and the one who sells clinic care where a place has it (the Weaver
  lists SV5 in its wares) (NR6 a).
- **SHEET-536** **Smith** (RO15, civilian; D-89 RP16 a, 21/11/2026): High Handiwork, Low Barter; the one who mends gear
  at a forge and sells repair (SV6) and use of the forge (SV7). Template TP21 ("a smith", a Trader), and a choice of the
  Service hook beside talker and healer.
- **SHEET-274** Peasant roles take no trade skills and stay in the Commoner class line (Commoner, then A Nobody), so no
  class is added for them (NR2).
- **SHEET-275** **Leader** (RO13, civilian): High Persuasion and Intimidation, Moderate Insight and Resolve, Low Medium
  Weapons and Barter; the headman, reeve or guild master others answer to, and a quest giver (NR8 a).
- **SHEET-276** The Leader's own class is parked (CI-341).
- **SHEET-277** **Knight** (RO14, combat): High Medium Weapons and Heavy Armor, Moderate Block, Resolve and
  Intimidation, Low Heavy Weapons and Persuasion; gear medium melee, shield, heavy armor (NR13).
- **SHEET-278** Its master's class is **Knight** (CL11, tier 2): Light, Medium and Heavy Weapons all at 50 (the Arms
  All-50), one of them at 100, and Heavy Armor 75; or **Knight Trainee** at its top level; its benefits come later (NR36
  b).
- **SHEET-279** **Knight Trainee** (CL12, tier 1): the way into Knight, open at Heavy Armor 40 and any one melee weapon
  skill at 40 (placeholder; benefits later; NR36).
- **SHEET-280** A class may list other ways in, each a set of unlock, unlockAny and unlockClass rules, with no perk
  needed (`ClassDef.orUnlocks`).
- **SHEET-281** Meeting any one opens the class, the class tree draws a link from each, and the library viewer shows
  them as "or instead" lines.
- **SHEET-282** Ali reads a knight as an anime knight more than a medieval one: past 100 they are what the power ladder
  says, shown only in results.
- **SHEET-283** Next rounds put fighters and monsters first (NR1 b, 15/11/2026).
- **SHEET-284** **Theme**: who the NPC belongs to, adding its own bands (library table themes, IDs TH…; NG1).
- **SHEET-285** Themes: village folk, town watch, road bandits, wild beasts, town folk (TH5, Fine wealth, values
  wealth), travellers (TH6, Common, freedom and adventure), lord's household (TH7, Superior, duty and loyalty; knights
  and servants) and monsters (TH8, no gear: the few always-lethal monster kinds, each in its own place) (town folk,
  travellers, lord's household and monsters: from NR16 a).
- **SHEET-286** Slimes and dragons stay wild beasts, as vermin and great beasts.

#### Layered generation: bands, cap, spread and floors

- **SHEET-290** **Bands**: a skill's value is the rank's anchor × its band share (ROLE\_BAND\_SHARE: High 1, Moderate
  0.8, Low 0.6) × NPC\_BAND\_MULT (1; one lever over every NPC's skills at once, which took over from the old points per
  level) (NG2).
- **SHEET-291** A skill in more than one band takes the highest.
- **SHEET-292** High-band skills are tagged, and Low-band skills are flawed, so they are generated under the flawed cap
  (75) below NPC\_UNCAPPED\_FROM (FC8 b on the Questions hub page "Flaws at character creation", Ali 18/11/2026: NPCs
  mirror the tags).
- **SHEET-293** The senses every NPC has at Low (NPC\_COMMON\_SKILLS) are flawed unless a role or theme bands them
  higher.
- **SHEET-294** NPCs make no improvement rolls, so a flaw only caps the generated value, which bites from rank anchors
  above 125 (Low 60% × 125 = 75).
- **SHEET-295** A hero who becomes an NPC keeps its own skill states.
- **SHEET-296** **Cap**: up to Paragon, the player's cap, SKILL\_CAP (100), and SKILL\_CAP + TAG\_CAP\_BONUS (120) for a
  tagged skill (NG5, D-314 c).
- **SHEET-297** From CONFIG.NPC\_UNCAPPED\_FROM (Beyond) up, a preset's banded skills skip the cap, so a Beyond is 150,
  a Mythic 200, a Transcendent 300 and a Divine 400 (placeholder, Ali 14/11/2026).
- **SHEET-298** The player's raw has no hard limit, so the save check no longer holds it to the cap (since D-374 TB7).
- **SHEET-299** **Spread**: each skill moves by up to ±COPY\_SPREAD (10%), seeded by the template and the actor's ID, so
  two copies differ a little and the same NPC always rebuilds the same (NG9).
- **SHEET-300** With no actor (the essence lists) the centre values are used.
- **SHEET-301** **Floors**: the template's minimums, its class floors (`templateMinimums`), and NPC\_COMMON\_SKILLS
  (Sight and Hearing at Low) when the NPC's body can use them; a slime has no Sight or Hearing (NG8).
- **SHEET-302** Stamina copies Endurance.
- **SHEET-303** A copy does not roll: its skills are rebuilt from these layers on load, so changing a lever or a role
  reaches existing NPCs (`refreshCopies`).

#### Gear, compositions and the cast check

- **SHEET-310** Every number in gear, compositions and the cast check is a placeholder lever in CONFIG
  (src/library/spawn.ts, src/scenario/apply.ts; NG10, NG15, NG16).
- **SHEET-311** **Gear**: a preset's pinned items come first, kept where the story needs one, like the guard's round
  shield (NpcTemplate.loadout; NG10).
- **SHEET-312** Then, for each gear class its role uses, it gets the highest-level library item its skills meet, up to
  its theme's wealth (village folk and road bandits Common, town watch Fine); a starter item wins a tie
  (NpcRoleDef.gear; ThemeDef.wealth, an EQUIP\_LEVELS key; `templateLoadout`).
- **SHEET-313** NPC gear is the starter kit's rule without the starter tag.
- **SHEET-314** A slot a pin fills gets no pick, nor a shield beside a two-handed weapon.
- **SHEET-315** Every gear class but improvised has a piece at each level from Common to Masterwork; levels past
  Masterwork have no items yet (IR2).
- **SHEET-316** **Compositions**: a cast entry may name `compose` (race, role, theme, rank by key or name, optional
  class) instead of a template; validation refuses unknown parts (catalogs.compose; bad\_compose; NG15).
- **SHEET-317** Code builds a copy preset and keeps it as a story blueprint, one per composition (ID
  NC\_race\_role\_theme\_rank\[\_class\]), so it shows in the GM view under "Made this story" with Send to library
  (`composeTemplate`; Resolve, control and chase from COMPOSED\_NPC by the role's kind).
- **SHEET-318** When no template or composition gives who it wants, the Weaver uses the closest and says who in
  `templateGap`.
- **SHEET-319** Every such gap is kept in hidden.templateWants and listed in the GM view (Wanted), so a
  template can be made. A routineGap (no routine set fits) joins the same list, marked Routine, with the set used
  instead, so the routine bank can grow (D-53 a). The Chronicler's deed ideas are kept in the same field but listed on
  the Bugs page, not here (AA-108, Agent Chronicler). WT9: the list keeps counted groups (kind, who, what was used
  instead; count, last scenario), at most CONFIG.GM\_LOG\_GROUPS\_TEMPLATE\_WANTS, the least recently seen dropped. Each
  group has Approve and Turn down in the GM view: approved, it leaves the list; turned down, only its count stays and
  keeps counting, so a gap that keeps coming shows it needs revising. A deed idea gets the same when Clear list takes it
  off the Bugs page (Agent Chronicler).
- **SHEET-320** This settles the NPC half of D-11.
- **SHEET-321** **Theme role kinds**: each theme lists the role kinds that fit its world (`roleKinds`): Road bandits and
  Town watch take fighting roles only, Wild beasts and Monsters beast roles only, the folk themes (village, town,
  travellers, a lord's household) any person (Ali's library-viewer note on Road bandits, 15/11/2026: "what would a road
  bandit without combat skills do?").
- **SHEET-322** A composition whose role kind its theme does not take is refused (`bad_compose`).
- **SHEET-323** The closest-role pick chooses only among the roles its theme takes (NR28).
- **SHEET-324** catalogs.compose shows each role's kind and each theme's kinds.
- **SHEET-325** **Closest role**: when no role fits, a composition leaves `role` out and gives `wants`: a label for who
  is wanted and 2 to 4 skill ids (NR28).
- **SHEET-326** Code picks the role whose bands cover them best: each wanted skill counts CONFIG.ROLE_WANT_SCORE (High
  3, Moderate 2, Low 1); ties keep the role table's order.
- **SHEET-327** Wanted skills that role lacks from its High and Moderate bands go to `hidden.roleWants`, shown in the GM
  view as "Roles wanted", grouped by who was wanted with a count, so new roles are made from what the agents keep asking
  for. WT8 c: the groups (who, skills, role; count, last scenario) are what is kept, at most
  CONFIG.GM\_LOG\_GROUPS\_ROLE\_WANTS, the least recently seen dropped. Approve and Turn down work as for SHEET-319.
- **SHEET-328** A composition with neither role nor wants, or wants with fewer than 2, more than 4 or unknown skills, is
  refused (`bad_compose`).

- **SHEET-330** **Rosters**: a real NPC earns its place with a hook; everyone else is crowd, written into how a place
  looks (src/land/roster.ts; NR17 a, NR18 a, NR19 a, NR20 a, NR31 a).
- **SHEET-331** Code rolls the hooks each settlement holds by size, seeded by the land's own ids, so a roll never
  changes (library `rosters`).
- **SHEET-332** Hamlet 1 to 2 from a person in need or a threat; village 3 to 5, always a leader, a service and its warden
  (the lord's posted warden, the strongest person there but not one of the Great; PQ13 a2); town 6 to 10, always a leader, a service, the seat, a trader, the watch and a rival.
- **SHEET-333** City 10 to 16, the town's must-haves plus a threat; court 5 to 8, Lord's household theme, always the
  ruler (a leader), the seat, the watch and a rival.
- **SHEET-334** The land draws no cities or courts yet, so those two rows wait for a region that holds one.
- **SHEET-335** Code also rolls the groups on each road stretch by danger (`roadPeople`) and at each landmark by kind
  (`landmarkPeople`: a tower holds a watch post, a camp a bandit gang). Larger groups: SHEET-540.
- **SHEET-336** Hook kinds say what each gives play and who can fill it (`hookKinds`, HK…).
- **SHEET-337** Each person's race is rolled: elves CONFIG.ROSTER_ELF_PCT (5) in 100, else human.
- **SHEET-338** Ranks come from CONFIG.ROSTER_RANKS: services, traders, the watch and people in need Trained 50 /
  Veteran 40 / Elite 10; the crowd Novice 70 / Trained 30; leaders and rivals one step up; threats by settlement size
  (city and court up to Beyond); roads by danger (NR21 a).
- **SHEET-339** The seat (a village's warden) is at least its minimum (village Veteran or Elite, town Paragon, city Beyond, court Mythic),
  one step higher on SEAT_STEP_UP_PCT (TL24).
- **SHEET-340** The World builder's view (`land`) lists each unfilled entry beside its site, road or landmark (`roster`,
  `travellers`, `people`: key, who, what it gives, and who code rolled). The Weaver's view at story start lists them too,
  and the Weaver casts the start settlement's roster by the World builder's rule (PQ2 a).
- **SHEET-341** `land.wild` lists who can be met on each cover at this time of day (`wildPeople`, NR19 a).
- **SHEET-342** A cast entry names the key in `roster`: code takes the entry's race and rank, and who it is unless the
  entry gives a template or composition; a key is filled once (`hidden.rosterFilled`). An entry keyed by a roster key
  that gives no roster, template, composition, actor or group is that roster entry (BG-1507).
- **SHEET-343** A seat entry (goals) is given a name, its deeds (motive) and 1 to 3 goals; casting it as a full unique
  with essences comes next (NR22 a).
- **SHEET-344** The GM view lists each settlement's hooks and how many are filled.
- **SHEET-345** Still to come: road travellers moved by code between places, and a crowd person made a Commoner when the
  player picks them out.
- **SHEET-346** **Groups**: a group is one cast entry with `group` {id, rank} (library `groups`, GP…; NR27 a, D-308).
- **SHEET-347** Code makes the entry the leader (its `step` ranks above the group's rank) and adds its seconds (NF7 a) and
  followers right after it, with the leader's band, routine, slots and awareness (`groupOf`, keys `<key>_2`…).
- **SHEET-348** A group counts once against the cast cap.
- **SHEET-349** Recipes: pedlar, traveller, caravan (a caravan master and two hired guards), pilgrims, bandit gang (a
  chief one rank up, two to four bandits), watch patrol, watch post, wolf pack (a leader one rank up, two to five
  wolves), wild boar, bear, hunter, dog at the fold, slimes.
- **SHEET-539** **Larger groups** (the owner, Questions hub page "Notable foes: fewer early essences", 21/11/2026, NF7 a):
  a rung above the small groups, each with one notable head (GroupPart.`notable`: whoever it spawns is a notable foe,
  marked as Core.notable; Essences, notable()). Bandit company: a captain two ranks up (notable), two gang chiefs one rank
  up (its `seconds`), and its bandits. Watch garrison: a watch captain two ranks up (notable), two watch sergeants one rank
  up, and its watchmen. Counts are in the library `groups` table. The small groups keep no notable member (NF3: "actual
  leaders only, not a group of 3 bandits").
- **SHEET-540** A group's `minSite` is the smallest settlement whose roster rolls it (hookGroups, src/land/roster.ts):
  both larger groups are town and up, so a town's or bigger place's Threat hook may roll a company and its Watch hook a
  garrison, and a hamlet or village never does. A dangerous road's `roadPeople` row can bring a company (a placeholder
  weight); no other road can.
- **SHEET-350** The Weaver and the World builder see the groups in catalogs.compose.groups.
- **SHEET-351** **Prefixes**: a beast may carry one prefix, a stronger kind of the same beast named in its label ("a
  dire wolf") (library `prefixes`, PF…; NR37 a, NR38 a).
- **SHEET-352** **Dire** (PF1): one rank step up, half again the health and a fifth more skill (rank step: `rankStep`,
  which goes on past Divine; health: `hpMult` 1.5, in totalHp; skill: `skillMult` 1.2 on every banded skill after the
  rank step, NR46 b).
- **SHEET-353** For Dire, the raw cap still holds below Beyond, and its level follows its skills.
- **SHEET-354** Dire's third part, one body size larger, waits for a body-size rule (D-354).
- **SHEET-355** A composition may name `prefix`; only beast roles take one (catalogs.compose.prefixes; `bad_compose`).
- **SHEET-356** A group's beast members roll Dire on CONFIG.DIRE_PCT (10) in 100 on wild cover, roads and landmarks,
  never on a safe or quiet road.
- **SHEET-357** The World builder and the Weaver may cast a prefix from the catalog.

- **SHEET-360** **Cast readings** (NG16 b, CK6 a): the challenge grade stays the Weaver's declared severity, checked only
  against the tier. At each scenario's opening code logs three readings beside it, none of them a verdict: danger to the
  player (the power of the cast hostile or opposed to the player over the player's), local pressure (the same hostile
  power over the place's usual hostile group) and exceptional (how many ranks the strongest hostile stands above anything
  the place can roll).
- **SHEET-361** The place's usual hostile group is the weighted median power of its own threat table, one fixed roll per
  group and rank: an encounter on a road by the road's danger (roadPeople, ROSTER\_RANKS.road), else the land cover at the
  encounter point (wildPeople, ROSTER\_RANKS.wild), else the settlement's threat hook (ROSTER\_RANKS.threat), counting only
  groups marked threat (GroupDef.threat: bandit gang, wolf pack, boar, bear, slimes). The highest rank it can roll adds a
  leader's step and, where Dire can roll, one more. A place with no threat table (a safe or quiet road, a place on no land
  site) reads unknown (CK9 a). A free cast above the place's tables is only logged, through the exceptional reading
  (CK10 a). Code: `usualThreat` in src/scenario/apply.ts.
- **SHEET-362** The readings are kept in hidden.castPower and shown in the GM view; nothing is refused and no NPC changes.
  WT7 a: the newest CONFIG.GM\_LOG\_ROWS\_CAST\_POWER readings are kept, the oldest dropped.
  The off-band flag and CAST\_POWER\_BANDS are retired (CK6 a).

#### Perks, traits, rules and personality

- **SHEET-370** Every number for NPC perks, traits, generator rules and personality is a placeholder lever in CONFIG
  (src/library/spawn.ts; NG11–NG14).
- **SHEET-371** **Milestone perks**: an NPC spends its level's perk points (one per PERK\_POINT\_EVERY levels, as the
  player) on ladder milestone perks by the player's rules: the milestone reached by true skill, a perk written there and
  in the game, and enough perks below it in that skill (NG11).
- **SHEET-372** Its role's High skills come first, then Moderate, Low and the rest, highest first, each from its lowest
  milestone up (`npcMilestonePerks`).
- **SHEET-373** Milestone perks are 'level' perks.
- **SHEET-374** A copy's milestone perks are re-picked on load from its rebuilt skills; a rolled NPC's points left over
  stay unspent.
- **SHEET-375** Milestones read true skill, so a tagged 125 reaches 131 with its 40 perk and stops short of a 140 perk.
- **SHEET-376** **Rank traits**: a rank draws RANK\_TRAITS (0, 0, 0, 1, 1, 2, 2, 3, 3, 3 from Untrained; +
  RANK\_TRAITS\_BEYOND per step past the last row) from its theme's and role's trait pools, perks and quirks alike,
  seeded by the actor's ID, as 'template' perks (ThemeDef.traits, NpcRoleDef.traits; NG12). They are drawn once, at
  spawn, and kept: a load re-adds only the template's own perks, so a pool or RANK\_TRAITS edit reaches new NPCs only
  (owner, decision card, 21/11/2026; BG-351).
- **SHEET-377** The pools are thin placeholders until the perk thread adds rows; no preset below Veteran draws any
  today.
- **SHEET-378** **Generator rules**: a role's kind sets its rank floor (RANK\_FLOOR: combat Trained, civilian Novice; a
  beast none) (`templateRank`; NG13).
- **SHEET-379** A template a routine set with the patrol routine is for (by its TP key in RoutineSetDef.tags.role) gets
  Keen Ear (`patrols`, `templatePerks`).
- **SHEET-380** Neither the rank floor nor Keen Ear is typed into a preset any more.
- **SHEET-381** **Personality**: the theme's lean, then the role's, then the preset's own pins (only what differs), a
  later layer winning per axis (NpcTemplate.personality; NG14).
- **SHEET-382** Values strongest first: the preset's, the role's, the theme's, up to DRIVES\_SHOWN.
- **SHEET-383** A copy's every trait (not Nerve) then moves by up to ± PERSONALITY\_SPREAD (20), seeded by its ID; a
  beast gets no spread.
- **SHEET-384** The Weaver's Nerve line, types and values go on top (`presetPersonality` then personalityFrom; PL12).

#### Personality: Nerve, axes and values

- **SHEET-390** Every actor, the player included, holds points in two layers, and everything shown is read from them
  (Core.personality; src/ruleset/personality.ts; Ali, 11/11/2026, questions PL1–PL19, page "Personality Lines").
- **SHEET-391** **Nerve** (how a character meets risk): one axis from Cautious (−100) to Daring (+100) (PL1–PL4).
- **SHEET-392** Nerve leans at PERSONALITY\_LEAN (20) or more from 0, which gives three lines: Cautious, Steady (no
  lean) and Daring.
- **SHEET-393** Raw Resolve picks the tier on the line (NERVE\_TIER\_FROM: 0, 20, 40, 60, 80, 100; one ordered scale per
  line in NERVE\_LINES).
- **SHEET-394** Tiers: Cautious Skittish, Timid, Careful, Prudent, Cool-headed, Unflappable; Steady Jittery, Settled,
  Steady, Stalwart, Unbreakable, Immovable; Daring Blustering, Brash, Spirited, Bold, Fearless, Death-defying.
- **SHEET-395** Resolve 100 and up is superhuman; past it, every NERVE\_BEYOND\_STEP (50) adds a + (Ali, PL3; PL20).
- **SHEET-396** The morale level is the mood and never moves the tier (PL4).
- **SHEET-397** Names are set by the lore thread (PL18).
- **SHEET-398** **Personality** (how a character behaves): eight axes from −100 to +100, with no cap on their number, a
  library table (PA…) with a behaviour hint on each end (D-329; PL6, PL7).
- **SHEET-399** The axes: Honesty (deceitful ↔ honest), Pride (humble ↔ proud), Temper (patient ↔ quick to anger),
  Sociability (quiet ↔ talkative), Discipline (impulsive ↔ disciplined), Curiosity (set in their ways ↔ curious), Levity
  (earnest ↔ playful; from the personality voice tests), Assertiveness (meek ↔ assertive; from the Rudeus voice test,
  NX1).
- **SHEET-400** A new axis starts with no archetype target, so it shows only as a "but" and never changes which
  archetype a character gets; a target is added only when a test shows an archetype needs one (NX2).
- **SHEET-401** A line still shows at most 3 "buts" (NX3).
- **SHEET-402** Nerve stays one axis; D-204 stays parked (NX4).
- **SHEET-403** Plus up to DRIVES\_SHOWN (3) **values**, ranked strongest first, each with a hint: duty, wealth, family,
  faith, power, freedom, safety, pleasure, knowledge, kindness (VL…; PL19, PL28).
- **SHEET-404** Ali asked for more, so the list now covers all 19 values of Schwartz's refined theory (Schwartz et
  al. 2012) plus family: glory (achievement), adventure (stimulation), reputation (face), humility, nature, justice
  (universal concern), tolerance, loyalty (dependability), courtesy (interpersonal conformity), order (societal
  security) (PL28; PL29).
- **SHEET-405** The voice tests added propriety, gratitude and desire.

#### Personality: words, archetypes, buts and tensions

- **SHEET-410** **Words**: a trait under 20 from 0 is left out; 20–39 "a bit", 40–69 the plain word, 70 and up "very"
  (TRAIT\_WORDS; PL9).
- **SHEET-411** **Archetypes** are library rows with a target on the axes and Nerve (left out = 0), the values the type
  lives by, and a behaviour hint (PY…; the personality line prototype, voice-tested in the "Personality Voice Tests"
  doc; PL10).
- **SHEET-412** Archetypes: Ordinary, Prideful, Mature, Childish, Honourable, Schemer, Bully, Loner, Busybody, Free
  spirit (targets are placeholders).
- **SHEET-413** A character's archetype is the nearest row: the gap averages |points − target| over every axis and
  Nerve, plus the drive fit counted ARCHETYPE\_VALUE\_WEIGHT (2) times.
- **SHEET-414** The drive fit is 0 when the type's values are the character's top values, by DRIVE\_RANK\_WEIGHT; 100
  when none are held or the type has none (ARCHETYPE\_NO\_VALUES\_GAP).
- **SHEET-415** A tie goes to the earlier row.
- **SHEET-416** A **"but"** is a trait the archetype doesn't explain: BUT\_MIN (20) points or more, BUT\_GAP (40) or
  more from the target, and not just a weaker version of it.
- **SHEET-417** Buts go widest gap first, at most BUTS\_SHOWN (3).
- **SHEET-418** **Tensions** (TN…) are library rows of two parts that pull against each other (conditions on axes, raw
  Resolve, the best raw skill of any kind / of a fighting group / of an attacking group, the Nerve line, the life stage
  and the values).
- **SHEET-419** The agent gets the first TENSIONS\_SHOWN (2) met, in table order.
- **SHEET-420** Scaling: axes stop at ±100, so archetypes, buts and tensions are a human-range description; past 100 the
  Nerve tier keeps growing (+), and a tension's skill bar (40, 60) is simply met by every supernatural fighter.

#### Personality: what it does, where points come from and who sees it

- **SHEET-430** **What it does**: words only (PL13), except who holds back in a fight (SHEET-438).
- **SHEET-431** The Planner and Responder get one line in CHARACTER: "Nerve: Timid (keeps out of danger when they can;
  Calm right now). Mature at heart (thinks before acting, …), but very curious (wants to know how things work, …).
  Drives: knowledge first (…), then loyalty (…). Tensions: wary but dangerous (…)."
- **SHEET-432** A unique NPC's template may add hand-written signatures (if-then lines, right after Nerve) and a title
  (given with its name in CHARACTER); copies get neither.
- **SHEET-433** Any character may also hold its own signatures, after the template's (Core.signatures).
- **SHEET-434** The player sets theirs in play, one box each in the Character page's Personality pop-up, at most
  SIGNATURES_MAX (5) of SIGNATURE_MAX_CHARS (120) characters each, saved at once (Ali, 14/11/2026, SP3 a, SP4 a: "we
  will see as we go").
- **SHEET-435** The player's line goes to the Narrator and to the agent bar's In character style (player.personality,
  SP5 a).
- **SHEET-436** Both rules tell the agent which line wins when they disagree: a line written for it alone, then a
  tension, then the "at heart" line.
- **SHEET-437** The Voice gets none of it (Q1).
- **SHEET-438** Code-run NPCs are unaffected, except that the cautious Nerve line can make one hold back and never close in on a foe (D-205 b, PQ3 c, PQ16 b; "Who holds back" under Fallback behavior). Other numeric effects are a deferred item (D-205).
- **SHEET-439** **Where points come from**: an NPC template gives its points and its starting Resolve (PL11).
- **SHEET-440** The Weaver may name a Nerve line (±NERVE\_LINE\_POINTS, 40), up to two archetypes (each sets the traits
  it names to its target unless already past it) and up to three ranked values for a new actor (PL12).
- **SHEET-441** The player sets them at creation; left out = no lean (CreationBuild.personality; PL14).
- **SHEET-442** Perks, the current class and achievements add points while held; achievement chains include lower levels
  by reference (PerkDef, ClassDef, AchievementDef `personality`; PL15, PL16).
- **SHEET-443** Acting in or against character moves nothing; personalities that shift with actions are open (PL16;
  VT-OI1).
- **SHEET-444** **The player's personality in play**: narration flavour only (Ali, after playtests runs 34 and 35).
- **SHEET-445** The Narrator gets player.personality (the sheet's words) and may colour how the player's actions are
  told, e.g. a cautious character who lashes out does it with a shaking hand.
- **SHEET-446** The player's personality never changes, softens, refuses or undoes an action, and the Parser never sees
  it.
- **SHEET-447** **Who sees it**: the player sees their own on the sheet, never an NPC's (PL17).
- **SHEET-448** The Character page's Personality tile (archetype, Nerve tier and line) opens a Personality block: the
  Nerve tier and line ("Steady · Daring nerve"), the trait words, the values, and the archetype with its hint
  (src/ui/personality.ts).
- **SHEET-449** **Creation picker**: below the skill groups, a Personality section: a Nerve line picker (Cautious,
  Steady, Daring; ±NERVE\_LINE\_POINTS) with the tier the current Resolve gives, up to three values (strongest first),
  and a slider per axis (−100 to +100, step 5) showing its word live, no word for no lean (PL14; SD3).
- **SHEET-450** A line under it reads the result back as the sheet will ("Honest, proud. Values duty, freedom.
  Honourable at heart.").
- **SHEET-451** Clear resets to no lean.
- **SHEET-452** The picks carry over when the Start changes.
- **SHEET-453** validateBuild refuses points outside −100 to +100, unknown traits and more than three values.

#### Age

- **SHEET-460** Every actor of a race that ages has an age; it is descriptive, plus the old-age decline
  (src/ruleset/age.ts; Ali, 12/11/2026, Character Age AG1–AG22, page https://claude.ai/artifact/Nrx5ZkmVhdb7txGcZT4GNh).
- **SHEET-461** **Kept**: one saved number, Core.bornDay, the game day it was born (day 1 is the story's first) (AG2).
- **SHEET-462** Age = (today − birth day) ÷ YEAR\_DAYS (365), so it grows with the clock. No calendar or birthdays.
- **SHEET-463** **Life stages**: ordered scale LIFE\_STAGES (stage\_0 Child, stage\_1 Youth, stage\_2 Adult, stage\_3
  Middle-aged, stage\_4 Old, stage\_5 Venerable, stage\_6 Ancient) (AG3, AG7).
- **SHEET-464** Child describes the race's life only: no one in the game is in it (no children, D-316).
- **SHEET-465** Past Ancient each further step, the gap between the race's Venerable and Ancient starts, adds a +
  (Ancient+, Ancient++); from AGE\_PLUS\_NUMBER\_FROM (4) steps it reads "Ancient +4".
- **SHEET-466** **Lifespan on the race**: RaceDef.ageStages lists the start age of each stage (AG4–AG6).
- **SHEET-467** Human 0/13/18/40/60/80/100 from real references (adolescence, age of majority, middle age, the UN's
  older persons at 60, the oldest old at 80, centenarians).
- **SHEET-468** Elf 0/13/20/150/250/350/450 and Dragon 0/5/100/200/300/400/500 (Ali set Ancient at 450 and 500; the
  stages between are placeholders).
- **SHEET-469** A race with none is ageless (Slime): no age, no decline.
- **SHEET-470** **Old-age decline**: from the start of Old (AGE\_DECLINE\_FROM), a skill in the Melee, Ranged, Defense,
  Health, Stealth or Notice group (AGE\_DECLINE\_GROUPS) keeps 0.5 ^ (years past the start of Old ÷ (the race's Ancient
  start − its Old start)) of its effective skill (AG9, AG17–AG20).
- **SHEET-471** A human with 100 fights like an 84 at 70, a 50 at 100, and never reaches zero.
- **SHEET-472** The decline multiplies effective skill at the tier step, so raw and true skill, perks, milestones,
  All-50s and learning are untouched ("an old retired hero who still has something in him") (ageMult).
- **SHEET-473** Augments to a declining skill decline with it.
- **SHEET-474** HP reads raw Endurance and does not drop.
- **SHEET-475** A flat penalty would stop mattering past 100; a share keeps biting at any level.
- **SHEET-476** **NPCs**: at spawn code picks a stage from the template's ageStages (none: NPC\_AGE\_STAGES, Adult and
  Middle-aged) and a year inside it, seeded by the actor's ID, and saves the birth day once (AG13, AG14).
- **SHEET-477** Copies keep the birth day when refreshCopies rebuilds their skills.
- **SHEET-478** The Weaver may name a new actor's life stage in its cast entry (`age`); code picks the years.
- **SHEET-479** A stage that isn't a life stage, or one for an ageless race, is bad\_age.
- **SHEET-480** Every spawn path sets the birth day: nothing fills one in on load (MG4).
- **SHEET-481** **Player**: the creation screen's Age field, whole years from the race's youngest age (Youth start; no
  children) to its Venerable start (13 to 80 for a human); it opens on the random identity's age (SHEET-183); a build
  with no age gets CREATION\_AGE\_DEFAULT (20) or the Start's StartDef.age (AG15; no children: D-316).
- **SHEET-482** **Who sees what**: your Character card reads "Age 20 · Adult" (AG16).
- **SHEET-483** Others see only the stage they look, never the number: the who's-here row, which leaves out Adult as the
  normal case, the Narrator's actors and an NPC's view of who it sees (leaving out Adult: SD3).
- **SHEET-484** Each NPC's own agent gets "Age 31 · Adult" in self.age; the Narrator gets the player's.
- **SHEET-485** The GM view lists exact ages.
- **SHEET-486** When your stage changes as time passes, the turn says "You are now Middle-aged (age 40)".

#### Age: the youngest age per rank and no children

- **SHEET-490** **The youngest age per rank**: training years are the same for every race, so long-lived races have an
  edge (AG12 b, AG21–AG27).
- **SHEET-491** Each rank row (CONFIG.RANK_ROWS) carries `training`: Untrained 0, Novice 1, Trained 4, Veteran 8, Elite
  12, Paragon 20, then +10 per rank step (Beyond 30, Mythic 40, Transcendent 45 as a placeholder between them, Divine
  50; RANK_BEYOND_STEP) (Transcendent: D-335; AG22).
- **SHEET-492** Youngest age = the race's Youth start + years × the NPC's talent, never under the race's youngest age
  (SHEET-503); Untrained is the youngest age itself (ruleset/age.ts ageFloor).
- **SHEET-493** **Talent** is an ordered scale TALENTS (talent\_0 Common ×3, talent\_1 Steady ×2, talent\_2 Able ×1,
  talent\_3 Talented ×0.75, talent\_4 Prodigy ×0.5; multipliers in CONFIG.TALENT_MULT).
- **SHEET-494** Past the last row each step multiplies by TALENT_BEYOND_MULT 0.5, so it never reaches zero, and the name
  gains a +.
- **SHEET-495** Able ×1 is a real professional's pace (AG24).
- **SHEET-496** An NPC's talent is the Weaver's cast `talent`, else its preset's (NpcTemplate.talent), else its theme's
  (ThemeDef.talent), else CONFIG.NPC_TALENT_DEFAULT (Able) (AG25).
- **SHEET-497** Talent is saved once at spawn and the GM view shows it beside the age (Core.talent).
- **SHEET-498** The age roll never goes under the floor: a stage wholly under it rolls inside the stage that holds the
  floor instead.
- **SHEET-499** A Weaver stage wholly under the floor is refused (`bad_age`, with the youngest age in the message) and a
  talent off the scale is `bad_talent`.
- **SHEET-500** The Weaver's template catalog lists each preset's `youngestStage`.
- **SHEET-501** Talent only sets the age floor; the player has none and is never held to the floor (AG26; AG27).
- **SHEET-502** A Common human reaches Elite at 49 and Paragon at 73; an Able human Trained guard is at least 17.
- **SHEET-503** **No children**: no one in the game, player or NPC, is younger than the start of CONFIG.YOUNGEST\_STAGE
  (Youth: 13 for a human or an elf, 5 for a dragon) (ruleset/age.ts youngestAge; D-316).
- **SHEET-504** Teenagers stay (Ali chose "Allow teens from 13 again").
- **SHEET-505** Every age floor, NPC age roll, creation range and random identity starts at the youngest age.
- **SHEET-506** A Weaver stage wholly under the youngest age is bad\_age ("there are no children"), and its age field
  leaves out Child.
- **SHEET-507** Every agent's fixed prompt says the world has no children.
- **SHEET-508** On load, an NPC under the youngest age (after a library change) leaves the world; links to it are
  dropped like any missing actor's (save/checks.ts dropChildren).
- **SHEET-509** A player can't be made under the youngest age, so is never touched (MG4).
- **SHEET-510** The Child role (RO10), the village child preset (TP6) and the "old head on young shoulders" tension
  (TN3) are retired.
- **SHEET-511** Turned down: faster learning for the young, dying of old age (faster learning: AG10; dying of old age:
  AG11).
- **SHEET-512** Parked: slower ageing from power, revisiting training years past Paragon, talent and learning speed
  (slower ageing: D-222; training years: D-223; talent and learning speed: D-224).

#### Templates

- **SHEET-520** **Slime template** (first build): a copy of race Slime (body type amorphous) with no class, role beast,
  theme wild beasts, rank\_0 (level from its skills, SHEET-253), Resolve 50 and no personality points (Steady; slimes are no longer fearless)
  (BR7: the Slime class is gone; AB19 a: slimes smell, not feel).
- **SHEET-521** Slime skills: slam 30 and scent 50 (minimums; AB16, AB19 a), dodge about 9 (beast Low band), everything
  else 0.
- **SHEET-522** Slime HP multiplier 0.6 (30 HP).
- **SHEET-523** The slime's slam uses the slam class: damage 20, hit +10, reach 0.
- **SHEET-524** **Village templates** (first build; every number a placeholder). All three are copies of race Human
  (body type humanoid); the guard carries the Guard class (SHEET-121), the trader the Trader class (PY2), and the
  patron none.
- **SHEET-525** **Template rules**: anyone with fighting experience (guard, thief) is at least level 4, and a villager
  at least level 2 (Ali, 08/11/2026).
- **SHEET-526** A template can list perks (`perks`) that every NPC made from it has.
- **SHEET-527** Any template that patrols (its role has a routine set with the patrol routine), now and later, has Keen
  Ear, given by the generator, and a test enforces it (NG13).
- **SHEET-528** Copies follow their template live: on load, each copy's skills are rebuilt from the layers above, and
  missing template perks are added (`refreshCopies`).
- **SHEET-529** Rolled NPCs keep what they rolled.
- **SHEET-530** A guard (soldier, town watch, Trained) has about melee\_medium 50, block 50, medium\_armor 50, endurance
  40, eyesight 40.
- **SHEET-531** Every template carries the skill its loadout asks for, and a test checks it (AR9; EQ5).
- **SHEET-532** **guard:** soldier, town watch, rank\_2 (level from its skills, SHEET-253), Keen Ear (it patrols); minimums
  melee\_medium 50, medium\_armor 50, block 30, dodge 20, eyesight 40 (BF17 b), earshot 30, intimidation 30, persuasion 20; Resolve 50, Discipline 40
  (soldier), value duty (town watch) \[Proposed\]; control agent.
- **SHEET-533** The guard's loadout is arming\_sword, mail\_hauberk, round\_shield: the guard blocks with a shield
  again, not Parry (Ali, 13/11/2026).
- **SHEET-534** **trader** (the barkeep): talker, village folk, rank\_1 (level from its skills, SHEET-253); minimums eyesight 25, earshot 25, barter
  40, persuasion 30; Resolve 30, Nerve −40 (village folk), Sociability 20 (talker), values wealth, family \[Proposed\];
  no loadout; control code.
- **SHEET-535** **patron:** worker, village folk, rank\_1 (level 2); minimums unarmed\_strike 20, sight 20, persuasion
  30; Resolve 30, Nerve −40 (village folk), Sociability 20 (worker), values pleasure (its own pin), family \[Proposed\];
  no loadout; control code.

#### Open discrepancies

The points the split listed were settled on 20/11/2026 where a later recorded decision and the code agreed (PR "Spec:
settle actor-sheet discrepancies"). What is left is for the owner; until the owner rules, the code decides what the game
does (`AGENTS.md`, Order of authority).

- **SHEET-166 and the Unwritten Legend story line (D-417):** the late bloomer's recommended build meets the hand axe
  (SHEET-176), so it opens armed, while its class story says it starts "in rough clothes with empty hands"
  (src/library/data.ts, CL.late_bloomer).
