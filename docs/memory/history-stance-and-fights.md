# History: stance, sparring, initiative and wounds

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(Part 2: "Stance" under "Information model", "Sparring" under "Encounter modes", "Initiative" under "Action
time"; Part 3: "Health track"); every number is in `src/config.ts`.

- **Hostile and opposed (07/11/2026; R1).** "Opposed" used to mean attack on sight, which turned standoffs
  into brawls. Hostile now means attacks on sight; opposed is wary and never strikes first (#23). Talk may
  still start a fight, but less often (#27); that prompt rule was later replaced by the rule that personality
  decides what provokes (D-361). Later threads must not reopen the two terms.
- **Surrendered foes (08/11/2026; D-98).** A surrendered foe stayed hostile and blocked rest for good. It now
  holds a yielded state for the scenario, then turns opposed and leaves (#69). Yielded is a temporary state
  kept outside the stance scale (RS1). A healing item is not used up when there is nothing to heal.
- **The stance scale (09/11/2026; RS1-RS7).** Awareness became a scale of its own (#212). Unfriendly was added
  between opposed and neutral, and an NPC now sees its stance word, not only hostile or not (#232). Friend and
  loyal were added above friendly (#237, #246). Stance is directed, per pair of actors and per pair of bands.
  A target turns hostile only if it saw the attack or knows the attacker afterwards; anyone the player
  defeats pays XP whatever the stance (#238). Parked: more for the friend stance (D-133).
- **Sparring (09-10/11/2026; SP1-SP12; D-54).** A spar is its own kind of engagement, a pact between sides:
  blows change no stance, raise no alarm and pay no defeat XP. One against one, groups and free-for-alls.
  Damage is normal, with no special rules. A spar can span places. Spar wins have their own achievements
  (D-144). An attack turns its target hostile in two places in the code, and both skip spar blows (#247).
  Hiding works as in a real fight; an outsider's hidden attack ends the spar (#363).
- **Initiative (09/11/2026).** A function of its own, asked for as a hook for later skills, perks and roll
  bonuses. An actor unaware of its attacker acts last (#221). Its group is Speed. Dodge sits in Defense and
  Speed but does not raise initiative: #228 wrongly gave it the function and #231 took it back. Being in a
  group is not having a function. Learning from initiative was closed by the Tactics tree (D-132).
- **Dead (08-11/11/2026).** The health track got Dead as its last level. The player's own Dead shows as
  Incapacitated; no healing row revives, and each row carries the lever for later (#83, #84). Someone else
  who is dead and seen clearly shows as Dead, other fallen people as Down (#455; BG-29, #450).
- **Bane and healing counts (08-15/11/2026; D-111, D-172, D-174; BG-256).** A higher chain level switches the
  lower ones off and carries their steps, shown as one total with its parts (#890). Healing is counted by
  source for achievements; only perks that heal directly count as perks, and a new healing perk must go
  through the perk heal function, which a test enforces (#312, #314).
- **Raw rolls or bands in contests (12/11/2026).** The owner asked what comparing raw roll numbers would gain
  over the gap in tiers. A page recommended steps of fixed size. Its answers were never readable to an agent
  and nothing was built; the counts behind it predate the extra tiers past both ends (D-211). Open as D-408.
- **Wound penalties as percentages (15/11/2026; PW1-PW6).** Wound, morale and fatigue penalties were flat
  points. They are now a percentage of the average roll at the actor's effective skill, in one pile; rolls
  show the percentage and its points (#891, #892). A new wound-type penalty follows the same form.
- **Situational modifiers as percentages (20/11/2026; D-76).** Outnumbered, unaware and every other flat
  situational modifier (light, cover, range, hostile close, dodge vs missile, filch attention and size, repeat try)
  became a % of the roller's average roll, the old numbers ÷ 75.5 as wounds did, still type situational. The
  difficulty grades stay in points (parked, D-431). A new flat situational modifier follows the same form (pctMod).
