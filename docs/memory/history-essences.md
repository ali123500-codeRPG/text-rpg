# History: essences

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(the "Essences" and "Essence extraction" lines in Part 1 section 6); rows and pick weights are library data
and `src/config.ts`. How essences began is in [history-growth-and-skill-gain.md](history-growth-and-skill-gain.md).

- **Passing on essences (13/11/2026; ES1-ES7).** Asked to be able to sell or give them. An offer can be given
  to someone in reach or sold to any seller who buys items, at a value from the one value equation; a unique
  NPC takes it into its own slots; a gift cannot be refused and a sale can (#648). Parked: essences as
  carried items (IEI-249), NPCs selling or giving them to the player (IEI-250).
- **Template essences (13-14/11/2026; EN1-EN7).** Each NPC template carries an essence list worked out in
  code from its skills and race, with a hand-set list allowed; an echo carries only its own (#701). An
  essence that adds true skill opens that skill whatever its requirements (#704; BG-208). The loot rule: the
  skill requirement sits on the dead foe offering the essence, never on the taker, and taker-side filters
  are not to be proposed. A template's fighting style is never changed as a side effect of a content fix.
  Parked: body parts for body types that lack one a skill needs (D-255). Open: essence rows and traits
  (IEI-229).
- **Bested foes and extraction (14/11/2026; TF20, DX1-DX6, BS1-BS4).** Essences roll only from a death, but
  the offers at a scenario's end draw from anyone bested: defeated, or beaten without a fight, so builds that
  avoid combat stay viable; defeated and bested weigh the same (#777, #813). The first few essence changes
  are free. Extraction is a blessing: it takes the essence of someone down and broken or surrendered with no
  roll, leaves a lasting quirk on them, and counts as an attack (#778, #781). Gods and blessing tiers came
  with the Starts (#776); gods are not described in the wording used for the Thread. Offers were tuned to be
  generous (#835). Parked: blessings and gods (D-311), extraction from the willing (D-312), merging essences
  (IEI-313).
- **Extraction from the surrendered (21/11/2026; #1462).** Asked to extract from surrendered foes who are still up.
  The condition became Down or surrendered, where it had been Down and broken or surrendered.
- **Every NPC has an essence (16-17/11/2026; NE1-NE5).** An audit found elves, some human roles and nearly
  all beasts carried none. Decided: shared beast rows that name no race, human rows widened to the humanoid
  shape, one new lookout row on every person at a low weight; when no row fits the game files a flag instead
  of falling back (#932). All pick weights sit in one config table, and a new row must add its weight there.
  A row for beasts whose Resolve tops their weapon skills closed the one parked item of the round, and rows
  may carry owner bounds as a provision (#941).
