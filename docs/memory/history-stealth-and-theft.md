# History: stealth, warnings, containers and theft

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(D-8, the stealth rules in Part 2, "Foes share what they notice"); the numbers are in `src/config.ts`. Question
IDs name the owner's answers.

- **The Stealth tree (08/11/2026; ST1-ST23, NS1-NS10; D-8).** Two skills with one function: Sneaking outside an
  engagement, Combat Stealth inside one (#71). Breaking a sight someone already has of you is a third skill,
  Vanishing (#76). Situational modifiers apply by situation tag (#78, #81). NPCs sneak, hide, vanish and ambush
  by the player's own rules (#89). Darkness never hurts hearing, so it gives no help against a listener.
- **Containers and filching (12-14/11/2026; CT1-CT7, FL1-FL7, TN1-TN4, PI1-PI4, PO4).** Chests, sacks and worn
  packs (#600); Filching and the Sleight group, with a theft that must make a sound someone can hear (#660);
  putting things into containers (#698). Pockets, belts and bandoliers were built (#758, #762) and removed again
  (#786): everything in the pack outside a container is at hand. Parked: stealing what is gripped (D-234),
  container capacity (D-254).
- **Hide removed (14/11/2026; HA1-HA3; D-327).** The Hide action did nothing of its own. Sneak stays and takes its
  cover (#851, #852); the skills and the hide situation tag stay. Go to Ground stays parked (D-189).
- **Stealth attacker trial and Vanish (16-17/11/2026; VS1-VS8; BG-263; D-363, D-364).** A trial confirmed that the
  stealth skill rolled is always the one that learns. It found BG-263: a shot after a step got no contest of its
  own (#927). There is no Vanish action: a sneak rolls Vanishing against those already aware of it (#946).
  Sneaking multiplies the time of every action, movement included (#948, #957).
- **Foes share what they notice (17-18/11/2026; WN1-WN13).** Knowledge of a trick or of a hidden foe passes only
  by a warning that is given and heard (#1046). Parked: hand signs (D-387), supernatural warnings (D-388)
  (#1044). A new trick that keeps a list of who believes it uses the shared helpers in `src/engine/ruses.ts`
  and gets a re-check in `src/engine/warnings.ts`.
- **Each sense contests on its own (20/11/2026; D-40, decision card Q1-Q3).** Every detection sense that reaches a
  watcher makes its own stealth contest, once per turn; slipping away must beat every sense; smell always rolls; Every
  Sense One makes sight and hearing one contest. One shared list of detection senses for stealth and searches.
- **The ambush is a Combat Stealth roll (20/11/2026; BG-343, decision card AQ1-AQ4).** An ambush rolls nothing of its
  own: the attack's own Combat Stealth contests, per sense and once per turn, decide who notices and the surprise (every
  sense of the target must lose), for any attacker, Stealthy or not.
