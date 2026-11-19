# Perk design

Kind: decision. How perks are drafted and named. The perk rules are in `docs/build-spec.md` ("Skill ladders",
D-258); the written perks are in `src/library/`; `docs/perks.md` is generated from them.

- **A 40 perk's extra changes one of the skill's own rule numbers** (18/11/2026). The perk keeps its standard
  own-skill and group bonus. Its one extra changes a number in the skill's own rules (a gap, a multiplier, a penalty,
  a time factor, a reach), named from `src/config.ts`. When drafting, list the skill's own config settings first and
  lead with options built on them. A flat bonus to another skill may stand as one option at most. Reason: a flat
  bonus to another skill changes nothing about how the skill plays, and every perk should change play.
- **Naming** (08/11/2026). Call perks by milestone: "20 perk", "40 perk". The 20, 60, 100 and 140 perks change what a
  character can do; the 40, 80 and 120 perks change numbers. Lower perks get grounded names; perks at 100 and above,
  and All-50 perks, may be dramatic.
- **A negative perk is a "quirk"** (08/11/2026). Flaw, curse, bane and scar are taken words: see `docs/glossary.md`.
