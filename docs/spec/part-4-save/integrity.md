### 8. Integrity

Only the engine writes the save, every load is checked, and the save stays inside platform limits.

**One write door.**

- The store accepts only typed engine operations. Agent outputs are a different type, so the compiler rejects passing one to the store.
- Agents receive copies built by the view builders, never live state.
- Claude in chat may read saves to debug and may write library entries when asked. It never writes story pages.
- The head lists a checksum for every page. A page changed from outside (by hand, or by Claude in chat) or torn by a half-finished save fails the check on load.

**Checks on every load.**

| Check | Examples | On failure |
| --- | --- | --- |
| Checksums | Every page matches its hash in the head | Refuse to load, ask the designer |
| Shape | Every page matches its schema version | Refuse to load, ask the designer |
| Invariants | Exactly one current class; character level = sum of class levels unless a perk says otherwise; every page carries the loaded story id; every actor's placeId equals its zone's placeId; every stage zone id resolves to a zone on its place page; no slot used twice per actor; every slot names a part the actor still has; no part covered by two worn items; stackables hold qty ≥ 1 | Refuse to load, ask the designer |
| References | Every id resolves: place, actor, fact, library entry (through alias or dormant) | Repair and report: drop the dangling link, list it in the GM view |

Raw skill above 100 is logged as a warning, not refused, because workaround mechanics for the mortal limit are coming. When a load is refused, the creation screen offers the ways back: one turn back, a backup, or a new save (YS1 c, section 10).

**Size budgets.**

| Item | Budget | When reached |
| --- | --- | --- |
| Any page | 256 KiB (platform) | Busy places split facts into more facts.\<placeId>.\<n> pages |
| Head (control/head) | 256 KiB (platform). It lists every page twice (its own map and the undo bookmark), so it grows with the world | Past HEAD\_WARN\_SHARE of the limit (placeholder), the save that crosses that line files a head\_large bug once. Past the limit the save is refused before anything is written, and the last good head is kept |
| Turn records | Last N (placeholder) | Oldest records are deleted; story history stays |
| Story text | HISTORY\_CHUNK\_TURNS turns per document (20) | A new document starts; nothing is pruned. If one document passes 256 KiB its lines keep their text and lose the code-built extras (mechanics, heard lines, changes) |
| Claude proposals | Fact text and name length; promotions and minted items per scenario (placeholders) | The validator rejects the proposal |
| Whole story | 25,000 documents per database, shared by the library and every story; total size and per-collection caps unpublished | Saving stops and the game says so. Data is never dropped silently |
