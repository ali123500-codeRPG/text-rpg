# History: body types, animals, body size, the 3D figure and age

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
(Part 3: "Body type database" and "Reach, range, cover and light"; "Age" under "Actor sheet" in Part 4); sizes,
reaches and speeds are in the library rows and `src/config.ts`.

- **Body type and race (08/11/2026; BR1-BR9).** "Creature" was renamed body type everywhere (#98). A body
  type is shape only; the race carries the health multiplier and natural armor and adds its own attacks; a
  template names a race and the body type follows. Defeat achievements count per body type and per race, and
  access rules may name either (#102). Taste was removed for now (#112).
- **Age (12-14/11/2026; AG1-AG27; D-316).** Every actor has an age: life stages per race, a birth day on the
  game clock, rolled once at spawn. The player sees an NPC's stage only. Old age lowers effective skill by a
  share that grows with age and never reaches zero, so an old retired hero still has something in him. No
  learning bonus for the young and no death of old age. Training years are real and the same for every race,
  so long-lived races have an edge; a talent scale shortens them (#492, #496). A rank and talent set the
  youngest age (#767). Children were added (#779) and then removed: the youngest anyone may be is the start of
  Youth, which a config setting names (#817). Parked: slower ageing from power (D-222), training years past
  Paragon (D-223), talent and learning speed (D-224).
- **Animals (14/11/2026; AB1-AB20, NR14).** Three animal shapes and a set of animal races, each a race row on
  a shape with real, cited speeds; speed sits on the race (#838, #841). Natural weapons split into a skill per
  kind of attack, with access worked out from a body's attacks; Scent and Hide were added; jaws may wield a
  weapon (#846). A skill that one of a being's own natural attacks rolls is always open (BG-250, #842).
  Animals are not playable. Parked: venom (D-322), flight (D-323).
- **Real size (17/11/2026; SZ1-SZ19).** A body type has a length, width and height, multiplied per axis by
  the race; that size is the space a being takes up, and every reach is measured edge to edge. The footprint
  is a capsule turned by facing; bodies do not overlap (#981). Arm reach comes from the body and a weapon adds
  its length (#991). A body is seen by its size, cover works by height and shot range by target size (#994).
  A doorway is passed sideways and by ducking (#996). Footprints are drawn to scale on the map (#997). There
  is no personal size: perks will change size, so size is read through one function only. Small bodies are
  seen from much nearer, so tests place beasts closer instead of loosening checks. Parked: what tails do
  (D-366), loudness by size (D-367), crawling (D-369).
- **The 3D body figure (17/11/2026; BV1-BV15).** One figure everywhere, turnable where it is big; it never
  turns by itself and a changed part pulses. One even scale from the size table, with no table of its own.
  Four-legged bodies have a part per leg (#992). Models are free-licence ones, credited in the library
  viewer, with a built shape where no model fits; each race loads one small file on demand (#1008). The owner
  turned down scanned fan art and anime-style humans. `docs/assets.md` lists the models and their licences.
