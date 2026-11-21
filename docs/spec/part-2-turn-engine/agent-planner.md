### Agent Planner

Agent Planner plays one engaged significant actor, on any side: an enemy, an ally or a companion. Each such actor gets its own call, made before this turn's player action exists, so it acts only on what that one actor perceived or was told.

Code builds the OppositionView from that actor's own knowledge. If the player hid from this guard, the Planner sees status: 'suspicious' with the last known zone, never the true zone. The engine rejects any order targeting something this actor has no belief about.

Output shape:

```
{
  action:   { type: attack | move | search | hide | hold | call_help | flee |
              talk | persuade | deceive | intimidate | barter |
              use_item | give | other,
              target: actor_id | zone_id | null, skill: skill_id | null,
              targetPart: part_id | null,      // preferred part; takes effect only through the gap
              aimed: boolean,                  // pays the aim penalty for a sure location
              defense: dodge | block | null,   // sets the standing defense; null keeps it
              item: item_instance_id | null, mode: mode_id | null,
              intent: short phrase },
  dialogue: { line, volume: whisper | normal | shout } | null,
            // the words if action.type is talk; otherwise a bark
  gear:     [ { op, item, from? } ] | null,   // as the Parser: free gear ops, before the action
  stance:   { toward: actor_id, step: friendlier | colder } | null,
  planUpdate: { goal, steps, triggers,
                routine: routine_id | null } | null,  // routine: next turn; null = keep the current plan
  memory:   { add: [string], drop: [number] } | null,  // PM1: edit the memory list; drop by its number in the view
  agreement: { with: actor_id, text, job? } | null,   // PM3/PM4: a deal said aloud this turn; job: a quest (QT1)
  endAgreements: [ { id, outcome: done | broken } ],   // a party ends its own deal (never one holding a quest)
  questEnd?: { id: quest_id, outcome: done | abandoned | called_off } | null,  // QT6/QT12/QT22
  when?: { on, who, at? } | null   // AE6 (RQ3 a): the action is readied, as the Parser's "when" (Agent Parser)
}
// job = { line, goal: { kind: defeat | deliver | reach | find | other, target?, count?, item?, qty?, to? },
//         pay?: { coin?, item?, qty? } | null, due?: { days, by?: time of day } | null, after?: quest_id | null }
```

Standing defense is saved on the actor (Part 4 §4 Core gains standingDefense: dodge | block). Default: whichever of dodge and block has the higher effective skill **\[Proposed\]**.

Fixed instructions: the exact text is PLANNER_INSTRUCTIONS in src/agents/prompts.ts, the one copy (CS6; the spec no longer copies it, a test keeps it so). In short, it plays one engaged character from CHARACTER and its OPPOSITION_VIEW: picks its action, move, gear and stance for the turn. Never narrates outcomes, never rolls dice, never targets what the character has no belief about.

**Readied steps (AE6, RQ3 a, #1682).** The Planner and the Responder ready an action as the Parser does: the action with "when" (the same conditions, READY\_ON). Its view shows the step still waiting (self.readied); giving it again keeps it waiting, any other order drops it. A "when" on a hold or talk, or naming someone it does not know of (not in its beliefs or sight, a band it knows, or "anyone"), is dropped (invalid\_ready) and the action plays at once. Between Planner calls (NV1 b) the step waits on without a call: its held turn comes before the combat list (Who thinks for each actor).

Shared plans between actors (a coordinated ambush across several guards) are an open design question tied to how actors are grouped. For now each actor holds its own plan and triggers.
