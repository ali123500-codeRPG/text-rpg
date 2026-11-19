# Claude in-app instructions before the repo became the home

The project instructions of the claude.ai project, word for word as they stood on 19/11/2026, kept as a record.
They are the owner's own text, so "I" and "me" are the owner. They are not the current rules: those are `AGENTS.md`
and `docs/instructions.md`. Paths under `/mnt/project-files` are the Claude project's shared folder.

```text
PROJECT: Text RPG (the main game, not a prototype; personal use only: one player, published only as a Claude artifact)

SOURCE OF TRUTH
- The game's code and its tests are the source of truth for how it works. docs/build-spec.md in the repo is the living
  design record: every PR that changes a rule updates it in the same PR, and it holds the design rules (including the
  play screen and motion rules), the Deferred items table and the Bug log. Values marked "placeholder" are config. Items
  marked [Proposed] are built as written and kept easy to change.
- Where code and spec disagree, report it (a BG-n if the code is wrong, else a question); never pick one silently. The
  old Build Spec v0.6 artifact is the outdated original-build copy: never use it.
- Do not invent mechanics. Report a gap as a question with a recommendation (see QUESTIONS).
- REAL-WORLD DISTANCE: everything that measures distance (weapon reach, throw range, sight, hearing, movement, room and
  building sizes) uses real-life metres with a cited reference, unless I explicitly say otherwise. Nearness is never
  zone membership, zone hops or link counts: zones are only titles for places.

IDS AND BUGS
- Open questions, deferred items and bugs are named only by fixed IDs: OQ-n, D-n, BG-n. New ones take the next free
  number; answered or retired IDs are never reused.
- PARKED ITEMS: anything I park (perks, questions, features, tuning) gets its own D-n the same turn, in the spec's
  "Deferred items" table with its options written out, plus banked rows in the library where it is content (perks,
  achievements, table rows).
- BUGS: every bug found or reported, in any thread, gets a BG-n from the one counter and a row in the spec's "Bug log"
  with its status and the PR that fixes it. Investigate and fix it with the "root-cause-first" skill. Post the cause and
  the planned fix and get my OK before pushing any bug fix. Every bug-fix PR adds an entry to docs/bug-fix-log.md.

SCALING (source of truth for every design decision)
- The setting uses real-world numbers, but the people who live in it are supernatural by nature. Design with
  both in mind.
- Skill scale: 50 = the average real-world professional (the reference point). 75 = the real-world peak, the
  best anyone has actually been. 100 = the theoretical limit of the human body (mortal limit); no real person
  has reached it. Above 100 = supernatural.
- Up to 75, ground everything in what real people at that level actually do. 75 to 100: beyond anything ever
  achieved, but within what a human body could theoretically do. Past 100: no longer humanly possible.
- 100 is a milestone, not a ceiling. The scale will keep extending above it, up to godlike beings.
- Whenever you design anything (mechanic, formula, table, perk, item, creature), note how it behaves at 50,
  75, 100, and well past it (150, 200 and up). Flag anything that caps out, stops growing or stops mattering
  above 100; runs out of rows, tiers or entries; or only makes sense for real humans with no answer for the
  supernatural. If something only works inside the human range, say so and suggest how it could extend, even
  if only the human range gets built for now.
- SIMS: in every simulation or balance model, assume infinite gap tiers (no Critical Success/Failure cap;
  extra bands every TIER_EXTRA_BAND past both ends) so skills reach the gap their margin earns.

EVERY THREAD
- Use the "ponytail" skill: the smallest complete change, no bloat, and finish every part a change touches (callers,
  tests, fixtures). Where ponytail says "no config", BALANCING LEVERS wins.
- Out-of-scope work gets its own thread; don't expand the current one.
- BALANCING LEVERS: every balancing number (odds, damage, ranges, timers, thresholds, XP, costs) lives in one
  easy-to-edit place (config or a library table), with a clear name and placeholders marked. Never hard-code
  them in logic.
- Never resolve a thread; I resolve them myself.
- Never play the published game or read, write or delete my saves and stories without my OK. Publishing the game means
  build, test and publish only.
- SAVES: until I name a keep-saves point, a change may break old saves; CONFIG.OLDEST_SAVE_SCHEMA marks the oldest
  that still loads.
- BROWSER: Claude in Chrome is the default for browsing the web and for looking at a page together with me; if it fails,
  Claude may use its own browser. Local renders, screenshots and test runs use the pre-installed Playwright.

QUESTIONS
- Every question for me goes on a decision card (one question) or a Questions hub page (two or more), never in chat
  text. Each has a recommendation. Mark undecided items [Proposed].
- QUESTIONS HUB: every questionnaire is a page in the one hub artifact
  https://claude.ai/artifact/Fu3pVa1AQsrVjUygXCLiDp, written with ArtifactData, never a newly published artifact.
  Write only what changed: a new round, or a question marked done or re-asked, adds or updates only its own small docs
  (rounds/<name>/items, qs/<name>/items) plus the page's `updated`, in one batch built with questions/hub/hubdb.py; never
  re-save a whole page. Read /mnt/project-files/questions/hub/README.md first: it holds the data layout, the question
  layout (colour blocks from blocks.py, lint() before every write), answer boxes, autosave, Submit, newest questions at
  the bottom, and marking answers read. Only a change to the hub's own layout needs a publish. Never paste fonts or
  images in as base64.
- A document I'm asked to review keeps its open items on the hub page and links to it. Comments on a document also
  count as answers.
- Claude reads the answers, acts on them, and marks each item done on the page.

HOW TO PRESENT THINGS TO ME
- Anything with more than a couple of parts (options, comparisons, systems, designs, findings, plans) is
  color-coded, with each color's meaning stated (e.g. 🔴 blocker, 🟡 should fix, 🟢 nice to have, ⚪ already
  handled). Use clear sections and short labeled items instead of paragraphs, as an inline visual or a
  doc/page, whichever fits. Colors must actually show: in docs, use real colored backgrounds or borders, not
  only emoji.
- No horizontal scrolling, ever. Never use wide tables: if a table would not fit the screen width, show the
  items as stacked cards or rows that wrap instead. Option text must be readable without scrolling sideways.
- Code, spec text and anything to copy stay plain text alongside it.
- Short answers stay plain text.

PLAY SCREEN (final play artifacts only: the creation screen, the play screen and their pages; NOT question or
decision pages)
- The rules live in docs/build-spec.md: "### Play screen" for layout and look, "### Play screen motion" (M-01 to M-74)
  for motion. Read the section before any play UI work and make every change to these rules there, through a PR.
  This block only points there.
- The game is a build-crafting game first and a story second: the build screens (creation, Character page, perks,
  essences, gear) lead.
- HISAB is no longer the design system. New tokens are fine when named for the game.
- Motion headlines (details in the spec): code resolves every number and the screen only animates what is already
  resolved; timing never reveals which mode, agents or secrets are involved; nothing on the play screen changes while a
  turn runs; skip is a click on the story or Esc, never a typing key; motion always plays (no Motion switch, M-72).

VISUAL DESIGN (any UI change, however small)
- Load all five skills before starting, and name each one and what it changed in the report. Mock-ups only for major
  changes.
1. interface-design: primary lens. Judge structure, hierarchy, density, tokens, states and consistency.
2. impeccable: run its audit and critique disciplines (anti-patterns, a11y, theming, spacing, typography,
   motion). Use its P0–P3 severity scale.
3. frontend-design: aesthetic direction. Does the screen have a deliberate point of view that fits a build-crafting
   game, or does it read as a generic AI dashboard?
4. ui-ux-pro-max: use its search for palette, font-pairing and data-display guidance. Cite what it returned.
5. show-dont-tell-ui: show instead of tell. Mark only the exception with an icon, put words in tooltips and
   aria-labels, and cut hints the styling already gives.

BUILDING
- Use parallel agents or threads wherever the work splits cleanly. Give each one a narrow, explicit scope,
  the spec sections it owns and the interfaces it must match, and merge their work through one owner.
- Every PR runs the full CI (typecheck, unit and scenario tests, build, smoke). Claude reviews and squash-merges its own
  PR once CI is green; a bug fix only after my OK.
```
