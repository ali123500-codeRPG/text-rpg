### 6. Persistence

The save is many small versioned pages in the artifact's database, committed by flipping one bookmark. State is never rebuilt by re-running old turns, because the library always moves to its latest version and replay under a newer library would change the past.

**Three records.**

| Record | Holds | Kept |
| --- | --- | --- |
| Snapshot (head bookmark) | The page versions that make up the story at turn start | Current and one turn back |
| Turn record | Player text, agent outputs, RNG state before, events with effects, facts added, library version | Last N (placeholder) |
| Story history | Facts and promoted headlines | Never pruned |

**Where it lives.** The artifact's db capability, not browser storage and not a self-republishing page. Database paths (even segment counts, as the platform requires):

```
library/meta                          libraryVersion, alias table
library/<kind>.<id>                   one library entry, e.g. library/body_type.dragon
stories/<storyId>                     story meta
stories/<storyId>/control/head        the bookmark
stories/<storyId>/control/lock        turn lock (lease)
stories/<storyId>/pages/<key>@<turn>  one page version, e.g. actor.rook@41
stories/<storyId>/turns/<turn>        one turn record
stories/<storyId>/backups/<turn>      one in-database backup (section 11)
stories/<storyId>/history/<n>         story text for turns n×HISTORY_CHUNK_TURNS onward
ops/republish                         the Republish button's saved task id (Play screen, Republish button)
```

Page keys: engine, hidden, actor.\<id>, place.\<id>, region.\<id>, facts.\<placeId>.\<n>, blueprint.\<id>, tile.\<tx>.\<ty>.\<n>.

**Tiles** (Ali, 21/11/2026, Questions hub "Splitting the world for saving", WT1 a, WT2 b: "b, but allow for flexibility"). The floor plan (walls, ways, roofs, lights, furniture) and what lies on the ground are saved by square tiles of the world frame, CONFIG.TILE_SIZE_M a side (set to the land's cell size), not by place: a record goes to the tile holding its anchor point (a wall's middle, a roof's middle, a way's or light's spot, a piece's or item's point), and a full tile splits into numbered parts under the page limit, as facts do. A title only names a space, so a place page keeps names (its titles, state and headlines), and a wall between two places has one home. People keep a page each, since they move. Every tile is still loaded, so all built ground stays live (WI8 a). Each tile page records its own size, so a save tiled at another size loads, and the next save regroups at the current one (the flexibility asked for). Before each save the live lists are put in tile order (`src/save/pages.ts` inTileOrder), so a reloaded state keeps the order of the saved one. Saves of schema 10 to 12 move to tiles once on load (MIGRATIONS 12). Everything on the ground has a point, so every record has an anchor (WT4 a, D-1623: an item off every title used to have none and went to tile 0,0); a saved person keeps their own point and height (GSM-24), and a save from before that gets them once on load (MIGRATIONS 14, GSM-130).

**Platform limits** (artifact runtime contract 0.2.96):

- 256 KiB per document, 32 levels deep; paths up to 16 segments of 200 bytes.
- No transactions; last writer wins. Hence the bookmark commit.
- An artifact's database holds at most 25,000 documents in total, shared by the library and every story. Documents per collection, total size and write rate are also capped, but those numbers are not published.
- Leases give a single-writer lock.

**Undo.** One turn. It points head back at the previous bookmark and drops that turn's record. The RNG does not roll back: the engine page keeps the undone turn's RNG state, so a retried action rolls new dice. Undo after a library edit is allowed; the restored state uses the new library from the next turn. Undoing the turn that started a scenario rerolls the event roll and runs Agent Weaver again, like any other dice. Undoing a turn that crossed a frontier reuses the held extension, if this session still holds it.

**Removed.** No named save slots and no /save export. Backups are automatic (section 11).

**Two windows.** The turn lock makes a second window read-only while the first plays.
