### Body type database

Code keeps every body type, its parts and the role table. Agent Weaver names the body type by catalog id in the stage plan; code loads the entry, builds the hit table, and tracks every part from then on.

```json
{
  "roles": {
    "sense": {"shared": true},
    "grip": {"shared": false},
    "move": {"shared": true},
    "fly": {"shared": true},
    "strike": {"shared": false},
    "speech": {"shared": true}
  },
  "bodyTypes": {
    "humanoid": {
      "general": {"name": "torso", "size": "normal"},
      "naturalAttacks": [{"id": "punch", "tree": "unarmed", "class": "punch", "skill": "unarmed_strike", "reach": 0, "grips": 0},
                        {"id": "grapple", "tree": "unarmed", "class": "grapple", "skill": "unarmed_grapple", "reach": 0, "grips": 0}],
      "parts": [
        {"id": "head", "size": "small", "impact": "essential", "roles": ["sense", "speech"], "adjacent": ["general", "neck"]},
        {"id": "left_arm", "size": "normal", "impact": "normal", "roles": ["grip"]},
        {"id": "right_arm", "size": "normal", "impact": "normal", "roles": ["grip"]},
        {"id": "left_leg", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "right_leg", "size": "normal", "impact": "normal", "roles": ["move"]},
        {"id": "neck", "size": "extra_small", "impact": "essential", "roles": [], "adjacent": ["head", "general"]}
      ]
    },
    "amorphous": {
      "general": {"name": "body", "size": "normal"},
      "naturalAttacks": [{"id": "slam", "tree": "unarmed", "class": "slam", "skill": "unarmed_natural", "reach": 0, "grips": 0}],
      "parts": []
    },
    "winged_quadruped": {
      "general": {"name": "body", "size": "big"},
      "parts": [
        {"id": "head", "size": "normal", "impact": "essential", "roles": ["sense", "strike", "speech"], "adjacent": ["general", "neck"]},
        {"id": "neck", "size": "small", "impact": "essential", "roles": [], "adjacent": ["head", "general"]},
        {"id": "left_wing", "size": "normal", "impact": "non_essential", "roles": ["fly"]},
        {"id": "right_wing", "size": "normal", "impact": "non_essential", "roles": ["fly"]},
        {"id": "left_foreleg", "size": "small", "impact": "normal", "roles": ["move"]},
        {"id": "right_foreleg", "size": "small", "impact": "normal", "roles": ["move"]},
        {"id": "left_hind_leg", "size": "small", "impact": "normal", "roles": ["move"]},
        {"id": "right_hind_leg", "size": "small", "impact": "normal", "roles": ["move"]},
        {"id": "tail", "size": "small", "impact": "non_essential", "roles": ["strike"]}
      ]
    }
  }
}
```

adjacent lists the parts a hit can move to at gap −2. Default when absent: the general area only. The general area is adjacent to every part. A body type is the shape only (BR1, Ali 08/11/2026): parts, general area, silhouette and the natural attacks the shape always has. Shape names are generic so later races can reuse them (BR4): the Slime race is amorphous and the Dragon race is a winged quadruped. Toughness (hpMultiplier), natural armor and a race's own natural attacks are on the race (BR2, BR3, BR6).

