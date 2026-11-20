### Chosen design: health track + body parts

Every successful hit damages the body part it lands on and, depending on that part's impact, the health track. Total HP comes from endurance and the body type (Total HP); part pools are shares of total HP set by size (Body parts). Health-track levels and part states are % of those pools. Code owns all of it, including a database of body types: Agent Weaver names the body type, and code knows its parts.

- **Health track (World of Darkness):** levels by % of HP lost; one wounds modifier on every roll (Part 1 §4, Layer 2b; rolls only, not checks); each level is a trigger for perks, tactics and story.
- **Body parts:** every body type has a general area plus a list of parts. Each part has a size (hit chance and aim penalty), an impact (how its damage counts on the health track) and a role (what its states do); a part can have several roles. Parts are Healthy, Damaged, Crippled or Destroyed.
- **General area:** always present, stateless, normal impact, and always at least 30% of the hit table. Any damage that isn't aimed at, or doesn't land on, a specific part counts here.
- Attack and defense are two rolls; damage is not rolled. The attack roll is contested by the defender's dodge or block roll, and the gap between their tiers sets the multiplier and can move or restrict the location. Damage is fixed by weapon and armor. Perks can act on the attack roll, the defense roll, the gap or the damage values, each on its own.
- **One damage type** for now.
- WoD's sixth level "Crippled" is renamed **Critical**, so "Crippled" only ever means a body part.
