# Class unlocks

Kind: decision. How one class leads to the next. The classes and their unlock levels are in `src/library/data.ts`.

- **Capstones never unlock classes** (16/11/2026). A class that follows another unlocks when the earlier class or
  classes reach their top level (`ClassDef.unlockClass`), or by an alternative road such as a skill level
  (`orUnlocks`). It never unlocks through a perk. Reason: a capstone is the class's own reward, and progress between
  classes should read as class levels.
- `tests/unit/class-tree.test.ts` fails on any class link that is not a class level.
- The Legend capstone that opens every class stays: it is a bonus, not a required way in.
