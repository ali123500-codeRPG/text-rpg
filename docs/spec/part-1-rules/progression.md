### 5. Progression

XP, defeats, ratings and power, achievements, quests, levels and classes, perks and the All-XXX steps. Each rule
starts with a stable ID (PROG-nn) that code, tests and reviews cite; a number is never reused. Provenance (owner, date,
question IDs, BG/D numbers) sits in one trailing parenthesis.

- **PROG-10** XP drives levels and perks only. Skills grow separately, through skill improvement (section 6).

#### What XP is: the Thread

- **PROG-20** This is backstory: no NPC or agent knows it, and nothing in play shows it (no renamed "XP", no level-up
  flavor). It is the design lens for deciding what gives XP and why (Ali, 09/11/2026, XP lore XL1–XL3).
- **PROG-21** Every life is a thread in the world's weave. Skills are the body's craft: they grow by use and stop at the
  mortal limit (100). XP is thread, not practice.
- **PROG-22** Overcoming someone ties the part of their thread that their training wound into yours, so defeat XP is the
  worth of the foe's skills. Hitting them, or their yielding, is the touch that ties it. A foe that flees, or one downed
  by someone else, slips away.
- **PROG-23** A thin thread adds little to a thick one (taper). The weave doesn't care whose thread it is, so stance
  doesn't matter.
- **PROG-24** A great deed knots your own thread: achievement XP.
- **PROG-25** Classes are patterns a thread can follow. A class's top level is a pattern with only so many turns, and
  its capstone closes it. Banked XP is loose thread waiting for a pattern, and Commoner is the plainest pattern, always
  open. Unwritten Legend and A Nobody are threads not yet woven.
- **PROG-26** It is felt, never seen (no glowing strings), and nobody can see another's thread. Beyond the mortal limit
  (D-6) can hang off it: the body stops at 100, the thread doesn't.
- **PROG-27** **The examiners.** Backstory like the Thread: no agent is told and nothing in play names them. "Above the
  gods, unseen examiners grade every hero. The report card is their mark; echoes are heroes they send out again. They
  never touch the Thread. No one knows of them." (D-351, Ali TS9 a, wording IL7 b, 16/11/2026)
- **PROG-28** **Test for any new XP source:** does it overcome someone, so their thread joins yours, or is it a deed big
  enough to knot your own? If neither, it teaches through skill marks and gives no XP.

#### XP

- **PROG-30** Three sources, defeats, achievements and quests, each logged on the source trail as {source, amount, turn}
  (B8) (Ali, 07/11/2026, XP proposal X1–X10; all numbers *placeholders*, kept small at first).

#### Defeats

- **PROG-40** Defeats are no longer the main source of XP: achievements (below) contribute greatly, and a single one
  often pays more than many defeats.
- **PROG-41** An NPC pays once (B4), whatever its stance (RS7), when it is downed and the player hit it at least once,
  or when it surrenders to the player or breaks (flees) while fighting the player: a morale break is a defeat, as for
  the player (CS2, Ali 12/11/2026; both turn its stance toward the player to yielded).
- **PROG-42** Companions' defeats wait for companion XP.
- **PROG-43** The amount comes from stats only (X18–X23, Ali 07/11/2026; Danger was dropped).
- **PROG-44** Defeat XP reads each skill's **group** (Ali, 10/11/2026: there is no separate XP category): a skill counts
  in its first group (`groupsOf`), so attack skills count in Melee or Ranged, dodge and block in Defense, endurance in
  Health, the senses in Notice, stealth skills in Stealth and speech in Influence.
- **PROG-45** Riposte and Blade Dance (formerly Slip Counter) join the Melee and Defense groups directly (D-158) and
  count in Melee. Filching (the Sleight group, FL1) counts like Stealth; Handiwork (the Survival group, D-89) counts for nothing in a fight.
- **PROG-46** A skill's worth is SKILL\_RATING\_AT\_50 (23.1) × (s ÷ 50)^SKILL\_RATING\_POWER (2), so doubling a skill
  makes it worth four times as much, with no cap; s is the **true** skill × its tier multiplier (LF16), for the player
  and foes alike (Ali, 12/11/2026, LF15; it replaced the old training-effort curve, which assumed 100 was the top and
  went flat from 98).
