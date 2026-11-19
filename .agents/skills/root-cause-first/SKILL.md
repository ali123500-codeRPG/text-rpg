---
name: "root-cause-first"
description: "Use for any bug, error, broken feature, failing test, regression, unexpected behaviour, broken build or 'it's not working' report, in any project, before proposing or making a fix. Finds the root cause, not the symptom."
---

# Root cause first

## The rule
No fix until the root cause is found and confirmed. A change that makes the symptom go away without explaining why it happened is a patch, not a fix, and does not count as done.

The root cause is the earliest point where the code, data or config first goes wrong, not the place where the error shows up. Keep asking "why did that happen?" until the answer is something you can point to in a specific file, line, value or setting.

This applies to simple bugs too, and most of all under time pressure or when a quick fix looks obvious.

## Signs of a symptom fix (don't ship these on their own)
- Adding a null/undefined check, try/catch or default value where the bad value shows up, without finding where it came from
- Raising a timeout, adding a retry or a delay
- Special-casing the one input that broke
- Hiding an error message or console warning
- Changing CSS until it looks right without knowing which rule was winning
- "It works now" after several random changes

A guard at a real boundary (user input, network response, external file) is fine — as long as the bad value's origin is also found and fixed if it's ours.

## Red flags: stop and go back to step 2
- "Quick fix now, investigate later" or "just try X"
- "It's probably X" without having traced where the value came from
- Listing fixes before investigating
- Several changes at once, or skipping the test
- "One more try" after two failed fixes, or each fix uncovers a new problem somewhere else
- The user says "stop guessing", "you're fixing the symptom" or "is that not happening?", or sounds frustrated

## Process

### 1. Reproduce
- Get the exact steps, input and environment that cause it. Read the full error and stack trace, not just the first line.
- If it can't be reproduced, say so and collect evidence (logs, console, network requests) before guessing.
- Check what changed recently (last edit, last deploy, data or config change) — regressions usually live there.

### 2. Trace backward
- Start at the symptom and walk back through the call chain or data flow: where did this value/state come from, and who passed it?
- Compare with a working case (another record, an older version, a similar page that works). Read the working code fully and list every difference, not just the first one you spot. The difference points at the cause.
- In a system with several parts, add temporary logging of what enters and leaves each boundary and run once to see where it first goes wrong, rather than guessing.

### 3. Hypothesis
- First list every plausible cause (code rule, data, config, prompt, numbers) and check each against the evidence. Keep only what the evidence supports.
- Then state one specific hypothesis: "X happens because Y at <file/line/setting>."
- Test it with the smallest experiment possible. If it's wrong, discard it fully and form a new one — don't stack changes.
- The hypothesis must explain every symptom observed. If it explains only some, keep going.
- If you don't know, say so and investigate more. Don't guess.

### 4. Fix
- Where the codebase has tests, first write a test that fails because of the bug; it must pass after the fix. Otherwise add the smallest check that would have caught it.
- Fix at the root cause. One focused change; no unrelated refactors or "while I'm here" edits.
- Search for the same root cause elsewhere (same pattern, copied code, same data source) and list any other spots found.

### 5. Verify
- Re-run the original reproduction steps and confirm the symptom is gone for the right reason.
- Check nearby behaviour didn't break.
- Remove temporary logging.

## Escalation
If a fix attempt fails, go back to step 2 with what it showed; don't add another change on top of it. If three fix attempts have failed, stop patching. Say so plainly, and question the approach itself: is the design or architecture what keeps producing these bugs? Present that to the user before trying a fourth fix.

## Reporting to the user
Before or alongside the fix, give a short report:
- Symptom: what the user saw
- Root cause: the actual origin, with file/line/setting
- Why it caused the symptom: one or two lines linking them
- Fix: what changed and where
- Also affected: other places with the same cause (or "none found")
- Verified: how it was checked

If the root cause can't be confirmed (e.g. can't reproduce, no access), say that clearly, give the leading hypothesis and the evidence for it, and label any change made as a mitigation, not a fix.

If the cause really is outside our control (environment, timing, an external service), write down what was checked, then add handling (retry, timeout, clear error) plus logging, labelled as a mitigation. Most "no root cause" cases are an unfinished investigation, so be sure before taking this route.

## When writing prompts for other agents
If delegating a bug fix to a subagent or writing a builder prompt, include this rule verbatim: "Find and confirm the root cause before changing any code. Report symptom, root cause, why it caused the symptom, fix, other affected places, and how it was verified. Symptom-only patches are not acceptable."
