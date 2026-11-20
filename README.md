# Text RPG

A single-player text RPG in which code owns every number and fact, and AI agents only read the player's intent,
voice characters, plan scenarios and narrate. This file is for people: what is here, how to run it, and how to
start an AI agent on it. Agents start from [AGENTS.md](AGENTS.md).

This is one person's personal project ("the owner" in these files). The repo is public; the published game is not.

## Run it

Needs Node 22.

```sh
npm ci
npm run typecheck
npm test          # unit and scenario tests, with a stand-in for the model
npm run build     # writes dist/play (the game) and dist/library (the library viewer)
npm run smoke     # browser tests of both pages; needs Playwright's Chromium
```

Open `dist/play/index.html?fake=play` to see the play screen with an in-memory stand-in game. The real game calls a
model while it runs, and for that it is published as a private page from the owner's Claude account.

## Where things are

- [AGENTS.md](AGENTS.md): the entry point for agents. The rules that must never be broken, and a map of the repo.
- [docs/instructions.md](docs/instructions.md): the full working rules.
- [docs/build-spec.md](docs/build-spec.md): the design record, an index of one file per topic in `docs/spec/`.
- [docs/systems.md](docs/systems.md): each game system's spec topics, history, code and tests.
- [docs/glossary.md](docs/glossary.md): IDs, names and abbreviations.
- [docs/memory/README.md](docs/memory/README.md): the owner's decisions and agents' checked notes, by topic.
- [docs/skills.md](docs/skills.md): the skills agents use here.
- [docs/providers/](docs/providers/): what only one provider's agent can do.
- [CHANGELOG.md](CHANGELOG.md): changes to the rules and skills.

## Starting an AI agent here

Every agent works from the same files. The start-up step differs by tool. The entries below say which workflows
have been tested in this project.

- **Claude (claude.ai project, or Claude Code).** Tested. `CLAUDE.md` imports `AGENTS.md`, so the rules load by
  themselves. Claude Code loads the owner's skills through `.claude/skills/`, which links to `.agents/skills/`. A
  thread inside a claude.ai project loads skills only from the account: there the agent opens the `SKILL.md` it
  needs, or the account gets the skills uploaded (`npm run skills-zip`). Also read `docs/providers/claude.md`.
- **Codex.** Tested with a public fetch, manual instruction and skill reads, and the Node 22 checks.
  See [Codex provider notes](docs/providers/codex.md) for results, question handling and tool limits.
- **GitHub Copilot (coding agent).** Untested. It reads `AGENTS.md` and skills in `.agents/skills/`.
- **Cursor.** Untested. It reads `AGENTS.md` and skills in `.agents/skills/`.
- **Gemini CLI.** Untested. `GEMINI.md` imports `AGENTS.md`. It reads skills in `.agents/skills/`.

For any tool: if the rules did not load, the first message is "Read AGENTS.md on the latest main before working."

## What only one provider can do

Today these work only from Claude sessions on the owner's account. `docs/providers/claude.md` says what other
agents do instead.

- Writing questions to the owner's Questions hub, and decision cards.
- Publishing the game page and the library viewer.
- Playtests and the Parser test set against a real model (they need a signed-in `claude` command-line client).
- Reaching the project's shared folder (`docs/assets.md`).

An agent from another provider can do everything else: read the rules, change code, run the tests, open a PR and
merge it under the same rules as Claude.
`docs/providers/claude.md` lists the smaller Claude-only pieces too. A new provider gets its own file in
`docs/providers/` the first time its agent works here: the agent writes it, starting with how it and the owner
agreed to handle questions (`docs/instructions.md` section 5).

## Contributing

There is no outside contribution process: changes come from the owner's agents through PRs that follow
`.github/pull_request_template.md`. Licences of third-party material are listed in [docs/assets.md](docs/assets.md).
