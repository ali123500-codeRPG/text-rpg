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
- **Event roll.** An effect may modify the event roll only when its entry names it. Such an effect may be carried. Code reads the player's inventory once, at scenario setup step 2. Only the player makes this roll.
