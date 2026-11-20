### 3. What an effect can do

Three kinds, all subject to §2's activation and to a scope (withItem: only actions made with this item; any: every roll or check of that kind while active).

1. **Skill bonus (default).** A flat bonus or penalty to named skills, entering effective skill (Part 1 §3). It counts in full in checks and at the roll's skill weight in rolls. The standard kit bonus is one +25 per roll, shared by all kit pieces, so two kit pieces that both apply still give +25 (Part 1 §3). Armor weight is a skill penalty on Dodge and Parry alike (LG23 a, Ali 19/11/2026): ARMOR\_DEFENSE\_COST × the piece's need, by weight, light −0.1, medium −0.2, heavy −0.4 a point of need (*placeholders*), so a Fine (need 50) piece costs −5, −10, −20, a Masterwork one −10, −20, −40, a Mythic (200) one −20, −40, −80, and a Crude one nothing (src/library/gearScale.ts armorDefenseCost, read by ruleset/gear effectValue). It grows with the need with no top, so it keeps its weight past 100, where the wearer's Dodge and Parry are as high as the need asks.
2. **Item stats.** Read by the combat flow, never stacked as modifiers: weapon modes (§5), armor protection and pools, shield part (§6).
3. **Noted roll modifier (rare).** A flat modifier on one roll kind (hit, dodge, block, perception, stealth, event), of type gear (Part 1 §4, Layer 2b), only when the entry says so. The weapon hit adjustment is one: it applies at full value on the hit roll.

Every gear modifier enters the check or roll request as its own entry, naming its item and state, e.g. "Gear (held): arming sword". How gear modifiers combine with perks and statuses is decided by the modifier-stacking rules, not here. Initiative is not a gear target yet (D-85).
