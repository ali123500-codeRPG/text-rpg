# History: senses, sound and search

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Scale keys" and "Skill functions and groups" in Part 1, the sound lines under "### Game state model",
"#### Searching"); the numbers are in `src/config.ts` and the library. Question IDs name the owner's answers.

- **Noise and visibility scales (08-11/11/2026; NV1-NV6, Z1-Z6, AN1-AN5).** The owner wanted more levels of noise
  and visibility. Levels became keyed scales (#103, #104), and NV3 restated the scale-key rule for anything with
  levels. Armor makes body-moving events louder by steps, not by a roll penalty (#113, from D-88). Ten loudness
  levels on real decibels came with one sound equation (#386). A "silent" chance was asked for and then dropped.
  Z1, Z4 and Z5 (a zone is one open space with no positions inside) are superseded by titles.
- **Sense rolls go by function (09/11/2026).** A sight roll rolls the sight function and a hearing roll the hearing
  function (#141). Skills are named by ID so that a rename confuses nothing; the two skill ids were renamed so
  they no longer clash with the function names. Tremor augments hearing only (#704).
- **Hearing in metres (12/11/2026; HB1-HB8; BG-57, BG-74).** A whisper at arm's length went unheard because sound
  counted zone links. Now only distance, doors and walls cut sound; a whisper needs leaning in (HB8); voices do
  not rise against noise (HB7) (#528). Talking to someone who would not hear you clearly walks you over first
  (#533). Background noise per place was built and then removed for one hearing floor (#572); it is parked as
  D-231.
- **Search (09-13/11/2026; SE1-SE25; BG-38).** A search is a sense roll against what is really hidden in the spot,
  and nothing is rolled when nothing is hidden. Look around is a weak search (SE1, SE14 b). There is no search
  bonus, because a search is already a second roll (SE4 c). Built in #598, #601, #652 and #659. SE18 a handed
  the difficulty of other acts to the obstacle grades (see `history-doors-cover-walls-map.md`).
- **Senses that grow unasked (14/11/2026; PG1-PG11; BG-249, BG-252).** The owner asked whether a character who
  never looks or listens still grows Eyesight and Earshot. A trial showed almost never. So what is half seen or
  half heard gets a make-out roll, a passed check teaches, and someone made out is named in Who's here (#836,
  #840, #854). Parked: senses past 100 widen ranges (D-321).
- **Search by sound (19/11/2026; LS1-LS6). Open.** LS1 to LS5 are answered and recorded as D-411 (decided, not
  built). LS6, how the better sense is picked, waits for the owner. It builds on the BG-314 fix (#1089).
- **Search and Look around merged; Pat down (20/11/2026; LX1-LX4, Questions hub page "Merge Search and Look
  around" on the second account's hub).** Search is one action around the player: the look and the search together,
  3 s, the same circle in a fight and out of one, never under a 2 m radius. Searching a person became Pat down (#1129).
  Open: LX5-LX7 (two outer rings at −1 and −2, hearing in them by LS1-LS5, NPCs). Parked: a 60 s deep search (D-410).
