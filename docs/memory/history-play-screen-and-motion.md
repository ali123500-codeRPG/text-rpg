# History: the play screen, the Character page and motion

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Play screen" and "Play screen motion", M-01 to M-74); `docs/memory/ui-decisions.md` holds the standing UI
decisions.

- **First displays (07/11/2026).** Picked from mock-ups with three options each: skill progress on the sheet
  and a gold perk-unlock card (#48); a patched-up card, a glow on the healed part and one quick-use healing
  slot (#52); the time of day as a coloured icon. Notes that belong to one turn ride on the story line,
  because the code log is cleared when the next turn starts. Mock-ups are for major changes only.
- **Play screen review (09-10/11/2026; UI1-UI8).** A review over real turns found leaks and overlong lines:
  the header's mode word and the waiting line gave away hidden hostiles, and the rolls shown included sense
  rolls against unseen things. All recommendations were approved: no mode word, a neutral wait line, a
  "Show rolls" switch, the layout of a book with a status strip. The game-code part hid sense rolls against
  the unseen and put level-ups, achievements and incoming rolls on the story line (#219). Button labels
  carry no trailing dots (#160). Skill bars draw their learning window (#318).
- **Motion (10-14/11/2026; M-01 to M-74, VM, MT1).** Value changes did not feel good: a number just changed,
  and a crippled arm was noticed only by reading. A study found the side sheet was rebuilt on every update,
  so nothing could move. A draft rule set was reviewed rule by rule and went into the spec (#342, #349,
  #354). Decided: narration is revealed sentence by sentence; no false delays; motion never shows more than
  the player's view; the final state lands first and a redraw never restarts a beat. Tuning added hit-stop
  and shake for crushing hits and two-layer bars (#461, #463); the owner finds the pace quick enough and it
  is not to be shortened. Motion always plays, with no switch (#844).
- **Inventory and Character page (11-14/11/2026; CP1-CP5).** Equipped slots with item icons (#441); two-line
  skill rows with raw shown on hover (#442). Perks got one compact box per tree with a Story and Effect
  toggle (#784). The page fits one screen, with tiles opening pop-ups: partial ones float and leave the page
  usable, full-screen ones take over (#790).
- **Action deck (14/11/2026; AD1-AD16).** The default input became a list of every action the code allows,
  with typing kept for dialogue and story; convenience over realism. No action keys: typing must never pick
  an action. A targeted action is one entry that opens a picker. The minimap is clickable and sends real
  coordinates. A test enforces that every action has an entry (#858). The suggestion was later dropped from
  Play. Deck-only playtests ran on one carried-over world, pausing to fix each bug, until a run of clean
  turns was reached. Parked: an Insight read of someone's power (D-365).
