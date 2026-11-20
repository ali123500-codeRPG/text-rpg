### 6. Armor, shields and the damage step

- **Coverage.** An armor item lists the parts it covers ('general' for the general area). Hits on uncovered parts take no armor. Head cover comes from a helmet or a body piece that covers the head (the plate harness). **Helmets** (IR21) are armor pieces of their weight's class with the Helmet type (head) or Helmet with neck: light arming cap, leather cap, secret; medium mail coif (head + neck), kettle hat, sallet; heavy nasal helm, bascinet (head + neck, its aventail), great helm; one fantasy-tagged peerless helmet per weight at Masterwork. A closed helmet costs nothing beyond its weight (IR22 d). A piece covers a part when its real garment covers most of it, with the source on the row (IR8, Ali 16/11/2026): gambeson torso and arms (Wikipedia "Gambeson"), mail hauberk torso and arms (to mid-thigh, "Hauberk"), boiled leather cuirass and brigandine the torso only ("Cuirass", "Brigandine"), lamellar coat torso and arms ("Lamellar armour"), half plate torso, arms and legs, plate harness all but its wearer's hands and feet.
- **Protection.** One reduction and one multiplier per armor item. The reduction is ARMOR\_FACTOR × need × ARMOR\_WEIGHT\_SOAK by weight (light 1, medium 1.5, heavy 2; D-368, placeholders); the multiplier comes from the weight (light ×0.8, medium ×0.65, heavy ×0.55). The multiplier is taken first and the reduction after it, so the flat soak takes most of a light blow and little of a heavy one. At Fine (need 50): light 4, medium 6, heavy 8.
- **Armor pools.** An armor item may add a pool to a covered part (a heavy helm on the head). The pool is a fixed number of points on the item entry, the same whoever wears it. After protection, damage drains that pool first; the rest reaches the part. The pool never counts on the health track. An empty pool absorbs nothing until repaired (D-89). \[Proposed\]
- **Shields.** A held shield adds its Non-essential part to the holder, off the hit table; a block at gap 0 or better sends the hit to it (Part 3, Weapons, armor and shields). Its pool is a fixed number of points on the item entry, the same in any hand. The pool's state is saved on the item instance, so damage survives swaps. A Destroyed shield is lost.
- **Natural armor.** A race may list natural armor with the same fields (BR6). It stacks with worn armor: worn first, then natural. A natural-armor pool has no saved state yet, so it absorbs nothing (parked: D-256).
- **Damage step** (replaces Part 3's damage roll):

```
base  = (WEAPON_CLASSES[mode.class].damage + mode.damageAdj) × (1 + DAMAGE_NEED_RATE × need) × damage perks   // CE11
dmg   = base × gapMultiplier(defense outcome)                 // Part 3, Defense
if worn armor covers the struck part:    dmg = dmg × worn.multiplier − worn.reduction    // D-368: share, then soak
if natural armor covers the struck part: dmg = dmg × nat.multiplier  − nat.reduction
dmg   = max(0, dmg)          # no rounding: fractions allowed (Ali, 07/11/2026)
if an armor pool covers the part: the pool absorbs first, the rest goes on
then Part 3: part pool, then the health track × impact (unchanged)
```

**Damage perks.** A perk can change damage at any step above: base, the gap multiplier, armor (reduction, multiplier or pool) or the final number. Each damage perk names its step, and code applies it there **\[Proposed\]**.

**Damage grows with the requirement** (CE11, CE8; *placeholder*). A weapon's damage is multiplied by 1 + DAMAGE\_NEED\_RATE (0.01) × its need (`damageGrowth` in src/library/gearScale.ts, `damageNeed` in src/ruleset/index.ts): +1% for every requirement point, whoever holds it, so a Crude weapon (need 0) keeps its class damage and every class grows by the same share (fists, daggers, swords and greataxes keep their order in damage a second at every level). Whatever is added to a mode's damage (damageAdj, a minted weapon's quality boost) is multiplied too. A natural attack or a bare hand has no requirement: the attacker's effective skill with it stands in, as Hide does for natural armor. An item with no requirement (an improvised weapon) does not grow. Arming sword (class damage 25): Common 31.25, Fine 37.5, Superior 43.75, Masterwork 50, need 150 62.5, need 200 75. *Scaling:* a straight line, like armor's soak and health, so nothing runs away; it almost keeps pace with plate (exact pace would be 1 ÷ 86 a point): a matched sword's plain hit through matched plate is 12.6 at 50, 11.5 at 100, 9.25 at 200 and stops getting through only past need 611.

The share before the soak bites light weapons hardest, so heavy weapons earn their hit penalty against armor. With the placeholders, a Fine medium weapon (37.5) drops a 100-HP fighter in 3 full hits unarmored, 4 in Fine light armor, 6 in medium and 8 in heavy.
