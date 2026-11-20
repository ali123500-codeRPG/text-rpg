### Damage flow and the roll packet

Code runs the whole exchange; Claude gets one packet afterwards and narrates from it.

1. **Setup** (once per body type): Agent Weaver names the body type in the stage plan; code loads it from the database and builds its hit table.
2. Attack roll (Part 1 §4, Layer 2b) with the weapon's skill. Aimed: add the aim penalty for the part's size. Tier shifts. Failure or worse: miss, end here.
3. Defense roll with the standing defense, then its tier shifts.
4. Gap = defense tier − attack tier + gap shifts; read the gap ladder (past +5: the +5 entry; past −10: +GAP\_PAST\_STEP a step, CS10). A 0× result ends here as dodged.
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
