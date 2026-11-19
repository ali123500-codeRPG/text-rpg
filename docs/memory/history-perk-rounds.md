# History: perk rounds from 13/11/2026

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Skill ladders" in Part 1, which holds the milestone gate, and the D-n rows named below); every number is in the perk
rows of the library or in `src/config.ts`.

- **Stamina perks (13-14/11/2026; SS1-SS15; D-301).** The perks of the Stamina skill, built in #738 and #763.
  Forced March was retired by the strain rebalance (#849, D-326). Parked: strain on auras (D-333), Short
  Sleeper's race (D-300).
- **High perks that read a skill (14/11/2026; SH1-SH7; D-258).** The 120 perk gives a share of the skill's own
  true skill plus a spread to its group. SH5: each higher slot's extra is stronger than the one below. No
  shares of skill on All-50 pieces, because of inflation (D-302, parked). Built in #738.
- **Link rows (14/11/2026; LR1-LR5; D-259).** Four more linked perks (#738).
- **Payoff perks that count pieces (14/11/2026; CN1-CN9, RN1-RN6; D-260).** A payoff perk grows with the
  matching pieces a character owns, itself included (#773, #775). The owner found halving too harsh, so one
  power rule for stacking replaced it (#785). Chorus came in #788. A payoff perk on a 40, 80 or 120 slot
  still carries that slot's normal boosts. Parked: dormant perks as pieces (D-310).
- **Perks that nudge personality (14/11/2026; PN1-PN6; D-272).** Attitude perks only (#738).
- **"Beaten by" lines per tree: withdrawn (14/11/2026; D-257).** The owner withdrew the tree counters and the
  questions behind them (#799). Build no counter and no strong-against line for a tree.
- **Missing 20 and 40 perks (14-19/11/2026; LG1-LG26; D-397, D-403, D-405).** Some built perks were sealed
  because a lower milestone on their ladder was empty. Decision: write the missing perks and never loosen the
  gate. Built in #1076, #1083, #1091 and #1094. Three things became everyone's rule instead of a perk: a won
  haggle holds for the day, Plain as Day, and armor costing Parry as it costs Dodge. Parked: Blade Dance 20
  (D-398), Hit From the Dark (D-399), trading perks (D-404), so Barter 40 is empty and Buy Them Off stays
  sealed. Riposte 20 was built with the strike-back limit (D-337). The id BG-254 names two things: this
  report in the game page's bug list, and a different bug in the spec's Bug log; D-397 holds this one.