- **PROG-47** Within each group the worths are ranked high to low and count at 1, ½, ¼….
- **PROG-48** The foe's **rating** is the sum over groups × the group's XP factor. XP factors are an ordered scale
  (XP\_FACTORS: None 0, Quarter 0.25, Half 0.5, Three quarters 0.75, Full 1; CONFIG.XP\_FACTOR\_MULT), and each group
  names its level (CONFIG.XP\_GROUP\_FACTOR): Melee, Ranged, Defense and Health Full, Stealth Three quarters (Ali,
  10/11/2026), Notice Half, Influence Quarter, Speed None.
- **PROG-49** Melee and Ranged are separate pools, so a foe strong in both counts both in full.
- **PROG-50** Since round 13 of "Skill groups as ratings" (GR45) this skill part is read off the reference fighter at
  the actor's combat level, and gear counts through the combat level, no longer by its coin (see Skill groups as ratings
  below).
- **PROG-51** **Levels in the rating:** every rating, the player's included, adds LEVEL\_RATING\_SHARE (0.02, a balance
  lever) × what the XP curve asks to reach the actor's level from 0 (`xpToReach`, the sum of `levelCost` for every step;
  xpToNext asks the same `levelCost`, so changing the curve changes both) (Ali, 10/11/2026, option B).
- **PROG-52** An NPC's level is its template level; the player's is its full character level, free and bonus levels
  included (Ali). With LEVEL\_XP 100 and LEVEL\_XP\_EARLY 4.75: level 4 adds 41, level 10 adds 138, level 20 adds 444.
- **PROG-53** Defeat XP = foe power × min(1, DEFEAT\_XP\_TAPER (2) × foe power ÷ player power) × DEFEAT\_XP\_MULT (1,
  X20), each power taken as its side joined the fight (GR44).
- **PROG-54** All numbers are *placeholders*, to be tuned later (X19). Example against the test village's player (power
  104): a slime (power 38) gives 28 XP, a guard (power 292) 292; worked out from the code, so they move with every
  placeholder.

#### Skill groups as ratings

- **PROG-60** Every skill group, and each compound row of groups (CONFIG.RATINGS: Melee strength = Melee + Health,
  Ranged strength = Ranged + Health, Toughness = Health + Defense, Agility = Speed + Stealth, Presence = Influence +
  Will, Senses = Notice; names in RATING\_NAMES), has a rating in skill points: each skill's worth on the curve above,
  highest first at 1, then × RATING\_SHARE\_STEP (½) per place, summed into a pool and read back as 50 × (pool ÷
  SKILL\_RATING\_AT\_50)^(1 ÷ SKILL\_RATING\_POWER), so a lone skill rates itself and breadth adds at most ×1.41 (GR1)
  (Ali, 18/11/2026, GR1–GR39 on the Questions hub page "Skill groups as ratings"; src/ruleset/ratings.ts).
- **PROG-61** A skill counts in every group it names, each skill once in a compound row (GR35, GR36).
- **PROG-62** A check's rating pools effective skill with stand-ins off (GR2: true × tier, gear lines, augments, age);
  `own` leaves the item lines out, and the gap is the gear portion (GR8).
- **PROG-63** An action that needs strength takes the best kind × its share (CONFIG.STRENGTH\_KINDS; breaking: Melee
  strength 1, Ranged strength 0.5, placeholders, GR11); the breakable-walls design reads it.
- **PROG-64** Rating checks mark nothing for growth (GR25 c).

#### Power, with combat level as one equation

- **PROG-70** Power = the level part + the combat part + the non-combat part; coin no longer counts (GR45; the rebuild
  is a *placeholder*, round 13 GR40–GR45).
- **PROG-71** *Combat level:* src/engine/combatLevel.ts works out the level L of the standard soldier (the reference
  fighter, CONFIG.MODEL\_REF\_*: a human with Medium weapons, Parry, Endurance, Medium armor, Resolve and Battle sense
  at L) the actor fights evenly, from one equation and no staged fight (CE1, CE9).
- **PROG-72** A fight is even when each side needs the same time to defeat the other: **seconds to defeat = blows to
  defeat × seconds a blow**, **blows to defeat = the other's health × nerve ÷ the average blow**, and **average blow = Σ
  chance × max(0, ladder × damage × armor share − soak)**.
- **PROG-73** The average is exact: every pair of tiers the two rolls can give, by its chance (every d100 face once,
  tiers with no end; tierOdds in src/ruleset/expect.ts on the ruleset's own roll set-ups), moved by the ruleset's own
  gap shifts (gapShiftsOf: a heavy weapon against parry and block, Turn Aside, Slip the Blow), read on the defense's gap
  ladder, on every body part by how often it is hit, through the damage step's own armor (armorLayers and throughArmor
  in src/ruleset/index.ts, the attacker's armor pierce, Thick Hide, Fighter's Frame).
