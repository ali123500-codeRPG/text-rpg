# Workstream rules (integration owner: W0)

Source of truth: `docs/build-spec.md` (Build Spec v0.6). Every rule there is binding. Values marked placeholder live in
`src/config.ts`. Items marked [Proposed] are built as written. Do not invent mechanics: if the spec has a gap, pick the
smallest reading, mark it `// GAP:` in code with a one-line note, and list it in your final report.

## Hard rules for every workstream
- Own only your files (listed in your brief). Do not edit `src/types/*`, `src/config.ts`, `src/library/*`, `src/engine/relations.ts`
  or `tests/harness/*`. If you need a type change, make the smallest addition, put it in your final report as "TYPE CHANGE", and keep it additive.
- Implement the exported contract signatures in your module's `index.ts` exactly. You may add new exports and new files under your directory.
- Determinism: never use Math.random or Date.now in engine code. Use the passed `Rng` (`src/rng.ts`). Replay must be exact.
- Every number from `CONFIG` (read at call time). Never change a ruleset number; add a missing placeholder to your report instead.
- Views are deny-by-default: build new objects from whitelisted fields; never clone state and delete.
- Nothing from `state.hidden` reaches the Parser, Narrator or Voice.
- Ask-before list (do NOT do these; report instead): change a ruleset number, add a Claude call to a turn type, send state.hidden to Parser/Narrator/Voice, settle a deferred item (D-n).
- Other workstreams' functions may still be stubs (`todo()` throws). Unit-test your module with small local fakes where you depend on others.
- Scenario tests: one file per test in `tests/cases/`, named `sNNN-short-name.test.ts`, using `tests/harness`. Write them
  against the real contracts. If one can't pass until another workstream lands, still write it fully; it will go green at integration.
- `npx tsc --noEmit` must pass for your files. Commit on your branch with clear messages. Don't push.
