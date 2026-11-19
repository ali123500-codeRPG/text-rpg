# History: the autoplay agent, tone, land and the power ladder

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("World, tone and the power ladder" in Part 2; "Play screen" for the agent pop-up); every number is in
`src/config.ts`.

- **Autoplay (10-12/11/2026).** Asked for as a live playthrough by an agent with spoken commentary, on the
  owner's story or the agent's own. One story runs at a time per owner, and opening the game always resumes
  the player's; the agent's story opens only from its bar. The agent spends perk points on its own story
  only. Commentary went through several rounds: short, the outcome first (#430); then reacting in the
  moment and never as a report, with no name or honorific and Claude's own voices only (#435, #436); it sees
  its last lines and may not reuse their words, and is never given a short fixed list of phrases (#439).
  Attack commands were added because the agent misread aiming (#448). Each move carries what the map shows,
  after the agent invented a door (BG-30, #514).
- **Guided mode (11/11/2026; GA1-GA20).** A second mode plays most turns and asks at crossroads, which code
  checks after each turn and the agent checks before a move; the same kind about the same thing asks once per
  scenario (#445; BG-26). Standing orders were later replaced by signatures.
- **Tone, land and power (14/11/2026; TL1-TL29).** All of it is a placeholder until magic and mana are
  designed, which will become core (D-332, parked). Voice: close on the hero's shoulder, short lines, dry;
  big moments count the odds, show one brutal act and end on one flat line; dark things happen on the page,
  fast, without lingering and without a joke after; the supernatural shows as results only. People have
  flexible morals: warm and practical, helping or selling out as needs call, without malice or guilt. Land:
  lords run daily life and borders are the reach of someone past 100; elves live among humans; dragons are
  beasts that never speak; there is no picture of the whole land yet. Power: a doubling climb past 100 as
  targets for perk rows, not formulas; power pictures per rank as a yardstick; places hold at least a given
  rank, as minimums and not limits; nobody trains past 100, which takes deeds and strong essences; no ranks
  in the world's own words (#863, #864, #869). Built as placeholders: beings past the cap (D-314), the
  Transcendent rank (D-335). Parked: dragonkin (D-330), wild creatures at higher levels (D-331). The owner
  judges tone by samples and prefers a web-novel voice to sober prose.
- **Rank presets checked against the pictures (14/11/2026; TL27).** A report-only run found every rank from
  Elite up beat one guard and lost to three, far below the pictures, and the two top ranks came out the
  same. Causes then: capped preset skills, one attack pace for all, no limit on attackers, no skill term in
  damage or health, the same gear at every rank. The missing 20 and 40 perks later closed part of the gap
  for a maxed swordsman (D-397). The figures go stale with any balance change: rerun before reusing them.
