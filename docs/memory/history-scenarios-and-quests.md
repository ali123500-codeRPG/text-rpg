# History: quests, scenarios, event rolls and free roam

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Scenarios", "Scenario setup" and "Agent Weaver" in Part 2; D-339, D-342); every number is in `src/config.ts`.

- **Quests (09-10/11/2026; QT1-QT28, QX1-QX4).** A quest is a deal with an NPC plus a job: typed goals, pay, a
  deadline, and hand-in by talking to the giver. A quest is made only if the giver heard the player that
  turn, and one is open per giver (#242). Quest achievements and the first scar followed (#245). A defeat
  job pays less when the foes were weak for the player; jobs with no foes are not cut, because the reward
  grade already covers that (#343). Deferred: multi-step quests (D-140), the player's own goals (D-141),
  quests held by NPCs (D-142). Quest XP sized to the level (D-180) was closed: the achievement level share already does it.
- **Event roll review (11/11/2026; ER1-ER5).** Encounters can be good or bad like any event roll (#409). The
  tier sets the balance of gain against challenge, a Near Miss tilts bad, and the roll shows on the rolls
  line (#447). The event roll reads the normal roll table, so only naturals reach criticals (#449).
- **Scenes deep dive (11-12/11/2026; SC1-SC23, SD1-SD7, CH1-CH7).** The scene rules were called under-
  developed. Wanted: scenes at several scales, the Weaver as the main way one ends, fallbacks when the Weaver
  fails, a way out for the player, and bad situations that are hard to escape. Decided: scales are a table
  that can take new rows; rest, sleep and time skips never end one; more than one end condition, and a bug
  report whenever code cannot judge an ending or a fallback fires; a check-in may change a scene, not only
  end it; a new place is not a new scene; no hard limits by tier. Built in steps: scales and endings (#460),
  the check-in (#464, #471), drops and falls (#466, #473), a follow order (BG-34, #468), the ending moment
  (#469, #470; BG-39), barriers, keys and lock picking, which keeps getting faster with skill (#474, #475),
  chases and free roam (#476). Free roam means no scene until something starts one; every ending starts it
  (#486). Scenes were renamed scenarios everywhere (#488). Parked: tier lean past Critical (D-216).
  Deferred: what a scenario's ground is (D-217; built 21/11/2026 as outlines plus three turns out of touch with its people, D-217 a).
- **Scenario event rolls (14-16/11/2026; SW1-SW10, WB5-WB7; BG-240).** Scenarios felt weak: a Great Success
  had no stakes, the Weaver was not told why a free-roam scenario began, new hooks came with every plan, and
  there was no outer arc. Decided: the Weaver is told the cause, and a job can start one (#828); free roam
  starts on danger only, the Weaver may decline a window, and rest follows a scenario (#830); every tier has
  conflict and every scenario a stake (D-339, #879); budgets count acting time only (#880); an Episode holds
  its parts, with a lull between them (D-342, #882). Parked: old threads before new hooks (D-319).
