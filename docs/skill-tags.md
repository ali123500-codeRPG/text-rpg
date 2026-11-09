# Skill tags

Every skill in `src/library/data.ts` (SKILLS) carries these tags. Code reads them to decide which skills a check, a
perk or a wound touches. Ali asked for this list on 07/11/2026 (perk A8).

| Tag | Values | Used for |
|---|---|---|
| Tree | melee, ranged, unarmed, natural, defense, armor, perception, stealth, speech, swordsman, slime_senses, tools | Tree-wide perks (the tree rule), the Perks screen |
| Functions (narrow, one or more) | arms, unarmed, ranged, defense, armor, health, sight, hearing, stealth, influence, initiative | Stand-ins: a skill sharing a function stands in for a missing one |
| Group (broad, from the functions) | melee, ranged, defense, health, notice, stealth, influence, speed | The 40 perk's +1 (every skill sharing a group with the ladder skill), XP category |
| Situation tags | sight, hearing, stealth, hide, ranged | Which situational tables reach the skill's rolls (CONFIG.SITUATION_TAGS, Ali 08/11/2026, ST21): light hurts sight and helps stealth; cover helps hide and hurts ranged. No table reads hearing yet. An action can add a tag (a Hide adds hide, ST22) |
| Roles | grip, strike, move, sense, fly, speech | Which wounded body parts lower the roll |
| Cue | sight, sound (notice skills only) | Which cue a notice roll reads |
| XP category | offensive, defensive, endurance, notice, influence, misc | XP ratings (X18–X23); comes from the group unless a skill sets its own |
| Player open | yes / no | Whether the player can buy the skill |

## Every skill

Groups and functions (Ali, 08/11/2026, F1–F8). One table in `src/library/functionNames.ts` (FUNCTION_GROUP) puts each
function in its group; adding a function or group is one row there.

| Group | Function | Skills |
|---|---|---|
| Melee | arms | melee_light, melee_medium, melee_heavy (tree "Combat – Arms") |
| Melee | unarmed | unarmed_strike, unarmed_grapple, unarmed_improvised, unarmed_natural |
| Ranged | ranged | ranged_light, ranged_medium, ranged_heavy |
| Defense | defense | dodge, block |
| Defense | armor | light_armor, medium_armor, heavy_armor (tree "Armor – Conventional", AR1–AR3) |
| Health | health | endurance |
| Notice | sight | sight, tremor |
| Notice | hearing | hearing, tremor |
| Stealth | stealth | sneaking, combat_stealth, vanishing |
| Influence | influence | persuasion, intimidation, barter |
| Speed | initiative | dodge (the best one adds to the initiative d100) |
| none | none | feint, riposte, disarm (placeholders), lockpicking |

| Skill | Tree | Roles | Cue | Situation tags |
|---|---|---|---|---|
| melee_light, melee_medium, melee_heavy | melee | grip | | sight |
| ranged_light, ranged_medium, ranged_heavy | ranged | grip | | sight, ranged |
| unarmed_strike, unarmed_grapple, unarmed_improvised | unarmed | grip | | sight |
| unarmed_natural | natural | strike | | sight |
| dodge | defense | move | | sight |
| block | defense | grip | | sight |
| endurance | defense | | | |
| light_armor, medium_armor, heavy_armor | armor | | | |
| sight | perception | sense | sight | sight |
| hearing | perception | sense | sound | hearing |
| sneaking, combat_stealth | stealth | move | | stealth |
| vanishing | stealth | move | | stealth, hide |
| persuasion, intimidation, barter | speech | speech | | |
| feint, riposte, disarm (placeholders) | swordsman | grip | | |
| tremor (slime only, tier 0) | slime_senses | sense | sound | hearing |
| lockpicking (placeholder) | tools | grip | | |

Persuasion and barter also need a speaking race (race tag `speaks`: Human, Elf); intimidation does not (SR1, Ali 08/11/2026).

## Substitutes

By default a skill that shares a function counts at `CONFIG.SUBSTITUTE_EFFICIENCY` (0.3×, F4; was 0.5×). Sight and
hearing don't stand in for each other; an untrained sense stays untrained (F5: deafness is real). A skill can have its
own table in `CONFIG.SUBSTITUTES` instead. The grapple check (unarmed_grapple) uses other unarmed skills at 0.4× and arms
skills at 0.2× (Ali, 07/11/2026). A perk can move the share (`PerkDef.standIn`: `add`, optionally only for one
function); the share stays within 0–1. Weight and armor tags (light, medium, heavy) sit on attack modes and
items, not on skills.