- **PROG-74** An attack under a Near Miss never lands. Each side uses its best attack. The actor is rated as drawn:
  of every most-full set of the weapons and shields it carries that its grips can hold, the one that rates highest is in
  hand, so sheathing or drawing never moves its combat level or power (PQ4 a, BG-1583).
- **PROG-75** The level is the L where the two times are equal: the code halves between whole levels (the soldier's
  sheet at a whole level is read once per library) and reads the balance on a straight line between the two whole levels
  it lies between; never below 0, with no ceiling.
- **PROG-76** Nothing is measured at one level and used at another, so the soldier comes out at its own level at every
  level whatever the rules are, and the equation has no lever of its own (the pivot and its weights are gone).
- **PROG-77** Nerve = the average share of its health an actor loses before it is out (Down, or Broken by a health fear,
  from its Resolve roll's odds; 1 from about Resolve 60).
- **PROG-78** A blocker's shield first takes the blows it blocks (gap HIT\_GAPS.shieldFrom and up; Iron Rim, Shield
  Breaker) until its pool is gone, and the blocker is then read with the defense it falls back on without it.
- **PROG-79** Range: an attack that outreaches the soldier's lands 1 + (reach past the soldier's) ÷ (the soldier's run
  speed × the seconds the soldier needs) times its blows.
- **PROG-80** The reference carries *relics* of an arming sword and a mail hauberk whose requirement is L itself, every
  stat that scales with need following it (ItemDef.relicNeed, the equations in src/library/gearScale.ts that the library
  and minted gear share: armor soak, shield pool, weapon damage), so it meets its kit at every level and a fighter in
  standard kit rates at its kit's level (sword and mail at 50 rate 50) (GR40).
- **PROG-81** Cached by sheet (what is in hand is not part of it); a new sheet costs a few thousandths of a second for
  each set of weapons and shields it could hold.
- **PROG-82** *Left out:* reaction time, threats, wound and morale penalties on rolls, damage to single parts and the
  limits on where a blow may land, parry strike-backs, fatigue and situational modifiers; a missile is rated as if the
  soldier could parry it (CE3) (parked, D-400 and D-401).
- **PROG-83** *What the rules give* (CE6: left as the rules have it): health and armor outweigh weapon skill; on the
  level-50 soldier +30 sword is worth +4.3 levels, +30 Parry +4.2, +30 Endurance +9.2, no mail −11.3 and plate for mail
  +28.
- **PROG-84** *Scaling:* the soldier is exact at every level; fights between equal soldiers last 15 s at 25, 16 s at 50,
  17 s at 75, 18 s at 100, 19 s at 150, 20 s at 200 and 19 s at 400, and fall slowly past that (11 s at 1000) as damage
  and soak, both straight lines in the requirement, outgrow health's fixed 50.
- **PROG-85** *Combat part* = what the old skill part (ratingGroups below, its XP factors included) gives the reference
  at L, so a guard keeps about today's power.
- **PROG-86** *Non-combat part:* Σ over Stealth, Notice, Sleight, Medicine and Influence of the group's pool × its share
  of an equal fight (CONFIG.NONCOMBAT\_SHARES), each share worked out from the rolls against a foe at the group's own
  rating, so it stays about the same at every level and skill counts once, through the pool: Stealth and Sleight slip
  past an equal watcher (win outright; Filching faces Sight as sneaking does), Notice catches an equal sneaker,
  Influence talks an equal foe down (a win by OFFER\_WIN\_TIERS), Medicine the share of missing health one Heal gives
  back on a roll graded at its own level (nothing below HEAL\_UNLOCK) (GR34, GR41, GR42; src/engine/nonCombat.ts).
- **PROG-87** Intimidation counts in Influence only (threats are left out of the combat level); no opening strike for
  now.
- **PROG-88** Checks pool skill lines only: weapons, armor and shields count only through the combat level and the rules
  of actions that use them (GR43).
- **PROG-89** *When it is read:* an actor's power is taken when it joins a fight and kept on its engagement until the
  fight ends (fightPower, notePower in src/engine/xp.ts); defeat XP, the stronger-foe achievements and defeat quests
  read that, so dropping a shield before the last blow changes nothing (GR44).

#### Achievements

- **PROG-100** Achievements are a major XP source alongside defeats: the first slime felled pays 169 XP (reward level I)
  where the slime itself pays about 28 (PROG-54), and Blooded Fighter (10 defeats) pays another 169 (Ali, 11/11/2026).
