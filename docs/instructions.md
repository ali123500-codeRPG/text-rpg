# Working rules

The full rules for working on this project, written for any AI agent. `AGENTS.md` holds the short list that must
never be broken; this file holds the rest. Rules that need one provider's tools are in `docs/providers/`.

"The owner" is the project's designer and only player. Each rule that came with a reason keeps it, so you can judge
edge cases. Where a section repeats a rule from `AGENTS.md`, it is there to add the detail; the wording in
`AGENTS.md` wins.

## 1. Source of truth

- The game's code and its tests decide how the game works. The spec (`docs/build-spec.md`, an index of one file per
  topic in `docs/spec/`) is the living design record: every PR that changes a rule updates the spec in the same PR. It
  is never frozen.
- Values marked "placeholder" are config. Items marked [Proposed] are built as written and kept easy to change.
- Where code and spec disagree, report it (a BG-n if the code is wrong, otherwise a question). Never pick one silently.
- A decision is recorded in the spec where its rule lives, with the question ID and date it came from, and in the
  item's D-n row if it has one.
- An answer that is not built in the same PR gets a D-n row in the "Deferred items" table, status Decided (older
  rows say "Agreed, not built"), holding the answer and its question IDs. When it is built, the spec rule cites the
  IDs and the row becomes Built. Memory notes and the Questions hub link to the row and hold no second copy.
- An old "Build Spec v0.6" page exists outside the repo. It is the outdated original: never use it.
- Inventing new things for the game is the job (`AGENTS.md` rule 3): report a gap as a question whose options are
  whole proposals, with concrete values and a recommendation (section 5). Only the in-game agents never invent.
- When reading the code cannot settle what a rule or perk does, run it: write a throwaway test with `tests/harness`,
  print measured results on the latest `main`, delete the test, and report the numbers. A code reading alone goes stale.

## 2. IDs, parked items and bugs

- Open questions, parked items and bugs are named only by fixed IDs: OQ-n, D-n, BG-n. Each new one is a GitHub issue
  number, so two threads never take the same one. A new BG-n is its claim issue's (Bugs, below). A new D-n or OQ-n is
  the number of an issue opened for it alone and closed at once, titled with the item; its row stays its record:
  ```
  n=$(gh api repos/{owner}/{repo}/issues -f title='D: <item>' -f body='Row in docs/spec/deferred-items.md' --jq .number)
  gh api -X PATCH repos/{owner}/{repo}/issues/$n -f state=closed --silent && echo "D-$n"
  ```
  (`OQ:` and `open-questions.md` for a question.) Numbers below 1000 are the old count, taken one past the highest.
  IDs are never renumbered or reused. `npm run sync` keeps both sides when two PRs add rows at the same spot.
- **Parked items.** Anything the owner parks (a perk, a question, a feature, tuning) gets its ID the same turn, in
  its subject's idea list below (a group ID), holding the owner's own words, with options only where the owner gave them
  (no context or reading of the agent's own), plus banked rows in the library where it is content (perks,
  achievements, table rows).
- **Parked ideas by subject.** A parked idea is sorted by subject when it is parked, so a thread on that subject
  can take its list together. Which ID holds which kind of parked idea, and in which file, is the table at the top of
  `docs/spec/deferred-items.md`: perks (IPP-n), achievements (IAA-n), vows and pledges (IVP-n), classes (ICI-n),
  essences (IEI-n), Threadbound items (ITI-n), combat and bodies (ICB-n), items, loot and trade (IGT-n), the world,
  travel and scenarios (IWD-n), NPCs and personality (INP-n), age and training (ICG-n), screens and layout (IUI-n). Every newly parked item goes into one of these lists (the owner, 21/11/2026: "moving forward, make sure every item I say to park belongs to a group ID"). The D-n table keeps older rows, and a new row only while the owner is asked which list takes it, or for a new list, when none fits (`AGENTS.md` rule 12). An idea list's ID starts with I (for idea), so it never reads like a Questions hub
  question ID. A new idea-list row (IPP-n, IAA-n and the rest) is numbered as a new D-n is (`title='IPP: <item>'`, and so on); a
  row moved from the Deferred items table keeps its number (D-189 became IPP-189), and its D-n row in the archive says
  where it went.
- **Active and archive.** The Deferred items table and the Bug log keep open rows only. A row moves unchanged to
  `deferred-items-archive.md` or `bug-log-archive.md` (beside them in `docs/spec/`) in the PR that finishes it: built,
  settled, dropped, closed or merged for a D-n; fixed, won't fix or duplicate for a BG-n. `npm run spec -- <ID>` finds
  a row in either file.
