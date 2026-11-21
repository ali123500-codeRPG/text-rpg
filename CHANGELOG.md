# Changelog

Dated changes to the working rules and the skills only: `AGENTS.md`, `docs/instructions.md`, `docs/providers/` and
`.agents/skills/`. Newest first. Game changes are in the merged PRs, the spec and `docs/bugs/`.

- 21/11/2026: `AGENTS.md` rule 12 and `docs/instructions.md` section 2: five more idea lists, ICB-n (combat and
  bodies), IGT-n (items, loot and trade), IWD-n (world, travel and scenarios), INP-n (NPCs and personality) and ICG-n
  (age and training); 40 open D-n rows below D-231 moved there with their numbers, and rule 12 now names every
  list's ID. The owner, project thread, 21/11/2026: "have a thread provide groups to the open items before D-231 if
  they don't already have an ID group", "also check that group IDs are part of the instructions", then "I like the
  first four" and "fine with ICG".
- 21/11/2026: `docs/instructions.md` section 2: the idea lists' IDs start with I: IPP-n,
  IAA-n, IVP-n, ICI-n, IEI-n and ITI-n (were PP, AA, VP, CI, EI and TI); D-n is unchanged. Every reference in the repo
  was renamed; older lines below keep the old names. The owner, Questions hub page "Open parked items 3", TI-218:
  "a, but add a letter at first to indicate they belong to the ideas, it gets confusing when the same naming sense is used for the question hub and the parked ideas."
- 21/11/2026: `AGENTS.md` rule 12 and `docs/instructions.md` section 2: parked Threadbound item ideas get TI-n rows
  in `docs/spec/threadbound-ideas.md`; D-218 and D-220 moved there. The owner, Questions hub page "Open parked items
  3", D-218: "I want some threadbound items to level up. give threadbound items a unique parked item ID, and confirm to
  me explicitly in the question hub what the current table IDs are for parked items before closing this question."
- 21/11/2026: `AGENTS.md` rule 12 and `docs/instructions.md` section 2: parked essence ideas get EI-n rows in
  `docs/spec/essence-ideas.md`; the parked essence rows D-227, D-228, D-249, D-250, D-262, D-263, D-265
  and D-313 moved there. The owner, Questions
  hub page "Notable foes: fewer early essences", NF6: "park for later to be review if I don't like how essences work.
  give parked essence items their own ID."
- 21/11/2026: `AGENTS.md` rule 12 and `docs/instructions.md` section 2: parked class ideas get CI-n rows in
  `docs/spec/class-ideas.md`, and a table at the top of `docs/spec/deferred-items.md` shows which ID holds which kind of
  parked idea. The owner, Questions hub page "Open parked items 2", D-157: "a, give class ideas their own ID in parked
  items, Make sure there is a table showing which ID holds which type of parked idea."
- 21/11/2026: `docs/instructions.md` sections 4 and 8: a task that grows big within its scope uses helper agents;
  work of a different scope goes to its own thread. The owner, in the DS1–DS7 thread: "make it a standing rule as
  well if the tasks gets big within the same scope, use helper agents, if the scope is different, separate the scope
  to a different thread."
- 21/11/2026: `AGENTS.md` rule 3 and `docs/instructions.md` sections 1 and 5: inventing new things for the game is the
  build agents' job, proposed whole with concrete values for the owner to approve; only the in-game agents never
  invent. The owner, in the AA-108 deed-ideas thread: "the ones who cannot invent rewards are the in-game agents
  during play, your whole role here with me is to invent new things to include in the game".
- 21/11/2026: `docs/instructions.md` section 2: parked vow and pledge ideas get VP-n rows in `docs/spec/vow-ideas.md`.
  The owner, Questions hub page "Vows: goals you set with an agent (D-141)", VW5: "park forsworn idea (under a new parked
  ID theme for pledges and vows, and move all parked ideas related to them to that new theme )".
