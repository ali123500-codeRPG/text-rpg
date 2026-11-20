### 8. Agents

- **Requests.** Agent Parser, Agent Planner, Agent Responder and Agent Voice share the same gear fields: action.item, action.mode, and a gear list of free ops. Code minds choose gear in code. The legality check rejects an item the actor doesn't hold or can't see and a mode the item lacks.
- **Own gear in views.** The full inventory by name and kind, where each item is equipped, mode ids, class and weight labels. No values.
- **Others' gear in views.** Only on actors perceived fully: held items, shield and armor by public look; accessories only when tagged visible; concealed items only once revealed; stowed items only once a search finds them (SE11). Items on the ground of perceived zones, by name, except hidden ones the viewer doesn't know of (SE8).
- **Agent Narrator.** Describes gear by public name and look only: the weapon, armor and shield named in the roll packet, item\_dropped and give events, visible gear of perceived actors. Its fact check already rejects item names outside the view.
- **Agent Weaver.** Rewards are typed (Part 2, Agent Weaver): an item id or a minted variant, a quantity, and a place (carried by a cast actor, or on the ground of a planned zone). NPC loadouts come from their templates' loadout field \[Proposed\]. Loot is gear in place: a downed actor keeps its inventory, and pick up takes from it.
