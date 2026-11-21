### Agent Chronicler

Agent Chronicler proposes new achievements (AA-108, settles who carries the proposals of PROG-118). It never grants
anything and never narrates.

- **When.** Once for each scenario that ends, after that turn's narration is shown and saved, as a background call: no
  turn waits on it. It takes a background call slot (Latency and cost: call slots), so the turn's own calls go first.
  It is skipped while play is stopped or rate limited.
- **Reads.** The scenario's record (number, question, ending, outcome, first and last turn); its turns as the player saw
  them (the player's lines and the narration, closing line included); what the library's achievements count (each
  rule's text and the names that count it); and the deeds already proposed, so it does not repeat one.
- **Writes.** Deed ideas, with no fixed number and none when the scenario offers nothing new. Each idea has a name, the
  deed in words code could count, the turn that showed it and one line on what happened there. Each goes to
  hidden.templateWants as a row of kind `deed` (name as the label, deed and what happened as the want), kept beside
  templateGap and routineGap (SHEET-319, D-53), and is listed on the Bugs page under the bugs, not in the GM view's
  Wanted list. The rows are kept across scenarios, as counted groups (SHEET-319), and saved at once when the call comes
  back.
- **Then.** An idea is only a proposal. It becomes an achievement when the owner approves it and a thread writes it as a
  code rule with a library row (PROG-118).
- **Review.** The Bugs page lists the ideas under the bugs (Deed ideas: idea, deed, scenario and turn, status), newest
  first. Send deed ideas to Claude (shown only where the page can send to Claude) sends the ideas not yet sent as one
  comment to Claude, asking the thread to review them with the owner and write each approved one as a code rule
  (PROG-118). Each sent idea's status becomes Sent and it is not sent again. The mark is a document per idea in the game
  page's db, `deed_sends` (src/save/sends.ts), never in the save. Copy for Claude, the fallback, copies every idea still
  waiting for a verdict and marks nothing. The two buttons are the bugs' own (claudeSend, src/ui/kit.ts). Once the
  owner rules on an idea, the thread writes `verdict` ("approved" or "turned\_down") on its document and the status
  shows Approved or Turned down; the idea stays listed. Clear list, shown once an idea is ruled, takes the ruled ideas
  off the list (`cleared` on their documents). WT9 (D-1621): it also rules them in the story, as the GM view's Approve
  and Turn down do for the Wanted list (SHEET-319): an approved idea leaves the story (it is a code rule now or soon,
  so the library lists it); a turned-down one keeps only its name and count, so the Chronicler still sees it as
  proposed and does not offer it again.
- **Model.** Claude Fable 5.2 at high effort, model "claude-fable-5-2" (config AGENT\_MODELS.chronicler), with modelTier
  "complex" as the fallback. Chosen by the owner from the AA-108 comparison on one simulated scenario: Opus 5.5 high gave
  6 ideas (about $0.09 a call), Fable 5.2 medium 7 (about $0.17), Fable 5.2 high 11 (about $0.22), the most and the
  sharpest (PR #1522).
- **Failure.** One repair retry (src/agents/call.ts), then no ideas for that scenario. Nothing in play changes.

Fixed instructions: CHRONICLER\_INSTRUCTIONS in src/agents/prompts.ts, the one copy. Data: src/agents/chronicler.ts.
