# Skill tags

Every skill in `src/library/data.ts` (SKILLS) carries these tags. Code reads them to decide which skills a check, a
perk or a wound touches. Ali asked for this list on 07/11/2026 (perk A8).

| Tag | Values | Used for |
|---|---|---|
| Tree | melee, ranged, unarmed, defense, perception, speech, swordsman, slime_senses, tools | Tree-wide perks (the tree rule), the Perks screen |
| Functions | melee_attack, ranged_attack, unarmed_attack, defense, notice, influence, hp | Substitutes: a skill with a shared function stands in for a missing one |
| Roles | grip, strike, move, sense, fly | Which wounded body parts lower the roll |
| Cue | sight, sound (notice skills only) | Which cue a notice roll reads |
| XP category | offensive, defensive, endurance, notice, influence, misc | XP ratings (X18–X23) |
| Player open | yes / no | Whether the player can buy the skill |

## Every skill

| Skill | Tree | Functions | Roles | Cue |
|---|---|---|---|---|
| melee_light, melee_medium, melee_heavy | melee | melee_attack | grip | |
| ranged_light, ranged_medium, ranged_heavy | ranged | ranged_attack | grip | |
| unarmed_strike, unarmed_grapple, unarmed_improvised | unarmed | unarmed_attack | grip | |
| unarmed_natural (creatures only) | unarmed | unarmed_attack | strike | |
| dodge | defense | defense | move | |
| block | defense | defense | grip | |
| endurance | defense | hp | | |
| sight | perception | notice | sense | sight |
| hearing | perception | notice | sense | sound |
| persuasion, intimidation, barter | speech | influence | | |
| feint, riposte, disarm (placeholders) | swordsman | | grip | |
| tremor, taste (slime only) | slime_senses | notice | sense | sound / none |
| lockpicking (placeholder) | tools | | grip | |

## Substitutes

By default a skill that shares a function counts at `CONFIG.SUBSTITUTE_EFFICIENCY` (0.5×). A skill can have its own
table in `CONFIG.SUBSTITUTES` instead. The grapple check (unarmed_grapple) uses other unarmed_attack skills at 0.4× and
melee_attack skills at 0.2× (Ali, 07/11/2026). Weight and armor tags (light, medium, heavy) sit on attack modes and
items, not on skills.
