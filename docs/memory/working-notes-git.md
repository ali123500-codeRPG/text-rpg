# Working notes: git in this repo

Kind: working note. Written by agents, each with how it was checked. Not the owner's decisions.

- **Fetch `main` before branching.** A session's checkout can start on an old branch. Run `git fetch origin main`,
  then `git checkout -B <your branch> origin/main`. Checked: a PR once showed hundreds of unrelated commits because
  it was cut from a stale default branch (13/11/2026).
- **Look for conflict markers after every conflicted merge:** `git grep -nE '^(<<<<<<<|>>>>>>>) '` before committing.
  Never stage a whole folder while a merge is open; add only the files you resolved. Checked: PR #1085 shipped
  markers, PR #1087 fixed them and added a test.
- **Force-push may be refused.** To bring a branch back in line with `main` without it: `git checkout -B <branch>
  origin/main`, `git merge -s ours origin/<branch>`, then push. Checked: used on the library viewer's branch
  (13/11/2026).
- **GitHub sends no event when a PR turns conflicted** after another PR merges. An open PR's owner has to look.
  Checked: 13/11/2026.
- **The squash-merge needs the head commit you checked.** Pass the expected head SHA when merging your own PR, so a
  late push is not merged unseen.
- **The PR rule reads the PR body.** The check `pr-rule` (`scripts/pr-rule.mjs`) fails when "## Siblings checked" or
  "## Tests" is missing or still holds only the template comment. Checked: PR #616.
- **The repo name has capitals** in its owner part. Tools that lower-case it still reach it.
