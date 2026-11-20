# Process decisions

Kind: decision. How changes land and where work runs. The rules that follow from these are in `AGENTS.md` and
`docs/instructions.md`; this file keeps the dates and reasons.

- **The agent merges its own PR once checks are green** (07/11/2026). Before that the owner merged every PR. Bug
  fixes and rule files still wait for the owner's OK.
- **The spec is never frozen** (07/11/2026). An edit to it is a normal change, made in the PR that changes the rule.
- **Open items live in the repo** (07/11/2026). The spec's "Deferred items" table is the decision log (D-n), with
  "Open questions" (OQ-n) and the "Bug log" (BG-n) beside it. There is no separate decision-log file.
- **Generated docs fail the checks when stale** (07/11/2026). `docs/perks.md` is one
  (`tests/unit/perk-writeups.test.ts`).
- **The repo is public** (11/11/2026, confirmed 14/11/2026 and 19/11/2026). Reason: free minutes for the checks.
  Consequence: `AGENTS.md` rule 9.
- **The default branch is `main`** (19/11/2026). Before that a stale work branch was the default, and fresh clones
  started far behind.
- **Long runs go on GitHub, from a pushed branch** (19/11/2026). Reason: the checks already run the full suite on
  every push, and results stay with the branch. To be asked again after 19/12/2026.
- **The full test suite may run locally** (19/11/2026). Reason: since #1115 `npm test` takes about two minutes, so
  it is no longer a long run. Rule 5 stays as it was: the slowness came from how the tests loaded, not from the rule.
- **Optimise the game for quality and speed, not for model cost** (14/11/2026). Reason: the owner kept a costlier
  set of in-game agent calls because lower cost was the only case for trimming them.
- **Playtests continue one world** (17/11/2026). New runs carry on an existing world, never a fresh one.
- **This repo is the home for the working rules** (19/11/2026). Reason: so that agents from any provider work the
  same way. Agents that cannot use the Questions hub are shown it and agree with the owner how they ask. Other
  agents take BG numbers from the Bug log, and merge their own PRs under the same rule as Claude.
- **Naming the owner** (19/11/2026). New files say "the owner". Older files stay as they are, and new lines in the
  spec and the bug-fix log keep those files' form. The old in-app instructions are kept as a file in the repo.
