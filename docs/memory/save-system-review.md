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

- Every ordinary save takes the same 5 round trips at any size. Cleanup (a list and some deletes) is 2 of them, and the
  narrator waits on all 5.
- The head holds the page map twice (head and undo), and three times while a safety bookmark is kept. It passes
  256 KiB at about 1,950 pages, or about 1,300 with a safety bookmark. Since #1251 the save checks its size first:
  past HEAD_WARN_SHARE of the limit it files head_large once, and past the limit the save is refused with a clear error.
- `artifactDbStore.list` reads one page of 1,000 documents. Past about 1,000 page documents, cleanup misses some stale
  versions: they stay forever (no loss, only growth toward the 25,000-document cap).
- Backups write the whole state every BACKUP_EVERY turns, the largest write cost when amortised.
- Saved playtest worlds (`tests/soak/worlds`) had 9 to 16 pages by turn 49; all were schema 9, below
  OLDEST_SAVE_SCHEMA. #1229 retired them (YS4 a was already done), so no real long world is measured.

**Checked behaviour:**

- Meta and story text are not part of the commit. Meta holds settings, which undo and restore do not rewind either, so
  a meta that moved ahead mid-story is harmless. Two cases were bugs: BG-336 (a first save with no head) and BG-337
  (story text after a failed head write). Both fixed.
- BG-338 (fixed, #1225): after `/undo`'s head write, a failed delete was reported as "nothing to undo".
- `useBookmark` (the undo or safety choice after a refused load, spec sections 8 and 10) has no caller outside tests.
  A refused load only shows a notice, and a backup can't be restored either: backups are listed, and restored, only
  once a story has loaded. So a refused load has no way back in the game but a new character, and the safety
  bookmark is never usable.
- `MIGRATIONS` holds one step (v10 → v11, BG-312). The rule said to write no migrations; since YS3 b it allows small
  steps (a default or a renamed field), and BG-312's step is one.
- Archived stories keep every page, turn record and backup (D-73), and they count toward the 25,000-document cap.
