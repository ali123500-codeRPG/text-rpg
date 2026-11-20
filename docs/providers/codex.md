# Codex

## Questions

Use the owner's private Text RPG Questions site. Keep its private address out of this public repository.
Use one questionnaire per batch, stable question IDs, short labelled colour blocks and an editable answer
for every question. A recommendation must be selectable in one tap and explain why. Keep the unanswered
shortcut and completion-message button usable on phones. Follow section 5 of `docs/instructions.md`
for numbering, ordering, re-asking and recording decisions.

A draft lives in the browser that entered it. The owner pastes the completion message, including answers,
into the thread that asked. Act on that message, then record each result on the private site.
For work across threads, read the latest repo decisions and the existing questionnaire first. One thread
owns each questionnaire. Save confirmed project decisions in their existing repo home through a PR.

## Tools and handoffs

- Start with `git fetch origin main`. Manual reading of the root instructions and project skill files
  was verified. Automatic discovery was not verified.
- Use Node 22 for install, typecheck, tests, build and smoke. Smoke uses the Chromium revision pinned
  by Playwright. The onboarding run verified both builds. Two scenario cases and two smoke cases
  timed out locally and passed in isolation with their original limits. Both CI jobs passed on that head.
- Check authenticated GitHub access before promising a PR. Public fetch and local commits can work
  while the CLI is signed out. Use a separate checkout or worktree and a task branch per thread.
- For the private game and library viewer, identify the page to republish in the PR and report.
  After merge the owner presses the game's Republish button, or a Claude session publishes.
- Use stand-in unit, scenario and smoke tests. Real-model playtests and Parser evaluations require
  Claude's signed-in client. Identify any such check still needed.
- Use repository fixtures. Name any asset or run that requires Claude's shared folder.
- Take bug numbers from the latest spec Bug log, one above the highest ever used. Recheck on integration.
