### Body parts

Every part carries a size, an impact and one or more roles, all stored in code. Each part's pool is a share of total HP set by its size: Extra small 15%, Small 20%, Normal 30%, Big 50% (placeholders; Tiny is not in use). Its state is measured as % of its own pool. The general area has no pool and no state.

Role penalties (Damaged and Crippled columns of the role table) are roll modifiers of type wounds.

An essential part (head, neck; the impact column) that is Crippled or worse adds a further wounds modifier of −7% of the average roll (CONFIG.ESSENTIAL_CRIPPLED_PENALTY) to every roll the character makes, once however many essential parts are crippled. Tough It Out counts the part one step milder, as for role penalties. The D-54 survival roll stays modifier-free.

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

Size is set per body type, not per part name: one body type can have big arms and small legs.

**Impact: link to the health track**

| Impact | Damage counted on the health track | When Destroyed |
| --- | --- | --- |
| Non-essential | None: the part absorbs it | Part is gone; total HP untouched |
| Normal | 1× | Part is gone |
| Essential | 1.5× | Total HP drops to 0 |

**Roles: what each state does**

| Role | Shared | Damaged | Crippled | Checks it applies to |
| --- | --- | --- | --- | --- |
| Sense (head) | Yes | −13% | −27% to all checks | Perception and mental checks when Damaged; every check when Crippled |
| Grip (arm) | No: per limb | −13% | Unusable: keeps holding its item but can't attack, block or use a tool with it; no two-handed actions. A Destroyed arm drops what it held to the ground (Part 5 §4). | Anything done with that limb: melee, shooting, climbing, fine work |
| Move (legs) | Yes | −13% | −27% to dodge (movement effects: D-248) | Dodge, athletics, stealth, fleeing |
| Fly (wing) | Yes | −13% to flying | Can't fly | Flight |
| Strike (tail, horns, bite) | No: per part | −13% to that attack | That attack is unavailable | Attacks made with the part |
| Speech (head) | Yes | −13% | −27% | Speech rolls: persuasion, intimidation, barter (Ali, 08/11/2026). With a Crippled head a speech roll takes both −27%s, stacked within the wounds type (SR4) |

- **Several roles:** a part can carry more than one (a dragon's head is Sense and Strike, for its bite); each role's effects apply.
- **Shared roles:** the penalty is split between the parts that have the role. A dragon has two Move parts, so one Damaged pair of legs gives −6.5%, not −13%. Role penalties are % of the average roll (PW1 b).
- **Per-limb roles** (Grip, Strike) are not split: each limb acts on its own. Two-handed actions take the worse arm's penalty.
- Code tags every skill with the roles it uses, so a Damaged left arm never touches a persuasion check.
- **Destroyed** (CS24): a Destroyed part's role penalty is DESTROYED\_PART\_WEIGHT (1.2) times the Crippled one (−32.4% where Crippled is −27%), on top of what Destroyed already does (off the hit table, its roles lost for good, an arm drops its item).

On/off effects of shared roles (no running, can't fly) switch on when Crippled and Destroyed parts reach SHARED\_ROLE\_OFF\_PCT (60%) of the role's parts (ruleset roleOff), with a Destroyed part counting DESTROYED\_PART\_WEIGHT (1.2) Crippled ones, the same weight as its role penalty (CS24). A dragon with one Crippled wing still flies (50%); one Destroyed wing grounds it (60%). A spider needs 5 of 8 legs Crippled, or 4 Destroyed.
