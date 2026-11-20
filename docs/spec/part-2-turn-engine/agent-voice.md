### Agent Voice

Agent Voice plays one addressed spokesperson with no agenda, such as a shopkeeper or a ferryman. It runs after the Parser, on the same model as the Responder, and decides that actor's one action for the turn. It exists so that talking to an ordinary NPC and talking to a guarded one look the same from outside: same pipeline, same number of calls, same order, same timing.

- Receives DialogueView: its own view plus only this turn's spoken words and its impression (Dialogue input).
- Shares only listed facts. It may share facts from the NPC's knows list and nothing else. This closes the hole where the Narrator, voicing NPCs itself, could invent directions, prices or clues.
- Never sees the hidden store. An NPC that gains a secret, a plan, a memory entry or an agreement has an agenda, and from then on Agent Responder voices it.

Output shape:

```
{
  action:     { ...as the Planner... },   // talk to reply, or any other action
  line:       what the NPC says,          // the reply if action.type is talk;
  volume:     whisper | normal | shout,   // otherwise a bark
  shares:     [fact_id],                  // facts from KNOWS this line reveals; may be empty
  gear:       [ { op, item, from? } ] | null,   // as the Parser
  stance:     { toward, step } | null,
  routine:    routine_id | null           // from its routines list; next turn
}
```

Fixed instructions: the exact text is VOICE_INSTRUCTIONS in src/agents/prompts.ts, the one copy (CS6; the spec no longer copies it, a test keeps it so). In short, it voices a calm character's reply to the player (a line, an action, a stance step, a routine switch). Never narrates, never decides whether the player's attempts succeed, never states a fact outside its view.

The engine checks every shares id against knows and scans line for names and facts that are not in the NPC's view.

**Failure handling (Responder and Voice) \[Proposed; see D-43\].** One repair retry, then a neutral in-character line from the NPC's sheet as a talk action. The legality check on targets applies to both, as it does to the Planner.
