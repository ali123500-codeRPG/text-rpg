# History: achievements and scars

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(the Achievements line in Part 1 section 5 and the D-n rows named here); the rows are library data, their IDs in
`src/library/achievementIds.ts`, their rewards read by `src/ruleset/achRewards.ts`.

- **Total defeats and deeds (09/11/2026; AC1-AC11; D-119, D-120).** The total-defeats chain adds to attack and
  defense rolls only, and levels add up along the chain (#164, #172; the adding-up was later fixed as BG-256).
  Deed achievements: crits count per skill group, a flawless win needs a defense roll, an outnumbered win needs
  no allies, and what is not earned yet stays hidden in play. Only race and body type chains are Banes (#177).
- **IDs, page and scars (09/11/2026).** Achievements have fixed numeric IDs and code names them only through the
  ID table; a new one takes the next free number (#171). The game got an Achievements page with a Scars tab; a
  scar is a negative achievement (#174). A scar pushes its own direction, never a weaker copy.
- **Class, level and mastery lines (09-10/11/2026; D-122, D-152, D-153, D-156, D-165).** Class-count chains, a
  peak per class tier and an achievement every so many character levels with its own name at each (#200, #302).
  Class tiers were named and the tiers chain gives free levels: level-ups that cost no XP, go into a class and
  never raise the next level's cost (#266, #268, #273). Bonus levels are character levels no class gets (#274).
  Each tree rating has its own mastery line, grander the higher (#299).
- **Tags (09/11/2026; TG1-TG9; D-129).** Seven tags, shared by scars (#205, #206).
- **Rewards by type (09/11/2026; RW1-RW9, T1-T20; D-128, D-130, D-131, D-135, D-138).** XP comes from one table
  (RW1), later one curve. The owner turned down hand-picked bonuses per achievement and asked for reward types
  first, mapped to achievements later. A higher level includes every lower level's reward by reference, so
  changing a lower row changes all above; a level drops one only through its own exclude list; replaced levels
  do not keep paying beside it (#206). Each reward is its own piece, so excluding one never touches another.
  First sight and race intelligence (#209); round 2 and worn titles, which an NPC knows only once it has seen
  the player (#236). Rewards are written as amounts added, never as "from x to y". Parked: D-124 to D-127,
  D-136; deferred: D-137.
- **More lines (09-10/11/2026).** Quest achievements and the first scar (D-143, #245); ideas page 2 (D-145,
  #248); spar achievements and totals earned (D-144, D-146, #249, #250); Loser scars (D-150, #257); morale
  achievements and the break scar (D-160, #292). Scars pay XP one reward level lower (D-151).
- **Grant check (10/11/2026).** Every row was checked in code. Fixed: selling counts toward the coin lines
  (#258); tree mastery is checked for every tree; a class's Awakened row is granted however the class opens,
  through one helper, `openClass` in `src/engine/xp.ts`; a win without a blow means no attack at all, and a miss
  is an attack (#263). A new way to open a class must go through that helper.
- **NPCs earn too (09/11/2026; D-148).** Achievements and scars are meant for permanent NPCs as well. The reward
  readers already take any actor; earning is still the player's only. What "permanent" means is deferred (D-148,
  #252), so every new rule is designed per actor, not per player.
- **Personality (11-13/11/2026; AP1-AP20; D-123, D-208).** A chain level adds one step on its axis while held,
  the step a config setting (#416). Losing scars lower Pride (#421). No points for a win without a blow, the
  survival chains or lost morale. A small task may give less than a step.
