### Deliverables and acceptance criteria

Done means every case test passes except those waiting on other work: 46 and 53 test rules still \[Proposed\]. Also, every non-dialogue turn that doesn't start a scenario shows checked narration after one Parser call plus one full Narrator call.

**First build scope.** A fantasy village with a guard, a trader and a tavern patron to talk to. The player is a swordsman, and slimes living around the village are hunted. Hunting gives XP (Part 1 §5) but no skill changes (recordUse() only logs). The slimes' routine set, slime\_wander, is the test of the Agent Weaver integration (library viewer, Routine sets).

Build in this order, so the game is playable with stubs before any agent is wired in:

- [ ] State types, seeded RNG with saved state, agent log
- [ ] Ruleset: TIERS, eventRoll, roll, attack, check and contested built (Part 2, First-build ruleset); applyEffects and recordUse stubbed
- [ ] Perception per event, the single belief writer, communication events and belief decay
- [ ] The six deny-by-default view builders (DialogueView built from ActorView; a bark's words only to those who heard them)
- [ ] isActive; bands, relations and overrides; engagement
- [ ] Resolution engine with the simultaneous-order rules, order merging and the exchange slot
- [ ] Hidden store, trigger checker (turn start and mid-turn), fired log and secret reveal
- [ ] Routine bank types, the import validator and the prototype bank (Appendix)
- [ ] Desired-state routines (schedule, follow, wait) with slot bindings, route expansion and code-set anchors, alarm state, onAlert and returnTo; detection on major actions and ambush resolution (Explore mode)
- [ ] Scenarios, the stage, frontiers and the event roll (ruleset.eventRoll)
- [ ] Item library and blueprints, the active-effect reader, slots and gear ops, ground items, the damage step with armor (Part 5)
- [ ] Fallback combat list per actor type (Fallback behavior)
- [ ] Agent Parser, Planner, Responder, Voice and Narrator wrappers, prompts as constants, schemas validated
- [ ] Agent Weaver wrapper, stage-plan validator and the flagged fallback stage
- [ ] Mode switcher, the call cap, spokesperson selection and MAX\_SPOKESPEOPLE
- [ ] Planner scheduler, and the BACKGROUND\_WINDOW and DIALOGUE\_WINDOW gates
- [ ] Leak scan, fact checks, the Voice fact check and the templated fallback narration
- [ ] Save, load, undo and automatic backups (Part 4 §10–11)
- [ ] Creation screen and play screen (Part 2, Play screen)
- [ ] GM debug view
- [ ] The case tests passing, as Done above sets out

Ask before you:

- change any ruleset number;
- add a Claude call to any turn type;
- send anything from state.hidden to Agent Parser, Agent Narrator or Agent Voice;
- settle anything listed under Deferred items.
