# Save system review (#1218)

Working note. Checked 20/11/2026 on `main` at ad1d4d7 by reading `src/save/` and `src/agents/game.ts`, with failure
injection on `memoryStore` and `scripts/save-baseline.ts` (how to run it is at its top). The full report, with the
roadmap, is linked from #1218.

**Measured (village plus scaled copies; in-memory store, so round trips, not milliseconds, are the cost to watch):**

| Pages | Head | Save | Load | Backup turn |
| --- | --- | --- | --- | --- |
| 17 (village) | 2 KiB | 5 round trips: 2 get, 7 set, 6 delete, 2 list | 2 round trips, pages + 2 gets | +2 rounds, whole state written |
| 102 | 13 KiB | same | same | 245 KB written |
| 512 | 65 KiB | same | same | 1.4 MB written |
| 1,822 | 235 KiB (92% of 256 KiB) | same | same | 5.5 MB written |

- Every ordinary save took the same 5 round trips at any size, 2 of them cleanup (a list, then deletes). Since #1252
  cleanup is worked out from the replaced head: 4 round trips and no list call per ordinary save, re-measured with
  `scripts/save-baseline.ts`. The full sweep runs on backup turns and after undo or restore.
- The head holds the page map twice (head and undo); a safety bookmark made it three times until #1253 removed it. It
  passes 256 KiB at about 1,950 pages. Since #1251 the save checks its size first:
  past HEAD_WARN_SHARE of the limit it files head_large once, and past the limit the save is refused with a clear error.
- `artifactDbStore.list` reads one page of 1,000 documents. Past about 1,000 page documents, the sweep misses some stale
  versions: they stay forever (no loss, only growth toward the 25,000-document cap). Since #1252 only the sweep (backup
  turns, undo, restore) lists; ordinary turns never do.
- Backups write the whole state every BACKUP_EVERY turns, the largest write cost when amortised.
- Saved playtest worlds (`tests/soak/worlds`) had 9 to 16 pages by turn 49; all were schema 9, below
  OLDEST_SAVE_SCHEMA. #1229 retired them (YS4 a was already done), so no real long world is measured.

**Checked behaviour:**

- Meta and story text are not part of the commit. Meta holds settings, which undo and restore do not rewind either, so
  a meta that moved ahead mid-story is harmless. Two cases were bugs: BG-336 (a first save with no head) and BG-337
  (story text after a failed head write). Both fixed.
- BG-338 (fixed, #1225): after `/undo`'s head write, a failed delete was reported as "nothing to undo".
- A refused load had no way back in the game but a new character: `useBookmark` had no caller outside tests, and
  backups were listed only once a story had loaded. Since YS1 c (#1253) the creation screen offers one turn back,
  the backups and a new save; the safety bookmark and `useBookmark` are gone, and a restore backs up the save it
  replaces first.
- `MIGRATIONS` holds one step (v10 → v11, BG-312). The rule said to write no migrations; since YS3 b it allows small
  steps (a default or a renamed field), and BG-312's step is one.
- Archived stories kept every page, turn record and backup (D-73), counting toward the 25,000-document cap. Since
  YS2 b (#1254) archiving deletes the turn records and all but the newest backup; pages and meta stay.