- **PROG-101** Each has an id and a name and is earned once (the every-10-levels achievement repeats, one reward level
  higher each time, D-179).
- **PROG-102** Library achievements are a data table that only code awards.
- **PROG-103** Per body type: 1, 10 and 100 defeats (reward levels I, II and III; ids first\_defeat:<type>,
  defeats\_10:<type>, defeats\_100:<type>; "First Slime Felled", "Slimebane", "Scourge of the Slime Hordes").
- **PROG-104** Per race (human and elf for now, identical, both humanoid; library NPCs and the player are human until
  creation offers a choice): the same counts (ids first\_defeat\_race:<race>, defeats\_10\_race:<race>,
  defeats\_100\_race:<race>; "First of Elfkind Felled", "Bane of Elfkind", "Scourge of Elfkind").
- **PROG-105** In all: 10, 100, 250 and 1000 defeats (reward levels I, II, III and IV: "Blooded Fighter", "Calamity of a
  Hundred Blades", "Harvester of the Fallen", "Thousand-Slayer, Herald of Ruin"; D-119).
- **PROG-106** Per tree, when enough of its skills (by its rating) reach 50, 100 and 150 (reward levels II, III and IV),
  one line per tree rating, grander the higher the rating: normal "Adept / Master / Grandmaster of <tree>", superior
  "Paragon / Ascendant / Transcendent Sovereign of <tree>", legendary "Chosen of <tree>", "<tree> Incarnate", "The
  Heavens Kneel to <tree>"; inferior trees earn none (D-165).
- **PROG-107** The achievements table is treated like a scale table: saves keep only the row key and what it names, so a
  rename or a new reward level edits only the table.
- **PROG-108** Each achievement has a reward level, an ordered scale like tiers: −1 to XV (D-179).
- **PROG-109** One equation gives every level its XP, for achievements and quests alike, with no top: XP = 50 × ((p + 2)
  ÷ 2)³, where p is the level's place (0 = level 0, I = 1, −1 = −1). So −1 6, 0 50, I 169, II 400, III 781, IV 1,350, V
  2,144, VI 3,200, X 10,800, XV 30,706 (CONFIG.REWARD_XP_CURVE, read only through rewardXp; REWARD_LEVELS in
  src/scales.ts; CS15, CS16; Ali, 07/11/2026).
- **PROG-110** The same equation adds a share of the earner's XP to the next level (xpToNext, read when it is earned),
  so a reward never fades as levels get dearer: share = floor + (atI − floor) × max(0, p)^power, with floor 0.5%, atI 2%
  and power 1.67 (CONFIG.ACH_LEVEL_SHARE, placeholders) (AL1-AL8 on the Questions hub page "Achievement XP: a small
  share of a level", Ali, 18/11/2026).
- **PROG-111** So level 0 and below 0.5%, I 2%, II 5.3%, III 9.9%, VI 30%, X 71%, XV 139% of a level; a scar takes the
  share of the place it pays. The library viewer and the report card read the fixed part only.
- **PROG-112** Names name what was defeated and grow grander with the feat; small feats get tame names (Ali,
  07/11/2026).
- **PROG-113** Progression keeps defeat counts per body type and race.
- **PROG-114** Kills are counted apart from defeats: a kill is the player's blow that takes someone else to Dead, and it
  stays a defeat too, so both tallies move; its chain is 1, 10 and 50 kills ("A Life Taken", "Gravefiller", "Death Walks
  Beside You"; reward levels 0, I and II), each paying +1 max morale (D-277).
- **PROG-115** Near death is read by depth, not by count: a fight survived from Critical, back up after going Down, and
  the survival roll passed (D-54), which earns "Woke Up Anyway" (reward level II, +10 max morale) (D-279).
- **PROG-116** Its twin for the mind: a fight won although your morale broke in it climbs a chain at 1, 5 and 25 ("Back
  from the Break", "Broken, Not Beaten", "Nothing Left to Fear"; reward levels II, III and IV), each level paying +5 max
  morale and one Nerve step; the fight still counts as lost for the Loser scars, as a break always does (D-294).
- **PROG-117** The reward fits the deed, as a guide for whoever proposes a row: an ordeal pays what would have carried
  you through it (max morale, death's door, rest), and a feat done with a skill may pay that skill (D-278).
- **PROG-118** New achievements come only from Ali-approved proposals (AA-108); Weaver-seeded scenario achievements (X7)
  are dropped (Ali, 07/11/2026).
  The first approved round (Ali, Questions hub page "Chronicler deed ideas: which become achievements (AA-108)",
  21/11/2026; rows in src/library/data.ts, counted in src/engine/feats.ts, quests.ts and memory.ts): Answer in Steel
  (kills on a strike back, XP only, DI1), Not One Step (fights won against OUTNUMBERED_FOES+ foes without moving, with
  branches at CONFIG.HELD_GROUND_FOES, DI2, DI20; a solo stand also earns Stand Against Many, DI21 b), Finishing Stroke
  (DI3 a), Every Last One (DI4 b, DI12 a), Paid in Bone (DI13 d), Something Gave (a branch of Wounds lived through, DI14 d)
  and Terms Under Threat (DI7 a, DI15 a). Existing rows changed: Still Swinging pays max morale (DI13), the morale-lost
  chain pays by level (DI18 a), the quest chain pays quest pay from level II (DI19 a). Dropped: DI8 to DI11. Health
  rewards for Paid in Bone and Something Gave (DI5, DI6), rewards across chains (DI22), and the levels of Not Done Yet and
  Breaker of Wills (DI14, DI17) wait on round 4 of the same page.
- **PROG-119** Earned achievements are listed on the Achievements page (the rail's Achievements tab), not on the
  character card: grouped by reward level with every group open (a heading the player closes stays closed), and clicking
  a chain opens its side panel: its current row with how it is earned, the turn it was earned and its reward, the
  earlier levels, and one line per branch with its own level and next count (src/ui/pages.ts chainDetail; D-298, TB4).
- **PROG-120** The in-game Achievements page shows no XP anywhere (AL5, Ali 18/11/2026: "it's bloat"); the play screen's
  achievement pop-up shows the XP actually paid.

#### Quests

- **PROG-130** **Quests** pay XP when done, by their reward level, from the same XP equation as achievements, two places
  higher on its ladder (CS16, CONFIG.QUEST_XP_LEVELS_UP): a level 0 quest pays what a level II achievement does, so 0
  400, I 781, II 1,350, III 2,144, IV 3,200 XP (QUEST_REWARD_LEVELS, questLevelXp), plus that level's share of the
  player's XP to the next level (AL4: one equation; quest 0 adds 5.3% of a level).
- **PROG-131** The level is picked by code from the scenario's gain grade when the quest is accepted: minor 0, moderate
  I, major II, extreme III (CONFIG.QUEST_GAIN_LEVEL); IV is kept for later story quests.
- **PROG-132** A defeat quest's XP is cut by the defeat-XP taper: min(1, DEFEAT_XP_TAPER × the counted foes' average
  power ÷ the player's power), each foe's power taken when it fell and the player's at hand-in (QX4), so easy hunts pay
  little to a strong player (QX2).
- **PROG-133** Other jobs are not cut: their reward level already comes from the scenario's grade (QX3).
- **PROG-134** Sizing quest XP to the player's level is parked (D-180). See Quests below.

#### Levels

- **PROG-140** From level n to n+1 takes LEVEL\_XP × √(n² + LEVEL\_XP\_EARLY²) XP, rounded (LEVEL\_XP 100,
  LEVEL\_XP\_EARLY 4.75, placeholders; Ali, 16/11/2026: one continuous equation, every level dearer than the one
  before).
- **PROG-141** Levels 1→2 to 10→11 cost 485, 515, 562, 621, 690, 765, 846, 930, 1,018 and 1,107, so the XP that used to
  take a character from level 1 to 10 (4,500) now takes it to level 8 (4,484).
- **PROG-142** The cost of one level bends back to LEVEL\_XP × n: +11% at level 10, +5% at 15, +3% at 20, +1% at 30.

#### Class level cap

- **PROG-150** A class's top level is set by its tier: CLASS\_TIER0\_MAX\_LEVEL (5) + CLASS\_LEVELS\_PER\_TIER (5) ×
  tier, at most CLASS\_MAX\_LEVEL (20) (`classMaxLevel`). So tier 0 tops out at 5, tier 1 at 10, tier 2 at 15, and tier
  3 and up at 20 (Ali, 09/11/2026).
- **PROG-151** When the class the next level would go to is at its top level, no level happens and XP banks
  (Progression.xp keeps growing).
- **PROG-152** Picking a class with room on the sheet takes every banked level at once (`spendXp`).

#### Commoner, A Nobody, A Somebody and Unwritten Legend

- **PROG-160** The default class, **Commoner** (`fallback`), is open (unlocked, level 0) for every new character from
  creation, whatever the Start and race, and opens again for a player whose current class reaches its top level if it is
  ever missing, so banked XP always has somewhere to go (Ali, 14/11/2026; newPlayer).
- **PROG-161** Reaching 5, its top level, unlocks the class A Nobody (ClassDef.unlockClass, Commoner 'max'), and its
  capstone **Nobody Special** gives +1 perk point, once (PerkDef.perkPoints: perk points from active perks are added to
  the unspent pool when owed, Progression.perkPointsTaken).
- **PROG-162** **Capstones never unlock classes:** a class that follows another unlocks when that class, or those
  classes, reach their top level (ClassDef.unlockClass or orUnlocks, 'max'), apart from the capstone;
  ClassDef.unlockPerk is gone (Ali, 16/11/2026).
- **PROG-163** **A Nobody** gives Quick Study at its level 1 and the capstone **Every Fall a Lesson** at 15, its top
  level: losing a contest or a defended attack by exactly one tier step marks the owner's rolled skill (and the asked
  skill when a stand-in rolled), inside the learning window or not (Ali, 09/11/2026; its Start was removed, CC3).
- **PROG-164** **A Somebody** sits between A Nobody and Unwritten Legend: tier 3 (Renowned, top level 20), it unlocks
  when A Nobody reaches 15, its top level, with no skill road (CB7) (CL13; Ali, 16/11/2026, CB1 to CB7).
- **PROG-165** Its level 1 perk **Late Bloom** (PK157) gives a marked skill two improvement rolls, each with its own
  gain, while its raw value is below LATE\_BLOOM\_SHARE (0.5, placeholder) × the owner's highest raw skill
  (PerkDef.improveRolls.belowShare), so it keeps working as skills grow: best skill 50 covers skills under 25, 100 under
  50, 200 under 100.
- **PROG-166** Its capstone is parked (D-360).
- **PROG-167** Reaching A Somebody 20 also unlocks **Unwritten Legend** in play (CB3); its Start stays the fast way in.
- **PROG-168** Unwritten Legend's own level 1 perk is **Any Road Will Do** (PK158): the stand-in share of every function
  is +UL\_STAND\_IN\_ADD (0.2, placeholder; PerkDef.standIn with no function named), so 0.3 becomes 0.5, kept within 0
  to 1 (Ali, 16/11/2026, UL1 a).
- **PROG-169** A skill never trained, stood in for by a related skill at 40, 100 or 200, counts 20, 50 or 100 instead of
  12, 30 or 60.
- **PROG-170** Quick Study is A Nobody's level 1 perk alone (UL2 a). A class perk the character already has is not
  granted twice.

#### Alternate capstones

- **PROG-180** A class's capstone (ClassDef.capstone, the default) is granted when the class reaches its top level, not
  at a flat 20 (Ali, 09/11/2026).
- **PROG-181** A class can also list alternates (ClassDef.capstones), each with conditions in the tree-access form (Must
  / Either of / Blocked by), which can name a race, race tag, body type, class level, perk or a true skill (kind
  'skill').
- **PROG-182** When the class reaches its top level, every alternate whose conditions hold at that moment is offered
  (Progression.capstoneOptions).
- **PROG-183** While an offer stands, the default is granted dormant (inactive). On the character sheet the player
  either keeps the default, which makes it active (`keepCapstone`), or picks one of the offered alternates in its place
  (`swapCapstone`); either choice is final. With nothing on offer the default is active at once.
- **PROG-184** The alternates themselves are designed in the capstone thread.
- **PROG-185** There is one XP bar. A level goes to the class picked in the class tree, or else to the current class
  (X9; settles OQ-8). The pick may be an unlocked class or a previous one below its top level (D-65), made before the
  level-up.

#### Class tree

- **PROG-190** The class circle by the name on the character card (its tip: the class, its tier, its class level and
  where the next level goes) opens a full-screen pop-up that is also the only place to pick where the next level goes (CT1–CT4, src/ui/classTree.ts).
- **PROG-191** It shows the classes the character has plus the next step from each: a class one of them opens at a class
  level (unlockClass or orUnlocks), and Commoner once the character has any class.
- **PROG-192** Each tier is a band of its own, side by side, Common on the left and Legendary on the right (CT2 b), and
  an arrow joins each class to the class it opens.
- **PROG-193** A gold thread is the character's own path: it joins the classes they have levelled in the order they
  first took a level in each (from the level log; the start's class first, marked with the class_start icon, tip
  "Started here"; Next level here is the class_next icon, SD10), turning a link it follows gold; picking another class
  for the next level draws the next stretch dashed until the level lands (CT4).
- **PROG-194** A class not open yet is dashed and says where it comes from; a class with no outgoing link is marked Dead
  end, and one whose perk opens every class (Write Your Own Ending) carries the class_any icon with that tip.
- **PROG-195** Clicking a class opens its card (story, tier, level, level perks, capstone, opens from, leads to) with
  "Next level goes here" on any class the character has that is not previous and below its top level; picking it sets
  the next class and takes every banked level at once (`spendXp`).
- **PROG-196** While a scenario runs the level waits for its ending moment (EG8). With mechanics shown, the turn lists
  "+n XP (source)" and "Level n!".

#### Level perks

- **PROG-200** One perk point on every even level (PERK_POINT_EVERY 2; perkPointAt in src/ruleset/levels.ts, which NPC
  spawn reads too), spent on perks.
- **PROG-201** Some perks are trade-offs (e.g. give up a skill for a higher cap, faster training and bonuses to class
  skills); these come later, on their own tab (S6).

#### Skill ladders

- **PROG-210** Every skill has a perk at each 20 points of true skill (PERK\_MILESTONE\_EVERY), with no top (CS11):
  perks are written for milestones 20, 40, 60, 80, 100, 120 and 140, and a milestone past the last written perk shows as
  reached with no perk yet (D-293 will make them rarer past 140) (Ali, 07/11/2026, perk page S1–S9).
- **PROG-211** Reaching a milestone unlocks its perk; taking it costs one perk point (S2).
- **PROG-212** Milestones 20, 60, 100 and 140 give a perk that adds a new ability; milestones 40, 80 and 120 give a perk
  that raises numbers, with the same +5 true skill in its skill and +1 in its group at 40 and 80 (Ali, 12/11/2026, LF13;
  the older +5/+10/+15 example was a mistake); a 120 perk gives shares instead, HIGH\_PERK\_SHARE of its skill to itself
  and HIGH\_PERK\_SPREAD of it to its group, with no +1, since the group share already covers it (D-258).
- **PROG-213** A perk is kept if the skill later drops below its milestone (S4).
- **PROG-214** **Milestone gating:** a milestone shows only once enough ladder perks have been taken in that same skill:
  60 and 80 need one (from 20 or 40), 100 and 120 need two, 140 needs three, and the pattern goes on (160 three, 180
  four …, ruleset perksNeeded). Until then it stays sealed like an unreached one. All-XXX perks do not count (Ali,
  07/11/2026).

#### The 20/60/100/140 perks and the 40/80/120 perks

- **PROG-220** Docs call each perk by its milestone: "20 perk", "40 perk" and so on. The 20, 60, 100 and 140 perks add
  an ability; the 40, 80 and 120 perks raise numbers (Ali, 08/11/2026, F1–F5).
- **PROG-221** A 40/80/120 perk has no conditions. A 40 or 80 perk gives +5 true skill in its skill, +1 true skill in
  its skill and in every other skill sharing a group with it (docs/skill-tags.md; Ali, 12/11/2026, LF1: the group, not
  the function), so +6 in its own skill; a 120 perk gives shares in their place (PROG-212). Each also gives one more
  number: one of the skill's own numbers, or +10 true skill on skills that work well with it (+10 to one, or +5 to two).
- **PROG-222** Numbers stay on theme (light weapons get hit and aim, heavy weapons get damage), and a 40/80/120 perk
  never repeats what a 20/60/100/140 perk gives.
- **PROG-223** A perk's numbers may work with more skills than its own (PerkDef.numbersFor), or with every attack of one
  kind whatever skill rolls it (PerkDef.numbersForAttack, "melee in general" and "ranged in general").
- **PROG-224** The kind comes from the attack mode: a ranged-tree mode (a shot or a throw) is ranged, every other mode
  (weapon, unarmed, improvised and natural attacks) is melee, so a thrown dagger counts as ranged even though it rolls a
  melee weapon skill.
- **PROG-225** Keen Edge (+10 hit) and Heavy Hand (×1.2 damage) work with every melee attack; Steady Draw (+5 hit, ×1.1
  damage) and Armor Piercer (armor stops 2 less) with every ranged attack.
- **PROG-226** The 40, 80 and 120 perks are in src/library/boostPerks.ts. Most 80 and 120 perks are not written yet
  (written: Deep Lungs at 80; Bottomless and Chorus at 120). An 80 perk keeps the 40 perk's +5 own skill and +1 group
  true skill, a 120 perk its shares (PROG-212), and the one more number of either can differ from the 40 perk's. The
  rest stay empty until each skill's own perk round (LF14) (LF2, Ali, 12/11/2026; D-258; SH1–SH4).
- **PROG-227** Ladder perks are level perks (OwnedPerk source 'level'). Content is chosen milestone by milestone; the
  chosen perks and the bank of perks kept for later are in docs/perks.md.

#### Two views

- **PROG-230** Every perk has a Story write-up (what a player reads when choosing) and exact Rules (what code applies,
  the basis for building it), and the two must say the same thing (Ali, 07/11/2026).
- **PROG-231** Both live in src/library/perks.ts, and docs/perks.md is generated from it.
- **PROG-232** On the Perks screen the player switches the perk card between Story and Rules. A perk that is written but
  not coded yet (built: false) shows both views but can't be taken.
- **PROG-233** Most perks are always on and apply when their condition is met; a few are moves chosen on a turn (G1).

#### Quirks and innate perks

- **PROG-240** **Quirks:** a perk that is negative in nature is called a quirk (PerkDef quirk: true). None are designed
  yet (Ali, 08/11/2026, name for now).
- **PROG-241** **Innate perks and quirks:** each race can list any number of innate perks and innate quirks (RaceDef
  innatePerks, innateQuirks). Every member of the race, player or NPC, has them from spawn as owned perks with source
  'race' (Ali, 08/11/2026).
- **PROG-242** They cost no perk point, can't be undone and don't count toward milestone gating. The Perks screen lists
  them under Innate. Human and Elf have none yet.
- **PROG-243** When Human and Elf perks are picked, AGG's origin perks are the models (Ali, 08/11/2026, AGG comparison
  A4).
- **PROG-244** Riposte (Swordsman) has ladder perks (its 60 perk is Answer the Blow) and blade\_dance mirrors it;
  the slime senses get none (G3).

#### All-XXX perks

- **PROG-250** **All-XXX perks** (All-50, All-100, All-150; formerly mastery perks, renamed by Ali on 07/11/2026; the
  save key stays `mastery`) are granted instantly, at no point cost, when enough skills of a tree reach 50, 100 or 150
  (by its rating, D-164); the steps go on every ALL\_STEP\_EVERY (50) points with no top (CS11), a step past All-150
  having no perks written yet.
- **PROG-251** All three steps work alike: the tree's passive for that step plus each of those skills' part
  (src/library/allPerks.ts ALL_BUNDLES, STEP_PARTS) (D-197).
- **PROG-252** Once granted they are never removed. They replace the LLtQ category bonus.

#### All-XXX check

- **PROG-260** The check runs at scenario end, when achievements are also granted, and both show in one scenario-end
  gains moment (its animation is with the motion work). It uses true skill (S9); the number of skills needed comes from
  the tree's rating (D-164) (Ali, 12/11/2026, LF3).
- **PROG-261** Built (D-226, CONFIG.GROWTH\_AT\_SCENARIO\_END): while a scenario runs, the player's All-XXX check is
  skipped at turn end and grantAchievement queues the player's achievements on Progression.pendingAchievements; when the
  scenario ends, closeScenario grants the queue and runs the check (src/engine/growth.ts flushGrowth).
- **PROG-262** A queued achievement keeps the turn it was reached on, and its line names that turn, not the turn it was
  handed over (BF60).
- **PROG-263** In free roam they wait for the next scenario's end too, and its gains moment counts the roam's XP
  (BG-217, Ali, 14/11/2026).
- **PROG-264** Every event roll opens a scenario, so what it earns (the event-roll critical chains) waits for that
  scenario's end even when no scenario runs yet, at the story's opening or after a story beat closed the last one
  (BG-272, xp.ts forScenarioAhead).
- **PROG-265** NPCs are checked every turn.
- **PROG-266** The ending turn's narration line carries one gains summary, LogLine.scenarioGains (ScenarioGains: skill
  raises with from and to, milestone unlocks, All-XXX perks, achievements, the XP bar from and to, level-ups), gathered
  across the scenario on ScenarioFrame.gains each turn; an outer scenario that ends with its inner one sums both.
- **PROG-267** That line leaves out its own achievement, unlock and level-up notes, since the summary shows them.
- **PROG-268** With 100 as the mortal limit, the All-150 tier is unreachable through training alone until workaround
  mechanics are designed.
