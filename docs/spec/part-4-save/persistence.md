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
stories/<storyId>/lists/<hash>        one part of the head's page list (D-1621), named by its content's hash
stories/<storyId>/control/lock        turn lock (lease)
stories/<storyId>/pages/<key>@<turn>  one page version, e.g. actor.rook@41
stories/<storyId>/turns/<turn>        one turn record
stories/<storyId>/backups/<turn>      one in-database backup (section 11)
stories/<storyId>/history/<n>         story text for turns n×HISTORY_CHUNK_TURNS onward
ops/republish                         the Republish button's saved task id (Play screen, Republish button)
```

Page keys: engine, hidden, actor.\<id>, place.\<id>, region.\<id>, facts.\<placeId>.\<n>, blueprint.\<id>, tile.\<tx>.\<ty>.\<n>.

**Tiles** (Ali, 21/11/2026, Questions hub "Splitting the world for saving", WT1 a, WT2 b: "b, but allow for flexibility"). The floor plan (walls, ways, roofs, lights, furniture) and what lies on the ground are saved by square tiles of the world frame, CONFIG.TILE_SIZE_M a side (set to the land's cell size), not by place: a record goes to the tile holding its anchor point (a wall's middle, a roof's middle, a way's or light's spot, a piece's or item's point), and a full tile splits into numbered parts under the page limit, as facts do. A title only names a space, so a place page keeps names (its titles, state and headlines), and a wall between two places has one home. People keep a page each, since they move. Every tile is still loaded, so all built ground stays live (WI8 a). Each tile page records its own size, so a save tiled at another size loads, and the next save regroups at the current one (the flexibility asked for). Before each save the live lists are put in tile order (`src/save/pages.ts` inTileOrder), so a reloaded state keeps the order of the saved one. Saves of schema 10 to 12 move to tiles once on load (MIGRATIONS 12). Everything on the ground has a point, so every record has an anchor (WT4 a, D-1623: an item off every title used to have none and went to tile 0,0); a saved person keeps their own point and height (GSM-24), and a save from before that gets them once on load (MIGRATIONS 14, GSM-130).

**Each person's page** (Ali, 21/11/2026, Questions hub "Splitting the world for saving", WT3 a: "a.", D-1621). Each person's share of the world-wide state is saved on their own actor page (`own`), not on the engine and hidden pages, so no page grows with the number of people: the recent events they keep (the ones `keptBy` in src/perception/index.ts keeps for them, the same rule pruneRecent uses), and their memory, plan and drive. An event seen by several people lives once, on the first page in actor order that keeps it: a copy on every perceiver's page would multiply the size by the crowd, and a page never holds more than its own person's kept history. Recent events no one present keeps stay on the engine page. Each event is saved with its place among its turn's events, so a load puts the live list back in order (recent events run in turn order). In play nothing changes: the state still keeps one list of recent events and the hidden store by actor id (`src/save/pages.ts` shareOut, fromPages).

**The head in parts** (WT10 b, D-1621). The head lists CONFIG.HEAD\_PART\_PAGES pages itself and the rest in parts of as many pages, each a document under lists/ named by the hash of what it holds, so an unchanged part is never written again and a part that no longer reads back refuses the load. The undo bookmark lists only the pages whose versions differ from the head's, and the head's pages the undo turn lacked; a load and a save rebuild it whole in memory. A head stored before schema 17 lists every page itself, twice, and still loads. The parts are written with the pages and cleaned up with them (save step 6).

**GM logs** (D-1621). The hidden page's GM view logs keep a set size: cast power its newest CONFIG.GM\_LOG\_ROWS\_CAST\_POWER rows (WT7 a, SHEET-362); the roles wanted and the templates, routines and deed ideas wanted fold into counted groups, at most CONFIG.GM\_LOG\_GROUPS\_ROLE\_WANTS and CONFIG.GM\_LOG\_GROUPS\_TEMPLATE\_WANTS, the least recently seen dropped (WT8 c, WT9, SHEET-319, SHEET-327; `src/scenario/wants.ts`).

Saves of schema 16 and older move each person's share to their page and fold the GM logs once on load (MIGRATIONS 16, GSM-130).

**Platform limits** (artifact runtime contract 0.2.96):

- 256 KiB per document, 32 levels deep; paths up to 16 segments of 200 bytes.
- No transactions; last writer wins. Hence the bookmark commit.
- An artifact's database holds at most 25,000 documents in total, shared by the library and every story. The other caps are not published; measured 21/11/2026 in a throwaway page (OQ-9, contract 0.2.98):
  - Total size: about 100 MB. It refused the 416th document of 240,000 bytes, with 95 MiB of document bodies stored. Over it, creating a document, or growing one, fails with quota\_exceeded ("reached its storage limit"); deleting frees room.
  - Documents per collection: no separate cap. One collection held 24,486 documents and the next create failed only at 25,000 in the whole database ("database is full").
  - Write rate: no limit met. A write takes about 0.3 s, so writes one at a time reach about 3.5 a second; 8, 32 and 128 in flight reached about 21, 35 and 45 a second, none refused. Rewriting one document in a loop also ran at about 3.5 a second.
  - So size runs out long before the document count: 25,000 documents average 4 KiB each at the size cap.
- Leases give a single-writer lock.

**Undo.** One turn. It points head back at the previous bookmark and drops that turn's record. The RNG does not roll back: the engine page keeps the undone turn's RNG state, so a retried action rolls new dice. Undo after a library edit is allowed; the restored state uses the new library from the next turn. Undoing the turn that started a scenario rerolls the event roll and runs Agent Weaver again, like any other dice. Undoing a turn that crossed a frontier reuses the held extension, if this session still holds it.

**Removed.** No named save slots and no /save export. Backups are automatic (section 11).

**Two windows.** The turn lock makes a second window read-only while the first plays.
