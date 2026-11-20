### 10. Save and load flow

A save counts only once the head is written, so a crash at any earlier step leaves the last good save intact.

**Save, once per turn:**

1. Hold the turn lock: acquire control/lock at turn start and renew it while the turn runs. If it is busy, this window is read-only.
2. Resolve the turn in memory (Part 2), including scenario setup or stage extension when the turn starts a scenario or crosses a frontier. A turn stopped by a clarify question saves nothing.
3. For each page whose content changed: serialize it, check it is under 256 KiB (split facts pages if not), hash it, write pages/\<key>@\<turn>.
4. Write turns/\<turn>.
5. Write control/head: the new turn, the full page map, undo = the previous head's bookmark. This is the commit.
6. Clean up: delete page versions that no bookmark (head, undo, safety) points to, and turn records older than the last N.
7. After the narration is shown, write the story text: every history/\<n> document the turn's new lines fall in, rewritten whole. It is not part of the commit, so a failure costs only text. Loading a story reads every history document, so a reload shows the whole story column (Q18).

On unavailable, retry the failed write once. On quota\_exceeded, stop, keep the last good head, and tell the player.

**Undo:**

1. Hold the turn lock.
2. Read the undone turn's final RNG state from the current engine page.
3. Point head at the undo bookmark, with undo set to null.
4. Write a new engine page version carrying that RNG state forward, and add it to the head.
5. Delete the undone turn's record.

**Load:**

1. Read control/head, then every page it lists. Verify each checksum.
2. If the save's schema version is older: keep a safety bookmark, run the numbered migration steps in order.
3. If the library version changed: reconcile every library reference (section 7).
4. Validate shape, invariants and references (section 8). A structural failure stops here with the save untouched, and the designer chooses: undo bookmark, safety bookmark, or a confirmed reset.
5. If steps 2 to 4 changed anything, write the changed pages and a new head, as in save steps 3 and 5.
6. Build in-memory state from the pages. The game is ready.
