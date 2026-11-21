### 10. Save and load flow

A save counts only once the head is written, so a crash at any earlier step leaves the last good save intact.

**Save, once per turn:**

1. Hold the turn lock: acquire control/lock at turn start and renew it while the turn runs. If it is busy, this window is read-only.
2. Resolve the turn in memory (Part 2), including scenario setup or stage extension when the turn starts a scenario or crosses a frontier. A turn stopped by a clarify question saves nothing.
3. For each page whose content changed: serialize it, check it is under 256 KiB (split facts pages if not), hash it, write pages/\<key>@\<turn>.
4. Write turns/\<turn>, and the story meta (stories/\<storyId>) when it changed. They go out together with step 3. A load needs the meta whenever a head exists, so it can't wait for the commit. A story counts as existing only once its head is written: a meta with no head (a first save whose head write failed) is not listed and does not keep a world taken (BG-336).
5. Write control/head: the new turn, the full page map in parts (its further parts go out with step 3), undo = the previous head's bookmark as its changes (section 6, D-1621). This is the commit. Its size is checked before step 3 writes anything (size budgets, section 8).
6. Clean up: delete page versions that no bookmark (head, undo) points to, and turn records older than the last N. An ordinary turn works these out from the head it replaced (the versions only its bookmarks held, and the record that just fell out of the last N), with no list call. Every BACKUP\_EVERY turns, and after an undo or a restore, both collections are listed and swept, which also removes what a failed write left behind.
7. After the narration is shown, and only if step 5 committed, write the story text: every history/\<n> document the turn's new lines fall in, rewritten whole. It is not part of the commit, so a failure costs only text. Loading a story reads every history document, so a reload shows the whole story column (Q18). A turn whose head write failed keeps its text in memory, and the next good turn writes it, so the saved text never runs ahead of the head (BG-337).

On unavailable, retry the failed write once. On quota\_exceeded, stop, keep the last good head, and tell the player.

**Undo:**

1. Hold the turn lock.
2. Read the undone turn's final RNG state from the current engine page.
3. Point head at the undo bookmark, with undo set to null.
4. Write a new engine page version carrying that RNG state forward, and add it to the head.
5. Delete the undone turn's record.

**Load:**

1. Read control/head and its parts, then every page it lists. Verify each checksum.
2. If the save's schema version is older: write a backup of it (section 11), run the numbered migration steps in order, and drop the undo bookmark, whose pages are in the old schema.
3. If the library version changed: reconcile every library reference (section 7).
4. Validate shape, invariants and references (section 8). A structural failure stops here with the save untouched, and the creation screen offers the ways back (YS1 c): go back one turn (when the save has an undo bookmark; its pages are checked like a load, and the refused turn's pages are never read), restore one of the story's backups (newest first), or start a new save on the creation screen itself.
5. If steps 2 to 4 changed anything, write the changed pages and a new head, as in save steps 3 and 5.
6. Build in-memory state from the pages. The game is ready.
