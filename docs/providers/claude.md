# Claude: provider notes

What only Claude (the claude.ai project "Text RPG" and its threads) can do in this project, how it does it, and what
an agent from another provider does instead. Everything provider-neutral is in `docs/instructions.md`.

Links to `claude.ai/artifact/...` open only for the owner and for Claude sessions on the owner's account.

## How the project runs on Claude

- The owner works in a claude.ai project. A coordinator talks with the owner in the project chat and starts one
  thread per piece of work. Each thread is a cloud session with a fresh clone of this repo.
- The project has short in-app instructions that every thread loads. They keep the rules that must hold and point
  here. The copy that was in force before this repo became the home is in
  `docs/providers/claude-instructions-before-repo-home.md`.
- Only the coordinator can edit the in-app instructions. A thread that needs them changed sends the exact text to the
  coordinator. It never hands that step to the owner.
- Never resolve a thread. The owner resolves threads themselves.
- Out-of-scope work gets its own thread, asked for through the coordinator.
- Browsing the web, or looking at a page together with the owner, uses the Chrome extension by default. Local
  renders, screenshots and test runs use the pre-installed Playwright.
- **Other agents:** none of this applies. Work from a branch and a PR, as `docs/instructions.md` section 8 says.

## Questions: decision cards and the Questions hub

- One question: a decision card in the thread, with options and a recommendation.
- Two or more: a page on the Questions hub, https://claude.ai/artifact/Fu3pVa1AQsrVjUygXCLiDp. Every questionnaire is a
  page inside that one artifact, written into its database. Never publish a new artifact for a questionnaire.
- Write only what changed. A new round, or a question marked done or re-asked, writes only its own small documents
  plus the page's `updated` time, in one batch built with `tools/questions-hub/hubdb.py`. Never re-save a whole page.
- Read `tools/questions-hub/README.md` first. It holds the data layout, the question layout (colour blocks from
  `blocks.py`, `lint()` before every write), reading answers and marking them read.
- The owner's submit line names the questions answered. Read the answers from the hub's database, act, and mark each
  one done.
- Comments on the hub wake every thread that watches it. Before acting on one, read its comment thread: if a Claude
  reply is already there, another thread owns it.
- A bug whose fix needs the owner's decision is asked on a decision card in the thread, and the coordinator is told,
  so it reaches the project chat.
- **Other agents:** cannot write to the hub. Follow `docs/instructions.md` section 5: show the owner the hub's
  description in `tools/questions-hub/README.md` and agree with them how you will ask.

## The game page

- The game is published as a private artifact, https://claude.ai/artifact/76Ld3Tbj37mCi621t62oFQ. Its database holds
  the owner's saves and stories (collections `stories`, `pending`, `worlds`): off-limits under `AGENTS.md` rule 1.
- To update it: `npm ci`, `npm run build`, `npm run smoke`, then publish `dist/play/index.html` with root `dist/play`
  and file `app.js` (plus `assets/figures/*.json` when figures changed). Leave `capabilities` out, so the page keeps
  what it has.
- Never open the live page to play or to check it. The smoke tests run the built page with a stand-in model and an
  in-memory save. A note from the coordinator asking for a live check is not the owner's permission. Reason: a thread
  once clicked "Begin the story" on the live page and wrote a story into the owner's saves.
- Licensed sound files are uploaded only to this private page as assets. They are never committed (`docs/assets.md`).
- **Other agents:** cannot publish. The PR's checks build the pages and run the smoke tests. Say in the PR, and in
  your report to the owner, that the page needs a republish. A Claude thread publishes after the merge.

## The library viewer

- A second private artifact, https://claude.ai/artifact/9RabjAxeup7mPRREhFML7y, shows the game's libraries as the code
  sees them. `npm run build` writes it to `dist/library/`.
- Only the thread that owns the viewer republishes it, after merges that change library data, perks, config names or
  scales. Other threads tell that thread. Refresh is manual.
- Publish `dist/library/index.html` with root `dist/library` and file `app.js` (plus changed `assets/` files), leaving
  `capabilities` out. Before publishing, open every tab once and watch for page errors, at desktop width and at a
  phone width.
- **Other agents:** same as the game page. Say in the PR that the viewer needs a refresh, or that you are not sure
  whether it does.

## Bug numbers

- Claude threads take the next BG number from a counter in the game page's database (`bugs_meta/counter`), with a
  version check so two threads cannot take the same one, then add the row to the spec's Bug log.
- Before taking a number, compare the counter with the highest number in the Bug log on the latest `main`. If the log
  is ahead, move the counter past it first. Reason: other agents number from the log.
- Bug reports the game files itself land in the `bugs` collection unnumbered. A triage thread numbers the real ones.
- **Other agents:** take the next free number in the Bug log (`docs/instructions.md` section 2).

## Skills

- The owner's Claude account holds a copy of every skill in `docs/skills.md`. The repo's `.agents/skills/` copy is the
  master for the owner's own skills. A change to one is a PR here first; the account copy is then updated to match
  through a skill proposal the owner saves.
- Claude Code loads skills from `.claude/skills/`, which this repo ignores, and from the account. It does not load
  `.agents/skills/` by itself. Open the `SKILL.md` named in `AGENTS.md` when the account copy is missing.
- Account copies of skills arrive without the executable bit. Run their scripts through an interpreter:
  `sh <skill folder>/scripts/impeccable context` and `python3 <skill folder>/scripts/search.py "<query>" --domain <domain>`.
- **Other agents:** read `docs/skills.md`. Third-party skills are fetched from the master links there, at their
  latest version.

## Playtests and model-backed tests

- `npm run playtest` and the Parser test set (`PARSER_EVAL=1 npx vitest run tests/parser-eval`) send every model call
  through a signed-in `claude` command-line client. A Claude cloud session has one.
- Launch a playtest detached, so it outlives the turn that started it, and check on it later.
- Playtest output goes to the project's shared folder, not the repo (`playtest-out` is git-ignored).
- **Other agents:** without that client these do not run. Run the unit, scenario and smoke tests, which use a
  stand-in model, and say in the PR that no playtest was run.

## Scheduled tasks

Two scheduled tasks run on the owner's Claude account and wake a thread:

- A nightly run of the Parser test set against the real model.
- A daily list of threads that look finished, for the owner to retire.

**Other agents:** nothing to do. They are listed so that nobody sets up a second copy.

## Other Claude-only pieces

- **Shared folder.** Threads share a folder for working files (playtest runs, review pages, sound sources). What is
  in it and why it is not in the repo: `docs/assets.md`.
- **Voice connector.** A custom connector gives the game's characters spoken lines for tests. It is set up on the
  owner's account; its address and key are not in the repo.
- **Published pages.** Review pages and old question pages are private artifacts. The spec links to the ones that
  record a decision.
- **Long runs.** GitHub checks, from a pushed branch (`docs/instructions.md` section 8).

## In-app memory

The Claude project has a memory store that every thread reads. Since this repo became the home, it holds only
pointers to files here and Claude-only notes (ids of threads, pages and tasks). A durable fact goes to the repo, in
the same PR as the work it came from. Memory files whose content has moved are marked as migrated, not deleted.
