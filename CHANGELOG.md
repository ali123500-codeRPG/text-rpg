# Changelog

Dated changes to the working rules and the skills only: `AGENTS.md`, `docs/instructions.md`, `docs/providers/` and
`.agents/skills/`. Newest first. Game changes are in the merged PRs, the spec and `docs/bug-fix-log.md`.

- 20/11/2026: `docs/instructions.md` section 4 "Saves" (YS3 b): a change that breaks loading adds a migration step when
  the step is small (it sets a default or renames a field); otherwise it raises `OLDEST_SAVE_SCHEMA` and says so in its PR.
- 20/11/2026: `docs/instructions.md` section 8, `.agents/skills/root-cause-first` and the PR template: a test earns its
  place (behaviour that could break again, run through the game, never source text; "none needed" is a fine answer);
  a change of meaning gets a whole-repo search, not a guard test; a bug fix no longer must start with a failing test.
- 20/11/2026: `AGENTS.md` rule 9 and map, `docs/instructions.md` section 8 (TE1 a, TE2 a): the replay set and the saved
  soak worlds are retired; the soak run plays the test village.
- 20/11/2026: `docs/instructions.md` section 8 and `AGENTS.md` "Finding your way" (CU2 b): `test:near` has no `--deep`;
  tests that reach a change only through another file are left to GitHub.
- 20/11/2026: `docs/instructions.md` section 8 and `AGENTS.md` "Finding your way": `test:near` is quick by default (direct
  tests plus structural guards, indirect ones left to GitHub and counted), `--deep` for refactors and risky changes;
  push and open the draft PR at the first commit, then run local checks while GitHub runs its own.
- 20/11/2026: `AGENTS.md` rule 7 and map, `docs/instructions.md` section 4 "Balancing levers" (SX7 b): CONFIG's defaults sit in
  parts under `src/config/`, one per system, gathered by `src/config.ts`, which stays the one entry and the one CONFIG.
- 20/11/2026: `AGENTS.md` rule 2 (WF3 a): the cause and the fix are written once, in the bug's `docs/bug-fix-log.md`
  entry, which the PR links, as `docs/instructions.md` section 2 already says; it no longer asks for them in the PR.
- 20/11/2026: `docs/instructions.md` section 8 (WF2 a): locally, typecheck plus `npm run test:near` and new tests;
  the full suite and browser tests run on GitHub only, on every PR; open a draft PR early; a newer push cancels the
  PR's older run (`ci.yml` concurrency, PR runs only). `docs/providers/claude.md`: the draft and ready-for-review
  commands. `rpg-map` skill: the map smoke test runs locally only to debug a failure.
- 20/11/2026: Pictures in questions. `docs/instructions.md` section 6: a picture goes beside the words when it shows
  the point faster. The Questions hub shows them (`tools/questions-hub/README.md` "Pictures": `fig()`, `image()`).
- 20/11/2026: `docs/providers/claude.md` is split: an "Every thread" part (how the project runs, desk labels, how to
  ask, never open the live game page, the owner's saves, bug numbers, in-app memory, the REST commands GitHub needs
  from a Claude session) and parts read only when the task needs them, each with a "Read when" line. No rule
  was dropped. `AGENTS.md` Upkeep: read the provider file's "Every thread" part before the first action, the rest when
  needed. `tools/questions-hub/README.md`: a new hub's link goes beside the hub links in "Every thread".
- 20/11/2026: `docs/instructions.md` section 7 (WF4 a): design skills in proportion to the change; a small change to
  an existing element uses `interface-design` and `show-dont-tell-ui` plus the accessibility checks, everything else
  all five. Section 1 (WF6 a): an answer not built in the same PR gets a D-n row, status Decided (D-411, D-412).
- 20/11/2026: `docs/instructions.md` section 2 (WF3 a): a Bug log row is ID, one line on what was wrong (at most 160
  characters), status and claim issue (`#n`); the story is written once, in `docs/bug-fix-log.md`, which the PR links;
  no second commit to write a PR number in. Rows up to BG-326 keep their form.
- 20/11/2026: `docs/instructions.md` section 8: catch up with `main` by `npm run sync` (rebase, then a check that
  every line the branch added is still there); in a conflict keep both sides' edits and never take one side of a
  whole file; check a PR's `mergeable_state` after pushing, since a PR with a conflict gets no checks. `AGENTS.md`
  names `npm run sync`.
- 20/11/2026: The map's rules (MAP-nn) have one home, `docs/spec/part-2-turn-engine/map.md`, which also takes in the
  Map and minimap text from the Play screen topic. The `rpg-map` skill keeps only the working method (MAP-01 and
  check, then look) and points to `src/ui/mapCheck.ts` instead of carrying a copy of the checker; its design skills
  are now those `docs/instructions.md` section 7 requires. Section 7's last bullet names the rules' home.
