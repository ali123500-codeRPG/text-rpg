### 11. Backups and playing from several PCs

One player, signed in to the same Claude account on every PC. Backups run on their own; the player never has to remember them.

**Several PCs.**

- The story lives in the artifact's database, not on the PC, so opening the game on any PC signed in to the same Claude account continues the same story.
- Nothing needed to resume a story is kept in browser storage. Browser storage holds only per-PC conveniences, such as panel layout.
- The turn lock lets one PC play at a time. A second PC that opens the game mid-turn is read-only until the lock's lease ends. A PC closed mid-turn loses nothing: that turn never committed, and its lease expires.

**Automatic backups, two layers.**

| Layer | What is copied | When | Kept | Protects against |
| --- | --- | --- | --- | --- |
| In-database backup | Every page the head lists, packed into as few documents as fit under 256 KiB, at stories/\<storyId>/backups/\<turn> | Every BACKUP\_EVERY turns (placeholder), and on load before any migration | Last K per story (placeholder) | A bad migration, corrupted pages, mistakes beyond one-turn undo |
| Off-artifact backup \[Proposed\] | A scheduled task copies every story's current pages and the library into a separate backup artifact's database | Daily (placeholder) | Last K per story (placeholder) | Deleting or losing the game artifact |

- Backups are written only by engine code or the scheduled task, never by an agent.
- A restore runs the same checks as a load (section 8). It first backs up the save it replaces, as a migration does (YS1 c), unless that save's pages no longer read back or it is the backup's own turn. Then it writes a new head pointing at the backup's pages, with no undo bookmark.
- The GM view lists backups and restores one on request. Backups are never shown to the player during play, so they can't spoil hidden plans or secrets. The one exception is a refused load: the creation screen offers the story's backups by turn number as ways back (section 10).
- In-database backups count toward the 25,000-document cap; size BACKUP\_EVERY and K together with N (OQ-9).
- Optional manual copy: an owner-only "Download backup" button in the GM view. It asks to confirm each time, so it supplements the automatic layers rather than replacing them.
- Before relying on the off-artifact layer, the build confirms that a scheduled task can read the game's database and write the backup artifact's database.
