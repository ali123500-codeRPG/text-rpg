# Changelog

Dated changes to the working rules and the skills only: `AGENTS.md`, `docs/instructions.md`, `docs/providers/` and
`.agents/skills/`. Newest first. Game changes are in the merged PRs, `docs/build-spec.md` and `docs/bug-fix-log.md`.

- 19/11/2026: Added Codex provider notes covering the private questionnaire, verified setup and Claude handoffs.
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
