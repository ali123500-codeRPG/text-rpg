### Agent Narrator

Agent Narrator writes the prose the player reads, on the strongest model available. It receives only NarrationView, so the perception rule is enforced twice: structurally (it never gets hidden data) and in the prompt (it must not invent any). Its full text is checked before display; there is no streaming for now.

**Seen actors in the dark (P3, 07/11/2026).** An actor in a dark zone is perceived partially, unless it shares the viewer's zone and the viewer fully perceived one of its events since the scenario began (for example it spoke face to face): then it stays fully seen.

Partial events reach the Narrator without actor names or intent, with the zone link's label and the cue, e.g. `{ kind: 'move', where: 'left of the gate', perception: 'partial', cue: 'sound' }`, so it can write "boots scrape somewhere to your left" and nothing more. Actors whose names the player doesn't know reach it by their public label.

Output shape:

```
{
  text:     the narration,
  narrated: [event_id]        // every event the text describes
}
```

Fixed instructions: the exact text is NARRATOR_INSTRUCTIONS in src/agents/prompts.ts, the one copy (CS6; the spec no longer copies it, a test keeps it so). In short, it turns the resolved, perceived events into prose in STYLE and lists every event it describes in narrated. Never decides outcomes, never names what the player has not perceived or learned.

**Narration length (Ali, 14/11/2026, "Narrator length per turn" LN1-LN8, D-334).** Measured first: the narration ran about 171 words, 3 or 4 paragraphs, on every turn, whatever happened ("Hide" got 175), where other AI text adventures default to about 110 words and let length follow the moment. Code now picks a band for each turn from what was resolved (narrationBand, src/views/index.ts; the Narrator never picks it) and STYLE.length tells the Narrator that band's words and paragraphs (LN2 a). **Big:** a scenario opens or ends, the player stands in a zone for the first time, a jump down, the player going down or someone seen dying, an essence offer, or NARRATION\_BIG\_EVENTS (6) perceived events. **Quick:** at most NARRATION\_QUICK\_EVENTS (2) events with no change on anyone (a look, a wait, a step, a wasted action). **Normal:** the rest (LN4 a). Someone only being there (idle, presence) is not an event for this count. Words per band, NARRATION\_LENGTH (*placeholders*): Quick 25-60 words in 1 paragraph, Normal 60-110 in 1 or 2, Big 110-180 in 2 or 3 (LN3 a). The spoken lines shown under the narration come on top of the band (LN8 b), and the Narrator is told so. Rule 7: the Narrator may end on one short sentence that hands the turn back, inside the last paragraph, never a paragraph of its own (LN5 a). **Setting** (LN6 a): the story's Narration length (Settings.narrationLength: Shorter, Normal, Longer; NARRATION\_SCALES) multiplies the words by NARRATION\_LENGTH\_SCALE (0.6, 1, 1.5; *placeholders*); the Play header's narration icon button, beside Show rolls (its tip and name read "Narration: Normal"), steps through them and the next turn is told at that length. **Measured, never re-asked** (LN7 a): each narration line records length {band, words, top}, and a playtest writes narration-length.md with each band's turns and every turn over NARRATION\_OVER (1.5) times its band's top. Motion is unchanged: the reveal stays sentence by sentence under the 1.5 s cap (M-10, M-11). Scaling: length follows what happened, never skill or power, so nothing caps past 100.

**The hero's running commentary (TL4 d, built with D-334).** Narrator rule 16 asks for the character's own dry asides beside the danger (a joke, a grim tally, a complaint), shaped by what the view already carries: player.personality (its Nerve line first, then signatures, archetype, drives, tensions), player.morale, player.health and the wounds in player.parts. It is a voice, never a choice: it never plans, decides or announces an action, and it fits inside the turn's length band.

For attacks, Agent Narrator receives the combat packet (Part 3, The packet), which holds no numbers. When SHOW\_MECHANICS is on, code prints the dice and modifiers in a mechanics panel under the narration; the Narrator never sees them.
