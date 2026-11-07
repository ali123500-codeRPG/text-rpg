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

- Combat – Melee: light weapons, medium weapons, heavy weapons
- Combat – Ranged: light ranged, medium ranged, heavy ranged
- Combat – Unarmed: strike, grapple, improvisation; they behave the same for now (Part 5 §5). Improvisation is fighting with whatever is at hand: improvised weapons (Part 5 §7) roll it (Ali, 07/11/2026). Natural weapons is a creature-only skill outside every player tree (creatures' natural attacks roll it)
- Combat – Defense: dodge, block, endurance

Endurance sets total HP (Part 3, Total HP). An average fighter has 50 in a combat skill; this is the design reference point. All-XXX perks apply to these trees as to any other.

**Other skill trees** (placeholders; each is its own tree):

- Perception: sight, hearing, and a third skill not chosen yet. Both are tagged with the Sense role.
- Stealth: skills not set yet. Sneaking waits for this tree (Part 2, Explore mode).
- Speech: persuasion, intimidation, barter. No body-part role.

The trees' skills are designed with character and mob generation. A perception roll uses sight for an event perceived by sight and hearing for one perceived only by sound (the cue from computePerception); when both apply, the higher. Combined checks (sight with hearing) are to be explored later.

**First-build skill list.** The first build has these skills, by id: melee\_light, melee\_medium, melee\_heavy; ranged\_light, ranged\_medium, ranged\_heavy; unarmed\_strike, unarmed\_grapple, unarmed\_natural; dodge, block, endurance; sight, hearing; persuasion, intimidation, barter; plus the class trees (Swordsman: feint, riposte, disarm; Slime: tremor, taste). Perception's third skill and Stealth are left out of the first build. Every skill here except the Slime tree is open to the player's point-buy (Part 4 §4). Natural attacks and fallback.attackSkill name one of these ids.

**Skill substitution.** Any roll or check may use another skill that shares a function with the named skill (Skill functions, below) at reduced efficiency: that skill's effective skill × SUBSTITUTE\_EFFICIENCY (placeholder 0.5). Code computes every candidate and uses only the highest value after efficiency. Example: intimidating with intimidation 20 and persuasion 60 uses persuasion at 30. The named skill counts at full value, and the roll is recorded against the skill actually used.

**Skill functions**. Each skill's library entry lists its functions, and a skill may have several. First build:

- Melee attack: melee\_light, melee\_medium, melee\_heavy
- Ranged attack: ranged\_light, ranged\_medium, ranged\_heavy
- Unarmed attack: unarmed\_strike, unarmed\_grapple, unarmed\_natural
- Defense: dodge, block
- Notice: sight, hearing, tremor, taste
- Influence: persuasion, intimidation, barter
- No function yet: endurance (never rolled; it sets HP), and feint, riposte and disarm (no effects designed yet)

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
- **Effective skill** (computed for every check and roll, in order): true skill → + gear → + combined-check perks → + situational skill perks → apply hard cap → apply conditions.

Derived, never saved; the Character page shows true skill, with raw skill beside it when they differ.

Gear is a flat bonus to effective skill unless an item says otherwise. Standard kit (an average fighter's minimum equipment) gives one +25 per roll, shared by all kit pieces: pieces never stack (*placeholder*).

Wounds are no longer part of effective skill: the health-track level and body-part role penalties are a roll modifier type (§4, Combat rolls). They apply to rolls only, never to no-dice checks (settles OQ-15, Ali, 07/11/2026).

**Character fields:** defined in Part 4 §4 (a Core every actor has, plus Progression, Mind and Journal modules). Part 4 adds race, creature type and classes.

### 4. Resolution

The dice deal the hand; skills and perks decide what the character can do with it.

**Layer 1 — situation roll.** Rolled once per scene, for the player, at scene setup (Part 2, Scene setup). It deals the hand: it decides the who and what of the scene (its event, cast, challenge and gain), not how alert anyone is. Code reads it with a fixed base in place of skill (SITUATION\_BASE, *placeholder*, 50):

```
margin = d100 + SITUATION_BASE + net modifiers − 100
```

Only three sources may modify the roll, each its own modifier type: perks, gear and statuses (blessings, buffs, curses, debuffs) whose library entry names the situation roll. A gear effect counts only when its library entry names the situation roll; it may be active while only carried (Part 5 §2). Code reads the player's inventory once, at scene setup step 2. Injury, place, difficulty, skills, terrain and tactics never modify it. With the placeholder base, the totals (d100 + net modifiers) read as follows:

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

**Scale keys.** Every ordered scale (tiers, band tactics, zone light and cover, stance, and in turn the others) has one table in `src/scales.ts`: a row per level, lowest first, each a stable key and its display name. Code and saves use only the key, a level's order is its row position, and display names appear only in text for the player and for Claude, so adding or renaming a level edits only the table (Ali, 07/11/2026). Tier keys, worst first: critical_failure, failure, near_miss, success, great_success, critical_success. Tier arithmetic (shifts, gaps) works on a tier's level, its row position; a roll shifted past either end keeps the end key plus `beyond`, the steps past it, shown as one + or − per step (Critical Success+). Saves store keys (schema v3; v1 and v2 saves are migrated on load). Schema v5 split hostile from opposed: older saves' opposed becomes hostile, so they play as before, and a logged more\_opposed step becomes colder.

Modifier types (each type diminishes within itself; values per type are deferred):

- Gear and situational skill perks: inside effective skill; flat skill perks: inside true skill (§3).
- Roll perks: flat roll points.
- Gear roll modifiers: rare noted modifiers from items, such as the weapon hit adjustment, at full value (Part 5 §3).
- Wounds: health-track level plus body-part role penalties, in roll points.
- Situational: flanking, outnumbered, unaware, terrain, range, light, dodge vs missiles.
- Aim: its own type, so it never diminishes with situational modifiers.

**Stacking within a type.** Within one modifier type, bonuses and penalties are ranked separately by size. In each group the largest counts in full, the second at STACK\_2 and the third at STACK\_3; any further ones count 0. The type's value is the bonus total plus the penalty total. STACK\_2 0.5 and STACK\_3 0.25 are placeholders. Example: bonuses +6, +4, +2 give +8.5; penalties −8, −3 give −9.5; the type adds −1.

One roll point equals two skill points; write roll modifiers small.

**Tier shifts**, applied after banding: natural edges (01 −2 tiers, 02–05 −1, 96–99 +1, 00 +2) and tier perks. They apply to attack and defense rolls, never to the location roll. There is no clamp: a shifted tier may go past Critical Success or below Critical Failure. Narration and the packet show the nearest of the six named tiers with one + or − per step past the end: ID 3 is "Critical Success+", ID 4 "Critical Success++", ID −4 "Critical Failure−".

**Gap shifts**, applied to the gap (Part 3, Damage flow): heavy weapon vs block −1, cover, and perks that add a tier to block or dodge.

The margin bands stay open-ended: a margin of 75 or more is Critical Success, never more. Only shifts move a tier past the ends.

**Contests.** Every roll with two sides (perception against stealth, an ambush roll against perception, speech against the listener) uses roll() for both sides and is read by tier difference, like the attack and defense gap: gap = the opposing side's tier − the acting side's tier, after tier shifts. The acting side wins below 0, the opposing side wins above 0, and 0 is a tie. ContestResult carries the gap; what a larger gap does is not defined yet. Modifier types are those of Layer 2b except aim, stacked the same way. Wounds reach a roll through the skill's body-part role tags (Part 3, Roles).

### 5. Progression

XP drives levels and perks only. Skills grow separately, through skill improvement (section 6).

- **XP** (Ali, 07/11/2026, XP proposal X1–X10; all numbers *placeholders*, kept small at first). Three sources, each logged on the source trail as {source, amount, turn} (B8):
  - **Defeats (main source).** An opposed or hostile NPC pays once (B4) when it is downed and the player hit it at least once, or when it surrenders. A broken (fleeing) foe pays nothing. Companions' defeats wait for companion XP. The amount comes from stats only (X18–X23, Ali 07/11/2026; Danger was dropped). Each skill carries an XP category in the library (`xpCategory`, set per skill because one tree may mix categories): offensive (attack skills and the Swordsman class skills), defensive (dodge, block), endurance (endurance, function tag hp), notice, influence, or misc (lockpicking). A skill's training effort is (100 ÷ 3) × ln(100 ÷ max(100 − s, 2)), so high skills weigh more (Part 1 §6). Within each category the efforts are ranked high to low and count at 1, ½, ¼…. The foe's **rating** is the sum over categories × XP\_CATEGORY\_WEIGHT: offensive, defensive and endurance 1, notice 0.5, influence 0.25, misc 0. Kill XP = rating × min(1, KILL\_XP\_TAPER (2) × foe rating ÷ player rating) × KILL\_XP\_MULT (1, X20). All numbers are *placeholders*, to be tuned later (X19). Example against the recommended swordsman (rating 72): a slime (rating 12) gives 4 XP, a guard (rating 46) 46.
  - **Achievements**, each with an id and a name, each earned once. Library achievements are a data table that only code awards. Per creature type: 1, 10 and 100 defeats (100, 250 and 1000 XP; ids first\_defeat:<type>, defeats\_10:<type>, defeats\_100:<type>; "First Slime Felled", "Slimebane", "Scourge of the Slime Hordes"). Per race (human and elf for now, identical, both humanoid; library NPCs and the player are human until creation offers a choice): the same counts (ids first\_defeat\_race:<race>, defeats\_10\_race:<race>, defeats\_100\_race:<race>; "First of Elfkind Felled", "Bane of Elfkind", "Scourge of Elfkind"). In all: 10, 100 and 1000 defeats (100, 250 and 1000 XP: "Blooded Fighter", "Calamity of a Hundred Blades", "Thousand-Slayer, Herald of Ruin"). Per tree, when all three skills reach 50, 100 and 150 (250, 1000 and 2000 XP, ids mastery\_50:<tree> etc.: "Adept of <tree>", "Ascendant of <tree>", "Transcendent Sovereign of <tree>"; awarded once all-XXX perks exist). The achievements table is treated like a scale table: saves keep only the row key and what it names, so a rename or a new reward level edits only the table. Each achievement (and each quest, once quests exist) has a reward level, an ordered scale like tiers: I 100, II 250, III 1000, IV 2000 XP (REWARD_LEVELS in src/scales.ts, XP in CONFIG.REWARD_XP; Ali, 07/11/2026). Names name what was defeated and grow grander with the feat; small feats get tame names (Ali, 07/11/2026). Progression keeps defeat counts per creature type and race. New achievements come only from Ali-approved proposals (D-108); Weaver-seeded scene achievements (X7) are dropped (Ali, 07/11/2026). The character sheet lists earned achievements.
  - **Quests** pay on completion by gain: 25/50/100/200. Held until quests exist (X8).
- **Levels.** From level n to n+1 takes LEVEL\_XP × n XP (LEVEL\_XP 100). There is one XP bar. A level goes to the class picked on the sheet ("Next level goes to", shown when more than one class is current or unlocked), or else to the current class, with no waiting (X9; settles OQ-8). With mechanics shown, the turn lists "+n XP (source)" and "Level n!".
- **Level perks:** one perk point on every even level, spent on perks. Some perks are trade-offs (e.g. give up a skill for a higher cap, faster training and bonuses to class skills); these come later, on their own tab (S6).
- **Skill ladders** (Ali, 07/11/2026, perk page S1–S9): every skill has a perk at each 20 points of true skill: milestones 20, 40, 60, 80, 100, 120 and 140. Reaching a milestone unlocks its perk; taking it costs one perk point (S2). Milestones 20, 60, 100 and 140 give a perk that adds a new ability; milestones 40, 80 and 120 give a perk that raises a number, such as +5/+10/+15 true skill (S5). A perk is kept if the skill later drops below its milestone (S4). **Milestone gating** (Ali, 07/11/2026): a milestone shows only once enough ladder perks have been taken in that same skill: 60 and 80 need one (from 20 or 40), 100 and 120 need two, 140 needs three. Until then it stays sealed like an unreached one. All-XXX perks do not count. The 40, 80 and 120 perks stay simple number boosts (confirmed by Ali). Ladder perks are level perks (OwnedPerk source 'level'). Content is chosen milestone by milestone; the chosen perks and the bank of perks kept for later are in docs/perks.md. **Two views** (Ali, 07/11/2026): every perk has a Story write-up (what a player reads when choosing) and exact Rules (what code applies, the basis for building it), and the two must say the same thing. Both live in src/library/perks.ts, and docs/perks.md is generated from it. On the Perks screen the player switches the perk card between Story and Rules. A perk that is written but not coded yet (built: false) shows both views but can't be taken. Most perks are always on and apply when their condition is met; a few are moves chosen on a turn (G1). The Swordsman skills (feint, riposte, disarm) are placeholders and get no perks for now (G2); lockpicking and the slime senses get none either (G3).
- **All-XXX perks** (All-50, All-100, All-150; formerly mastery perks, renamed by Ali on 07/11/2026; the save key stays `mastery`): granted instantly, at no point cost, when all three skills in a tree reach 50, 100 and 150. Once granted they are never removed. They replace the LLtQ category bonus.
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
     Skill += 1d5
     For each threshold T in (50, 100, 150):
        if old < T <= Skill: run all-XXX check for T

Clear all marks.
```

- **Marks** (Ali, 07/11/2026, "Skill progression: options" SP1–SP11): a use marks the skill actually rolled (SP4), success or failure, when the opposition is within ±MARK\_WINDOW (10, placeholder) of the user's raw or true skill (SP2), so true-skill perks widen what teaches you. The opposition is a check's target, or the other side's true skill in a contest, attack or defense; notice rolls follow the same rule (SP6). Endurance is marked by a single hit costing ENDURANCE\_MARK\_PCT (10%, placeholder) health or more (SP5). One mark per skill. Only the player keeps marks; NPC progression comes later (SP7).
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
3. Exchange slot, part 1: the engine resolves the player's speech. A speech check is the speaker against the other side: one roll by the player with the action's speech skill, contested separately against each spokesperson's roll with the same skill (read by tier difference, Part 1 §4, Contests). Talk, persuade and deceive use persuasion; intimidate uses intimidation; barter uses barter. Any of them may be substituted by another speech skill (Part 1 §3, Skill substitution). The speech event is perceived like any other event. \[Proposed\] In the first build, winning a speech contest counts only toward check\_passed secret reveals; otherwise the result is logged, and deals and prices wait for trade (D-93).
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

### Game state model

The save is the set of pages defined in Part 4. On load, the engine builds one in-memory GameState from those pages; it is never saved as one document. Positions are abstract zones. Each zone belongs to one place, and the stage may hold zones from several places. Knowledge lives on the observer: the guard's belief about the player is `guard.mind.knowledge.player`, and it can be wrong.

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

type Zone = { id: string; placeId: PlaceId; name: string; look: string;   // look: public text
              links: ZoneLink[]; cover: 'none' | 'some' | 'heavy'; light: 'bright' | 'dim' | 'dark';      // zone ids unique within a story
              groundItems: ItemInstance[] };                             // Part 5 §4
type ZoneLink = { to: string; label: string; sight: boolean; frontier?: true };
                                                   // label: how the linked zone reads from here, e.g. 'left of the gate'
                                                   // sight: true = actors here can see into `to` [Proposed]
                                                   // frontier: `to` names an area not yet built

type Belief = {
  status: 'unaware' | 'suspicious' | 'aware' | 'tracking';
  lastKnownZone?: string;
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  revealed: string[];           // facts learned about the other actor, e.g. 'has_crossbow'
};

type Fact = { id: string; text: string };

type GameEvent = {
  id: string; turn: number; actorId: string;
  kind: string;                 // 'attack', 'move', 'hide', 'speak', 'call_help', 'alarm', 'arrival', 'presence', ...
  zone: string; target?: string;
  tier?: Tier;                  // absent for actions with no check, such as a plain move or speech
  effects: Effect[];            // structured; text is built per view, never stored
  noise: 0 | 1 | 2 | 3; visibility: 0 | 1 | 2 | 3;
  perception: Record<string, { level: Perception; cue: Cue }>;   // absent = not perceived
  bark?: boolean;               // speech flavor only: narrated, copies no belief, left out of every NPC view
};

type Effect = { kind: string; actorId: string; data: Record<string, unknown> };
```

The actor fields Part 2 relies on live in Part 4's sheet: control, behavior, morale, knowledge, knows, overrides, routine, routines and alarm in Mind; bandId, posture and label on the Actor itself; secretsKnown and namesKnown in Journal. hasAgenda is derived, never stored: an actor has an agenda when it holds a secret, has a plan or has a memory note. It is computed when a dialogue call is routed, from turn-start state.

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
  noise: 0 | 1 | 2 | 3; visibility: 0 | 1 | 2 | 3;
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

Tier comes from the ruleset. Health and body parts are Part 3's health track and per-creature body parts (SavedCondition, Part 4).

```ts
type Tier = 'critical_failure' | 'failure' | 'near_miss' | 'success' | 'great_success' | 'critical_success';   // keys of TIERS (src/scales.ts), worst first; names only via tierName()
```

Six views are built from state:

| View | Sent to | Contains | Never contains |
| --- | --- | --- | --- |
| PlayerView | Agent Parser | Player sheet, current zone, zones and actors the player perceives | Hidden store, NPC beliefs, unperceived actors |
| ActorView | Code minds: routines, combat lists | The same fields as OppositionView, as structured data | The same as OppositionView |
| OppositionView | Agent Planner and Agent Responder, one per actor | That actor's condition and position, its beliefs, events it perceived (including the last few exchanges it heard), what it was told, its own last few spoken lines (SAID_LINES, so it does not repeat itself), its plan and memory note, its own secrets, its band's goals and relations; the brief of each routine in its routines list | This turn's player input (a Responder gets only the dialogue input), other actors' private knowledge, the player's true zone unless perceived, the player sheet beyond revealed, place facts and headlines, barks |
| DialogueView | Agent Voice | ActorView minus plan and memory note, plus its knows facts and the dialogue input | Hidden store, other actors' knowledge, place facts and headlines, barks |
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

1. **Flee:** the actor is broken (the ruleset's morale check). A broken actor takes this move whoever controls it, Planner included, and its Planner call is skipped. It moves one link toward its exit slot, else its refuge slot, else into a linked zone away from the nearest hostile actor it believes in. Once there, it holds. A surrendered actor (Part 3, Morale) skips the move and holds.
2. **Attack:** an active hostile actor it believes in (aware or tracking) is in its zone. It attacks with its type's attackSkill, targetPart null, aimed false. Target: the actor that last hit it, else the player, else an rng pick.
3. **Close in:** it moves one link, by the shortest path, toward the lastKnownZone of its most recent belief about a hostile actor. Never into a frontier.
4. **Search:** it is already in that zone and no hostile actor is there.
5. **Hold.**

Like every code mind, it reads only its ActorView. The rng pick uses the turn's seeded rng, so replay stays exact. Its orders carry source 'fallback'.

**Per-type data.** Each creature type, or the NPC template when it sets one, names fallback.attackSkill. Slime: unarmed\_natural; slimes have only the general area, so targetPart is always null.

The rule order is fixed in code for the prototype. Each rule is its own small check, so a per-type, data-driven rule order can replace the fixed one later (D-17). tactics does not change the list yet (D-17).

### Agent Parser

Agent Parser turns the player's free text into a structured request. It runs on the smallest fast model, sees only PlayerView, and never narrates or decides outcomes.

Output shape (notation, not literal JSON):

```
{
  move:    { toZone: zone_id } | null,
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
              talk | use_item | equip | give | other,
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
  planUpdate: { goal, steps, triggers, memoryNote,
                routine: routine_id | null } | null   // routine: next turn; null = keep the current plan
}
```

Standing defense is saved on the actor (Part 4 §4 Core gains standingDefense: dodge | block). Default: whichever of dodge and block has the higher effective skill **\[Proposed\]**.

Fixed instructions (sent as the leading user turn):

```
You play the character described in CHARACTER, in a text RPG. You decide what this one character does this turn. You never narrate outcomes and never roll dice.

You receive CHARACTER (who you are) and OPPOSITION_VIEW. OPPOSITION_VIEW holds only what your character knows: your condition and position, the zones, your plan and memory note, events you noticed, what others told you, and what you believe about the player (status, last known zone, what you have learned). It may be wrong or out of date. Other characters, even allies, know things you don't.

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

Agent Responder plays one addressed spokesperson that has an agenda (it holds a secret, has a plan or has a memory note). It runs after the Parser, on the same model as the Planner, and decides that actor's one action for the turn: a reply or something else.

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
- Never sees the hidden store. An NPC that gains a secret, a plan or a memory note has an agenda, and from then on Agent Responder voices it.

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
  situation(actor: Actor, state: GameState, rng: Rng): SituationResult;
  // Layer 1 (Part 1 §4): d100 + SITUATION_BASE + modifiers from perks, gear and
  // statuses whose library entry names the situation roll. No skill. Six tiers and
  // natural edges. Called once per scene, at scene setup step 2, always for the player.
  applyEffects(result: CheckResult | ContestResult | AttackResult, state: GameState): Effect[];
  recordUse(actor: Actor, skill: string, result: CheckResult | ContestResult | AttackResult, state: GameState): void;
  // improvement-roll timing is open; recordUse only records a use for now
}

type CheckRequest = { actorId: string; skill: string; target?: string; modifiers: { source: string; value: number }[] };
type CheckResult  = { actorId: string; skill: string; target: number; passed: boolean; modifiers: CheckRequest['modifiers'] };
type ContestResult = { a: RollResult; b: RollResult; gap: number; winner: 'a' | 'b' | 'tie' };   // a = the acting side; gap = b.tier − a.tier (Part 1 §4, Contests)
type SituationResult = {
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

check() reads its target from the scene's challenge grade (Part 1 §4, Layer 2). Ambush, detection and stealth rolls run as before. A situation roll's result is saved in the turn record; replay feeds it back with the logged Weaver output, so a replayed scene start makes no Claude call.

Perception rules:

- **Perception per event.** Computing perception after the loop gave a guard killed in step 2 knowledge of step 3, and gave a moved actor sight of events from its new zone.
- **One belief writer.** Stealth contests return results; updateBeliefs alone writes Belief, so the stealth result and the perception result can't overwrite each other.
- **Passive perception.** Every event is checked against every actor in range, whether or not that actor ordered a search. The player's own events are the exception: an observer unaware of the player perceives them only through detection (Explore mode).

**Active actors.** isActive(actor) is false while the actor is incapacitated. An inactive actor gets no order of any kind and an order it hasn't resolved is dropped. It skips desired-state evaluation, its triggers stay armed but don't fire, it counts on neither side of engagement, and it gets no dialogue call when addressed. A revived actor is active from the next turn.

Rules for simultaneous orders, because the Parser and the Planner worked without seeing each other:

- **Target moved first.** An attack resolves against the target's new zone if it is still within the weapon's reach; otherwise it becomes a wasted-action event ("swings at empty air"). Reach comes from the attack mode, in zone links with sight (Part 5 §5).
- **Moves.** A move resolves at its actor's initiative like any other action. Provisional: how many actions a turn holds is part of the action-economy discussion.
- **Same target or object.** Earlier initiative acts first; the later actor gets a contested check or a wasted action.
- **Stealth.** A hide or sneak is contested once per observer in perception range. Each result sets that observer's belief separately. A hide or sneak also sets the player's posture to sneaking.
- **Speech.** Talking is an action. A talk action resolves at the speaker's initiative and is perceived by volume and zone links, except addressed speech in a dialogue turn, which resolves in the exchange slot at the top of the turn, followed by the spokespeople's spoken replies. A bark rides on its action's event: perceived and narrated, but it copies no belief.
- **Numbers.** Tier tables, caps, perk effects and skill gains come only from the ruleset module. Do not invent or tune them here.

**First-build ruleset.** Build TIERS, situation(), roll() and attack() as Parts 1 and 3 define them, and check() and contested() as Part 1 §4 sets out. The rest works like this:

- initiative(): d100, with no skill (perks may change it later). Higher acts first. An unaware actor takes INIT\_UNAWARE (placeholder). Ties go to the seeded RNG.
- applyEffects(): attacks as Part 3 sets out. A check or a contest only changes beliefs (through updateBeliefs) and reveals secrets; it never changes an object or a place (OQ-22).
- recordUse(): writes the use to the agent log and changes nothing, so no skill changes in the first build.
- The morale check (Part 3, Morale) is roll() with Mind.morale; its outcome is saved in Mind.moraleState until the scene ends. No new interface method.

**Replay.** Each turn record (Part 4 §6) holds the RNG state before the turn, each agent's exact output and any situation roll. Replay feeds the logged outputs, not the player's text, back through the engine, and is exact only under the library version that record names. Merge Planner outputs in actor-id order, never in the order calls returned.

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
  memory: Record<string, string>;    // actorId -> rolling memory note from the Planner or Responder
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
5. **Plan updates.** A non-null planUpdate replaces that actor's plan; memoryNote replaces its memory. Updates from a turn that stopped on a clarify question are kept and apply when that turn resolves. A late Planner output is discarded whole, planUpdate included (interim; D-43).
6. **Secrets.** A secret becomes player knowledge only when a resolved event meets revealWhen: minTier is a tier key and the check must reach at least that tier (the Weaver writes the tier's name; code keeps the key), and a check\_passed reveal needs the check aimed at againstActorId. A secret is also revealed when its holder's Responder lists it in reveals; code accepts only secrets that actor holds **\[Proposed\]**. When the player's speech check against a spokesperson meets one of its check\_passed reveals, its Responder is told so (SLIPS) before it answers **\[Proposed\]**. A revealed secret is added to the player's Journal (secretsKnown); only then can it appear in NarrationView.
7. **Save.** After resolution, the story is saved as described in Part 4 §10. Hidden fields are saved but shown only in the GM debug view.

**onAlert** is not a trigger. Code fires a routine's onAlert order once, when its owner first leaves unaware of a wary actor or first perceives an attack or alarm: this turn if the owner hasn't acted and has no agent order, otherwise next turn unless an agent order exists by then. An armed flag resets when the owner is calm again: unaware of every wary actor, and DECAY\_TURNS turns with no attack or alarm perceived.

### Encounter modes

Code picks the mode each turn; agents run only when someone needs a mind. Ordinary and guarded dialogue now share one pipeline, so the mode no longer shows whether an NPC has a secret.

**Engagement** (Ali, 07/11/2026, E1). An engagement is one encounter from an actor's point of view: a fight, a negotiation, or both. It starts when any actor becomes engaged with that actor, either in a fight (active, hostile to it, and believing in it at suspicious or higher) or in talk (the two speak to each other in a dialogue exchange). It ends once no actor has been engaged with it, in either way, for ENGAGEMENT\_END\_TURNS turns in a row (config, 2). A negotiation that turns into a fight, or a fight that turns into talk, stays one engagement (Ali, 07/11/2026): once-per-engagement effects and the improvement rolls at its end happen once. A scene can hold several engagements. Effects that work once per engagement reset when a new one starts, and other rules may count engagements too. Code keeps the current engagement's start turn per actor, and which kinds it has held so far (talk, fight).

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
- **What it changes (T3):** a zone the Weaver marks `outdoor` is lit by the brighter of its own lamps or fires and the sky (CONFIG.SKY\_LIGHT: day bright, dawn and dusk dim, night dark); indoor zones keep their own light. A routine set's time tags must fit the time of day (CONFIG.TIME\_TAGS: dawn and dusk take day or night sets), otherwise it is a routine error. Shop hours come with shops (Stage 6). Routines that change mid-scene wait (D-49).
- **Who sees it (T5):** NPC views and the Narrator get `time: {day, timeOfDay}`, never minutes. No new Claude call.
- **Waiting (T6):** the Parser reads "wait until dawn" as action wait with the time of day in target (none: the next time of day), and "sleep" as action sleep (the sleep row). Code moves the clock and breaks the scene (time\_skip). A hostile in the zone or tactical mode blocks it, like rest. The turn shows "Time passes: 11 h (Day 2 · Dawn)".
- **Starting time (T8):** the Weaver's first plan names `timeOfDay`, and code sets the clock to its start on day 1. After that a plan may only name the current one (bad\_time otherwise).
- **Shown (T11):** the Play header reads "Turn 5 · Day 2 · Evening · …"; its look is the designer's.
- **Later:** travel time for long journeys (Voyage E1), NPC needs such as hunger and sleep (T10, not planned).

### Scenes

A scene is the stretch of play between two scene starts.

- **Start.** A scene starts at story start, and whenever code calls sceneBreak(cause), where cause is rest, time\_skip or story\_beat. It ends when the next scene starts. Code calls sceneBreak after the turn's resolution (Ali, 07/11/2026, P7):
  - **rest:** the player rests outside tactical mode;
  - **story\_beat:** a beat with endsScene fires, or the scene stalls: STALL\_TURNS (*placeholder*, 8) quiet turns in a row with no beat left whose owner is active;
  - **time\_skip:** the player waits or sleeps (Game clock).
  A frontier crossing in the same turn goes first; the break waits for the next turn.
- **Quiet turns and beats.** A quiet turn is one where nobody on the stage attacks, the player learns nothing new (no secret, witnessed fact or name), and no beat fires. The stage counts quiet turns in a row and resets after any other turn and at scene start. Agent Weaver seeds at least one beat per scene plan: a trigger with when quiet\_turns N, which fires at turn start once the count reaches N.
- **Stage.** A scene is played on a stage: the set of zones currently loaded. A stage can span several neighbouring places; each zone belongs to exactly one place, and an actor's place is always the place of its zone. Moving between zones or places never starts a scene.
- **Frontiers.** A stage grows through frontiers: labelled exits to areas not yet built. When the player crosses a frontier, code extends the stage (Stage extension) without a new situation roll, using the scene's tier. A place already set up in this scene is loaded, not planned again.
- **Loading** a save resumes the current scene and stage. Encounter modes are chosen per turn inside a scene. Per-scene caps (fact promotions, minted items) reset at scene start.

### Scene setup

Runs inside the turn that calls sceneBreak, after resolveTurn and before the save:

1. Resolve the player's place node.
2. Situation roll: ruleset.situation(player).
3. Agent Weaver returns a stage plan with the tier in its view: the event first, then the zones (each with its place, creating place nodes as needed) and frontiers, any new bands, the cast (each actor's band, routine set id and slot bindings, with an optional startAt, opening belief about the player, beliefs about other bands and personal stances), hidden seeds and reward refs. The tier shapes the event and cast; opening attention and beliefs are the Weaver's story choice.
4. Code validates the plan and instantiates the cast: templates, unique or copy, creature types from the database.
5. Code checks the plan's challenge and gain grades against the tier, and nothing else, then applies it. Code computes each actor's anchorTurn (Anchors) and places the actor in its default routine's desired zone for the current turn, whose activity sets its attention. On open entry only, each opening belief about the player is written through updateBeliefs. New bands and personal stances (Mind.overrides) are installed; each belief about another band becomes one belief per member on the stage (lastKnownZone = that member's zone), written through updateBeliefs whatever the entry. A plan that fails gets one repair retry. After that, routine-only errors degrade the affected actors, and any other error gives the fallback stage (Agent Weaver: Failed stage plan).
6. Code installs each actor's routines list (its set's routines), slot bindings, current routine and anchor, then its knows facts (Mind.knows), plans, triggers and secrets. Each routine carries its one onAlert order; there are no onAlert triggers.
7. Arrival detection: if the player is sneaking, each observer in perception range runs the existing detection test against the player's last move; the plan sets no belief about the player for these observers.
8. Code builds the opening perception events (Opening narration), saves the turn (Part 4 §10) and computes the first turn (Architecture step 1).
9. The turn's Agent Narrator call narrates the arrival with the turn's other events.

Story start has no triggering turn: setup runs alone, is saved as turn 0, and one opening Agent Narrator call narrates it. Turn 0's premise and starting place come from the story's setting, chosen per story (D-1).

**First build:** the premise is the config value STORY\_PREMISE, "A swordsman arrives at a village troubled by slimes", and the story starts in the village tavern.

Whether the player sees the situation roll on screen stays with D-22. Until then it is hidden, like every roll Agent Narrator does not get.

### Stage extension

- **Background call.** After a turn is saved, if the player's zone links to a frontier that has no held extension, code starts a background Agent Weaver call for that frontier, with the scene's tier and the same contract.
- **Held, not saved \[Proposed\].** The result is held in memory, keyed by frontier, for the rest of the scene; it is not saved.
- **Crossing.** In the turn the player moves into that frontier, scene setup steps 4–7 run on the held plan in that turn's setup slot, after resolveTurn and before the save. There is no new situation roll: the Weaver's step 3 already ran in the background with the scene's tier. If the call is not back yet, the turn waits for it.
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
- catalogs: the library and blueprint ids it may use (templates, creature types, routine sets with their brief, tags and slot hints, items). Catalogs change only with libraryVersion and sit right after the fixed instructions as a stable prefix (OQ-11).

Never in WeaverView: skill growth, Burden or Potential (Part 1 §2); this turn's player text.

Output shape (notation, not literal JSON):

```
{
  event:       { summary: hidden text, challenge: grade, gain: grade },
  places:      [ { key, name, kind, parent: placeKey | placeId } ],   // new place nodes only
  zones:       [ { key, place: placeKey | placeId, name, look: public text,
                   cover: none | some | heavy, light: bright | dim | dark,   // keys of COVER and LIGHT (src/scales.ts)
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

**Lethal.** Each entry in bands carries lethal: true | false, default true. It is saved on the band, and an existing band keeps its value. Agent Weaver sets false only for a conflict nobody means to end in death, such as a spar or a hostage-taking; monsters such as slimes are lethal. Code reads it when the player is incapacitated (D-54).

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

- every id resolves (story blueprints first, then the library); an unknown creature type fails (Part 3);
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
3. Use catalog ids for every mechanical thing: templates, creature types,
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
   death, such as a spar or a hostage-taking. Monsters are always lethal.
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

Never in NarrationView: the tier, grades or situation roll; the event summary, Weaver note, plans, triggers or secrets; opening beliefs or attention; or any tone or mood hint derived from the tier.

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

#### Sneaking posture

- A hide or sneak action sets player.posture = 'sneaking'. It stays until the player acts openly.
- Which actions end sneaking is deferred, together with the definition of a major action (D-34).
- Deferred for the first build: hide and sneak wait for the Stealth tree (Part 1 §3), so the player is always open. Scenario tests 3, 18 and 42 wait with them.

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
- **Call slots.** Only a couple of Claude calls run at once per viewer; a few more wait their turn and a flood is rejected (rate\_limited). Background Planner and Weaver calls share these slots with the turn's own calls, so parallel calls can queue and a queued Planner call is more likely to be late (planner\_late). Size MAX\_PLANNER\_CALLS and BACKGROUND\_WINDOW with that in mind. Abort a call (its signal) as soon as its output can no longer be used, so the viewer stops paying for it. The exact slot count is unconfirmed.
- **Compact views.** Ids, short descriptions and the last few relevant events, not the full log.
- **Prompt order.** Each agent's input starts with its fixed instructions (a leading user turn, since the capability has no system prompt) and ends with the per-turn data; nothing that changes per turn or per actor goes in the fixed part. If the platform caches prompt prefixes, this makes repeat calls faster; the runtime docs don't say it does (OQ-11), so estimates assume it doesn't. Pass cache:false on calls whose repeat must give a new answer.
- **Waiting state.** Show the same short "…" indicator in every mode until the Narrator's checked text is ready.
- **Streaming** is off for now; revisit after playtests (D-24).
- **Timing rule.** Resolution never starts before the previous display plus BACKGROUND\_WINDOW (config), in every mode. In dialogue turns, results are also shown no earlier than DIALOGUE\_WINDOW (config) after submit, set at or above the Responder's usual latency, so guarded and ordinary NPCs answer in the same time. Known limit: retries still change timing (D-45). The call count is shown in the header on purpose.

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
* **Header:** the story title; under it the turn, the mode and the place line (the character's zone, then its place and parent place). On the right, the number of Claude calls this session, counted by code (Voyage U2, U3, U30; decided by Ali 07/11/2026). The day and time of day follow the turn (T11).
* **Who's here:** a strip under the header listing the actors the character fully perceives (PlayerView), by label until the name is known. Others' health shows only from Wounded down (Part 3), never as a bar (Voyage C2, U6, U7).
* **Narration log:** checked narration, newest last, with the "…" waiting indicator (Latency and cost). Story text is set in Literata.
* **Check line:** under the player's action, the player's own roll this turn with no numbers: skill, tier, the other side's tier, how far apart they are ("1 tier ahead") and the result, e.g. "Medium weapons Great Success vs the slime's dodge Success · 1 tier ahead · full hit, body" (Voyage U10). It opens with an icon for the kind of roll (attack or talk), and each tier is a chip tinted green (Great Success and up), blue (Success), amber (Near Miss) or red (Failure and worse) (Ali, 07/11/2026).
* **Speaker lines:** each line the character heard, word for word under the narration: the speaker's name in a column on the left with how it was said (whispering, shouting) under it, the line on the right, vertically centred (Narrator rule 5; Voyage U9, U12, style A picked by Ali 07/11/2026).
* **Turn changes:** one folded row per turn ("Turn 14 ↻3 You are Bruised") that opens to one typed row per change: Combat, Condition, Health. Built by code from the combat packets the character perceived (Voyage U14 to U16).
* **Commands and Ideas:** two buttons beside the input open a wide panel above it. Commands lists the / commands (D-100). Ideas lists up to three actions each for Fight, Talk, Move and Use, built by code from PlayerView (D-107). Picking one fills the box; nothing is sent until Send.
* **Input:** one free-text box; a line starting with / is a command (Part 1 §7).
* **Input keys:** the action box keeps focus; what it sends is trimmed, and an empty line sends nothing. If narration is ever paced (D-24), skipping uses a click on the narration or Esc, never a key that types (Voyage A7, decided by Ali 07/11/2026; was OQ-24).
* **Aim toggle:** marks this turn's attack as aimed (Part 1 §7).
* **Mechanics panel:** under the narration while SHOW\_MECHANICS is on; dice, modifiers and damage from code.
* **Out-of-character notices:** the scene-planning failure marker (Agent Weaver), the rate-limit notice and the stop-play message (Leak prevention, validation and failure handling).
* **Perks (Character page)** (Ali, 07/11/2026, K1–K4, S1, S7): a perk point is spent any time on the Character page; the rail shows a dot while one is unspent, and the level-up line on Play links there (K2). A taken perk can be undone until the next turn is played, then it is permanent (K3). Two views behind a "By tree / By effect" switch. By tree: a tab per skill tree, each skill a ladder of its seven milestones on a gold line showing true skill, the All-50/100/150 steps as dotted lines across the tree; on narrow screens the ladders become horizontal tracks. By effect: tracks in the same style grouped by what the perks do (Attack, Defense, Health, Speed, Senses, Speech); each group folds when its name is tapped. Milestones not yet reached are sealed and show only their number; the page never hints at what comes next (K4). Tapping a taken or open milestone shows a small card beside it with the perk's text and, when open, "Take · 1 point". Mock-ups: https://claude.ai/artifact/TVfF7qs3WnDdDZzzM6Yjf5
* **Journal page:** People (actors seen clearly now, or whose name is known; a label until the name is known; health only from Wounded down), Places (the current place and those above it, plus places of facts the character witnessed, folded under their parent place, no drawn map) and a Timeline (turns played since the page was opened). Built from PlayerView, the Journal and the story log only, never the hidden store (Voyage U26, U28; Ali, 07/11/2026).
* **Side sheet health:** the health bar marks the health-track thresholds and names the current level; clicking it opens each body part with its pool and state (Ali, 07/11/2026).
* **"You fell" screen:** shown when a lethal fight incapacitates the player, offering /undo or reset (D-54).
* **GM debug view toggle** (Leak prevention, validation and failure handling).

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
| 27 | Story start | Turn 0 makes one situation roll, one Weaver call and one Narrator call, and is saved as turn 0 |
| 28 | Place change is not a scene | The player walks from the bar's zone to the street's zone (two places, one stage): no situation roll, no Weaver call |
| 29 | The fight spills outside | An engaged NPC follows the player from the bar into the street; its placeId changes with its zone, and the turn stays Tactical |
| 30 | Background extension | With the player in a zone linked to a frontier, one Weaver call starts after the save, is logged, and is not applied before the player crosses |
| 31 | Crossing reuses the tier | Crossing applies the held extension with the scene's tier; no situation roll is made |
| 32 | Late extension | The player crosses before the extension returns; the turn waits for it, and no fallback is used |
| 33 | Grades must fit the tier | A Failure-tier plan with gain major fails validation, gets one repair retry with the errors, and the corrected plan applies |
| 34 | Fallback is flagged | A plan that fails twice yields the fallback stage, and all four flags appear: stage record, weaver\_fallback log, GM banner, play-screen marker |
| 35 | Stakes only | A Failure-tier plan whose threats are unaware and unalert passes validation |
| 36 | Situation modifiers | A perk naming the situation roll changes its total; a Wounded health level and a terrain bonus do not |
| 37 | Natural edge | A natural 01 on the situation roll lowers the tier by two |
| 38 | Hidden terms | A public zone description containing one of the plan's hiddenTerms fails validation |
| 39 | Opening narration covers who is seen | Every full presence event appears in the Narrator's narrated list; a narration that omits one fails the fact check |
| 40 | Nothing hidden in the opening | The logged NarrationView at scene start holds no tier, grade, event summary, Weaver note or opening belief |
| 41 | Labels until names are known | The opening uses the stranger label; after an Agent Voice line with introduces = \[speaker\], the next NarrationView uses the name |
| 42 | Sneaking arrival | A sneaking player crossing a frontier triggers detection tests; the plan's opening beliefs are not applied to those observers |
| 43 | One belief writer | Opening beliefs on open entry are written through updateBeliefs only (unit test) |
| 44 | Undo rerolls the hand | Undoing the scene-start turn and redoing it makes a new situation roll and a new Weaver call |
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
| 86 | One copy counts | Two identical lucky charms give the same situation-roll modifier as one |
| 87 | Carried charm | A charm whose entry names the situation roll and is active when carried modifies the roll at scene setup; one without the situation roll never does |
| 88 | Tool auto-pick | A lockpick action with two lockpick kits carried uses the better one; with both hands full, the off-hand item is stowed and no action is spent on it |
| 89 | Crippled arm holds | A shield arm goes Crippled: the shield stays held, no block is offered, the hit table gains no change |
| 90 | Destroyed arm drops | A Destroyed sword arm puts the sword on the zone's ground; an observer perceives an item\_dropped event; pick up returns it |
| 91 | Free gear ops | A turn with draw, swap and pick up plus an attack resolves one main action; equip on armor takes the main action |
| 92 | Reach | A reach-1 spear hits a target one linked zone away with sight; the same attack through a link without sight becomes a wasted action |
| 93 | Thrown | A thrown dagger ends on the ground of the target's zone, hit or miss |
| 94 | Uncovered part | A hauberk covering general area and arms: an aimed head hit takes no armor, a torso hit does |
| 95 | Stacked armor | A creature with natural armor wearing armor takes damage reduced by worn, then natural, floor 0, not rounded |
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
| 109 | Skill progression | A use marks a skill only when the opposition is within MARK\_WINDOW of raw or true skill, once, and only for the player; a hit costing ENDURANCE\_MARK\_PCT marks endurance; a marked skill whose roll beats its target gains 1d5 and shows "Sight 38 → 41" plus "New perk unlocked" past a milestone; a failed roll shows nothing; marks clear |
| 110 | Healing | Rest heals HP and working parts but not a Crippled part; a clinic lifts it; a bandage heals its row in the turn it is used, is used up, and shows "Bandage: Hurt → Bruised" |
| 111 | Game clock | Each action costs its durations row; waiting until dawn moves the clock to dawn, breaks the scene and shows "Time passes: 11 h (Day 2 · Dawn)"; a hostile in the zone blocks it; outdoor zones are dark at night unless lit; the Narrator sees the day and time of day; the Weaver picks the hour only at story start; a night-only routine set by day is a routine error; rest cools down in game minutes; natural recovery heals 0.5% an hour at endurance 50, never a Crippled part, fights included |

### Deliverables and acceptance criteria

Done means every scenario test passes except those waiting on other work: 3, 18 and 42 wait on the Stealth tree (D-8), and 46 and 53 test rules still \[Proposed\]. Also, every non-dialogue turn that doesn't start a scene shows checked narration after one Parser call plus one full Narrator call.

**First build scope.** A fantasy village with a guard, a trader and a tavern patron to talk to. The player is a swordsman, and slimes living around the village are hunted. Hunting gives XP (Part 1 §5) but no skill changes (recordUse() only logs). The slimes' routine set, slime\_wander, is the test of the Agent Weaver integration (Appendix: prototype routine bank).

Build in this order, so the game is playable with stubs before any agent is wired in:

- [ ] State types, seeded RNG with saved state, agent log
- [ ] Ruleset: TIERS, situation, roll, attack, check and contested built (Part 2, First-build ruleset); applyEffects and recordUse stubbed
- [ ] Perception per event, the single belief writer, communication events and belief decay
- [ ] The six deny-by-default view builders (DialogueView built from ActorView; bark events never copied into NPC views)
- [ ] isActive; bands, relations and overrides; engagement
- [ ] Resolution engine with the simultaneous-order rules, order merging and the exchange slot
- [ ] Hidden store, trigger checker (turn start and mid-turn), fired log and secret reveal
- [ ] Routine bank types, the import validator and the prototype bank (Appendix)
- [ ] Desired-state routines (schedule, follow, wait) with slot bindings, route expansion and code-set anchors, alarm state, onAlert and returnTo; detection on major actions and ambush resolution (Explore mode)
- [ ] Scenes, the stage, frontiers and the situation roll (ruleset.situation)
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

Every successful hit damages the body part it lands on and, depending on that part's impact, the health track. Total HP comes from endurance and the creature type (Total HP); part pools are shares of total HP set by size (Body parts). Health-track levels and part states are % of those pools. Code owns all of it, including a database of creature types: Agent Weaver names the creature type, and code knows its parts.

- **Health track (World of Darkness):** levels by % of HP lost; one wounds modifier on every roll (Part 1 §4, Layer 2b; rolls only, not checks); each level is a trigger for perks, tactics and story.
- **Body parts:** every creature has a general area plus a list of parts. Each part has a size (hit chance and aim penalty), an impact (how its damage counts on the health track) and a role (what its states do); a part can have several roles. Parts are Healthy, Damaged, Crippled or Destroyed.
- **General area:** always present, stateless, normal impact, and always at least 30% of the hit table. Any damage that isn't aimed at, or doesn't land on, a specific part counts here.
- Attack and defense are two rolls; damage is not rolled. The attack roll is contested by the defender's dodge or block roll, and the gap between their tiers sets the multiplier and can move or restrict the location. Damage is fixed by weapon and armor. Perks can act on the attack roll, the defense roll, the gap or the damage values, each on its own.
- **One damage type** for now.
- WoD's sixth level "Crippled" is renamed **Critical**, so "Crippled" only ever means a body part.

### Total HP

```
HP = (HP_BASE + HP_PER_END × endurance) × creature HP multiplier
```

HP\_BASE 50, HP\_PER\_END 1 (*placeholders*); creature HP multiplier humanoid ×1, dragon ×3; every creature type has one. Endurance 0 → 50 HP, 50 → 100 HP, 100 → 150 HP.

### Health track

Total HP is divided into levels by the share of HP lost, following World of Darkness.

| Level | HP lost | Wounds modifier (roll points) | Example hooks |
| --- | --- | --- | --- |
| Unhurt | 0% | 0 | — |
| Bruised | 1–15% | 0 | Free buffer; a toughness perk can widen this band |
| Hurt | 16–30% | −5 | Perk: ignore the Hurt penalty |
| Injured | 31–45% | −10 | Low-morale enemies check to retreat |
| Wounded | 46–60% | −15 | Perk: +10 to melee hit rolls while Wounded or worse. Story flag "visibly hurt": NPCs react |
| Mauled | 61–75% | −20 | +20 to intimidate a Mauled foe; Mauled enemies may surrender |
| Critical | 76–99% | −30 | One action per turn; last-stand perks switch on |
| Incapacitated | 100% | Out of the fight | Lethal fight: the story ends; otherwise a survival roll (D-54) |

The penalty is a roll modifier of type wounds (Part 1 §4, Layer 2b), diminishing together with body-part role penalties. It does not apply to no-dice checks (settles OQ-15).

Bands are 15% wide; Critical takes the remaining 24% so a last stand lasts a little longer. Penalty values are placeholders; they stack by Part 1 §4, Stacking within a type. The health track never modifies the situation roll (Part 1 §4).

**Morale.** An engaged NPC makes a morale check when its health track reaches a new level from Injured onwards, and when it perceives a bandmate become incapacitated. The check is roll() with Mind.morale as the skill and the actor's usual modifiers, with no target number; Failure or worse leaves the actor broken. Two thresholds skip the roll: reaching Critical always breaks the actor, and a fearless actor never makes the check (slimes are fearless). Morale and fearless come from the NPC template's personality; until templates set them, Mind.morale is 50 (placeholder). Broken lasts for the rest of the scene, and a broken actor takes the Flee move (Fallback behavior, rule 1). Broken is a win condition: a broken actor counts on neither side of engagement, so a fight ends when every hostile actor is broken or incapacitated. The player never makes a morale check. Surrender is part of the same check \[Proposed\]: on a Critical Failure, or when a broken actor has nowhere to flee, the actor surrenders instead. A surrendered actor holds, takes no hostile action and, like a broken one, counts on neither side for the rest of the scene. What the player can do with it is deferred (D-98).

**Healing** (Ali, 07/11/2026, "Healing: options" H1–H15). Every source is a row of one library table (healing): HP %, part-pool %, its reach (the worst part state it heals, a key of the PART\_STATES scale, so a perk can shift it by steps), whether it works in a fight, and the place kinds it needs; one engine rule applies a row, so amounts stay consistent (B5) and stronger tiers are new rows. Rows now (placeholders): rest 25/25, clinic 100/100 and lifts Crippled parts (resting in a place of kind clinic or infirmary), bandage 10/10, usable in a fight as the main action and used up (an item names its row with `heal`; the player starts with STARTING\_BANDAGES 2). A part worse than the row's reach is skipped; a Crippled or worse part a row reaches starts again from 0 (H4). Rest and bandage reach Damaged; the clinic reaches Crippled. A rest action (the turn's main action) needs no active hostile in the zone and waits REST\_COOLDOWN\_MIN (*placeholder*, 240) game minutes (H5, T7). **Natural recovery** (H12–H15) is the hourly row passive: every active actor on the stage heals endurance (true skill) × 0.01 % an hour (0.5% at 50) of HP and of each part it reaches (never Crippled or worse), all the time, fights included, as the clock moves; a line shows only when a health level or part state changes. NPCs use the same table when they rest; healing off stage waits for D-67 (H8). A Destroyed part stays gone unless a special perk, item or story event brings it back (settles OQ-6). The turn shows a plain line such as "Bandage: Hurt → Bruised"; its look is the designer's (H11). Later: a first-aid skill (H9, D-14), bleeding and other statuses (H10, D-15).

**Visibility:** for other characters, Claude is told the level only from Wounded down; Bruised to Injured stay hidden, though code still applies their penalties.

**Thresholds as triggers**

- Perks read the level: they can ignore a level's penalty, widen a band, or switch on a bonus at a level.
- Tactics read the level: enemy AI retreats, surrenders or turns desperate at set levels, and players get options against hurt foes.
- Story reads the level: crossing into Wounded or worse sets flags that scenes, companions and NPCs can check.

Code fires one event per change, `threshold_crossed {who, from, to}`; perks, AI and story scripts listen for it.

### Body parts

Every part carries a size, an impact and one or more roles, all stored in code. Each part's pool is a share of total HP set by its size: Extra small 15%, Small 20%, Normal 30%, Big 50% (placeholders; Tiny is not in use). Its state is measured as % of its own pool. The general area has no pool and no state.

Role penalties (Damaged and Crippled columns of the role table) are roll modifiers of type wounds.

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

Size is set per creature, not per part name: one creature can have big arms and small legs.

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
| Head | Small | Essential | Sense | 01–07 |
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
| Head | Normal | Essential | Sense, Strike | 01–09 |
| Left wing | Normal | Non-essential | Fly | 10–18 |
| Right wing | Normal | Non-essential | Fly | 19–27 |
| Forelegs | Normal | Normal | Move | 28–36 |
| Hind legs | Normal | Normal | Move | 37–46 |
| Tail | Small | Non-essential | Strike | 47–51 |
| General (body) | Big | Normal | — | 52–00 |

The dragon's big body gives its general area 49% (30% minimum + 19%). Crippling a wing hurts its flight without costing it any HP; destroying the tail removes it from the table, and the other parts' bands grow to fill the gap.

### Creature database

Code keeps every creature type, its parts and the role table. Agent Weaver names the creature type by catalog id in the stage plan; code loads the entry, builds the hit table, and tracks every part from then on.

```json
{
  "roles": {
    "sense": {"shared": true},
    "grip": {"shared": false},
    "move": {"shared": true},
    "fly": {"shared": true},
    "strike": {"shared": false}
  },
  "creatures": {
    "humanoid": {
      "hpMultiplier": 1,
      "general": {"name": "torso", "size": "normal"},
      "naturalAttacks": [{"id": "punch", "tree": "unarmed", "class": "punch", "skill": "unarmed_strike", "reach": 0, "hands": 0}],
      "parts": [
        {"id": "head", "size": "small", "impact": "essential", "roles": ["sense"], "adjacent": ["general", "neck"]},
        {"id": "left_arm", "size": "normal", "impact": "normal", "roles": ["grip"]},
        {"id": "right_arm", "size": "normal", "impact": "normal", "roles": ["grip"]},
        {"id": "left_leg", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "right_leg", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "neck", "size": "extra_small", "impact": "essential", "roles": [], "adjacent": ["head", "general"]}
      ]
    },
    "slime": {
      "hpMultiplier": 0.6,
      "general": {"name": "body", "size": "normal"},
      "naturalAttacks": [{"id": "slam", "tree": "unarmed", "class": "slam", "skill": "unarmed_natural", "reach": 0, "hands": 0}],
      "parts": []
    },
    "dragon": {
      "hpMultiplier": 3,
      "general": {"name": "body", "size": "big"},
      "parts": [
        {"id": "head", "size": "normal", "impact": "essential", "roles": ["sense", "strike"]},
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

adjacent lists the parts a hit can move to at gap −2. Default when absent: the general area only. The general area is adjacent to every part. Every creature type sets hpMultiplier (placeholder values: humanoid 1, dragon 3).

**Creatures not in the database**

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

Natural attacks have their own classes: punch (damage 15, hit +10) and slam (damage 20, hit +10). All values are *placeholders*. Reach is set per attack mode (Part 5 §5).

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

- **Situational roll modifiers (ranged):** a hostile actor in the shooter's zone −10; 2 links −5; 3 links −10; 4 links −15 \[Proposed\].
- **Light** (any roll that needs sight): dim −5; dark −10. The attacker uses the target's zone; a defender uses the attacker's zone.
- **Cover** (ranged attacks only): the target's zone cover 1 → gap +1, cover 2 → gap +2.

### Damage flow and the roll packet

Code runs the whole exchange; Claude gets one packet afterwards and narrates from it.

1. **Setup** (once per creature): Agent Weaver names the creature type in the stage plan; code loads it from the database and builds its hit table.
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

The save has two layers. The library holds blueprints shared by every story. A story holds everything that happens in one playthrough. One story runs at a time.

| Data | Layer | Saved | Notes |
| --- | --- | --- | --- |
| Ruleset numbers | Library | Yes | Retuning applies to the running story |
| Creature types, races, classes, perks, skills, item and NPC templates | Library | Yes | Edited only by the designer; stories always use the latest version |
| Story blueprints | Story | Yes | Items Claude minted, creatures filled in mid-story. Never leave the story unless the designer promotes them |
| Player | Story | Yes | Core, Progression, Journal (section 4) |
| Temporary NPCs | Story | Yes | Core, Mind (section 4) |
| Recurring NPCs | Story | Deferred | Every NPC gets a stable id so it can be promoted later |
| Places, state slots, facts | Story | Yes | Skeleton and canon, never descriptive prose (section 5) |
| Hidden store, quests, flags | Story | Yes | Plans, triggers, secrets, memory notes, fired log |
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
| History | Raw skills and their states, StartingTotal, all-XXX perks, level perks chosen, marks, classes and class levels, race, creature type, part pools, minted item blueprints, item instances, shield and armor pool states | Saved as plain fields |
| Grey zone | XP, unspent perk points, Potential | Saved, with a source trail where the value can change |

- Potential is saved as a base plus a list of {source, delta, turn} adjustments, so a perk or event change can be traced or reversed.
- Character level is the sum of class levels unless a perk changes it, so it is derived.
- Values used at resolution (the Burden snapshot, the effective skill of a check, the situation roll) go in the turn record, not on the sheet.
- Retuning never recalculates saved progress. Levels are stored and never lost. A retuned XP curve changes only the distance to the next level; if a character's XP already passes the new threshold, it levels up at its next XP award, not on load. A retuned perk-point rule applies only to future levels: points already earned and perks already bought stay.

### 4. Actor sheet

The player and every NPC share one sheet shape: a Core every actor has, plus optional modules. Roll code reads Core only, which guarantees one resolution path for everyone.

| Module | Who has it | Holds |
| --- | --- | --- |
| Core | Every actor | Race, creature type, skills and states, classes, stored perks, condition, inventory, standing defense, public label |
| Progression | Player; NPCs only if NPCs improve (deferred) | StartingTotal, Potential, XP, unspent perk points, marks |
| Mind | NPCs | Control, behavior, morale, beliefs, overrides, knows facts, current routine and its anchor, routines list, slot bindings, alarm state. The agenda flag is derived, not stored; the band moved to the Actor |
| Journal | Player | Secrets learned, facts witnessed, last-seen state slots, names known |

Promoting an NPC to recurring adds a module; it never converts the sheet. A companion needs no module: it is any member of the player's band.

**Race and creature type.** Race is separate from body plan. A race sets a creature type and grants a race perk; more race content comes later. Creatures without a race (a wolf, a slime) have a creature type only.

**Skills.** General skills are open to every actor unless a perk or race excludes them. Each class adds its own tree of three skills. Exclusions are derived from the library and never stored.

**Classes.** Each class an actor knows is saved with its state and its class level:

| State | Meaning |
| --- | --- |
| Unlocked | Offered at level-up. Same as not having it: tree unusable, class level 0 |
| Current | Exactly one. Receives every new level for persistent characters |
| Previous | A former current class. Keeps its levels; its skills stay usable |

Putting a level into an unlocked class makes it current, and the old current class becomes previous. Class perks come at class levels set in the library (normally 10 and 20) and are derived. Previous-class skills keep improving like any other skill. Returning to a previous class is deferred.

**First-build classes.** Swordsman, the player's class: its tree holds feint, riposte and disarm (names \[Proposed\]; effects not designed yet), and it sets class floors of melee\_medium 25 and block 15. Slime, every slime's class: its tree, Slime senses, holds tremor and taste; the third skill is open.

**Player creation.** The player builds the sheet by point-buy on the creation screen (https://claude.ai/artifact/HW45ivigqwZ5VDo4PWPv9u): 250 points over the open skills, no skill above 60 at creation, the class floors as minimums, and exactly 3 Tagged skills. The screen opens on a recommended build and shows HP, attack, standing defense and the odds against one slime as points move. The story starts only when every point is spent and 3 skills are tagged. StartingTotal is the sum of the untagged skills at that moment. The player starts with an arming\_sword and a round\_shield held, a gambeson worn, and 20 coin (placeholder).

**NPC generation.** All generation runs in code. A template gives a creature type and class, a minimum for each skill, a level, bonus points, three focus picks, a personality, a loadout and a control setting. Two kinds of NPC:

- **Unique** (a bandit): rolled once at spawn, then its values are saved and frozen.
- **Copy** (a wolf, a slime): saves only the template id and live state, and follows the latest template.

A template may carry a loadout: a list of library item ids given to every NPC made from it (Part 5 §8) \[Proposed\].&#32;

**Unique generation** (code, seeded), modelled on Iliad Quest's NPC rolls:

1. Every skill starts at the template's minimum; a skill with no minimum is raw 0. Minimums give each NPC its basic function, so a lopsided NPC is fine.
2. Points = level × POINTS\_PER\_LEVEL + bonusPoints (POINTS\_PER\_LEVEL 3, placeholder). The level is fixed per template for now; level rules come later. bonusPoints lets a well-trained template (a guard) outskill a higher-level one (a bandit).
3. The template names three focus picks, each a tree and a preferred skill in it (Iliad Quest rolls three focused skill groups and the GM picks the skill).
4. Points go out in 5-point chunks, and a seeded d3 picks the focus pick for each chunk, so spending is uneven. No skill goes above 100.
5. The three preferred skills are Tagged. Perk points from the level are saved; NPC perks are deferred.

A copy does not roll: its skills are the template's minimums, read live.

**Personality.** Each template names one personality, which sets Mind.morale for the morale check (Part 3, Morale): fearless (never checks), bold 70, steady 50, timid 30.

**Slime template** (first build): a copy of creature type slime with class Slime, level 0, personality fearless. Skills: unarmed\_natural 30, dodge 0, everything else 0. HP multiplier 0.6 (30 HP). Its slam uses the slam class: damage 20, hit +10, reach 0.

**Village templates** (first build; every number a placeholder). All three are copies of creature type humanoid with no class:

- **guard:** level 2, bonus points 10; minimums melee\_medium 40, block 30, dodge 20, sight 30, hearing 30, intimidation 30, persuasion 20; focus picks melee/melee\_medium, defense/block, perception/sight; personality steady; loadout arming\_sword, mail\_hauberk; control agent.
- **trader** (the barkeep): level 1; minimums sight 25, hearing 25, barter 40, persuasion 30; focus picks perception/hearing, melee/melee\_light, defense/dodge; personality timid; no loadout; control code.
- **patron:** level 1; minimums unarmed\_strike 20, sight 20, persuasion 30; focus picks unarmed/unarmed\_strike, defense/dodge, perception/sight; personality timid; no loadout; control code.

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
library/<kind>.<id>                   one library entry, e.g. library/creature.dragon
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

**Undo.** One turn. It points head back at the previous bookmark and drops that turn's record. The RNG does not roll back: the engine page keeps the undone turn's RNG state, so a retried action rolls new dice. Undo after a library edit is allowed; the restored state uses the new library from the next turn. Undoing the turn that started a scene rerolls the situation roll and runs Agent Weaver again, like any other dice. Undoing a turn that crossed a frontier reuses the held extension, if this session still holds it.

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

**Resets.** A change too big to migrate may reset the story, but only after the designer confirms it. Code never resets on its own. If a migration can't run, the game refuses to load, leaves the save untouched, and asks. A confirmed reset archives the old story: its pages and backups stay under its own id, and play starts a new story id (D-73).

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

These types replace Part 2's GameState and Actor as the saved shape. Belief, Fact, Zone, ZoneLink, Band, HiddenStore, GameEvent, AgentTurnLog, Tier and SituationResult keep their Part 2 definitions. Fields marked reserved hold a place for an open question and are not used yet.

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
            weight: 'light' | 'medium' | 'heavy';
            pools?: Record<string, number> };   // part id -> pool in points, the same for every wearer
  shield?: { pool: number };                     // pool in points, the same in any hand
  base?: { itemId: LibraryRef; quality: 1 | 2 | 3 | 4; boosts: string };   // minted variants
  tags?: string[];
};

type ItemEffect = {
  kind: 'skill' | 'rollMod';           // rollMod only when the entry notes it
  skill?: LibraryRef;                  // kind 'skill'
  roll?: 'hit' | 'dodge' | 'block' | 'perception' | 'stealth' | 'situation';   // kind 'rollMod'
  value: number;
  active: 'worn' | 'held' | 'inUse' | 'carried';
  scope: 'withItem' | 'any';
};

type AttackMode = {
  id: string;
  tree: 'melee' | 'ranged' | 'unarmed';
  class: 'light' | 'medium' | 'heavy' | 'punch' | 'slam';   // natural attacks use their own class; unarmed with no class: the unarmed profile
  skill?: LibraryRef;                    // unarmed only: which placeholder skill
  reach: number;                         // zone links; 0 = same zone
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
    tier: Tier;             // this scene's situation-roll tier
    sceneNumber: number;
    sceneStartTurn: Turn;
    fallback?: { reason: string; turn: Turn };   // set when the fallback stage was used
  };
  sceneCaps: { promotions: number; minted: number };   // reset at scene start
  clocks: Record<string, number>;
  flags: Record<string, string | number | boolean>;
  bands: Band[];
  quests: { id: string; state: string; text: string }[];
};

type HiddenPage = { storyId: StoryId } & HiddenStore;

type BlueprintPage = {
  storyId: StoryId;
  id: LibraryRef;
  kind: 'item' | 'creature' | 'npcTemplate';
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
  posture?: 'open' | 'sneaking';     // player only (Part 2)
  bandId: string;                    // moved from Mind; the player belongs to the player band
  core: Core;
  progression?: Progression;         // player; NPCs only if NPCs improve (deferred)
  mind?: Mind;                       // NPCs
  journal?: Journal;                 // player
};

type SkillState = 'tagged' | 'normal' | 'flawed';
type SkillEntry = { raw: number; state: SkillState; dormant?: boolean };

type Core = {
  raceId?: LibraryRef;               // absent for creatures with no race
  creatureTypeId: LibraryRef;        // body plan; set by the race when there is one
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
  defeats?: Record<string, number>;   // 'all', 'creature:<type>', 'race:<race>'
  nextClass?: LibraryRef;            // the class the next level goes to (X9)
};

type Mind = {
  control: 'agent' | 'code';
  behavior: string;
  morale?: number;
  moraleState?: 'broken' | 'surrendered';   // set by the morale check (Part 3, Morale); cleared when the scene ends
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
  creatureTypeId: LibraryRef;
  raceId?: LibraryRef;
  classId?: LibraryRef;              // its class tree, e.g. 'slime'
  generation: 'unique' | 'copy';
  minimums: Record<LibraryRef, number>;   // skill -> starting raw; absent = 0
  level: number;                     // fixed per template for now
  bonusPoints: number;               // added to level x POINTS_PER_LEVEL; uniques only
  focus: { treeId: LibraryRef; skill: LibraryRef }[];   // three picks; uniques only
  personality: 'fearless' | 'bold' | 'steady' | 'timid';   // sets Mind.morale (Part 3, Morale)
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
  situation?: SituationResult;       // set on the turn that started a scene
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
- **Situation roll.** An effect may modify the situation roll only when its entry names it. Such an effect may be carried. Code reads the player's inventory once, at scene setup step 2. Only the player makes this roll.

### 3. What an effect can do

Three kinds, all subject to §2's activation and to a scope (withItem: only actions made with this item; any: every roll or check of that kind while active).

1. **Skill bonus (default).** A flat bonus or penalty to named skills, entering effective skill (Part 1 §3). It counts in full in checks and at the roll's skill weight in rolls. The standard kit bonus is one +25 per roll, shared by all kit pieces, so two kit pieces that both apply still give +25 (Part 1 §3). Armor weight is a skill penalty on Dodge: light −5, medium −10, heavy −20 (*placeholders*).
2. **Item stats.** Read by the combat flow, never stacked as modifiers: weapon modes (§5), armor protection and pools, shield part (§6).
3. **Noted roll modifier (rare).** A flat modifier on one roll kind (hit, dodge, block, perception, stealth, situation), of type gear (Part 1 §4, Layer 2b), only when the entry says so. The weapon hit adjustment is one: it applies at full value on the hit roll.

Every gear modifier enters the check or roll request as its own entry, naming its item and state, e.g. "Gear (held): arming sword". How gear modifiers combine with perks and statuses is decided by the modifier-stacking rules, not here. Initiative is not a gear target yet (D-85).

### 4. Slots, hands and gear ops

- **Hands.** One hand per Grip part of the actor's creature type (humanoid 2; wolf, dragon 0). An item or attack mode says hands: 1 or 2; two-handed needs two usable Grip parts.
- **Worn slots.** One armor slot, plus ACCESSORY\_SLOTS accessory slots (*placeholder*, 3) not tied to body parts.
- **Crippled Grip arm.** It keeps holding its item but can't use it: no attack, block or tool use with that arm, and no two-handed actions. A Destroyed arm drops what it held to the ground of the actor's zone; an item\_dropped event is perceived like any other.
- **Gear ops (free).** draw, stow, swap, wear or remove an accessory, pick up (from the ground or from a downed actor in the zone). Code applies them at the actor's initiative, before its action. They cost no action.
- **equip (main action).** Putting armor on or taking it off. Its final cost belongs to the action-economy discussion.
- **give (main action).** Moves an item to another active actor in the same zone.
- **Ground items.** Each zone holds a list of item instances lying there. They are saved with the zone on its place page.

### 5. Weapons

- **Class table.** In Part 3, Weapons, armor and shields (ruleset config): damage and hit by class, and block's tier gap counts one less against heavy.
- **Skills.** Combat-Melee, Combat-Ranged and Combat-Unarmed trees, each with three skills. The skill of an attack is the tree plus the class (melee\_heavy, ranged\_light). The three Combat-Unarmed skills are placeholders that behave the same for now, sharing one unarmed profile (*placeholder*: 15 damage, +10 hit). A natural attack uses its own class's damage and hit instead (Part 3, Weapons, armor and shields): the humanoid's punch is class punch, the slime's slam is class slam. Worn hand gear such as gauntlets may change unarmed damage later (D-97).
- **Attack modes.** A weapon lists one or more modes, each with its own tree, class, reach and hands, plus optional bonuses on top of the class table (damageAdj, hitAdj). Dagger: melee light, and thrown ranged light. \[Proposed\]
- **Reach.** Counted in zone links: 0 = same zone; N = up to N links, every link with sight. Ranged modes take the range modifiers in Part 3 (Reach, range, cover and light). \[Proposed\]
- **Thrown.** A thrown mode moves the item to the ground of the target's zone. There is no other ammunition.
- **Natural attacks.** A creature type lists natural attack modes in the Combat-Unarmed tree. A mode tied to a Strike part follows Part 3's Strike role (Damaged −10, Crippled unavailable). A humanoid's unarmed mode has no part. \[Proposed\]
- **Blocking.** Any held melee mode can block, which meets the "shield or weapon" rule. Ranged, thrown and unarmed modes can't.
- **Default mode.** If an order names no mode, code uses the first held mode whose reach covers the target, else the unarmed mode.

### 6. Armor, shields and the damage step

- **Coverage.** An armor item lists the parts it covers ('general' for the general area). Hits on uncovered parts take no armor. Head cover comes only from the armor slot.
- **Protection.** One reduction and one multiplier per armor item. Placeholders: light 2 and ×0.8, medium 4 and ×0.65, heavy 6 and ×0.55.
- **Armor pools.** An armor item may add a pool to a covered part (a heavy helm on the head). The pool is a fixed number of points on the item entry, the same whoever wears it. After protection, damage drains that pool first; the rest reaches the part. The pool never counts on the health track. An empty pool absorbs nothing until repaired (D-89). \[Proposed\]
- **Shields.** A held shield adds its Non-essential part to the holder, off the hit table; a block at gap 0 or better sends the hit to it (Part 3, Weapons, armor and shields). Its pool is a fixed number of points on the item entry, the same in any hand. The pool's state is saved on the item instance, so damage survives swaps. A Destroyed shield is lost.
- **Natural armor.** A creature type may list natural armor with the same fields. It stacks with worn armor: worn first, then natural.
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
- **Minting** (for now): a variant = a base library item + quality tier 1–4 + public name and look. Code reads the tier's bonuses from QUALITY\_TABLE and writes a story blueprint, within the per-scene minted cap. A minted item with no close library match uses the nearest generic base: improvised\_light, improvised\_medium or improvised\_heavy for an odd weapon, curio (misc, no effects) for a thing with no game effect (Ali, 07/11/2026, loot L2).
- **Improvised items** (Ali, 07/11/2026, loot L3): when the player fights with a scene object not in the view, the Parser names an improvised base by size and a short name. Code writes a story blueprint (that base, the given name as name and look), puts it in the player's inventory and swaps it into hand before the attack. Improvised bases roll the Improvisation skill (Combat – Unarmed), carry hitAdj IMPROVISED\_HIT\_ADJ (*placeholder*, −10) and no kit bonus.
- **Boon** (Ali, 07/11/2026, loot V8): a reward's worth to the player. An item's Boon is its hand-set boon when it has one, else its value ÷ BOON\_COIN (20); a reward's Boon is that × qty, × BOON\_QUALITY (2/3/5/8) for a minted item of quality 1/2/3/4. Fractions are allowed. A plan's rewards together stay within BOON\_BUDGET by gain: none 0, minor 2, moderate 5, major 10, extreme 20. Boon is the only limit on rewards (no count cap). Only Weaver rewards count: NPCs' own template gear does not. All numbers are *placeholders*, to tune after playtests. The Weaver's item catalog lists each item's boon.
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
| D-8 | Sneaking; Stealth skills and Perception's third skill | 1–2 | Deferred | Skills are designed with character and mob generation; sneaking waits for the Stealth tree. Also open: what a larger contest gap does, and combined skill checks (such as sight with hearing) |
| D-9 | All-XXX checks use raw skill | 1 | To confirm | Assumed in Part 1 §5 |
| D-10 | XP sources and achievements | 1–2 | Partly settled | Settled 07/11/2026 (XP proposal X1–X10, Part 1 §5): defeats, library achievements, levels into a chosen class; kill XP from stat ratings (X18–X23); Weaver scene achievements dropped for D-108 (Ali, 07/11/2026); still open: quest XP (X8, held). Was: Part 1 §5 has Claude propose achievements for XP, but no agent output in Part 2 includes an achievement request, so XP currently has no source. Decide which agent or engine rule awards XP. Voyage playtest (07/11/2026): B4, an achievement or milestone must be granted only once; B8, XP must reconcile against its source trail |
| D-11 | Minting improvised items and NPCs | 1 | Partly settled | Claude proposes a new item or NPC and code assigns stats from a tier template. Minted content is a story blueprint, never written to the library. Items: a variant is a base library item + quality tier from QUALITY\_TABLE (Part 5 §7); further detail deferred with Loot and item creation. Voyage playtest (07/11/2026): C3, using the scene (terrain, objects) earned named modifiers; related OQ-22. Settled 07/11/2026: generic bases, improvised weapons and the Needs data list (Part 5 §7). Still open: NPCs, improvised tools and objects used other than as weapons |
| D-12 | Content database for items, loot and prices | 1 | Partly settled | Part 5 (Gear) sets the item data shape (Part 4 §9) and a prototype bank. Still deferred: loot tables, shops, trade, prices beyond the value placeholder |
| D-13 | Faction clocks | 1 | Deferred | Time advances with turns and faction clocks tick on their own. A faction here is a grand faction, unrelated to bands |
| D-14 | Skills and classes | 1, 4 | Deferred | Separate thread: general skills, class trees, exclusions, how classes unlock. Voyage playtest (07/11/2026): B11, ability requirements and cooldowns |
| D-15 | Status effects | 1, 4 | Deferred | Blessings, buffs, curses, debuffs: library entries, duration, and which rolls they modify, the situation roll among them |
| D-16 | One Planner call per actor | 2 | Provisional | Evaluate later against one call per group of actors who can talk to each other, or a commander layer; also decides shared plans, whether a spokesperson's answer can bind its band (commander layer), and coordination between allies, who also commit blind |
| D-17 | Fallback combat list | 2 | Under review | Which actors count as minor, and how rich their behaviors are. The prototype uses a fixed combat list in code (Fallback behavior). Later: a per-type, data-driven rule order once many creature types fight; tacticsLevel variants, such as level 3 calling for help first |
| D-18 | Call cap (MAX\_PLANNER\_CALLS) | 2 | Under review | The value, and which actors get calls first. Counts engaged significant actors only. Overflow runs its type's combat list \[Proposed\] |
| D-19 | Action economy | 2 | Parked | Decided: speech is an action and takes the main action, for everyone; words beside another action are a bark. The rest stays parked: a per-turn action limit is being considered, each action using 0–100% of it by type; covers move plus action and move timing |
| D-20 | Deferred actions | 2 | Parked | Run next turn unless new input, show as a queue, or drop; queuing many and typing "continue" is an exploit |
| D-21 | Player names something that doesn't exist | 2 | Parked | A clarify question can reveal what exists in the world. Voyage playtest (07/11/2026): F1, the player liked an impossible action failing inside the story instead of a clarify question |
| D-22 | What code produces, agents see, player sees | 2 | Parked | Separate document; includes roll numbers for Agent Narrator, SHOW\_MECHANICS and on-screen panels. Part 3's roll packet specifies part of this; Agent Narrator never gets roll numbers (Part 3, The packet). Includes whether the player sees the situation roll. Voyage playtest (07/11/2026): A1 one-line check summary, A2 typed update cards, D9 speaker labels and plain text, E3 location header, G2 quest text, G3 player-facing wording for rules text. Decided by Ali (07/11/2026, Voyage C2): no enemy health bars, by design; characters only know what they perceive |
| D-23 | Fallback narration form | 2 | Parked | Template text breaks immersion |
| D-24 | Streaming | 2 | Provisional | Off for now; revisit after playtests. Voyage playtest (07/11/2026): A5, narration paced line by line |
| D-25 | Improvement-roll timing | 2 | Settled | Settled 07/11/2026 (SP3, SP7): at the end of each engagement and at scene breaks; NPCs don't improve yet. Was: After each use, at scene end or at rest; whether NPCs improve. Part 1 §6 runs improvement at the end of a training action |
| D-26 | Ruleset module | 2 | Partly settled | First build: TIERS, situation, roll, attack, check and contested are built (Part 2, Resolution engine, First-build ruleset); the rest stays stubbed |
| D-27 | Body-part targeting | 2 | Settled | targetPart and aimed in the agent outputs (Part 2); aim penalty, gap ladder and location (Part 3) |
| D-28 | Event log retention | 2, 4 | Partly settled | Keep the last N turn records (placeholder); story history is never pruned. N stays deferred |
| D-29 | Who spawns enemies and weaves the story | 2–3 | Partly settled | Agent Weaver plans events, casts, stages and creature types. Still deferred: story beats and who calls sceneBreak (story-weaving thread) |
| D-30 | Scene breaks | 2 | Partly settled | Settled 07/11/2026 (P7): rest, beats with endsScene, and the stall fallback (Scenes); time skip (T6, Game clock). Still open: NPCs reacting on their own after a fight (P7 B2) |
| D-31 | Random rolls during a scene | 2 | Deferred | Iliad Quest-style encounter rolls while travelling or mid-scene. For now only the scene-start situation roll exists |
| D-32 | Computed grade check | 2 | Partly settled | Measuring a plan's challenge and gain from its cast and rewards. Settled 07/11/2026 (loot V8): rewards are held to the gain's Boon budget (Part 5 §7). Still open: measuring the cast's challenge, a passing stub until then |
| D-33 | Weaver effort | 2 | Dropped | Closed by Ali (07/11/2026, easy open questions Q10). The runtime accepts only low, medium and high, and the Weaver already uses high. Reopen if the runtime adds a higher level |
| D-34 | Definition of a major action | 2 | Deferred | Includes which actions end sneaking, and whether an observer arriving in view counts. Stub: every player action is major |
| D-35 | Marks and missed check-ins | 2 | Deferred | Bodies, forced doors and missing colleagues that unaware actors could notice. Left out of the first prompt to keep it simple |
| D-36 | Planner for failed ambushes | 2 | Deferred | Code onAlert order for now. Options reviewed: interrupt the turn at detection, a speculative Planner call in the background, or a fixed reaction stage in every turn |
| D-37 | Call count visible in network tools | 2 | Dropped | Closed by Ali (07/11/2026, easy open questions Q11). The play screen header shows the call count on purpose, so hiding it from network tools no longer matters |
| D-38 | CALM\_TURNS | 2 | Dropped | Deleted by Ali (07/11/2026, easy open questions Q12). Nothing used it; the alarm calm-down uses DECAY\_TURNS |
| D-39 | BACKGROUND\_WINDOW value | 2 | Deferred | Config; set at or above Agent Planner's usual latency after playtests |
| D-40 | Hide and detection tests | 2 | Deferred | One test per observer per action for now; revisit with the definition of a major action |
| D-41 | Out-of-character agent (/ooc) | 1–2 | Deferred | Code-only /help for now. An OOC agent would add a Claude call. Voyage playtest (07/11/2026): F3 a plain-text OOC question in the action box used a turn; F4 a side chat that answers questions without a turn |
| D-42 | Reloads and pending Planner outputs | 2, 4 | Deferred | Proposed: write each Planner output to a pending.\<turn> page outside the head bookmark and reuse it until the turn commits. This stops a reload from rerolling enemy plans and keeps test 13 across reloads. Until then a reload calls the Planners again |
| D-43 | Late and failed agent outputs | 2 | Settled | Settled by Ali (07/11/2026) as built: a late Planner output is discarded whole and the actor uses its combat list; the Responder and Voice share one fallback: one retry, then a neutral line as a talk action. Every late or failed Planner, Responder or Voice call is also filed for review in the play artifact's db at bugs/\<storyId>\_t\<turn>\_\<agent>\_\<actorId> (code planner\_late or agent\_fallback) |
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
| D-54 | Player incapacitated | 2, 3 | Partly settled | What the next turn is when the player is down: death, capture or rescue. Tied to the Weaver and Healing. Settled for the first build: the stage plan marks each opposing band lethal or not (Part 2, Agent Weaver). Lethal, the default: the story ends on a "you fell" screen that offers /undo or reset. Not lethal: one survival roll, roll() with no skill and no modifiers; Near Miss or better survives and wakes in a safe place at Critical, Failure or worse ends the story the same way. Capture and rescue stay deferred |
| D-55 | Triggers beyond the player | 2 | Deferred | player\_seen\_in\_zone and $player only watch the player; NPC-versus-NPC fights may need "enemy seen in zone" |
| D-56 | Total HP and its split between body parts | 3 | Settled | Part 3, Total HP and Body parts; the values wait for the balance pass (D-77) |
| D-57 | Damage calculation | 3 | Settled |  Part 3, Damage flow, and Part 5 §6, the damage step; values wait for D-77 |
| D-58 | Healing | 3 | Partly settled | Settled 07/11/2026 (H1–H15, Part 3 Healing): one healing-source table with a reach on the part-state scale; rest, clinic, bandage, natural recovery from endurance. Still open: first-aid skill, bleeding. Voyage playtest (07/11/2026): B5, healing amounts must be consistent |
| D-59 | How positive and negative modifiers combine per action | 3 | Settled | Part 1 §4, Stacking within a type; the values per type stay with D-75 |
| D-60 | Critical: "one action per turn" | 3 | Deferred | Unclear what it removes, since Part 2 already allows one move and one main action; settle with the action economy |
| D-61 | Recurring NPCs | 4 | Deferred | Stable NPC ids now; promotion adds modules. Voyage playtest (07/11/2026): D2, an NPC remembered a lie 15 turns later |
| D-62 | Temporary NPC linked to the place last seen | 4 | Deferred |  |
| D-63 | Telling temporary from recurring NPCs | 4 | Deferred |  |
| D-64 | NPC generation from templates | 4 | Partly settled | Settled in Part 4 §4: minimums, points, focus picks, random spend, personality, unique vs copy. Still deferred: level rules (level is fixed per template for now) and NPC perks |
| D-65 | Returning to a previous class | 4 | Deferred |  |
| D-66 | Swordsman class skills | 1, 4 | Deferred | Feint, riposte and disarm are named but have no effects; the player can raise them, and they do nothing yet |
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
| D-83 | Multiple attacks per turn | 2 | Deferred | Part of the action economy; the outnumbered modifier stands in for now |
| D-84 | Carry limit and encumbrance | 5 | Deferred | bulk exists on every item; capacity is infinite. Later: a carry limit per creature type, perk and item adjustments, what counts toward load, what happens past it |
| D-85 | Initiative as a gear target | 5 | Deferred | Heavy armor slowing initiative, and similar |
| D-86 | Conditional and granted effects | 5 | Deferred | Effects that apply only vs a creature type or in darkness; gear that grants statuses, perks or actions; movement and flight modifiers |
| D-87 | Dual wielding and versatile grips | 5 | Deferred | Off-hand attacks and penalties; weapons usable one- or two-handed with a bonus for two |
| D-88 | Armor depth | 5 | Deferred | Layers, armor-piercing weapons, damage types (already excluded for now), armor stealth penalties |
| D-89 | Durability and repair | 5 | Deferred | Wear on items other than pools; refilling shield and armor pools |
| D-90 | Containers, charges, keys, crafting | 5 | Deferred | Bags inside bags, items with uses, keys bound to doors, making items. Crafting plan (Ali, 07/11/2026, loot L4): a recipe consumes inputs and makes a check; outcome tier ID sets the quality (−1 plain base, 0 → 1, 1 → 2, 2 → 3, 3 → 4); failure tiers lose the inputs |
| D-91 | Consumable effects | 5 | Deferred | Healing and timed buffs; waits for Healing and Status effects |
| D-92 | Loot and item creation | 5 | Deferred | Loot tables, minting detail, items with no library base. Minting is base item + quality tier for now |
| D-93 | Shops, trade and prices | 5 | Planned | Approved by Ali (07/11/2026, playtest run 14 Q2): buying and trading for coin, goods or services, using the barter skill. Run 14: the player "bought a round of ale" for about 10 turns, but no ale appeared and his 20 coins never changed. Buying, selling, haggling, prices by place. value is a placeholder until then. Voyage playtest (07/11/2026): B3, a payment must happen once; B13, prices out of scale |
| D-94 | Hidden rewards and theft | 5 | Deferred | Containered or hidden rewards and searching for them, stealing, NPCs noticing a missing item, partial-perception gear cues (“a glint of steel”) |
| D-95 | ACCESSORY\_SLOTS value | 5 | Deferred | Placeholder 3; may vary by race or perk |
| D-96 | Ranged details | 5 | Deferred | Reloading. Range modifiers are set in Part 3 (Reach, range, cover and light); partial cover has its own row |
| D-97 | Gauntlets and unarmed damage | 5 | Deferred | Worn hand gear such as gauntlets may change unarmed damage while worn. Until such items exist, every unarmed attack without a class uses the unarmed profile (15 damage, +10 hit) |
| D-98 | Surrendered actors | 3 | Deferred | What the player can do with an actor that surrendered (take it prisoner, question it, let it go), and whether surrender lasts past the scene |
| D-99 | Movement speed | 3 | Deferred | How movement speed works beyond one zone link per turn, and how injured legs slow it; the Move role's movement effects wait for this |
| D-100 | Command buttons | 2 | Built | Decided by Ali (07/11/2026, Voyage A3): plan buttons on the Play screen that show the available commands (Part 1 §7). Built 07/11/2026 as the Commands panel |
| D-101 | Game clock | 2, 4 | Partly settled | Settled 07/11/2026 (T1–T11, Game clock): one clock, durations table, time of day, day counter, waiting. Still open: travel time. Voyage playtest (07/11/2026): E1, a trade took a day while 31 km of travel took no time; E2, NPCs said "yesterday" on day 1. Covers turn and command durations, travel time and a calendar NPCs can read. Related: D-13, D-49 |
| D-102 | Resource costs | 1 | Deferred | Voyage playtest (07/11/2026): B12, a failed spell still charged mana. There is no mana or other resource; when one exists, decide whether a failed action still pays |
| D-103 | NPC self-interest in exchanges | 2 | Dropped | Dropped by Ali (07/11/2026, easy open questions Q15). Voyage playtest (07/11/2026): D1, NPCs refused tips and bonuses. Whether Agent Responder and Agent Voice are told to keep their own interests in deals |
| D-104 | Attitude toward the player | 2, 4 | Deferred | Voyage playtest (07/11/2026): D4, a relationship score per NPC with labels; D5, threatening an NPC raised it. A Belief tracks awareness only and stance comes from bands (Part 2, Opposition); threats short of an attack have no lasting effect |
| D-105 | Quests | 2, 4 | Deferred | Voyage playtest (07/11/2026): D8, a duplicate quest for a job already taken; G2, quest text revealed secrets. Who creates quests and writes their text, a leak check on that text, and de-duplication. Quests are only {id, state, text} for now (Part 4 §9) |
| D-106 | Narration against NPC lines | 2 | Dropped | Closed by Ali (07/11/2026, easy open questions Q14). The Narrator no longer quotes lines and the play screen shows each heard line word for word, which removed the cause. Reopen if a playtest shows it again. Voyage playtest (07/11/2026): D7 |
| D-107 | Action ideas on request | 2 | Built | Decided by Ali (07/11/2026, Voyage A4; was OQ-23): a code-built list from PlayerView, shown when the player asks: people in view to talk to, exits, items held, actors in reach, grouped by tab (Talk, Move, Fight, Use) and refreshed each turn. No Claude call, so nothing can leak. Narrator rule 7 ("Do not list options") stays for the narration. Built 07/11/2026 as the Ideas panel on the Play screen (Fight, Talk, Move, Use side by side, three each) |
| D-108 | Achievement proposals | 1, 2 | Planned | Decided by Ali (07/11/2026, settles OQ-10): Claude may propose achievements, never grant them. A proposal goes to Ali for approval; once he approves, the feat is implemented as permanent code (a code rule that grants it), like the first-defeat achievement. Place state and promoted facts still come only from code rules. Which agent carries the proposal is open |

## Check on release

Decisions built as written for the first build, to be checked once the game is played. Unlike deferred items, these are settled for now; the check is whether they hold up in play.

| Item | Part | Rule for now | What to check |
| --- | --- | --- | --- |
| Where engagement applies | 2 | No place limit: an actor is engaged when it believes (suspicious or higher) in an active actor it is hostile to, wherever either one is | Whether distant actors make turns Tactical or spend Planner calls too often; if so, limit engagement to the stage or to the same place |
| Free gear ops | 5 | Drawing, stowing, swapping, accessories and picking up cost no action | Whether free accessory swaps (a ring before every check) or free pick up mid-fight feel exploitable |

## Open questions (answer before sharing)

These must be answered before the spec goes to a build agent. Each question has a fixed ID (OQ-n) that is never renumbered or reused; an answered question is removed and its ID retired. OQ-9 comes from the save data model (OQ-8 settled 07/11/2026 by XP X9); OQ-11 is about how Claude and code interact; OQ-13 comes from scene setup; OQ-14 from the actor-control review; OQ-22 from the ruleset review. Settled by Ali on 07/11/2026 and retired: OQ-4 (every attack on an unaware actor makes the ambush roll), OQ-5, OQ-6, OQ-15 (wounds: rolls only), OQ-16 (conditions stay in effective skill), OQ-17 (a graze never hits an essential part), OQ-20 (placeholder skill ids, renamed through library aliases) and OQ-10 (see D-108). A question with a build default is built that way until it is answered.

- OQ-9: The database holds at most 25,000 documents, shared by the library and every story. The caps on documents per collection, total size and write rate are not published. The build must measure them in a throwaway artifact (a full database refuses new documents) before N, the backup counts and the proposal caps are set.
- OQ-11: Prompt caching in the Claude-call capability (sample). Settled by the runtime 0.2.96 type definitions: the capability takes no system prompt (input is a prompt string or user/assistant turns under fixed platform framing; standing instructions go in a leading user turn), has no cache\_control or other prompt-caching option, and reports no token usage. Its only documented cache is answer replay: a call with the same input (every turn), modelTier, model, effort, images and verb replays the stored answer without contacting Claude, for 5 minutes by default or up to 24 hours with cache.gcTime. Replay never helps a call whose input changes. Still open: whether the platform caches a long shared prefix on its own. The docs don't say. Measure it with the Prefix Cache Probe artifact (same prefix vs. prefix changed at the first line vs. short prompt, timed to first text, quick tier, both input forms) and record the result here. Until then, cost and latency estimates assume no prompt caching. Catalogs (templates, creature types, routine sets, items) change only with libraryVersion, so they sit right after the fixed instructions as a stable prefix; they gain from prefix caching only if the probe shows the platform does it, and a library edit refreshes the prefix.
- OQ-13: Actors leaving the stage. Can NPCs follow the player across a frontier, or leave the stage on their own (pursuers, companions, fleeing enemies)? For now, orders into a frontier are dropped. Related: offscreen world changes (D-67).
- OQ-14: Stealth for actors other than the player. Posture, detection and ambush are player-only. Can a companion sneak with the player, and can an ally ambush an enemy that hasn't noticed it?
- OQ-22: Changing objects and places. In the first build a check or a contest only changes beliefs and reveals secrets (Part 2, Resolution engine). How one changes an object or a place, such as a forced door, a picked lock or a stolen item, is not designed yet.
  - Build default: nothing changes; the attempt is only narrated.
- OQ-28: Quests as a mechanic (Ali, 07/11/2026, Voyage UI check). Who creates a quest and writes its text, how the text is leak-checked and how duplicates are avoided (D-105). Until then the Play screen shows no quest line.
  - Build default: quests stay {id, state, text} and show only on the Quests page.

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
| stand\_watch | keeping watch | alert | 0 | 2 |
| walk | walking | normal | 1 | 2 |
| work | hard at work | normal | 2 | 2 |
| tend\_counter | tending the counter | normal | 1 | 2 |
| drink | nursing a drink | distracted | 1 | 2 |
| chat | chatting | distracted | 2 | 2 |
| sleep | asleep | asleep | 1 | 1 |
| rest | resting | distracted | 0 | 1 |
| cower | keeping out of sight | alert | 0 | 1 |
| ooze | oozing across the grass | normal | 1 | 2 |

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
| dagger | weapon | slash: melee light, reach 0 · throw: ranged light, reach 1, thrown | Kit +25 | 1 | 1 | 5 |
| arming\_sword | weapon | cut: melee medium, reach 0 | Kit +25 | 1 | 2 | 20 |
| greataxe | weapon | chop: melee heavy, reach 0 | Kit +25 | 2 | 3 | 30 |
| spear | weapon | thrust: melee medium, reach 1 (2 hands) · throw: ranged medium, reach 1, thrown (1 hand) | Kit +25 | 1–2 | 3 | 10 |
| shortbow | weapon | shoot: ranged light, reach 3 | Kit +25 | 2 | 2 | 25 |
| longbow | weapon | shoot: ranged medium, reach 4 | Kit +25 | 2 | 3 | 35 |
| crossbow | weapon | shoot: ranged heavy, reach 4 | Kit +25 | 2 | 3 | 40 |
| hidden\_blade | weapon, concealed | stab: melee light, reach 0 | Kit +25 | 1 | 1 | 30 |
| gambeson | armor, light | covers general, arms, both legs · 2, ×0.8 | Dodge −5 | — | 2 | 15 |
| mail\_hauberk | armor, medium | covers general, arms · 4, ×0.65 | Dodge −10 | — | 3 | 60 |
| plate\_harness | armor, heavy | covers general, arms, both legs, head, neck · 6, ×0.55 · head pool: 20 | Dodge −20 | — | 3 | 200 |
| round\_shield | shield | shield part, pool 30 | Kit +25 (Block) | 1 | 2 | 10 |
| signet\_ring | accessory, visible | — | none; shows the visible tag | — | 0 | 40 |
| lucky\_charm | misc | — | Situation roll +5, carried, any (noted roll modifier) | — | 0 | 50 |
| lockpicks | tool | — | lockpicking +25, inUse, withItem (placeholder skill id) | 1 | 0 | 15 |
| healing\_draught | consumable, stackable | — | none until Healing is designed | 1 | 1 | 10 |
| coin | misc, stackable | — | — | — | 0 | 1 |

Not items (ruleset config and creature database): the weapon class table (Part 3, Weapons, armor and shields); the unarmed profile, 15 damage and +10 hit; the humanoid's unarmed mode "punch" (class punch, unarmed\_strike, reach 0, no hands); QUALITY\_TABLE (Part 5 §7). Natural attacks and natural armor for other creature types arrive with their database entries.
