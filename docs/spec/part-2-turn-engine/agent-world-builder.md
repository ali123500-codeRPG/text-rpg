### Agent World builder

The Weaver's work is split between two roles (WB1). The World builder makes the world: places, everyday people and the situations that stand in it, with no event roll. The Weaver runs scenarios on top of that world. The story role keeps the name Weaver; the world role is the World builder (WB4).

- **What it writes** (WB2). The World builder writes places, everyday people, traders and the situations that stand in the world (wants, tensions, secrets, goals), in hidden form. It writes no scenario question, endings, beats or rewards, and uses no event roll. Everyday people are as strong as the region's people really are; they don't scale with the hero.
- **When it runs** (WB8). It writes the region brief (Land and regions) and builds the ground beyond frontiers (Stage extension). The scenario start changes are built with SW10 on the scenario event rolls page.
- **During a scenario** (WB3). The Weaver adds people, items, beats and situations. New ground comes only from story spots and frontiers, drawn by the World builder from the Weaver's brief. A frontier in a Weaver plan or check-in may carry a brief (one short line, kept hidden in hidden.frontierBriefs by frontier id); the World builder's view gets it as target.brief and builds to it.
- **WorldView** is the WeaverView without the tier, stakes, ways, recent scenarios or outer scenario. Its previousNote is the World builder's own note (hidden.worldNote), kept apart from the Weaver's.
- **Plan checks.** Its plan goes through the same validator and apply as a Weaver plan, with no grade check. Code drops any story part it returns (scenario, rewards, triggers; the event is set to none) and logs world_story_dropped.

Fixed instructions **\[Proposed\]**: the exact text is WORLD_BUILDER_INSTRUCTIONS in src/agents/prompts.ts; the region brief is WORLD_BUILDER_REGION_INSTRUCTIONS in src/agents/prompts.ts. Rules 3 to 6 are shared with the Weaver's text (PLAN_RULES_SHARED).
