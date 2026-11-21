### Agent Witness

Agent Witness hears the vows the player sets (D-141, VW2 a; src/agents/witness.ts). It never sets one and never
narrates the world.

- **When.** Each time the player sends a line in the Witness chat (the Quests page's Swear a vow). It runs outside the
  turn: no game time passes and nobody in the world hears it. The chat is kept only while the pop-up is open. It runs on
  the model CONFIG.AGENT_MODELS.witness names (the Parser's), tier CONFIG.MODEL_TIERS.witness as the fallback.
- **Reads.** Only what the player knows: the character's level, skills (true skill) and essences taken; the people the
  player has perceived and the places they have seen, with ids; what they carry; the race and body type names; the
  achievements not yet held; the acts a restraint can give up; the vows held, the cap, the deadline range and each
  stake's Thread now; and the chat.
- **Writes.** A short reply, and once the player has agreed a vow, the vow form: its line, goal, stake, days and an
  optional time of day (checkWitness). Code reads the form (readVow); a form it refuses goes back once with the reason,
  so the Witness can say why and offer the nearest vow code can check. A vow ready to swear shows as a card with Swear.
