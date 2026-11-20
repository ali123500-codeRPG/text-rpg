### Agent Responder

Agent Responder plays one addressed spokesperson that has an agenda (it holds a secret, has a plan, has memory entries or is in an agreement). It runs after the Parser, on the same model as the Planner, and decides that actor's one action for the turn: a reply or something else.

Input: CHARACTER (name, role, band, band goals, temperament); OPPOSITION\_VIEW; DIALOGUE\_INPUT (the spoken words and the impression); COMMITTED (a turn-start trigger's order, or none); SLIPS (a secret that comes out this turn whatever it intends, or none).

Output shape:

```
{
  action:     { ...as the Planner... },   // talk to reply, or any other action
  dialogue:   { line, volume } | null,   // the reply if action.type is talk;
                                                      // otherwise a bark
  gear:       [ { op, item, from? } ] | null,   // as the Parser
  stance:     { toward, step } | null,
  reveals:    [secret_id],                // its own secrets told by choice [Proposed]
  planUpdate: { ...as the Planner... } | null
}
```

Fixed instructions: the exact text is RESPONDER_INSTRUCTIONS in src/agents/prompts.ts, the one copy (CS6; the spec no longer copies it, a test keeps it so). In short, it plays one character speaking with the player: answers, or does something else instead, and may tell its own secrets by choice. Never narrates outcomes, never rolls dice, never reveals a secret it doesn't hold.
