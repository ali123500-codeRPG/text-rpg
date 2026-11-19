# History: speech, names, talking a foe down and trade

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(D-93, D-154, D-155 and "Names" under "Opening narration" in Part 2); every number is in `src/config.ts`.

- **The speech role (08/11/2026; SR1-SR5).** Speech is a role of the head, so a damaged head lowers speech
  rolls (#101). Races are tagged if they can speak; intimidation is open to all, and a speaking race opens
  persuasion and barter (#106).
- **Paying and selling (09-10/11/2026; PY1-PY11, SL1-SL14; D-93).** Give takes an amount. Only cast with the
  Trader class and wares sell; services are a catalog; a haggle win lowers the price and a bad loss raises
  it (#188). Traders buy the kinds they sell, from a set purse (#253). An item's value is worked out in code
  from its benefits, with consumables hand-set (#255); the rates wait for a more mature economy. Deferred: a
  merchant class with prices by place (D-149).
- **NPCs make speech rolls at the player (10/11/2026; NT1-NT20; D-154).** One contest rule for player and
  NPC speech. A lost intimidation gives Shaken and a lost persuasion Swayed, both by formula from the gap:
  the owner prefers formulas to tables per gap. Deceive got a Lying skill and Insight answers it; only shady
  NPCs lie; a repeat try at the same listener is penalised (#269, #275). Barter was already one check both
  ways and was left alone. Every lie can be caught however it is told (#316).
- **Names (12-13/11/2026; NM1-NM6, NL1-NL4; BG-95).** Names said aloud were not learned. One rule for player
  and NPCs: a listener who hears a name learns it if it clearly sees the owner then (#569). Heard-of names and
  believed false names followed (#577). An NPC's lie to another NPC rolls Lying against Insight (#712); the
  other speech kinds between NPCs stay banked (D-155).
- **Asides and furniture (13/11/2026; OA1-OA4, FR1-FR5).** One action per turn annoyed: thanks took the turn.
  Outside a fight, words beside a deed are answered the same turn, and courtesy never takes the turn's words
  (#615). Looking at one's own things, sitting, standing and setting down are free. Rooms got named furniture,
  mostly cosmetic, so the Weaver may make things up; the narrator may add unlisted colour that becomes real on
  use (#666).
- **Talking a foe out of a fight (13-14/11/2026; TF1-TF20).** Persuasion must be able to end a fight, with no
  new bar: wounds and morale already weigh on every roll. An offer to stop is one contest; code-run foes
  follow the roll and agent-run characters have the final say; bribes use Barter; foes may offer too (#733).
  A stand-down is its own outcome and never a defeat for either side (#741). Talking a foe into surrender is
  a defeat and needs a bigger win, easier against the Broken and the crippled (#747). Essences roll only
  from a death (BG-199, #750).
- **Speech in character (14/11/2026; SP1-SP5; BG-232).** The autopilot can speak from the character's
  personality, and the player sets signatures in play (#793). Styles were cut to Plain and In character,
  which also picks the moves; the other styles are parked (D-315, #801). Signatures replaced standing orders
  (#811). Signatures are habits, said only where they fit, and a word-for-word repeat is flagged (#820).
