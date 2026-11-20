### Goal-driven uniques

Decided on the "Goal-driven uniques" questions page (UG1–UG17, https://claude.ai/artifact/1yeiAAh9PLmVJiALgnYBuk). Code: `src/engine/goals.ts`, `goalThinkers` in `src/agents/game.ts`.

- **Who (UG1).** Any actor that holds goals follows these rules; only uniques are given goals. A goal holder has an agenda, so the Responder voices it.
- **What (UG2).** Drives (its ranked values), 1 to GOALS_HELD goals, and a queue of steps. A goal is text plus `about`: the ids it names (people, places, zones, items).
- **Where goals come from (UG3, UG4).** The Weaver writes a unique's goals when it casts it (`cast[].goals`), from its values, archetype and past; an echo's first goal is its unfinished business, fitted to the world. A template's `standingGoal` is always held first.
- **Over time (UG5).** Goals live in the world's save (`hidden.drives`). The Planner or Responder marks goals met or failed by number and adds new ones, up to GOALS_HELD. A standing goal is dropped only when met.
- **Who decides (UG6).** The Planner, with `goals`, `steps` and `thinkWhy` in its view; it returns `goals` (met, failed, add) and `steps`.
- **When it thinks (UG7, Ali: moments 1, 3, 4).** Its queue runs out or a step can't begin; it perceives something a goal names (a person in sight, the zone or place it stands in, an item it holds or that lies there; once, until it loses it); or as before (engaged, talked to, a deal, an errand). No time-of-day think.
- **Budget (UG8, UG9).** At most UNIQUE_THINKS_PER_TURN thinks a turn, after the fight calls, nearest the player first, near or far. Asleep or broken, it waits. A late or missing call leaves its think pending for the next turn.
- **Routines (UG10).** It keeps its routine set and runs its routine whenever it has no step; after a walk or a wait it goes back to its own routine. Sleep and watches stay routine rules.
- **Steps (UG11, UG16, UG17).** Up to STEPS_QUEUED in order: go (a zone or frontier, lead to take someone), routine (one of its own) or wait (stay here), each until a time of day or someone's arrival. A step with no end stops after STEP_MAX_DAYS. A step that can't begin is dropped. No call runs inside a long turn (a night, a rest, a wait): queued steps run on through it by code, and it thinks at the start of the next turn.
- **Limits (UG12, UG13).** Anything the rules allow, against anyone (Ali: "I will see how it goes"). A goal may name the player; it finds the player only through its own beliefs.
- **Seen by (UG14).** The GM view's hidden store shows goals and steps; the player sees only what it does and says.
- **Personality (UG15).** Goals move no personality yet; goal outcomes are noted as a likely input for VT-OI1.
- **Scaling.** Goals are text, so nothing runs out at 50, 75, 100 or past it; the Weaver sizes a goal to the unique's power. The one think a turn is shared by every goal holder, so more uniques means each thinks less often (UNIQUE_THINKS_PER_TURN is the lever).
