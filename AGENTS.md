# AGENTS.md

Entry point for any AI agent working in this repo: what the project is, the rules that must never be broken, which
source wins when two disagree, and where everything lives. Read it from the latest `main` before you start.

## What this project is

A single-player text RPG, published as the private page "Echoes of the Thread". Code owns every number and fact. AI
agents inside the game only read the player's intent, voice characters, plan scenarios and narrate. It is a
build-crafting game first and a story second. It is the main game, not a prototype, and it is one person's personal
project: "the owner" below is its designer and its only player.

- Stack: TypeScript, vitest, esbuild. Node 22.
- Set-up and checks: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke` (needs Playwright's
  Chromium). `.github/workflows/ci.yml` is the reference.
- Finding your way: `npm run spec -- "<heading>"` prints one spec topic, `-- <ID>` one row or rule, `-- <SETTING>`
  (`SEARCH_AREA_M2`) the config file and line that set it, `-- --grep <text>` where a term or file is ruled.
  `npm run test:near` runs the tests nearest your change (`-- <system>` for one
  system). `npm run sync` catches up with `main` and checks no edit of yours was lost. The page in dev views:
  `?fake=1&stage=<stage>` and `?mapcheck`; `tests/smoke/map.smoke.ts` is the Map's automated check.
- This repo is public. See rule 9.

## Rules that must never be broken

1. **The owner's game and saves are off-limits, except to read.** Reading the owner's saves and stories is always
   allowed, to find a bug's cause. Never play the published game, and never write or delete the owner's saves or
   stories, without the owner's OK. Publishing the game means build, test and publish only.
2. **Every bug gets a number and its root cause.** Every bug gets a BG-n and a row in the spec's Bug log. Find the
   root cause with the `root-cause-first` skill. Write the cause and the fix once, in the bug's `docs/bug-fix-log.md`
   entry, and link that entry from the PR. A bug fix does not wait for the owner: it merges like any other PR (rule
   5). A fix that needs a design choice is still a question to the owner first (rule 3).
3. **Do not invent mechanics or guess a rule.** A gap, or a request that can be read more than one way, is a question
   to the owner with a recommendation. Build only the clear parts. When the shape of a curve, formula or table is
   open, or a request gives a direction for a number but no amount, show options before building.
4. **Never settle a clash silently.** Where code and spec disagree, report it: a BG-n if the code is wrong, a question
   if not.
5. **No direct commits to `main`.** Every change is a PR that follows `.github/pull_request_template.md`, with "Siblings
   checked" and "Tests" filled in (the `pr-rule` check fails without them). Merge only when every check is green.
   Never skip, disable or weaken a test to get there. Correcting a test that asserts the wrong thing is allowed:
   say in the PR what it now checks and why. Removing a test that would not be added today is allowed the same way
   (`docs/instructions.md` section 8): say what protection is lost.
6. **Rule files change only on the owner's word.** A PR that touches `AGENTS.md`, `docs/instructions.md`,
   `docs/providers/` or any skill in `.agents/skills/` quotes what the owner said or answered that it acts on. It
   then merges like any other PR (rule 5), without a second OK. An agent never changes a rule on its own idea.
7. **Balancing numbers live in one place.** Every tunable number (odds, damage, ranges, timers, thresholds, XP, costs)
   sits in `src/config.ts` (its parts in `src/config/`) or a library table under a clear name, with placeholders
   marked. Never hard-code one in logic, and never copy one into `docs/memory/`: name the setting and where it lives.
8. **Distance is real metres.** Reach, range, sight, hearing, movement and room sizes use real-life metres with a
   cited reference. Nearness is never "same zone", zone hops or link counts: zones are only titles for places.
9. **Keep secrets and personal details out of the repo.** Never commit secrets, tokens, passwords, account or ID
   numbers, or personal details about the owner (name, email, quotes, devices).
10. **Questions go where the owner answers them.** One question at a time or a numbered list, each with options and a
    recommendation, through the channel your provider file names. Never bury a question in a progress message, and
    never act on an answer the owner did not give.
11. **No decision stamps in code.** No names of who ruled and no dates in `src`, `tests` or `scripts`, nor in game
    text. Why a rule changed belongs in the PR and the spec. A
    question ID or a D-n in a comment is fine.
12. **A parked item gets its ID the same turn.** Anything the owner parks gets a D-n row in the spec's "Deferred items"
    table, with its options written out.

## Order of authority

- **What the game does:** code and tests first, then the spec (`docs/build-spec.md` and its topic files).
- **How to work:** `AGENTS.md` and `docs/instructions.md` first, then `docs/memory/`, then any provider's in-app
  memory or instructions.

Follow the higher one, keep working, tell the owner about the mismatch, and fix the lower copy. For the game
itself, rule 4 decides what "tell" means: a spec line that the code and a later recorded decision plainly contradict
is fixed in your PR and named there; if you cannot tell which side is right, it is a question before any fix.

## Map

- `docs/instructions.md`: the full working rules, for every agent.
- `docs/providers/claude.md`: what only Claude can do here (decision cards, the Questions hub, publishing the game),
  and what other agents do instead. One file per provider. The same folder keeps a dated record of Claude's old
  in-app instructions; it is history, not rules.
- `docs/build-spec.md`: the index of the spec, the living design record. Each topic is its own file in `docs/spec/`,
  so read only the ones a task needs. The "Deferred items" table (D-n), the "Bug log" (BG-n) and "Open questions"
  (OQ-n) are `docs/spec/deferred-items.md`, `bug-log.md` and `open-questions.md`; finished D-n and closed BG-n rows
  move to `deferred-items-archive.md` and `bug-log-archive.md`. Play screen rules are
  `docs/spec/part-2-turn-engine/play-screen.md` and `play-screen-motion.md`.
- `docs/systems.md`: start a task here. Each game system's spec topics, decision history, source files and nearest
  tests.
- `docs/bug-fix-log.md`: what each fixed bug was and what was done. Newest first; entries up to BG-326 are in
  `docs/bug-fix-log-archive.md`.
- `docs/memory/README.md`: index of topic files with the owner's decisions and agents' checked working notes.
- `docs/glossary.md`: IDs, names and abbreviations.
- `docs/skills.md`: every skill the project uses and where its master copy lives.
- `.agents/skills/<name>/SKILL.md`: the owner's skills, in full. `docs/skills.md` says when each applies. Some tools
  load this folder by themselves; if yours does not, open the file.
- `docs/assets.md`: large and binary files, their licences, and who can fetch them.
- `tools/questions-hub/`: the tooling behind the owner's Questions hub.
- `PRODUCT.md`: product context for design work. `docs/perks.md` is generated (`npm run perks-doc`); edit its source.
- `docs/skill-tags.md`: the tags each skill carries. `docs/growth-proposal.md`: the proposal behind essences and
  scenario-end growth, kept as history; what was built is in the spec.
- `docs/workstreams.md`: rules from the first build, kept as history.
- `.github/workflows/`: `ci.yml` (every PR), `pr-rule.yml` (the PR body), `nightly.yml` (a nightly soak run of
  `tests/soak`, and every test file run isolated).
- `CHANGELOG.md`: dated changes to rules and skills only.
- `src/config.ts`: every balancing setting, gathered from its parts in `src/config/`, one per system;
  `npm run spec -- <SETTING>` finds a setting's part. `src/library/`: game data. `tests/harness/`: test helpers.
- `tests/`: `unit` and `cases` (scenario tests), `smoke` (browser), `soak` (long world runs: small in every check run, large nightly), `parser-eval` (needs a
  real model).

Links to `claude.ai/artifact/...` in these files open only for the owner.

## Upkeep

- A change to a decision, spec, skill or rule updates its file in the same PR as the change.
- One home per thing. Do not start a second log, table or glossary for something that has one. Link to it.
- A change to a rule file or a skill adds a dated line to `CHANGELOG.md`.
- Read the rules from the latest `main`, not from whatever checkout a session starts on: `git fetch origin main`
  first, and branch from `origin/main`.
- Before your first action, read your provider file's "Every thread" part and `docs/instructions.md` sections 4 and
  5, even when a task names only some sections; read the rest of the provider file when the task needs it. Check
  every question against rule 10 before you send it.
- A provider's in-app memory holds only pointers and provider-only notes. Durable facts go to the repo: a rule to
  `docs/instructions.md`, a decision or checked note to `docs/memory/`, a game rule to the spec.
- Dates are written DD/MM/YYYY.