- **Bugs.** Every bug found or reported gets a claim issue (section 4) labelled `bug`, and the issue's number is its
  ID: issue #1480 is BG-1480. The issues are the bug register: the title is one line on what was wrong (at most 160
  characters), an open issue is an open bug, and a closed one is fixed (the PR's `Closes #n`), or won't fix or a
  duplicate (closed as not planned, with a one-line reason). Open bugs:
  `gh api 'repos/{owner}/{repo}/issues?labels=bug'`.
  Reason: numbers taken as one past the highest in the Bug log clashed when two threads took one at once, and every
  bug PR edited the same table and log, so independent fixes conflicted with each other. This holds for every agent.
  - Numbers below 1000 are the old count. Their rows stay in the spec's "Bug log" and its archive and their entries
    in `docs/bug-fix-log.md`, never renumbered; a fix of one still open there moves its row to the archive. No new
    rows are added.
  - Investigate with the `root-cause-first` skill. Before choosing a fix, list every plausible cause (engine rule,
    agent prompt, view or narration data, numbers), check each against the logs, and keep only what the evidence
    shows.
  - Then find every action, actor kind (player and NPC) and code path that shares the cause, and fix them with one
    shared rule or table. Say in the PR which siblings you checked. Reason: fixing only the symptom a playtest showed
    left its siblings for the next run.
  - A bug fix needs no OK from the owner. Write the cause and the fix once, in a new file `docs/bugs/BG-n.md`; the PR
    links that file instead of repeating it, says `Closes #n`, and merges when every check is green.
  - The claim issue exists before the first commit, so one commit carries the file and the fix: never a second commit
    to write a number in.
  - When a fix needs a design choice, still call it a bug: file the BG-n and ask the fix question with a
    recommendation. Never describe a broken game state as a pending design question.
  - The file is a `# BG-n` heading, then `**What was wrong:**`, `**Root cause:**` and `**What was done:**` (the
    newest `docs/bug-fix-log.md` entries have this shape). The issue is the bug's number, so no "Fixed by" line.
- When a function behaves differently for the player than for NPCs, check all its callers and report them. The
  player holds no stances or beliefs, so a one-direction check can silently skip the player.

## 3. Scaling

The source of truth for every design decision.

- The setting uses real-world numbers, but the people who live in it are supernatural by nature. Design with both in
  mind.
- Skill scale: 50 is the average real-world professional (the reference point). 75 is the real-world peak, the best
  anyone has actually been. 100 is the theoretical limit of the human body; no real person has reached it. Above 100
  is supernatural.
- Up to 75, ground everything in what real people at that level actually do. From 75 to 100: beyond anything ever
  achieved, but within what a human body could do in theory. Past 100: no longer humanly possible.
- 100 is a milestone, not a ceiling. The scale keeps extending above it, up to godlike beings.
- Whenever you design anything (mechanic, formula, table, perk, item, body type), note how it behaves at 50, 75, 100
  and well past it (150, 200 and up). Flag anything that caps out, stops growing or stops mattering above 100; runs
  out of rows, tiers or entries; or only makes sense for real humans. If something only works inside the human range,
  say so and suggest how it could extend, even if only the human range gets built for now.
- **What this rule does not say.** It is about the skill and power scale, not about play counts: an achievement chain
  is judged against playtime and may simply stop. It asks you to note and flag, never to change the owner's numbers.
  A reward that is strong early and weak late is fine when chosen on purpose.
- **Sims.** In every simulation or balance model, assume unlimited gap tiers (no Critical Success or Critical Failure
  cap; extra bands past both ends, set by `TIER_EXTRA_BAND` in config) so skills reach the gap their margin earns.
  Say in the report that tiers are uncapped.

## 4. Every task

- **Claim the work first.** Every piece of work has one GitHub issue in this repo, and the open issues are the board
  of who is working on what. Before you start:
  - List the open issues. If one covers your task and carries another desk's label, stop and tell the owner. Do not
    start a second copy of the work.
  - If one covers it and has no desk label, add yours. If none does, open one: a title that names the goal in the
    owner's words, and two or three lines on what will change.
  - A desk is one place agents work from: one Claude project, or one provider's agent. Its label is `desk:<name>`,
    and the name is in that desk's provider file. Use only your own.
  - The PR says `Closes #<issue>`, so the issue closes with the merge. If you stop without finishing, remove your
    label and say in the issue where the work stands.
  - A question, a review or a one-line docs fix that leads to no PR needs no issue.
- **Smallest complete change.** Use the `ponytail` skill (`docs/skills.md`): the least new code that solves the whole
  task, no extras, and every part the change touches is finished (callers, tests, fixtures). Where it says "no
  config", the balancing rule below wins; where it asks for a test, section 8 decides.
- **Stay in scope.** Out-of-scope work becomes its own task. Do not widen the current one. A task that grows big
  within its own scope gets helper agents (section 8, parallel workers); work of a different scope goes to a thread of
  its own (for Claude, asked for through the coordinator, `docs/providers/claude.md`). Reason: one thread that built
  seven answers across spawning, events, speech, offers and the play screen took far longer than split work would.
- **Read by ID, not by file.** `npm run spec -- <ID>` or a line range. Never read a file over 50 KB whole.
- **Balancing levers.** Every balancing number lives in one easy-to-edit place (`src/config.ts`, whose parts are in
  `src/config/`, or a library table), with a clear name, placeholders marked, and the lever named in the spec by its setting, never copied as a number
  (PQ15 a: a copy drifts from the code). Use names
  tables for ordered scales, so a level can be inserted. Reason: the owner balances by playing and tunes numbers without touching logic.
- **One equation per concept.** Before writing a formula, search for an existing one that measures the same thing and
  reuse it. Two features that measure the same quantity call one shared function.
- **Reuse existing concepts.** Before naming a new need, role or table, search for one that exists (body-part roles,
  scales, config tables) and use it. Code reads a body type's parts; it never assumes hands.
- **Performance, not token saving.** Propose dropping or trimming an in-game agent call only when it makes the game
  better or faster. Lower cost alone is not a reason.
- **Saves.** Until the owner names a keep-saves point, a change may break old saves. A change that breaks loading adds
  a migration step (`MIGRATIONS` in `src/save/checks.ts`) when the step is small: it sets a default or renames a
  field. Otherwise it raises `CONFIG.OLDEST_SAVE_SCHEMA` and says so in its PR.
- **No decision stamps, no filler notes.** Code, comments and game text state the rule, not who decided it or when.
  A note in displayed prose that never changes play is deleted, not reworded.
- **Equations prose.** A change to how a roll, gain or mark works also updates the prose in
  `src/ruleset/equations.ts`, which the library viewer shows. No test checks it.
- **Naming conventions** for scale keys, typed IDs, tiers and perks are in `docs/glossary.md` and the spec.

## 5. Questions for the owner

- Every question goes through the channel your provider file names, never loose in a chat message. Each question has
  options and a recommendation. Mark undecided items [Proposed].
- **Agents without that channel.** The owner's channel is the Questions hub, which only Claude can write to. Read
  `tools/questions-hub/README.md`, show the owner what you can offer that is similar (one place, numbered questions,
  options, a recommendation, an answer box each), and agree with them how you will ask. Do this once, before your
  first question, in a plain message with your options and a recommendation; it is the one question that has no
  channel yet. The agreement also settles how you show colour where your surface has none.
  - Write what was agreed into your provider's file, `docs/providers/<provider>.md`, in a PR. It is a rule file: quote
    the agreement in the PR. From then on that file names your channel, for one question or for many.
  - Quote each question, its options and the owner's answer in the PR that acts on it. The spec cites question IDs
    as the source of a decision, so the PR is where a reader finds them.
- **A direction without an amount** ("a bit longer", "harsher early on") is a question, not a number to pick. Offer
  values or shapes with their measured effect. Propose the values yourself: an option never leaves an amount blank
  ("say how much"), and a reward option names its reward and amount, not "XP only" for want of an idea. Reason: merging without review rests on the build matching what the
  owner meant, and a guessed rule breaks that.
- Build the question page or list at once and give the link. Do not ask whether the owner wants one.
- Give each questionnaire its own two-letter ID prefix and number its questions (RH1, RH2). IDs are never reused.
  Search the spec for a prefix before you take it, and avoid the library's ID prefixes (`docs/glossary.md`).
- Newest questions go at the bottom. Answered ones stay above the open ones, in the order asked.
- A question longer than two sentences is laid out as short labelled, colour-coded blocks, never a wall of text:
  Today, Problem, Proposal, Formula, Example. Each formula sits on its own line with its constants explained below.
- Wait for the owner to say they have answered. Do not poll. Never pre-fill their answers with your own picks, and
  act only on what they wrote.
- When you have read an answer and acted on it, mark that question done where it was asked.
- **"tbd"** as an answer means "discuss this with me". Reply with your own view: what you would do, the weak point of
  your earlier recommendation, and what changed. Then ask the item again with choices.
- **"Something else"** with nothing written means "none of these". Ask again with options never offered before on
  that question, and say so in one line.
- **A turned-down item** gets alternatives. In a verdict colour scheme, green is kept, red is turned down, purple is
  banked for later, yellow is waiting. "Too strong" means the owner disagrees.
- **Never ask** what already goes without saying: whether a new skill gets perks at each milestone or who drafts
  them; whether a new tree shows on the creation screen (tree access rules exist: apply them and state the result);
  whether a per-tier bonus stacks (it does).
- **A new skill's ladder perks** (20 to 140) are never left out or described as not existing. When they are not
  written with the skill, the same turn gives them one row in the perks list (IPP-n) marked to be built, and they are
  drafted only when the owner asks for them; no thread is started for them before then.
- A comment the owner leaves on a document or page also counts as an answer. A reply to a comment only answers or
  confirms; a new question still goes through the question channel.

## 6. How to present things to the owner

- Anything with more than a couple of parts (options, comparisons, systems, findings, plans) is colour-coded, with
  each colour's meaning stated. Use clear sections and short labelled items instead of paragraphs. Colours must
  really show: in a document use coloured backgrounds or borders, not only emoji.
- A fix plan shows its parts as separate labelled colour blocks: What went wrong (red), Cause (amber), Planned fix
  (green), Tests (violet), Good to know (blue).
- Nothing scrolls sideways. No wide tables: show items as stacked cards or rows that wrap.
- A picture goes beside the words when it shows the point faster: a crop of the locally built game (never the live
  game) or a small diagram, with alt text. In the Questions hub, `tools/questions-hub/README.md` "Pictures" says how.
- Code, spec text and anything to copy stay plain text beside it. Short answers stay plain text.
- One-line content (counter lines, option texts, tags) is the headline only. Supporting detail goes in its own field.
- Name outcome tiers by name, never by number. Call perks by milestone ("20 perk", "40 perk").
- Dates are DD/MM/YYYY.

## 7. Game screens and visual design

- The play screen's rules live in the spec: "### Play screen" for layout and look, "### Play screen motion" (M-01 to
  M-74) for motion. Read the section before any play UI work, and change those rules there, through a PR.