- 21/11/2026: `.agents/skills/rpg-map`: the stages to render and check are four, with `two-towns`. The owner, in the
  D-1558 thread: "Add a 4th test stage with two towns and a road (MAP-52)."
- 21/11/2026: `AGENTS.md` rule 7 and `docs/instructions.md` section 4: the spec names a balancing setting and never copies
  its number. The owner answered PQ15 "if the spec if ancient and not needed, remove it or achieve it somewhere. a
  otherwise." (option a: "spec names the setting, numbers only in code").
- 21/11/2026: `AGENTS.md` rule 9: decision records in the spec and the changelog may name the owner and quote their
  answers; email, devices and anything private stay out. The owner, on the Questions hub page "One continuous map
  (D-1558)", RX3 (keep the name and quotes as they are): "b, I don't care so muchn".
- 21/11/2026: `docs/instructions.md` section 8 and `docs/providers/claude.md`, Skills: a merged change to a skill hands
  the owner the zip of each changed skill (`npm run skills-zip`, `dist/skills/<name>.zip`) in its report. The owner:
  "give me zip for the skill and make is a standing project rule for any change that updates skills".
- 21/11/2026: `docs/providers/claude.md` "Playtests and model-backed tests": the signed-in `claude` client is on the
  main account only; threads on the other account follow the "Other agents" line. The owner answered PQ14 "a."
  ("Note that it holds on the main account only").
- 21/11/2026: `AGENTS.md` rule 8 and the `rpg-map` skill: a zone (title) only names a space and never decides where
  something is or is drawn, how marks are placed, grouped, merged or hidden, who is near, or what can be reached. The
  owner, on the Questions hub page "One continuous map (D-1558)", ZR1: "a.", after "why are you insisting on
  utilizing zones? ... we need to resolve this issue at the root cause level."
- 21/11/2026: `docs/instructions.md` section 7: every hover label goes through the page's one tip (`mountTip`), never
  the browser's tooltip or a tip of its own. The owner: "reduce the amount of by hand items, and go ahead and change it
  all to game for consistency, it's weird now that some are browser and some are by game. make sure to log this
  somewhere in the instructions".
- 21/11/2026: `AGENTS.md` rule 12 and `docs/instructions.md` section 2: parked achievement ideas get their own list, AA-n
  in `docs/spec/achievement-ideas.md`, and every parked idea is sorted by subject when parked (perks PP-n,
  achievements AA-n, anything else D-n). The owner: "similar to the perks, have a separate ID for parked ideas related
  to achievements. make sure future parked ideas will follow the same segregation."
- 21/11/2026: `docs/instructions.md` section 7, `.github/pull_request_template.md`, `scripts/pr-rule.mjs`: every PR that
  changes `src/ui` has a `## Design` part (skills used, screens rendered, where a moved element now sits), and the
  `pr-rule` check fails it without one; every control carries a house class on itself and only classes that exist;
  every tag takes the colour of what it names. The owner asked "what rules were followed that allowed this in the
  first place, and how do you suggest we fix those rules", then chose "A + B + C" on a decision card.
- 21/11/2026: `docs/instructions.md` section 2: parked ideas about perks specifically get their own list, PP-n in
  `docs/spec/perk-ideas.md`, for a perks thread; rows moved there keep their D-n number. The owner: "for parked
  ideas related to perks specifically, make a new ID for them so we can tackle them in a perks thread later."
- 21/11/2026: `docs/providers/claude.md` and `codex.md`: an agent that cannot publish the game page or the library
  viewer no longer says in PRs or reports that they need a republish; the owner republishes when they choose. The
  owner: "the publishing is none of your concern, and if a rule says it is adjust the rule".
- 21/11/2026: `AGENTS.md` rule 12 and `docs/instructions.md` section 2: a parked D-n row holds the owner's own words,
  with options only where the owner gave them; no context or options of the agent's own. The owner: "I only told
  you to park the idea not add your own interpretation to it", then "Change it" on a decision card.
