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
- Do not invent mechanics. Report a gap as a question with a recommendation (section 5).
- When asked what a rule or perk does, run it: write a throwaway test with `tests/harness`, print measured results on
  the latest `main`, delete the test, and report the numbers. A code reading alone goes stale.

## 2. IDs, parked items and bugs

- Open questions, parked items and bugs are named only by fixed IDs: OQ-n, D-n, BG-n. A new one takes the next free
  number: one past the highest ever used, never a gap left by a retired one. Answered or retired IDs are never
  reused.
- **Parked items.** Anything the owner parks (a perk, a question, a feature, tuning) gets its own D-n the same turn,
  in the spec's "Deferred items" table with its options written out, plus banked rows in the library where it is
  content (perks, achievements, table rows).
- **Bugs.** Every bug found or reported gets a BG-n and a row in the spec's "Bug log": its ID, one line on what was
  wrong (at most 160 characters), its status and its claim issue (`#n`, section 4).
  - Taking a number: use the next free number in the Bug log on the latest `main`, in the PR that adds the row. A
    clash then shows up as a merge conflict. This holds for every agent.
  - Investigate with the `root-cause-first` skill. Before choosing a fix, list every plausible cause (engine rule,
    agent prompt, view or narration data, numbers), check each against the logs, and keep only what the evidence
    shows.
  - Then find every action, actor kind (player and NPC) and code path that shares the cause, and fix them with one
    shared rule or table. Say in the PR which siblings you checked. Reason: fixing only the symptom a playtest showed
    left its siblings for the next run.
  - A bug fix needs no OK from the owner. Write the cause and the fix once, in its `docs/bug-fix-log.md` entry; the
    PR links that entry instead of repeating it, says `Closes #n`, and merges when every check is green.
  - The claim issue exists before the first commit, so one commit carries the row, the entry and the fix: never a
    second commit to write a PR number in. A test fails on "this PR", on a fixed row without a number, and on a new
    row longer than one line (`tests/unit/bug-log.test.ts`). Rows up to BG-326 keep the form of their day.
  - When a fix needs a design choice, still call it a bug: file the BG-n and ask the fix question with a
    recommendation. Never describe a broken game state as a pending design question.
  - Every bug-fix PR adds an entry to `docs/bug-fix-log.md`, newest at the top: a `## BG-n` heading, then
    `**What was wrong:**`, `**What was done:**` and `**Fixed by:**` with the claim issue (older entries name the PR)
    (`tests/unit/bug-fix-log.test.ts` checks the form). Copy the shape of the entry above yours.
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
  config", the balancing rule below wins.
- **Stay in scope.** Out-of-scope work becomes its own task. Do not widen the current one.
- **Balancing levers.** Every balancing number lives in one easy-to-edit place (`src/config.ts` or a library table),
  with a clear name, placeholders marked, and the lever named in the spec. Use names tables for ordered scales, so a
  level can be inserted. Reason: the owner balances by playing and tunes numbers without touching logic.
- **One equation per concept.** Before writing a formula, search for an existing one that measures the same thing and
  reuse it. Two features that measure the same quantity call one shared function.
- **Reuse existing concepts.** Before naming a new need, role or table, search for one that exists (body-part roles,
  scales, config tables) and use it. Code reads a body type's parts; it never assumes hands.
- **Performance, not token saving.** Propose dropping or trimming an in-game agent call only when it makes the game
  better or faster. Lower cost alone is not a reason.
- **Saves.** Until the owner names a keep-saves point, a change may break old saves. Do not write migrations for new
  changes; raise `CONFIG.OLDEST_SAVE_SCHEMA` when a change breaks loading.
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
  values or shapes with their measured effect. Reason: merging without review rests on the build matching what the
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
    change. It uses `interface-design` and `show-dont-tell-ui` (1 and 5 below), plus the accessibility checks: every
    control has an accessible name, text keeps its contrast, and no meaning rests on colour alone.
  - **Everything else** (a new or changed layout, colour or type, a new component or screen) uses all five. When
    unsure, the change is not small.
  1. `interface-design`: the primary lens. Structure, hierarchy, density, tokens, states, consistency.
  2. `impeccable`: its audit and critique (anti-patterns, accessibility, theming, spacing, typography, motion), with
     its P0 to P3 severity scale.
  3. `frontend-design`: aesthetic direction. Does the screen have a deliberate point of view that fits a
     build-crafting game, or does it read as a generic dashboard?
  4. `ui-ux-pro-max`: its search for palette, font-pairing and data-display guidance. Cite what it returned.
  5. `show-dont-tell-ui`: show instead of tell. Mark only the exception with an icon, put words in tooltips and
     aria-labels, and cut hints the styling already gives.
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
- Every change is a PR into `main` that follows `.github/pull_request_template.md`. The full CI runs on it: type
  check, unit and scenario tests, build, browser smoke, and the PR rule. The template's terms (completeness rows,
  guard test, whole-turn test) are in `docs/glossary.md`.
- The agent that opened a PR reviews it and squash-merges it once every check is green, without asking the
  owner. That includes bug fixes and rule-file changes; a rule-file PR quotes the owner's words it acts on
  (`AGENTS.md` rule 6). The owner does not merge PRs. The same rule holds for agents of every provider.
- Catch up with `main` by `npm run sync` before you push: it fetches, rebases, and checks that every line your branch
  added is still there. In a conflict, keep both sides' edits by hand; never take one side of a whole file
  (`git checkout --ours` or `--theirs`), which drops every edit of the other side. Regenerate a generated file
  instead of merging it. Then search for conflict markers, stage only the files you resolved, and run
  `npm run sync -- --check ORIG_HEAD` after any rebase done by hand.
- After pushing, check the PR: `gh api repos/<owner>/<repo>/pulls/<n> --jq .mergeable_state`. `dirty` means a
  conflict, and a PR with a conflict gets no checks at all, so a silent PR is not a passing one.
- Long runs (anything over about ten minutes, such as a long build or a large soak) go on GitHub: push the branch and
  read its checks. The full test suite is not a long run (`npm test`, about two minutes) and may run locally.
  Decided 19/11/2026; the first agent that needs a long run after 19/12/2026 asks the owner again.
- A balancing change can move the replay or soak results (`tests/replay`, `tests/soak`). The replay set runs in the
  PR's checks. Its recordings are remade only from playtests, so if one must be remade and you cannot run
  playtests, say so in the PR.
- Where work splits cleanly, use parallel workers. Give each a narrow scope, the spec sections it owns and the
  interfaces it must match, and merge through one owner of the integration.
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