- The build screens lead (creation, Character page, perks, essences, gear). Never pitch a design as "it reads like a
  book".
- Motion headlines (details in the spec): code resolves every number and the screen only animates what is already
  resolved; timing never reveals which mode, agents or secrets are involved; nothing on the play screen changes
  while a turn runs; skip is a click on the story or Esc, never a typing key; motion always plays.
- The look is the game's own. An earlier borrowed design system no longer applies. New tokens are fine when named
  for the game.
- **Design skills, in proportion to the change** (`docs/skills.md`). The report names each skill used and what it
  changed. Never claim a skill's method without having used it: if you could not fetch one, say so in the report.
  Mock-ups only for major changes.
  - **A small change** changes an existing element and adds no element type, colour, font, size token or layout
    change. It uses `interface-design`, `show-dont-tell-ui` and `design-spatial` (1, 5 and 6 below), plus the
    accessibility checks: every control has an accessible name, text keeps its contrast, and no meaning rests on
    colour alone.
  - **Everything else** (a new or changed layout, colour or type, a new component or screen) uses all six. When
    unsure, the change is not small.
  1. `interface-design`: the primary lens. Structure, hierarchy, density, tokens, states, consistency.
  2. `impeccable`: its audit and critique (anti-patterns, accessibility, theming, spacing, typography, motion), with
     its P0 to P3 severity scale.
  3. `frontend-design`: aesthetic direction. Does the screen have a deliberate point of view that fits a
     build-crafting game, or does it read as a generic dashboard?
  4. `ui-ux-pro-max`: its search for palette, font-pairing and data-display guidance. Cite what it returned.
  5. `show-dont-tell-ui`: show instead of tell. Mark only the exception with an icon, put words in tooltips and
     aria-labels, and cut hints the styling already gives.
  6. `design-spatial`: render the built page, run its layout audit, look at the annotated screenshot, and measure
     what the change is about (centring, the gap to a neighbour). Its gates are fixed; its signals are only pointers.
     A subagent that did not write the change judges the screenshots only for everything else, not a small change.
