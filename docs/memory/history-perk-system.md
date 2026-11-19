# History: the perk system

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Skill ladders" and "True skill" in Part 1, "### Action economy"); the perks are in `src/library/perks.ts`, and
`docs/perks.md` is generated from them. How perks are drafted and named is in `perk-design.md`.

- **Perks on ladders (07/11/2026; K1-K4, S1-S9).** Every skill gets a perk at each 20 points. Reaching a
  milestone unlocks its perk and taking it costs a perk point (S2); a perk stays when the skill drops (S4).
  Milestones read true skill, a value between raw and effective (S3, S8). The perk screen never shows what
  comes next on a ladder: an unreached perk is sealed and shows a number only (K4). The owner's taste: a small
  bonus on a roll is weak, and a perk should change what the character can do. Every perk has a Story text
  and exact Rules, and the two must match. A 20 perk works for the other skills of its tree where that makes
  sense. Rules review in #51.
- **Engagements and the action economy (07/11/2026; AE1-AE12).** One engagement covers a talk and the fight it
  turns into, or back (#54). The action economy was settled in #65.
- **40, 80 and 120 perks (08/11/2026).** They raise numbers and carry no conditions, and they do not repeat
  what a 20, 60 or 100 perk gives. Light weapons get hit and aim, heavy weapons get damage, never the other way
  round (#79, #80, #82).
- **20 perks for the later skills (09/11/2026; N1-N11; D-117).** The three stealth skills and the three armor
  skills got theirs (#152, #156). Natural Weapons and Tremor get no 20 perk. Parked: Go to Ground (D-189).
- **Lying and Insight perks (10/11/2026; LI1-LI7; D-166, D-173, D-176).** Bluff, Takes One to Know One, Read
  Their Face and Overheard were built (#300, #315). LI4: every lie in plain talk can be caught, by anyone
  (#316). Gut Feeling is coded and parked until it has a milestone (D-176, #325).
- **Linked perks (10/11/2026; D-182).** Owning a set of perks grants one more perk or merges the set into one
  (#358). A new link is one row in `src/library/perkLinks.ts` and a linked write-up.
- **Perk names come from the library (19/11/2026; BG-319).** The play screen kept a perk's old name because
  code typed it by hand. Every perk name shown by code now comes from `perkName(id)`, and a guard test fails
  on a typed name (#1082).
