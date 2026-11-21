### Agent Chronicler

Agent Chronicler proposes new achievements (D-108, settles who carries the proposals of PROG-118). It never grants
anything and never narrates.

- **When.** Once for each scenario that ends, after that turn's narration is shown and saved, as a background call: no
  turn waits on it. It takes a background call slot (Latency and cost: call slots), so the turn's own calls go first.
  It is skipped while play is stopped or rate limited.
- **Reads.** The scenario's record (number, question, ending, outcome, first and last turn); its turns as the player saw
  them (the player's lines and the narration, closing line included); what the library's achievements count (each
  rule's text and the names that count it); and the deeds already proposed, so it does not repeat one.
- **Writes.** Deed ideas, with no fixed number and none when the scenario offers nothing new. Each idea has a name, the
  deed in words code could count, the turn that showed it and one line on what happened there. Each goes to
  hidden.templateWants as a row of kind `deed` (name as the label, deed and what happened as the want) and is listed in
  the GM view's Wanted list beside templateGap and routineGap (SHEET-319, D-53). The rows are kept across scenarios and
  saved at once when the call comes back.
- **Then.** An idea is only a proposal. It becomes an achievement when the owner approves it and a thread writes it as a
  code rule with a library row (PROG-118).
- **Model.** Claude Fable 5.2 at high effort, model "claude-fable-5-2" (config AGENT\_MODELS.chronicler), with modelTier
  "complex" as the fallback. Chosen by the owner from the D-108 comparison on one simulated scenario: Opus 5.5 high gave
  6 ideas (about $0.09 a call), Fable 5.2 medium 7 (about $0.17), Fable 5.2 high 11 (about $0.22), the most and the
  sharpest (PR #1522).
- **Failure.** One repair retry (src/agents/call.ts), then no ideas for that scenario. Nothing in play changes.

Fixed instructions: CHRONICLER\_INSTRUCTIONS in src/agents/prompts.ts, the one copy. Data: src/agents/chronicler.ts.