- 21/11/2026: `docs/instructions.md` section 2: a new D-n or OQ-n is the number of a GitHub issue opened for it and
  closed at once; numbers below 1000 are the old count. `npm run sync` keeps both sides when two PRs add rows to the
  Deferred items table, its archive or the Open questions list. The owner: "address D-n and OQ-n", then "Own issue per
  ID" on a decision card.
- 21/11/2026: `AGENTS.md` rule 2, `docs/instructions.md` sections 2 and 8, `docs/providers/claude.md` and `codex.md`:
  a new bug's BG-n is its claim issue's number (label `bug`), the issues are the bug register, and each fix writes
  its own `docs/bugs/BG-n.md`; no new Bug log rows or `docs/bug-fix-log.md` entries. PRs are waited on and merged with
  `npm run pr:wait -- <n> --merge`. The owner: "Eliminate race-prone manual bug-number allocation. Prefer using the
  existing GitHub claim issue's unique identifier" and "Replace blind CI polling with state-aware PR monitoring".
- 21/11/2026: `design-spatial` trimmed to what the game uses (render and look, the overflow gate, the audit, optical
  craft; about 1.5k tokens instead of 5k), and its fresh-eyes subagent runs only for new screens and layout changes, not
  small changes (`docs/instructions.md` section 7). The owner, on the two ways offered to cut its token cost: "apply
  both."
- 21/11/2026: `docs/providers/claude.md`, "Questions": a question from an agent's own work (permissions, housekeeping,
  a follow-up) is still a question, asked on a card or the hub, never as a line in a summary. The owner, on a
  decision card after a thread asked in plain chat: "Add the line".
- 21/11/2026: `design-spatial`'s project part: tap size is report-only, with no click-target floor (the owner, on a
  decision card offering 24 px, 44 px or none: "No floor, report only").
- 21/11/2026: new skill `design-spatial` in `.agents/skills/` (from connerkward/ckw-design-skill, MIT), used for
  every UI change as item 6 of the design skills in `docs/instructions.md` section 7. The owner asked: "I feel like
  we need more design skills, find me one which will tell you to center the icons in a band, and not take too much
  space"; after seeing it run on the perks board: "looks good, let's add it".
- 20/11/2026: `docs/providers/claude.md`, "The game page": a publish also sends `assets/backdrops/*.webp` when
  the backdrops changed (PS-486). The owner approved the report whose build plan named this step: "all is good, you
  can proceed with this approach".
- 20/11/2026: `AGENTS.md` rule 9 is back as a narrower rule: keep secrets and the owner's personal details out of
  the repo (the owner: "actually, add keeping secrets and personal details back to rule 9"). The parts on saves and
  user data, licensed content and how files name the owner stay out. The "See rule 9" pointer and the line in
  `docs/memory/process-decisions.md` return.