- **Every UI PR shows its look.** A PR that changes anything under `src/ui/` has a `## Design` part: the design skills
  used and what each changed, and the screens rendered (built page, `?fake=1` and any stage it needs), including
  every place a moved element now sits. "UI wiring" or "a smoke flow covers it" excuses a test, never the render:
  smoke flows check that a control works, not how it looks. The `pr-rule` check fails a `src/ui` PR without it.
- **House controls only.** Every button, toggle and tag carries one of the house classes on the element itself
  (`hs-btn-main`, `hs-btn-text`, `hs-icon-btn`, a button inside `hs-picker`, `hs-tg`). A page may adjust a house
  class; it never gives a control its look only through where it sits (`.inbar button.itm`), so a control keeps its
  look wherever it moves. A class written in `src/ui` exists in the stylesheet before it is used; a new kind of control
  is a new house class, named in the PR. Reason: a button moved out of the action bar, and one given the made-up
  class `hs-btn`, both showed the browser's plain gray button (BG-1514).
- **Colour means something.** Every tag and chip takes the colour of what it names, from the meanings the game
  already has: a skill's tree, a roll tier, a grade, perks violet, achievements gold, scars red. The gray fallback
  (`hs-tg` with no `--tg`) is only for a value that has no meaning yet, and the PR names it. Reason: the Hall of fame
  card was a wall of gray tags.
