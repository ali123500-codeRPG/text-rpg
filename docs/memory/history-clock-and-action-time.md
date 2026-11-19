# History: the clock, action time and turns

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("### Game clock", "### Action economy", "### Action time"); the times are in the library's Action times table
and `src/config.ts`. Question IDs name the owner's answers.

- **Clock, healing and sleep (07/11/2026; T1-T11, H1-H15; D-101).** One clock owned by code, with times of day
  and a day counter; healing as one table of sources; natural recovery from Endurance over game time, fights
  included (#45, #58). The rule that every band or range is a scale table, so that a perk can shift it by steps,
  dates from here. Deferred: the time of day changing within a scenario (D-49).
- **NPCs get a move (11/11/2026).** Every character has a movement and another action each turn; NPCs got what
  the player already had (#350).
- **Action time (13/11/2026; AT1-AT85).** From ZR11: nothing gates resting by distance. A long action takes its
  time and breaks when a foe strikes, and no check may use what the player does not know. Turns are only the
  player's input; the world lives in time. Two levers stay separate: focus (what breaks an action from outside)
  and stop (whether the actor may choose to stop). The round is a unit in code and is never shown in play.
  Built in stages: #650, #651, #654, #656, #658, #665, #667, #670, #675, #676 and #702; on the play screen in
  #662 and #674. Parked: a setting for what stops the clock (D-246), what drives each action's speed (D-248).
- **Split turns (14/11/2026; TP1-TP10).** The owner asked whether the player should resolve first and the NPCs
  decide after. Measured on playtest runs, that would about double the wait in a fight turn, so turns stay
  simultaneous (TP1 a). What was built instead: a stale NPC blow does its fallback action (#839); a wasted
  action gives its time back, time carries over, and several realism costs were cut (#845); crossbows (#865);
  one shot time per weapon class and a floor on when a fight ends (#870). Light Sleeper became everyone's rule
  here. Parked: the Earshot 60 perk (D-324) and the Persuasion 20 perk (D-325).
- **Talk time (16-18/11/2026; TK1-TK6).** The owner first wanted talk to take no time. The final answer: the
  clock must move while talking outside a fight, so plain talk there is a turn on the Speech row; persuading,
  lying and threatening take the Speech row everywhere; plain talk in a fight takes no time (#971).
- **Order queue (18/11/2026; D-20 b).** The rest of a long order plays one step per turn and stops on anything
  new. Each step waits for the player to send it; nothing plays by itself (#1074).
