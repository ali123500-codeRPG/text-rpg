# History: the look, icons, the library viewer, sound, narration length and lore

Kind: context. What was asked, what was decided and which PR built it, oldest first. The rules are in the spec
("Play screen", "Game sound", "World, tone and the power ladder", D-334); `docs/assets.md` lists files and
licences; `docs/providers/claude.md` says who publishes the pages.

- **Library viewer (08-09/11/2026; VR1-VR8).** Asked for as a view of the game libraries as the code sees
  them (#92). The owner's rules: everything shown comes from code, numbers call the same functions the rules
  use, colour coding with the filter buttons as the key. A tab can crash silently after a library shape
  change while build and tests stay green, so every tab is opened once before a publish. A change to how a
  roll, gain or mark works also updates the equations text the viewer shows; no test checks that. A design
  review was accepted in full: tables with cards and a compare dock, fixed colours per value, names not IDs,
  search across all tables.
- **Class flavor and lore (10-16/11/2026).** A class's text is as grand as its tier: low tiers get one plain,
  slightly deflating sentence with no second line, and only top tiers get drama (#284, #305). Gods are minor
  beings of a narrow field and never touch the Thread; an essence is a small add-on that sits beside a
  Thread, never a strand of it (#782). The game's name is the one place the Thread shows (#680). The world
  lore text stays short; the world is an isekai fantasy that only looks medieval, where people know their
  own level and skills (#864, #871, #895, #896, #901, #908). Parked: a reborn-outsider Start (D-347),
  titles for the strongest (D-348).
- **Narration length (14/11/2026; LN1-LN8; D-334).** Measured against the owner's own turns and other text
  adventures, narration was too long and always the same size. Now code picks a length band by what
  happened, with a story setting for shorter or longer; spoken lines come on top of the band.
- **Icons (14/11/2026; IC1-IC5).** Free icon sets were compared by coverage and licence. Things in the world
  are filled silhouettes from mixed sources, tinted by kind; items sharing a type may share an icon; a
  script copies only the picked icons into the code, with a credit line and a licence file (#827).
- **Sound (14/11/2026; AU1-AU12).** Effects only for now: clicks, roll tiers, blows, scenario end and the
  death scene, with one switch and one volume slider. The repo stays public, so licensed sound files are
  kept out of it and reach only the published page (#856). Parked: music (D-328), background noise (D-231).
- **The look (17-18/11/2026; LK1-LK6).** Two first looks were turned down for poor readability. The lesson:
  contrast ratios missed the real fault, which was small text and serif letter height, so judge size and
  letter height too. Graphite was picked (#1020), and no UI text may be smaller than a floor that a test
  enforces (#1022). A font fault on buttons was fixed on the way (BG-302, #1016).
- **Show, don't tell (19/11/2026; SD1-SD14).** Every page was reviewed: help lines under titles, headings
  repeating the title, words for the normal case and help paragraphs were cut (#1085; BG-317, BG-318).
