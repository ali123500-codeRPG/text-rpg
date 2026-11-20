### 7. Versioning and migration

Three things can change under a running story, and each has its own rule.

| What changes | Example | Rule |
| --- | --- | --- |
| Save shape | Code adds or moves a field | Numbered migration steps, run in order on load (v3 → v4 → v5). Defaults for missing fields are allowed only inside a step |
| Library entries | A dragon gains a tail; a perk is revised | Reconcile on load (table below) |
| Ruleset numbers | K, tier tables, penalties | Derived values follow automatically. Saved levels, XP and perk points keep their values; a new XP curve or perk-point rule applies from the next level (section 3) |

**Library reconcile rules.** The library keeps a status per entry, so saves always know where an id went.

| Entry status | Effect on a save |
| --- | --- |
| Added | New body part starts Healthy; new skill starts at its default |
| Revised | New effect applies at once (effects are derived) |
| Renamed | Library keeps old id → new id; saves follow the alias and keep raw values |
| Replaced | Old id points to its successor; saves move to the new entry |
| Deleted | Perk, skill or class stays dormant on the sheet: kept, not applied, shown in the GM view. A removed body part's pool is dropped |

**Oldest save (MG2).** While the prototype keeps no old saves (D-116), MIGRATIONS is empty and one setting draws the line: a save older than OLDEST\_SAVE\_SCHEMA is refused with OLDEST\_SAVE\_REASON ("made before the land" for schema 9, which added the land, WZ12) and is left as it was; a world older than it is not offered to carry on. A change that ends old saves raises SCHEMA\_VERSION and OLDEST\_SAVE\_SCHEMA together. Regions are saved as pages `region.<id>`.

**Resets.** A change too big to migrate may reset the story, but only after the designer confirms it. Code never resets on its own. If a migration can't run, the game refuses to load, leaves the save untouched, and asks. A confirmed reset archives the old story: its pages and backups stay under its own id, and play starts a new story id (D-73). The GM view has a **Start a new save** button (Ali, 08/11/2026): it warns that the current story ends and play can't return to it, offers Download backup, and only a second click archives the story (its meta gets `archivedAt`, so the newest story list skips it) and goes to Create. The "You fell" screen's Reset does the same.

**Safety bookmark.** Before migrating, load keeps the pre-migration bookmark. It is dropped after the next good turn.