- 20/11/2026: The spec is split into one file per topic under `docs/spec/`; `docs/build-spec.md` is its index.
  `AGENTS.md` and `docs/instructions.md` section 1 point to it, `AGENTS.md` names `docs/systems.md` as where a task
  starts and lists the finding-your-way commands (`npm run spec`, `npm run test:near`, the dev views, the Map's
  smoke test).
- 20/11/2026: One Questions hub for both Claude accounts. New questionnaires go to a shared Supabase table, and each
  account's hub page shows it beside its own older questionnaires (`tools/questions-hub/README.md`, "Where the data
  lives"). `docs/providers/claude.md` "Questions" and "Claude on another account" say where to write and read.
- 20/11/2026: `tools/questions-hub/README.md`: a new hub's link is recorded in `docs/providers/claude.md`, in the
  same thread, as "Claude on another account" does. `AGENTS.md` Upkeep: read the provider file in full and
  `docs/instructions.md` sections 4 and 5 before the first action, and check every question against rule 10.
- 20/11/2026: `docs/providers/claude.md`: the move of the game page and the library viewer is stopped. Both stay on
  the account that published them and are shared with the other account for playing; only threads of this project
  publish them and triage in-game bug reports. Numbering bugs from the Bug log stays.
- 20/11/2026: Merging no longer waits for the owner. `AGENTS.md` rules 2 and 6 and `docs/instructions.md` sections 2
  and 8: a bug fix and a rule-file change merge like any other PR, when every check is green. A bug fix still gets
  its BG-n, root cause and log entries; a rule-file PR quotes the owner's words it acts on.
- 20/11/2026: `docs/providers/claude.md`: new section "Where the game page and the library viewer live". Both pages
  move to the Claude project on another account (`desk:rpg-game`), which alone publishes them once it records the
  new links; the old pages are frozen, saves cross by Export and Import buttons, and in-game bug reports are
  triaged there and become GitHub issues. The bug number counter is retired: every agent numbers from the Bug log
  (`docs/instructions.md` section 2, spec "Bug log").
- 19/11/2026: `docs/providers/claude.md`: new section "Claude on another account", with the second account's own
  Questions hub link and its desk label, `desk:rpg-game`.
- 19/11/2026: Added Codex provider notes covering the private questionnaire, verified setup and Claude handoffs.
- 19/11/2026: `docs/instructions.md` section 8: the full test suite is no longer a long run (about two minutes since
  #1115) and may run locally; GitHub stays for runs over about ten minutes. `AGENTS.md`'s map notes the nightly
  isolated run. Rule 5 is unchanged.
- 19/11/2026: New rule "Claim the work first" (`docs/instructions.md` section 4): one GitHub issue per piece of
  work, labelled with the desk that took it, so agents on different accounts and providers do not do the same work
  twice. `docs/providers/claude.md` names the desk labels.
- 19/11/2026: `docs/providers/claude.md`: new section "Republish button". The game's rail button starts a saved
  task that republishes the game page and the library viewer from `main`; the viewer's "refresh is manual" line and
  the scheduled tasks list changed to match, and the game page's capability declaration is written down.
- 19/11/2026: `.claude/skills/` now links to each skill in `.agents/skills/`, so Claude Code loads the owner's
  skills from the repo. Added `npm run skills-zip`, which packs each skill for upload to a Claude account. No skill
  text changed. `docs/providers/claude.md` and `docs/skills.md` say who loads what.
- 19/11/2026: The repo became the home for the working rules. Added `AGENTS.md`, `docs/instructions.md`,
  `docs/providers/claude.md`, `docs/memory/`, `docs/glossary.md`, `docs/skills.md`, `docs/assets.md`,
  `tools/questions-hub/` and this file. The rules were moved from the Claude project's in-app instructions and
  memory; the instructions as they stood are kept in `docs/providers/claude-instructions-before-repo-home.md`.
- 19/11/2026: Added the skills `game-feel`, `animation-principles` and `motion-sequencing`, with their source
  licences. Added the source licence beside `show-dont-tell-ui`.
- 19/11/2026: New rules: agents that cannot use the Questions hub agree with the owner how they ask; other agents
  take bug numbers from the Bug log on the latest `main`; agents of every provider merge their own PRs under the
  same rule; new lines in the spec and the bug-fix log keep those files' form of naming the owner.
- 19/11/2026: Added the skills `root-cause-first`, `show-dont-tell-ui` and `rpg-map` (PR #1090).
