# Lore canon: gods, the Thread, essences

Kind: decision. What names, stories and option texts about gods, blessings and essences must respect. The world's
lore itself is in `docs/build-spec.md` ("### World, tone and the power ladder", "Gods and blessings") and in
`src/agents/worldLore.ts`.

- **Gods never touch the Thread** (14/11/2026). The Thread is the lore of XP. A god's blessing is never written as
  pulling, unpicking, spinning or knotting threads, and no god's name or title uses thread or knot imagery. Reason:
  such names put gods above the Thread, which breaks the world's order.
- **An essence is not part of the Thread** (14/11/2026). It is a small foreign addition that sits on someone's
  Thread, not a strand of their life. Extraction pries that addition off. Reason: the same as above.
- **Gods are titled "god of X"**, each with a narrow field (14/11/2026). Their names come from the lore work, not
  from whoever needs one for a perk.
- **A blessing's name matches its tier** (21/11/2026). A Tier I blessing is weak, so its name is tame: it never sounds
  like acting on the god's behalf or with the god's authority, which is above a Tier I blessing's level. The owner: "it should
  sound weak, but the name you shared is as if you are acting on their behalf, and acting on the behalf or authority
  of a minor god is not a tier I blessing level. give it a more tame name." The name also says what the blessing does:
  "a passing glance sucks as a name and doesn't capture what the blessing does". Turned down: Imbra's Measure, Imbra's
  Grip, A Passing Glance. Chosen: Essence Affinity (IB1 a).
- **"Minor" is game-side only** (14/11/2026). Code, spec and the library viewer rank every current god as minor.
  In-world text (looks, stories, narration) calls each one a god. `tests/unit/minor-gods.test.ts` checks this.
  Reason: to mortals every god is grand, yet today's gods are only the lowest rung of the divine, with wider
  beings above them still to be designed.
- **The late-medieval look is only a look** (16/11/2026; spec TL8). Never argue a design from "it is 1400" or
  "grounded medieval". Game systems may be fantasy: mana, demons, monsters, skills past the human limit. Use the
  period only for how gear, buildings and dress look.

How to apply: before writing any name, story or option text about gods, blessings or essences, check it against
this list. Names already turned down on these grounds are in the spec's history; do not offer thread imagery again.