- 20/11/2026: `AGENTS.md` rule 9 (keep the public repo clean) removed and left as a placeholder for a future rule;
  rules 10 to 12 keep their numbers (the owner: "I mean the keep the repo clean one. you can remove it, no need to
  renumber the rest just call it placeholder for future rules."). The "See rule 9" pointer and the rule 9 line in
  `docs/memory/process-decisions.md` go with it.
- 20/11/2026: style and format guards retired (the owner, KT6 b on "Tests I was unsure about but kept": "Keep the four
  that keep the repo working, plus the contrast check; remove the style and format rules"). `AGENTS.md` rule 11 and
  `docs/instructions.md` (bug log rows, bug-fix log entries) keep their rules but no longer name a test that enforces
  them; the imports-format, no-stamps, bug-log, bug-fix-log and prompt-sections tests are gone.
- 20/11/2026: keeping a test takes the same rule as adding one (the owner: "A permanent test must continue to earn its
  place in the suite. Existing tests should not receive automatic protection merely because they were added in the
  past"; RM23: "looks like temporary tests, we can't have everything run every test."). `docs/instructions.md`
  section 8: what to weigh (severity, likelihood, other coverage, real catches, cost), unique coverage is a reason and
  not a pass, a browser test only for a break that would stop play; a test that would not be added today may be
  deleted in a PR that touches it, naming the protection lost, with no replacement owed. `AGENTS.md` rule 5, TQ5 and
  the PR template follow.
- 20/11/2026: agents choose tests by risk (the owner: "Replace the owner-approval requirement with an autonomous,
  risk-based policy"; "No individual owner approval should be required for ordinary permanent tests").
  `docs/instructions.md` section 8: a permanent test only for a credible regression nothing else catches, its reason in
  the PR, in the cheapest form (a seed loop stops once it has seen what it asserts); temporary tests deleted before
  merge; the owner is asked only about costly tests or a change to how the suite is built. The PR template follows.
- 20/11/2026: one rule for permanent tests (the owner: "Permanent test cases require explicit owner approval", "This
  applies whether the new case is added to an existing file or a new file"). `docs/instructions.md` section 8: a
  temporary test may check a task and is deleted before merge; any new permanent case needs the owner's OK quoted in
  the PR; changed assertions and completeness rows need none. The section's two-line addition from #1321 is folded in.
- 20/11/2026: the bug fix log's entries up to BG-326 (the ones that name a PR) move unchanged to
  `docs/bug-fix-log-archive.md` (the owner, asked whether to split it as well: "yeah"). `AGENTS.md` map follows.
- 20/11/2026: active and archive (the owner: "for the spec for decisions and bugs etc files, I would still want to
  change them between active and archive"). `docs/instructions.md` section 2: the Deferred items table and the Bug log
  keep open rows; a finished row moves unchanged to its archive file in the PR that finishes it; a new BG-n is one past
  the highest in either file. `AGENTS.md` map, the glossary and the provider file follow.
- 20/11/2026: task tests are temporary (the owner: "I approve your addition to the rules"). `docs/instructions.md`
  section 8: a test written to check one task is deleted with its fixtures before merge; a new permanent test needs the
  owner's OK. Section 4: read by ID, not by file; never a file over 50 KB whole. The PR template's Tests line follows.
- 20/11/2026: tests by risk (the owner, testing review: "I am fine with both recommendations"; "go ahead with the
  rest"). `docs/instructions.md` section 8: look for a covering test first, add one only for a silent break nothing
  covers, in its cheapest form (a whole turn only when the turn is the risk), none for docs, rules, config, tooling
  or wiring a smoke flow covers; run local checks once and rerun only failures. `AGENTS.md` rule 5: removing a
  duplicate or a test that guards nothing is allowed, naming what covers it. Section 1: a throwaway test only when
  reading the code cannot settle a rule. Section 4: ponytail's test line gives way to section 8. The PR template and
  the TQ5 spec line follow; the memory note letting the full suite run locally is removed (section 8, #1161).

- 20/11/2026: `AGENTS.md` rule 1 and `docs/providers/claude.md` "The live game page and the owner's saves": reading
  the owner's saves and stories is always allowed (the owner, Questions hub page "Map rules revision", RM14: "reading
  my saves is always allowed"); playing the game and writing or deleting saves still need the owner's OK. A thread
  that cannot reach the game's database asks for the GM page's "Download backup" file.
- 20/11/2026: `docs/instructions.md` section 2 "Bugs": every Bug log row is one line, BG-1 to BG-326 included (the
  owner chose "Normalise, change rule"); an older row that held more than its fix log entry is kept as filed at the
  end of that entry.
- 20/11/2026: `AGENTS.md` "Finding your way" and map: `npm run spec -- <SETTING>` gives the config file and line that
  set it. `docs/providers/claude.md` "Questions hub: writing and answers": where a questionnaire lives is one lookup
  in Supabase, not a date; an own-database page with `moved` is a stale copy that names where it lives.
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
