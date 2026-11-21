# History: code scans, code checks and test safety nets

Kind: context. Which reviews of the code and the tests ran, what each decided and which PR built it, oldest
first. What came out of them as rules is in `docs/instructions.md`, the spec's "Bug log" and the tests named here.

- **Scales by key (07/11/2026).** Renaming the outcome tiers broke code that used their names. Every ordered
  scale now has stable keys and one names table in `src/scales.ts`; code compares positions and words appear
  only in text (#7). A roll past either end keeps the end key and shows one sign per step.
- **Bug reports (11/11 to 14/11/2026; CO10, BF45).** Every bug gets a BG-n and a row in the spec's "Bug log".
  The game first took numbers itself; it now files unnumbered reports and an agent numbers each real bug once at
  triage (#787). `docs/bug-fix-log.md` began as a backfill of the earlier bugs (#688).
- **Code scan (12/11 to 13/11/2026; first CS1-CS12).** Three sampled rounds. Round 1 fixed stale Equations tab
  text (#503) and brought guards on that tab (`tests/unit/equations-guard.test.ts`), a morale break counted as a
  defeat, and new config levers (#520). Round 2 gave hit outcomes, grades and item quality one table each (#535,
  #539). Round 3 removed the difficulty command, let NPCs use their keys off screen and saved between-turn
  changes at once (#589, #592). Stage trim was parked as D-225, settled since.
- **Review of past bug fixes (12/11/2026; FR1-FR5).** Asked after one bug had been fixed one action at a time.
  Each missed sibling was first proven with a failing test (#561). Outcomes: someone the player names must hear
  the player from where the words are said, and background noise per zone was parked as D-231 (#572); reach is
  grip reach in metres with one approach table, and no "hand" (#579); an NPC knows a way is shut only where its
  routine is bound, or after trying it (#580).
- **Testing review (13/11/2026; TQ1-TQ8).** Finding: many tests, yet few bugs were caught by a test while
  building; playtests and reviews caught most. Built as safety nets: a turn checker (`src/save/turnCheck.ts`,
  #606); a seeded soak run, small in every check run and large nightly (#608); a replay set of real agent
  answers (#609); a Parser set on the real model that runs only nightly, the owner's own choice (#611); the PR
  rule with its action table, guard and whole-turn helpers (#616); browser smoke tests (#618); and a Bug log
  that names every fix by PR (#620).
- **Leftover scan (13/11 to 14/11/2026; second CS1-CS26).** Eleven rounds over all of `src` for leftover rules,
  copies of one helper and stale notes (#710, #718, #719, #721, #734, #746, #748, #752, #760, #768, #855). The
  list of scanned files is in `tests/unit/leftover-scan-1.test.ts` and grows with each round. Answers built:
  settled gap notes and caps (#731); one reward XP equation that quests share (#742); grips, not hands, in code
  names (#742, #746); sleepers hear who is near, and no cap past training, D-3 (#756); a Destroyed part weighs
  more than a Crippled one, and a stealth act counts once (#780); the land maker's numbers in one table (#857).
  Parked: D-256, D-293. The hard caps review (D-275) was asked as CS10-CS14; the owner closed it on that basis
  (21/11/2026, D-275 a).
- **Code check in ten slices (16/11 to 17/11/2026; IC1-IC12).** All code checked for inconsistencies, a tenth at
  a time: tidy-ups with no behaviour change in one PR per slice (#923, #924, #939, #954, #955, #956, #958, #959,
  #960, #961), and each bug fixed only after the owner's OK (BG-261 #923, BG-262 #930, BG-267 #952, BG-274 and
  BG-276 #969). Rule from IC12 (#974): `withinM` is for resolving a blow only; any new decision about reach uses
  `reachesM`, and closing in aims inside the margin with `closeInM`. BG-277 is "won't fix". Prompt tidy-ups were
  proven byte-identical by a throwaway test that dumps every prompt string.
