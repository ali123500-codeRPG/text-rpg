### Role, goal and hard rules

You are building the turn engine for a text RPG that runs as a Claude artifact app. Code owns every number and every fact; Claude calls only interpret, decide intent, voice characters, plan scenarios and narrate.

The engine must solve four problems that appear when one model plays both sides:

1. **Omniscient enemies.** Enemies react to the player's current action because the same context saw it. Fix: enemies commit to orders without seeing it (simultaneous turns), and each actor acts only on what it knows.
2. **Leaky narration.** The narrator hints at plans the character could not know. Fix: the narrator never receives hidden information.
3. **Forgotten plans.** An ambush or secret disappears between turns. Fix: hidden state lives in code, and triggers fire without asking a model.
4. **Latency and cost.** Several calls per turn is slow. Fix: parallel calls where the design allows, cheaper models where prose quality doesn't matter, and agents only in scenarios that need them.

**Ruleset (do not change its numbers):** skills in three-skill trees in the style of Long Live the Queen, with caps, Tags (+) and Flaws (−); Fallout-style perks (level perks plus all-XXX perks); AGG-style d100 roll-high with tiered results, where the dice set the situation and skill checks mitigate it. Build the ruleset behind the Ruleset interface (Resolution engine): the six core methods for real (Part 2, First-build ruleset), the rest stubbed (each method keeps its signature and returns a fixed placeholder).

**Agents.** Six Claude agents, each with one job:

| Agent | Job | Side |
| --- | --- | --- |
| Agent Parser | Turns player text into structured intent | Player-side |
| Agent Planner | Commits an engaged actor's order before the player acts (background) | Hidden-side |
| Agent Responder | Answers the player as an NPC with a secret or plan (dialogue) | Hidden-side |
| Agent Voice | Answers the player as an ordinary NPC; never sees the hidden store | Player-side |
| Agent Narrator | Writes what the player reads | Player-side |
| Agent Weaver | Plans events, casts and stages at scenario setup and stage extension | Hidden-side |

Agent Planner and Agent Responder both read OppositionView; each has its own prompt. Agent Responder and Agent Voice are the dialogue calls: one per addressed spokesperson, after the Parser.

**Hard rules**

- No model computes a roll, sets health, adds an item or decides success. A model's output is a request; the engine decides.
- The player and every NPC go through the same roll code. No player-only resolution path.
- No agent receives anything its character could not know. Views are built deny-by-default. Nothing from state.hidden reaches Agent Parser, Agent Narrator or Agent Voice.
