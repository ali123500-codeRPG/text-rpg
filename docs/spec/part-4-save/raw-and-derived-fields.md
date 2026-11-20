### 3. Raw and derived fields

The save stores only what can't be rebuilt. Everything recomputable is derived on every use and never written.

| Kind | Fields | Rule |
| --- | --- | --- |
| Derived | True skill, effective skill, Total, Burden, cap in effect, health-track level, part states, hit table, active item effects, gear bonuses, protection per part, grips and slots in use, race perk, class perks, character level, excluded skills | Never saved. Effective skill differs per check, so it can't be cached |
| History | Raw skills and their states, StartingTotal, all-XXX perks, level perks chosen, marks, classes and class levels, race, body type, part pools, minted item blueprints, item instances, shield and armor pool states | Saved as plain fields |
| Grey zone | XP, unspent perk points, Potential | Saved, with a source trail where the value can change |

- Potential is saved as a base plus a list of {source, delta, turn} adjustments, so a perk or event change can be traced or reversed.
- Character level is the sum of class levels unless a perk changes it, so it is derived.
- Values used at resolution (the Burden snapshot, the effective skill of a check, the event roll) go in the turn record, not on the sheet.
- Retuning never recalculates saved progress. Levels are stored and never lost. A retuned XP curve changes only the distance to the next level; if a character's XP already passes the new threshold, it levels up at its next XP award, not on load. A retuned perk-point rule applies only to future levels: points already earned and perks already bought stay.