**One part per leg (BV7 a, BV8 a).** The Quadruped and the Winged quadruped have four leg parts (left_foreleg, right_foreleg, left_hind_leg, right_hind_leg), each size small, so the four together keep the odds the two pairs had (about 26.7% for a wolf). Running stops as for any shared role: 0.6 × 4 = 2.4, so three Crippled legs or two Destroyed. A natural attack that names a pair (claws: the forelegs; a kick: the hind legs) lists both legs (AttackMode.partIds): it works while either leg does and strikes with the better one. The Winged quadruped has a neck (size small, essential: a dragon's neck is long), adjacent to head and body.

**3D body figure (BV1–BV15).** Every body figure is a 3D figure drawn with three.js (BV14 a, src/ui/figure3d.ts): still and small in the condition pop-up, turnable (drag to turn, double-click to reset) on the character card, in the Body pop-up and in the library viewer (BV1 b). It never turns by itself; a part whose state changed pulses once at its beat (BV5 a, M-30). Colours: Healthy green, Damaged amber, Crippled red, Destroyed see-through (BV4 a); the part list beside it names each state in words. Each race shows an online model where one fits, otherwise its body type's built shape (BV10 a, src/library/figureModels.ts figureKey; a race with a man's and a woman's model picks by pronouns), split into the body type's part ids by the model's bones (BV11 a). Models are CC0 or CC-BY 4.0, credited on the library viewer's cards (BV12 b, FIGURE_CREDITS). Size (BV3 a): one even scale from the race's head-and-body length (height for an upright figure), then each measure stretched by the being's size ÷ its race's; there is no figure size table. Ground (BV6 a, Body pop-up only): the footprint capsule, rings, and a faint person of the human body type's size beside any non-person up to 20× a person's height. Files (BV15 a): scripts/figures.mjs (npm run figures) bakes each model in assets/figures/models, and each built shape (scripts/figureShapes.mjs), into one shrunk file assets/figures/<key>.json (about 50 KB: at most 6,000 triangles, quantised); the build copies them beside each page and a figure fetches its file only when first shown. A test checks every figure file exists and carries exactly its body type's part ids.

**Healing and Heal (NR2, NR33 to NR35).** Healing (SK44) is the one skill of the Medicine tree (TR18, closed to bodies with no hands), with its own function (healing, FN19) in its own group (Medicine, GR13; XP half). It opens one thing for now: **Heal**, at true Healing CONFIG.HEAL\_UNLOCK (50). Heal is an action (Parser action heal) on oneself or on someone alive within arm's reach: a Healing roll at moderate difficulty gives back a share of what is missing (the worse of health lost and the worst part), by tier: Near Miss 5%, Success 10%, Great Success 15%, Critical Success 25%, then +10% per step past it (CONFIG.HEAL\_TIER\_SHARE, HEAL\_PAST\_STEP; placeholders), through the Heal healing row (HL8, reach Damaged). Below Near Miss nothing mends; with nothing to mend it is logged heal\_blocked. It takes as long as binding a wound (the bandage row) and costs only that row's effort until another resource exists (D-340). It is a spell in name (NR35 a): it works with no mana now and gets a mana cost when magic is designed; the Narrator tells only the result, never a glow. Only the player is offered it for now (NPC agents can be given it later); the Healer role trains Healing in its High band. The deck shows Heal once true Healing is 50.

**Animal body types (NR14 a).** Quadruped (BT4: head that bites and carries in the jaws, neck, four legs, tail), Serpent (BT5: head, coils, tail; no grip) and Eight-legged (BT6: head and eight legs; no grip). Speed is the race's, not the body type's (RaceDef.speed, AB1 c), so one Quadruped serves a dog and a tiger. Animal races, each with real speeds, life stages and its own natural attacks (bite, claw, kick, gore, tail lash, constrict): Dog RC5, Wolf RC6, Tiger RC7, Bear RC8, Wild boar RC9, Horse RC10, Monitor lizard RC11 (Komodo-sized), Python RC12, Giant spider RC13 (AB8 a: a wolf-sized monster on the Eight-legged shape), Lion RC14, Leopard RC15, Hyena RC16, Crocodile RC17 (AB14 a). HP multipliers are (mass ÷ 70 kg)^(2/3) (AB6 a). Wild boar, monitor lizard and crocodile carry natural armor (AB13 a). Snakes and spiders can learn Tremor (AB11; its tree is now Tremor senses); slimes smell instead (AB19 a: Scent replaces Tremor on the slime template and the Gel Patience essence). **Natural attack skills** (AB16 a): Natural weapons split into Bite, Claws, Hooves and Horns (kick, tusks, horns), Tail (tail lash) and Slam (the slime's body blow; it keeps the old Natural weapons ID SK10, so slimes keep their points). Each skill, and the tree, opens only to the bodies and races that have an attack rolling it, worked out from the attacks; a Python's constrict rolls Grapple. A beast's role lists all five and an NPC trains only those its body can use (role and theme bands are filtered by access). The dragon got a bite and a tail lash, and weighs about 1,000 kg, HP ×5.9 (AB17 a). **Scent** (AB18 a): a skill with its own sense function (smell, Notice group), in the Perception tree, open to the animals and slimes, anyone else only through an essence. Anyone within Scent-skill metres along the open ways (the straight line where they see each other, else the walking path through the doorways: walls stop a smell) is perceived partly by smell, seen or not, in any light (perception smells): something is there, not who, and a smell is never made out. Stealth contests against a smell roll Scent, and a search rolls Scent when it beats sight and hearing. Scaling: 50 m at Scent 50, 100 m at 100, growing in a straight line past it. **Hide** (AB20, "one equation, different multiplied depending on the race"): natural armor stops ARMOR\_FACTOR × the owner's Hide skill × the race's hide multiplier (ruleset naturalReduction, the worn-armor equation with Hide in place of the need), after the light armor multiplier (D-368: the share first, then the soak). Race multipliers (estimates): wild boar 1 (a gristle shield), monitor lizard 0.8 (small bony scales), crocodile 1.5 (large bony plates); Hide 25 at 1 is Common light armor. Hide sits in Combat – Defense, opens only to races with natural armor, and has no function, so nothing stands in for it. Animals are not playable (AB4) and may wield what their jaws can hold (AB5 b). A race trains its rank's years × its Adult start ÷ 18 (AB7 a, CONFIG.TRAINING_ADULT_AGE). Venom waits on D-322 and flight on D-323.

**Body types not in the database**

1. Agent Weaver names a type that is not in the catalog.
2. Stage-plan validation fails; the one repair retry sends the list of existing types, and the Weaver picks the closest fit. No extra call.
3. Code runs the encounter on that type and flags the substitution to you (the name asked for and the type used), so you can enter its own data. Data entered mid-story goes to the story's blueprints (Part 4 §2); only you promote it to the library.
