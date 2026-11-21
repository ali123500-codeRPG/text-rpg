# History: positions, land and titles

Kind: context. How the game went from linked zones to titles on a floor plan, oldest first: what was asked, what
replaced what, and which PR built it, so that a retired design is not revived. The rules are in the spec: the
"Titles and the floor plan" note under "### Game state model", "### Land and regions" and "### Agent World
builder". Question IDs name the owner's answers on the Questions hub.

- **Real metres (11/11/2026; CO1-CO19, ZP1-ZP6).** The owner asked for real metres in place of counted zone links.
  Built in steps: heights and numbered bug reports (#370, #372), action slots (#376), then positions, walking and
  reach in metres (#395). Shapes other than rectangles were parked then; they came with the floor plan.
- **Zones used as distance (12-13/11/2026; ZR1-ZR12; BG-98 to BG-110, BG-113).** A code review replaced "same zone"
  and link-count tests with metres or grip reach (#571, #581, #586, #587). ZR3 was turned down and became the
  action-time rework (ZR11). Zones as places (routes, triggers, memory, quests) were judged fine.
- **Land first (14/11/2026; WZ1-WZ18).** The owner found the map a set of disjointed boxes. WZ1 c: code draws a
  region's land from a seed, and the planner fills it but never draws it; three region kinds came first (WZ11).
  Built in #819 and #826. The later steps were overtaken by the floor plan.
- **World builder and Weaver (14/11/2026; WB1-WB9).** One planner made world, people and drama in one call. Now
  two roles: the World builder makes places and everyday people with no event roll, the Weaver runs scenarios, and
  walking onto unbuilt ground only builds. WB9: one page of world lore opens the agents' fixed instructions
  (`src/agents/worldLore.ts`).
- **Places built twice (17/11/2026; WI1-WI10; BG-273, BG-285, BG-286, BG-288, BG-289).** Cause: planners named
  places with their own keys, and code gave a repeated key a new id. Fixes: a repeated key is refused (#975), the
  stage's zone list is retired so the whole built world is live (#977), code makes the land's ways once (#982),
  and a world check runs after every plan and on load (#993). A one-off mend (#988) left again with schema 10.
- **Zones become titles (18/11/2026; PZ1-PZ17).** The owner wanted "zone" to mean no more than the name of a
  location. A title is a footprint of any shape between two heights; walls, openings, light, clutter and paths
  live on the floor plan. One rewrite PR (#1058, save schema 10) after the leftovers in #1054 (BG-303 to BG-309).
  PZ17 added the new-ground achievement chain.
- **Leftovers after the rewrite (19/11/2026; BG-312 to BG-316, fix plans BF98-BF102).** Doorways, search, hunches,
  off-screen walkers and the Map still read zones. All fixed: #1081, #1089, #1092, #1095 and the Map rebuild
  #1096. Checked and found fine: noise, routing and grip reach.
- **Old saves (18/11/2026; MG1-MG6).** No save from before schema 10 is kept (PZ16 b). Old upgrade steps, old
  skill ids and unused data were deleted (#1055, #1059). The upgrade frame stays for D-116, and
  `CONFIG.OLDEST_SAVE_SCHEMA` names the oldest save that loads.
- **Saving by tiles (21/11/2026; WT1-WT6).** An audit (project doc "world-division-save-audit") found the save cut by
  place and some rules still using titles, places or door counts for nearness. WT1 a, WT2 b: the floor plan and the
  ground are saved by tiles of CONFIG.TILE_SIZE_M (schema 13). WT3 a (D-1621) is decided, not built; WT4 a (D-1623) is built: everyone has a point and height of their own (schema 15, GSM-24). WT5 a: one
  bug per cause (BG-1614 to BG-1619). WT6 a: belonging to a named place stays keyed by place (GSM-25).
