# History: first playtest review, speed, models and rule reviews

Kind: context. Reviews that changed how the game is built or shown, what each decided and which PR built it,
oldest first. The rules are in the spec ("### Play screen", "Deferred items") and `docs/instructions.md`.

- **First playtest review (07/11/2026).** The first long playtest gave command buttons (D-100), action ideas
  built by code (D-107), no enemy health bars by design (D-22), speaker lines set as a script and the Journal
  page (#8). The headless playtest runner came in #3. Lesson for scenario plans: every rule the plan validator
  checks must be stated in the Weaver's instructions, or an opening falls back to an empty room.
- **Speed (10/11/2026).** A timed run showed that a turn's time is almost all agent calls made one after
  another; engine code and page load are small. Saves and loads now send their database requests together
  (#286). To measure again, time the client call and the turn submit in a copy of `scripts/playtest.ts`. Crowd
  battles are parked as D-396.
- **Which model each agent uses (10/11 to 13/11/2026).** Chosen for quality, not cost. A cheaper narrator was
  turned down first: it saved little time and wrote weaker prose. Blind side-by-side tests then moved the
  narrator (#610), the responder, voice and planner (#637) and the Parser (#639) to the model that judged best;
  the Weaver stayed. The setting is `CONFIG.AGENT_MODELS`. Method worth reusing: replay recorded calls on both
  models, let two blind judges rank the pairs, then run short playtests end to end.
- **The Chronicler's model (21/11/2026, IAA-108).** The owner asked for its output compared across Opus 5.5 high, Fable
  5.2 medium and Fable 5.2 high with token cost. With no real ended scenario at hand, a simulated playtest made one
  (stand-in models answering the game's calls); each setup then read the same input. Ideas 6 / 7 / 11, cost per call
  about $0.09 / $0.17 / $0.22 at list price. The owner chose Fable 5.2 high after seeing the ideas side by side
  (PR #1522).
- **Rules kept only for a borrowed design system (17/11/2026; HS1-HS13).** The owner said that system was only
  meant to speed up early development. Its rules were sorted by whether they fit the game: a plain count chip
  and no edit box (#1014); the spec's "### Play screen" rewritten as the game's own rules (#1017); flat
  Character tiles with no lines or boxes (#1018). Play screen rules live in the spec and agents change them by
  PR; mock-ups are for major changes only. The look itself went to the look study
  (`history-look-viewer-sound-and-lore.md`).
- **Outside game-dev rules (17/11 to 18/11/2026).** Verdict: install no outside skill, and take selected rules
  into the spec (#1029). Built: gear compare (#1031), character card figures open their parts (#1033), choice
  states and undo-first risky choices (#1034), a batch of small rules (#1035), and marks without words for
  limited moves on the deck and for quests ready to hand in (#1037). Story flags that nothing wrote were
  removed. Parked: D-385 (balance report), D-386 (try before you take).
- **Review of open parked items (from 17/11/2026).** The owner goes through the open D-n rows five at a time;
  the question IDs are the D-n themselves. Many "Deferred" rows proved stale, decided elsewhere with the row
  never updated, and are closed in the table (#973, #1071). Parked in the same review: D-395, D-396. The review
  goes on; its state is the "Deferred items" table.
- **Instructions and memory review (19/11/2026; PI1-PI15, MR1-MR6).** Clashes between the old in-app
  instructions, the spec and the skills were listed and settled: code and tests decide what the game does and
  the spec is the living design record (PI14); notes hold no balancing numbers (MR2) and stay under 4 KB (MR5).
  Spec fixes: #1078, #1080. The owner's own skills moved into the repo (#1090), and the repo then became the
  home of the working rules (`process-decisions.md`).
- **Open: orders an NPC is sworn to carry out (13/11/2026).** A voice test showed the responder obeying a
  committed order with no feeling. A fix was tested and a build invited, not started: the responder carries the
  order out as given and voices what it feels against it, and the engine decides obey or refuse for a sworn NPC.
  The responder's instructions still hold the earlier rule. Tracked as D-409.
