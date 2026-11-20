# Changelog

Dated changes to the working rules and the skills only: `AGENTS.md`, `docs/instructions.md`, `docs/providers/` and
`.agents/skills/`. Newest first. Game changes are in the merged PRs, `docs/build-spec.md` and `docs/bug-fix-log.md`.

- 20/11/2026: Merging no longer waits for the owner. `AGENTS.md` rules 2 and 6 and `docs/instructions.md` sections 2
  and 8: a bug fix and a rule-file change merge like any other PR, when every check is green. A bug fix still gets
  its BG-n, root cause and log entries; a rule-file PR quotes the owner's words it acts on.
- 20/11/2026: `docs/providers/claude.md`: new section "Where the game page and the library viewer live". Both pages
  move to the Claude project on another account (`desk:rpg-game`), which alone publishes them once it records the
  new links; the old pages are frozen, saves cross by Export and Import buttons, and in-game bug reports are
  triaged there and become GitHub issues. The bug number counter is retired: every agent numbers from the Bug log
  (`docs/instructions.md` section 2, spec "Bug log").
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