- **One hover tip.** Hover text is a `title` (or `data-tip`) on the element; the page's one tip (`mountTip` in
  `src/ui/kit.ts`, PS-80 to PS-82) shows it with the game's look and timing, never the browser's tooltip. A richer tip
  (an item card) registers with `tipFor`. Never build another tip, its own listeners or a CSS hover tip. Reason: some
  labels were the browser's and some the game's, with different looks and waits.
- **Tips are colour-coded.** In every hover tip, the words that name something with a colour of its own (a skill, a
  health level, a perk, a tie, a gain or a caution) take that colour through `tint()`, with the tone from
  `src/ui/tipTones.ts`; plain words and control names stay plain (PS-496, PS-497). A new tip tints its words the same
  way, and a tip that names a kind of thing with no colour yet names it in its PR so the owner can give it one.
  Reason: the owner asked for every tip to be colour-coded and for the practice to carry on (OW1, HU1 to HU3).
- If a skill is missing for the job, look for one online before going without.
- Play and creation pages are PC only: no phone rules, checks at desktop widths. The library viewer must also work on
  phones, with nothing scrolling sideways.
- Every screen fills the window. No width caps, no content centred in a wide empty track.
- Clicking an entry (perk, item, body type) opens its details in a small movable panel, never a page jump or a
  blocking dialog. Check with the owner before replacing a play screen's existing side panel with one.
- Judge motion by watching it: record a video of the built page and read frame strips. Screenshots at fixed moments
  miss timing bugs. How: `docs/memory/working-notes-testing.md`.
- The map's rules (MAP-nn, `docs/spec/part-2-turn-engine/map.md`) exist to keep the map readable. When the owner asks
  for something that clashes with one, build what they asked, name the clash once, and update the rule.

## 8. Building and landing changes

- Start from the latest `main`: `git fetch origin main`, then branch from `origin/main`. A session's checkout can
  start on an old branch.
- **A skill change hands the owner its zip.** When a merged PR changed a skill in `.agents/skills/`, run
  `npm run skills-zip` on the latest `main` and give the owner `dist/skills/<name>.zip` for each skill it changed, in
  the report on that PR. Reason: project threads load the account copy, which the owner installs from the zip.
- Every change is a PR into `main` that follows `.github/pull_request_template.md`. The full CI runs on it: type
  check, unit and scenario tests, build, browser smoke, and the PR rule. The template's terms (completeness rows,
  whole-turn test) are in `docs/glossary.md`.
- Tests manage risk; they are not a deliverable. Before adding one, search `tests/` for a test or smoke flow that
  already covers the behaviour; if one does, extend it or name it. Add a permanent test only for a credible
  regression nothing else would catch (numbers, saves, RNG, ordering, a sibling path), never just because a bug was
  fixed, logic was added or a PR was opened, and say in the PR why existing coverage falls short. Weigh how bad and
  how likely the break is, what else would catch it, whether it ever caught a real bug, and its run time and upkeep;
  covering something nothing else does is a reason, not a pass. Use the cheapest form that catches it: a pure
  function gets a unit test, a whole turn only when the turn itself is the risk, a browser test only for a break that
  would stop play and nothing cheaper reaches, and a loop over seeds stops once it has seen what it asserts. A
  temporary test may check a task; delete it and its fixtures before the PR merges unless it meets this rule on its
  own. Never match source text.
  Docs, spec, rule, config and tooling changes, and wiring a smoke flow already covers, get none. A change of meaning
  gets a search of the whole repo for the old pattern, not a guard test (spec, TQ5).
