# Working notes: checking behaviour, motion and playtests

Kind: working note. Written by agents, each with how it was checked. Not the owner's decisions.

## What does a rule do

Write a throwaway vitest that uses `tests/harness` (a village, an actor, a seeded random source). Print true skill,
effective skill and roll rates over a few thousand seeded rolls, before and after. Delete the test and report the
measured results. Checked: an answer from reading code alone was wrong after a later PR changed the perk
(08/11/2026).

The harness resets the config: `makeVillage()` and the plan helper call `resetConfig()`. Set a config value for a
measurement after building the village, or the change is silently undone. Checked: `tests/harness/village.ts`.

For a before-and-after comparison across a fix, run the same throwaway test in a git worktree of the commit before
the fix. When counting "who acted first", check that the actor acted at all.

## Watching motion

1. `npm run build`.
2. Open `dist/play/index.html?fake=play` in Playwright with video recording on. `?fake=...` runs an in-memory game
   for screenshots and never touches a save.
3. Enter a command, wait for the turn to finish, and close the browser context, which writes the video.
4. Use `ffmpeg` to cut a timestamped strip of frames (about ten frames a second, cropped to the area that moves, tiled
   into one image) and read it. A slower full-frame strip gives the overview.

Checked: the first recording showed two bugs that screenshots at fixed moments had missed (11/11/2026).

## Pages

- Test the built page as served, not only the source: the library viewer and the game are bundles under `dist/`.
- Before a library viewer publish, open every tab once and watch for page errors and for "undefined" in the text.
  A change in a library's shape can break one tab while the build and tests stay green. Checked: 09/11/2026.

## Playtests

- Build once, then start runs with `node dist/playtest.mjs --turns N --out DIR`. Useful flags are in the header of
  `scripts/playtest.ts`: `--resume DIR`, `--world DIR`, `--class <class key>`, `--persona`, `--character`,
  `--near-seller`.
- Start a run detached from the session that launches it (`setsid nohup ... &`). A run started as a tracked
  background task died when it was paused. Checked: 13/11/2026.
- Stop one run by its `--out` folder, never every run at once.
- A run writes its store after every turn, so a stopped run can continue with `--resume` once the fix has merged.
- Each run writes a transcript, an errors log and a reports file where the test player lists what did not work.
  Read all three before calling a run clean.
- Playtest prompts differ slightly from the published game's: the command-line client joins the fixed and per-turn
  parts into one prompt. Read prompt-behaviour results with that in mind. Checked: header of `scripts/playtest.ts`.
