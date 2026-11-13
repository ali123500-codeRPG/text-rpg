# Personality line prototype

A standalone build of the redesigned personality line (archetype + "but" deviations, ranked drives, tensions, Nerve),
kept apart from the game so it can be tested before it replaces `personalityText` in `src/ruleset/personality.ts`.
Nothing in `src/` imports this folder, and CI does not build it.

- `tables.ts`: every word, hint, archetype target, tension row and threshold. Tuning happens here only.
- `line.ts`: computes the line from points. The archetype is the nearest by average gap over the six axes
  (a template may pin one); a "but" is any axis at 20+ points that is 40+ away from the archetype's target and
  not just a weaker version of it, at most 3; the first 2 drives; the first 2 tension rows that apply.
- `characters.ts`: test characters (blind renames) and what the self-check expects for each.
- `scenes/<character>/*.json`: one voice-test scene each, with its case ID and success conditions.
- `run.ts`: `explain`, `check`, and `build <dir>` (writes one Responder prompt per scene, automatic and full mode,
  using the live Responder rules from `src/agents/prompts.ts` plus the line-order sentence).

```
npx esbuild proto/personality/run.ts --bundle --platform=node --format=esm --outfile=dist/proto-personality.mjs
node dist/proto-personality.mjs check
node dist/proto-personality.mjs explain
node dist/proto-personality.mjs build /tmp/voice-run
```

Each prompt file is run by a blind agent that reads it and returns the Responder JSON; a scene passes when both
runs meet its success conditions. Cases and results are logged in the "Personality Voice Tests" doc.
