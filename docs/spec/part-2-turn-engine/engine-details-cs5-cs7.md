### Engine details (CS5, CS7)

Choices the engine made where the spec said nothing, settled by Ali (leftover scan CS5 and CS7, 14/11/2026):

- **Event noise and sight.** Each event the engine makes outside an activity has a noise and a visibility (the SENSE table in src/engine/resolve.ts; placeholders to tune). A kind not listed is quiet and normal. Worn armor makes the body-moving kinds louder (AN2).

| Event | Noise | Visibility |
| --- | --- | --- |
| travel, move, item dropped, set down, put in, pick up, way (a key, a bar, a door tried) | quiet | normal |
| attack, wasted | normal | high |
| speak | normal | normal |
| hold, rest | silent | low |
| call for help | loud | normal |
| battle cry | loud | high |
| alarm | deafening | high |
| stash | hushed | low |
| pick (a lock) | hushed | slight |
| filch (its own contest sets both) | hushed | slight |

- **Bandmates turn on an attacker** only when they perceive the attack fully; a half-seen attack names no attacker.
- **Crossing a frontier.** The player who walks into a frontier stays in their zone until scenario setup or the stage extension places them.
- **Heard speech.** An NPC's "speech heard since its last call" is the previous turn's speech and this turn's exchange.
- **Agent output shapes.** Each agent's output is given here in the spec's own notation; the exact JSON shape the model is told to return is that agent's \*\_SHAPE text in src/agents/prompts.ts, written from that notation and sent with the fixed instructions.
- **Half-seen people (CS7).** Someone the player only half perceives keeps their id, so the player can still target them, but shows only as "someone", with no name, label or gear.