- Keeping a test takes the same rule as adding one; age earns it nothing. A test that would not be added today (a
  duplicate, one that guards nothing or matches source text, or one whose break is not credible or not worth its
  cost) may be deleted in a PR that touches it or its area; the PR says what protection is lost. It needs no
  replacement, and a replacement meets the rule on its own. Never delete or weaken a test to turn a failing check
  green. Agents decide adding, keeping and removing; ask the owner only about a test that would be costly to keep or
  run, deleting protection for saves, RNG, turn ordering or the structural guards, or a change to how the suite is
  built.
- The agent that opened a PR reviews it and squash-merges it once every check is green, without asking the
  owner. That includes bug fixes and rule-file changes; a rule-file PR quotes the owner's words it acts on
  (`AGENTS.md` rule 6). The owner does not merge PRs. The same rule holds for agents of every provider.
- Catch up with `main` by `npm run sync` before you push: it fetches, rebases, and checks that every line your branch
  added is still there. In a conflict, keep both sides' edits by hand; never take one side of a whole file
  (`git checkout --ours` or `--theirs`), which drops every edit of the other side. Regenerate a generated file
  instead of merging it. Then search for conflict markers, stage only the files you resolved, and run
  `npm run sync -- --check ORIG_HEAD` after any rebase done by hand.
- After pushing and your local checks, wait on the PR with one call: `npm run pr:wait -- <n>`, or `-- <n> --merge` to
  squash-merge it once green, at exactly the head that was checked. It stops at once on a conflict (a PR with a
  conflict gets no checks at all, so a silent PR is not a passing one), a failed or cancelled check, a check still not
  started 2 minutes after a push, or the PR closing; it keeps waiting while a check runs or GitHub is still working
  out whether the PR merges, and gives up after 9 minutes (run it again). Do not wait with sleeps and repeated looks.
- Testing: on your own machine, run `npm run typecheck` and `npm run test:near` once, after your last edit, and
  rerun only the files that failed. `test:near` runs
  the tests that use the changed files directly, plus the structural guards (tests that check code as text); tests
  that reach a change only through another file are left to GitHub. NOTHING TESTED from `test:near` is not a pass.
  The full suite and the browser tests run on GitHub only, on every PR, and they decide the merge; a local pass never
  stands in for them. Push and open a draft PR at the first commit, then run the local checks while GitHub runs its
  own; do not sit waiting on checks. A newer push cancels the PR's older run. Run the browser tests locally only to debug one that failed; text widths
  count only from GitHub's run (BG-325). Reason: the full suite took 2 to 15 minutes locally and GitHub ran it again.
- Long runs (anything over about ten minutes, such as a long build or a large soak) go on GitHub too: push the branch
  and read its checks. Decided 19/11/2026; the first agent that needs a long run after 19/12/2026 asks the owner
  again.
- A balancing change can move the soak results (`tests/soak`).
- Where work splits cleanly, use parallel workers, and always once a task grows big within its scope (section 4,
  "Stay in scope"). Give each a narrow scope, the spec sections it owns and the interfaces it must match, and merge
  through one owner of the integration.
- The game's own agents and which model each uses are set in `CONFIG.AGENT_MODELS`.

## 9. Playtests

Playtests run the repo's script (`npm run playtest`), never the published game. The script calls a real model through
a signed-in command-line client: see your provider file for whether you can run it.

- New playtests carry on an existing world (`--world DIR` or `--resume DIR`), not a fresh one.
- Before starting, check that `main` has no newer merges; runs should include the latest features.
- Give the test player clear, numbered goals. It must take a concrete step every turn and report what does not work.
- Check a bug-hunting run every few turns. The moment a bug is clear, stop the run, keep its files (rename the folder
  with `-stopped`), file the BG-n, and message whoever fixes bugs. After the fix merges, continue with `--resume`.
- Never delete a stopped run's files: check them for bugs first.
- A bug that needs the owner's decision never blocks testing: park the question with a recommendation, stop that
  run, and start another.
- With each progress update, also report what the test player disliked: repeated frustrations, confusing systems,
  difficulty.
- Outcomes the owner has confirmed as intended are listed in `docs/memory/playtest-known-intended.md`. Do not flag
  them again.
