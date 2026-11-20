### Play screen

The game's own design rules for every play screen: the look, the layout and each part of the Play screen, the
Character page, the Inventory and the Journal. Each rule starts with a stable ID (PS-nn) that code, tests and reviews
cite; a number is never reused. The full-screen Map and the minimap follow [Map](map.md); motion follows
[Play screen motion](play-screen-motion.md) (M-01 to M-74).

#### Scope

- **PS-10** These are the game's own design rules. They started from the HISAB design system
  (https://claude.ai/artifact/PsxYHump4Sjy9iz9GvXkfx), which was only ever meant to speed up early work; HISAB no longer
  binds the game, and nobody needs to read it before building (Rules kept only because of HISAB, HS6 to HS13,
  17/11/2026).
- **PS-11** This section is where the play UI design rules live: the project instructions only point here, so agents
  make every later edit here (HS13).
- **PS-12** The game is a build-crafting game first and a story second: the build screens (creation, Character page,
  perks, essences, gear) lead.
- **PS-13** The look is Graphite, picked in the look study (LK4 b; Look, below).
- **PS-14** These design rules, from Platform to Design changes (PS-20 to PS-106), are binding for every play screen.

#### Platform, type and look

- **PS-20** Platform: one self-contained page for PC only (no phone rules). It makes no network calls except the game's
  own Claude and database capabilities and the owner's connectors it names (RPG Voice; Claude Code Remote for the
  Republish button).
- **PS-21** One dark theme, no theme switcher. Play screens carry no picture credit (personal use); the icon sets' licence
  credit sits on the GM page (PS-306).
- **PS-22** No max width, 32px gutters, 1.3× zoom at 2400px and wider.
- **PS-23** Text size: the browser's zoom is the text-size setting. Every page still works at 125% zoom on a 1920×1080
  screen, with nothing clipped or overlapping (B4; checked 18/11/2026 on creation and every rail page; the personality
  axes were the one overflow, fixed).
- **PS-24** Type: HISAB Round for all UI text (look study LK4, 17/11/2026: its letters stay readable at small sizes).
- **PS-25** Story text is set in Literata (SIL OFL, embedded). Tabular figures everywhere.
- **PS-26** Look: Graphite, picked in the look study: a neutral graphite ground (--bg, --surface, --field darker for
  text boxes) so the game's own colours (skill groups, perk series, essence, health) stand out (LK4 b, 17/11/2026; hub
  page "Choose the game's own look").
- **PS-27** One light-blue accent (--accent) for links, the active pill and main buttons. Main buttons are the light
  accent with dark text (--btn-fill, --on-btn) (LK4 b).
- **PS-28** Borders are faint see-through lines; placeholders, selection, caret and scrollbars take the theme (LK4 b).

#### Text size floor, tokens and words

- **PS-30** No UI text is smaller than 13px; the only exception is the step numbers inside the perk ladder's diamonds
  and circles. A styles test keeps the floor (LK6 a, 18/11/2026).
- **PS-31** Small capital labels keep their capitals with .06em letter spacing (LK6 a).
- **PS-32** A perk name beside the ladder wraps to a second line rather than being cut short (LK6 a).
- **PS-33** Tokens: every colour, radius, space and duration comes from a named token in `:root`. New tokens are fine
  when they are named for the game (like --perk-20, --essence); a rule never uses a raw hex (HS10;
  tests/unit/styles-tokens.test.ts).
- **PS-34** Words: plain words, one name per thing, no internal ids. Colour always comes with a word.
- **PS-35** Real-world dates are DD/MM/YYYY; in-world time reads "Day 2 · Morning".
- **PS-36** Buttons start with a verb and say what happens (Equip, Take, Move to here); no button names a key (A8).
- **PS-37** Every game term on screen (tier names, Burden, Thread, Near Miss, All-50, Breakthrough) has one tip with its
  plain meaning, from one table in src/words.ts, the same on every page, marked by a dotted underline (G3; GAME_TERMS,
  termAttrs).
- **PS-38** Built on the check line's tier chips, the skill pop-up's Burden line, the gains panel's Thread heading, and
  the perk board's All steps (the series key is gone, PS-461). A new term goes in the table and gets termAttrs where it shows (G3).

#### Navigation, tiles and three depths

- **PS-40** Navigation: an icon-only rail (60px wide), 52px items with no gap, each name in a tip on hover or keyboard
  focus. The active item is a pill filling the whole item (HS8).
- **PS-41** Nothing shrinks on short windows; the rail scrolls on its own (HS8).
- **PS-42** The rail's pages \[Proposed\]: Play, Character (/stats), Inventory (/inv), Quests (/quests), Journal and,
  when on, GM debug (HS8).
- **PS-43** Tiles: a page leads with tiles only where it has figures worth leading with (HS9).
- **PS-44** Every tile has a label and one figure with its unit; a sub-line only for the exception, and what the figure
  means is the tile's tip. The GM page keeps ⓘ (HS9; SD4).
- **PS-45** Coin always shows in coin words, never as a decimal amount (HS9).
- **PS-46** Every figure has three depths: glance (the figure on the page), hover or keyboard focus (a card with its
  exact rows), click (a pop-up with every part). Nothing is only on hover (A2).

#### Visibility and matching tiles

- **PS-50** Visibility (Shown / Left out) is the one filter pattern for long lists (Quests, Achievements, Scars), used
  only where a page has a list worth filtering (HS11).
- **PS-51** Clicking the big box cycles Shown → Left out → off (several Shown = either). Clicking the small heading
  ("QUESTS ›") opens that group (HS11).
- **PS-52** Use the words "Shown" and "Left out", never "Only" (HS11).
- **PS-53** A figure that can't be clicked this way goes in a text line under the row, not in the tile row (HS11).
- **PS-54** The Inventory page has no tiles: its boxes only repeated the group counts, so it shows the equipment panel
  and the Coin line, and lists each item once (SD11: no table under the pack).
- **PS-55** Matching tiles: tiles in one row share the same units and tip kind. When one page gets a feature, matching
  pages get it too.

#### Tables and grouping

- **PS-60** Related entries fold under one head row with combined values (sum, earliest start, latest finish, average,
  "Mixed" when values differ, latest status) and a plain count chip ("3") that opens the sub-rows (HS4 a, 17/11/2026: ↻
  is kept only for "↻ Another" on the action deck).
- **PS-61** Rows sort by the page's own key (turn, name, state), then title in natural number order. Sub-rows are
  numbered only where their order means something, and no game table has such groups today.
- **PS-62** Clicking a field's text opens the details panel with that field highlighted, never an edit box, since the
  game writes every field (HS5 a).
- **PS-63** Clicking empty space folds or unfolds.
- **PS-64** Every column title sorts (1st click biggest or A–Z first, 2nd reverses, 3rd back to page order).
- **PS-65** A folded row never shows more than the open one. Charts go under the table they explain.
- **PS-66** Number columns are right-aligned; numbers inside sentences are not (P4: groupedTable right-aligns any column
  whose every filled cell is a number).

#### Estimates and depth

- **PS-70** Estimates: every estimated number starts with ≈; its source line is the tile's tip and its link stays in the
  tile (HS6; SD4).
- **PS-71** An estimate is editable only when the player sets the input behind it (the creation screen's practice
  swings) (HS6).
- **PS-72** Depth: no glows and no shadows except the toast shadow (also the motion rules).
- **PS-73** Hover and focus never change size or position: only colour, opacity, background or an outline.
  tests/unit/styles-tokens.test.ts fails on a :hover or :focus rule that sets width, height, margin, padding, border
  width, font size, font weight or letter spacing (P6).

#### Tips, choice states and risky choices

- **PS-80** Tips: a hover tip waits --m-tip-delay (150 ms); keyboard focus shows it at once. Once one tip is open (or
  closed within twice the delay), the next shows at once; leaving hides it at once (A7; tipOn/tipOff in src/ui/kit.ts
  for item cards, Loot, the rail and the minimap; a transition-delay for the CSS tips).
- **PS-81** The minimap's hover text (rooms, rings, doors, stairs, furniture, people, its buttons) is this tip, not the
  browser's (Ali, 20/11/2026).
- **PS-82** Elsewhere the browser's own title tips keep the browser's timing (A7).
- **PS-83** Choice states: Available (normal, with its verb button), Can't afford (shows the shortfall: "needs 1 more
  point", "12 copper short"), Locked (a known requirement not met, shown), Sealed (unknown: a number only) (P5; K4).
- **PS-84** Each says its word or shape; none is colour alone, and Locked is never used on a sealed perk (P5).
- **PS-85** Built: a perk's Take with no point reads "Needs 1 more point"; a class not yet open is a dashed card reading
  "From …", with "Locked" as its tip and screen-reader name; sealed perk milestones show their number only (P5; SD10).
- **PS-86** Risky choices: a choice that can be undone doesn't ask. A choice that can't be undone asks once, in place (a
  confirm row beside it, never a browser dialog), saying what is lost. No hold-to-confirm (A6).
- **PS-87** The creation screen's Reset and Use recommended build get an Undo (until the build is changed again). An
  essence button that gives one up, and Let it go, get a confirm row (A6; askInPlace in src/ui/kit.ts: what is lost, the
  choice, Keep it).

#### Previews and empty states

- **PS-90** Previews: a choice with an exact result made outside a turn (taking a perk or essence, creation points,
  equipping) shows its change on the affected bars and figures before it is made, as a still striped segment. Rolled
  results and anything during a turn are never previewed (M-06); the ghost after a turn stays as M-33a. **\[To build\]**
  (P3)
- **PS-91** Empty states: every page and pop-up has an empty line in plain words that says how it fills ("No essences
  yet. A foe you defeat can offer one."; wording *placeholder*) (G4).
- **PS-92** The Essences pop-up's empty cue is its dashed Empty slot box (G4; SD3).
- **PS-93** Every rail page, the Journal tables, and the Gear and Essences pop-ups were checked; the ones that only said
  "nothing" now say how they fill (G4; checked 18/11/2026).

#### Contrast, cards and pop-ups, design changes

- **PS-100** Contrast: tests/unit/styles-tokens.test.ts fails when a text colour token (text, muted, faint, accent, ok,
  warn, danger, the perk colours and the skill-group colours, which name the trees) is under 4.5:1 against --bg or
  --surface (G5; after LK6).
- **PS-101** All of them clear 4.5:1, so the 3:1 large-text allowance isn't needed; --c14 was lightened a step (#b27567
  → #b4786a) to clear it (G5).
- **PS-102** Cards and pop-ups: tiles and the Character page's character card sit flat on the sky with no box and no
  lines. Space alone parts them, a hover tints the tile under the pointer, and a lit tile shows its figure in its colour
  (HS7; Ali: "I hate your stupid tile boxes", then "stupid lines").
- **PS-103** Pop-ups stay as built and movable, and so do the game-moment cards (gains, perk unlocked, hit cards)
  (HS7; Ali: "the pop-up is nice").
- **PS-104** The Play column has no extra veil of its own (HS7; Ali: not transparent "for no reason at all").
- **PS-105** Design changes use the design skills in proportion to the change, as `docs/instructions.md` section 7
  sets out: a small change uses interface-design and show-dont-tell-ui plus the accessibility checks; everything else
  uses all five (WF4 a, 20/11/2026).
- **PS-106** Only a major change is shown first, as 2 to 4 named options drawn over the real page, one recommended, and
  Ali picks one; small fixes and bug fixes ship without a mock-up.

#### Creation screen, Loot and item value

- **PS-110** Creation screen: the approved layout at https://claude.ai/artifact/HW45ivigqwZ5VDo4PWPv9u (Part 4 §4,
  Player creation). The story starts from it.
- **PS-111** Loot: when the character can see things to take where they stand, a Loot chip shows by the action box with
  how many ("Loot ×7").
- **PS-112** It opens a large partial pop-up listing them by where they are: each body that is down (what it wears and
  what a search turned up, plus an open pack's contents), each open container on the ground (a chest's contents), and
  the ground. A chest itself stays where it stands (src/ui/loot.ts; ContainerView.fixed).
- **PS-113** Each thing is a tick chip; Pick all picks everything.
- **PS-114** Take types one order for the picks, one phrase per place ("Take the bandage and the key from the
  halt-keeper, and pick up the sack") in the action box, unsent, like Move to here, so the turn still decides what can
  be taken.
- **PS-115** The Loot pop-up is built from PlayerView only. Back, ✕ or Esc closes it; a partial pop-up opened with
  `back` adds a step to the browser's history, as the full-screen one does (BG-220).
- **PS-116** Item value: an item's hover card and stats list its Value in coin words, each and for the whole stack when
  there are several, or Worthless (itemValue, the price a trader starts from).

#### Header and your deals

- **PS-120** Header: where you are. The character's zone is the heading; under it the turn, then the place and parent
  place the zone sits in (Ali: the story's premise as a title told him nothing).
- **PS-121** Pointing at the sun icon shows the day, the time of day and the clock to the second ("Day 2 · Morning ·
  07:30:15"). The day and time of day follow the turn (Ali; T11).
- **PS-122** No mode word, Claude-call count or background-call note: each changes with the encounter mode, which is
  hidden. The call count and the running agents show in the GM view (play screen review UI1, UI3, 09/11/2026).
- **PS-123** Your deals: an "N deals" chip beside the scenario title opens the player's deals with NPCs
  (PlayerView.agreements) in a gold-edged, gold-tinted list: who each deal is with, what each side will do, and the turn
  it was made (Ali, 08/11/2026, PM5 and Deals display K1 c).
- **PS-124** A click outside or Escape closes it. There is no chip while there are no deals.
- **PS-125** A deal leaves when a party ends it as done or broken; deals between NPCs never show.

#### Layout A, Who's here and narration log

- **PS-130** Layout A, "Book with a status strip": fixed rows (header, story, input) so nothing jumps (play screen review
  UI8; Who's here moved to the right column, PS-133).
- **PS-131** One reading column (Literata, sized by the fit-the-screen rule, line height 1.6) on the left, filling the
  space beside the right column with no width cap (PS-454), on the same see-through sky as the rest of the page (UI8;
  HS7: no extra veil behind it).
- **PS-132** The right column (PS-410) shows at every width. Its health strip stays folded (health level and bar,
  damaged-part chips, Stealthy); a click opens the full condition in a pop-up (UI8; AD1–AD16).
- **PS-133** Who's here sits in the right column under the minimap and Your band, as compact cells several to a row
  (name, pin and status words; how far they are in the cell's tip, PS-172) so it takes little room (PS-410; AD1–AD16;
  YB4 a, Ali 20/11/2026).
- **PS-134** It lists the actors the character fully perceives (PlayerView), by label until the name is known; "Nobody
  in view" when empty (Voyage C2, U6, U7).
- **PS-135** Others' health shows only from Wounded down (Part 3), never as a bar (Voyage C2, U6, U7); band-mates are the
  exception (PS-138).
- **PS-138** Your band sits between the minimap and Who's here, in the same cells: everyone in the player's band (the
  engine's rule, the same bandId; YB2, Ali 20/11/2026). One in clear sight shows its health and morale as two thin
  bars at every level, the level words in their tips; one out of sight shows, dimmed, the place it was last seen
  (YB3 c, Ali 20/11/2026; PlayerView `band`). A band-mate is never also listed in Who's here. With no band-mate the
  heading reads Solo (YB4 a, Ali 20/11/2026).
- **PS-136** Narration log: checked narration, newest last. Story text is set in Literata.
- **PS-137** While a turn runs, one neutral line for every turn, "The story is moving… 12 s", with "Taking longer than
  usual" after 90 s; it never names the agent (play screen review UI2).

#### Turn results and check line

- **PS-140** Turn results: under each turn's prose, in one place: the check line, every roll made against the player
  that they perceived (LogLine.incomingChecks), the turn's changes row, gear changes, skill gains, XP, and gold cards
  for level-ups, achievements and perk milestones, which show even with mechanics off (UI4).
- **PS-141** Gear changes are ready-to-show rows the game writes when the turn ends; with the place, scenario and the
  player line's aimed flag they survive a reload (UI4; LogLine.gear).
- **PS-142** The check line never sits above the prose it describes (UI4).
- **PS-143** There are no pop-up notifications: every change lands here in the M-21 order, and the story is the history
  (UI4).
- **PS-144** Gear rows merge the same item and say how many, in the game's ×N count ("Picked up: arrow ×3", "Used:
  bandage") (UI4; A1).
- **PS-145** Check line: the player's own roll this turn with no numbers: skill, tier, the other side's tier, how far
  apart they are ("1 tier ahead") and the result, e.g. "Medium weapons Great Success vs the slime's dodge Success · 1
  tier ahead · full hit, body" (Voyage U10).
- **PS-146** It opens with an icon for the kind of roll (attack or talk), and each tier is a chip tinted green (Great
  Success and up), blue (Success), amber (Near Miss) or red (Failure and worse) (Ali, 07/11/2026).

#### Speaker lines and turn changes

- **PS-150** Speaker lines: each line the character heard, word for word under the narration: the speaker's name in a
  column on the left, sized to the longest name, with how it was said (whispering, shouting) under it, the line on the
  right, vertically centred (Narrator rule 5; Voyage U9, U12, style A picked by Ali 07/11/2026).
- **PS-151** *Stage directions* show in italics without the asterisks, outside the quote marks; the player speaks as
  "You".
- **PS-152** Turn changes: one folded row per turn ("Turn 14 3 Your right arm is crippled", the 3 a count chip, or "3
  changes") that opens to one typed row per change: Combat, Condition, Health. Built by code from the combat packets the
  character perceived (Voyage U14 to U16).
- **PS-153** The summary names only Condition rows, since the bars already show health and morale (SD5).

#### Commands and Ideas

- **PS-160** Commands, in the action deck's top row beside Same again, opens a panel above the input, at most 40% of the
  story's height. Escape, a pick or a send closes it.
- **PS-161** Commands lists the / commands (D-100).
- **PS-162** Ideas listed everyone in view for Fight and Talk and up to three actions each for Move, Stealth and Use,
  built by code from PlayerView (D-107); the action deck replaced it (PS-370; AD1–AD16).
- **PS-163** Picking one fills the box; nothing is sent until Send (the panel doesn't say so: SD4).
- **PS-164** The character's personality orders what is shown: each group and idea has pulls from Nerve, the personality
  axes and held values (a value pulls IDEA\_VALUE\_PULL, *placeholder* 50, points) (src/ui/ideaLeans.ts IDEA_PULLS).
- **PS-165** Groups and the ideas in each sort by total pull (under PERSONALITY\_LEAN either way counts as 0, ties keep
  their place).
- **PS-166** An idea pulled away from by IDEA\_AGAINST\_NATURE (*placeholder* 50) or more is marked against your nature:
  the action deck shows a cracked mask after its name (tooltip and screen-reader name "Against your nature"; the icon is
  `against_nature` in scripts/icons.mjs).
- **PS-167** Nothing is added or hidden; the three-a-group cut is made before ordering, and a broken nerve's Get away
  stays first. A cautious, quiet character sees Stealth first and Talk last, marked; a daring, quick-tempered one sees
  Fight first.
- **PS-168** The Commands panel ends with a short Keys list: Esc, Enter, Tab, PageUp and PageDown and what each does
  (A5; KEYS in src/ui/play.ts, beside the handlers).

#### Input

- **PS-170** Input: the Say box, one free-text box across the reading column with Send beside it, above the action deck
  (PS-370); a line starting with / is a command (Part 1 §7).
- **PS-171** Aim, Same again and Commands sit in the action deck's top row; Sneak is a deck action; the quick-heal slot
  sits on the health strip (AD5).
- **PS-172** Pointing at (or tabbing to) someone on Who's here shows a tip with how far they are, their zone when it
  isn't yours, and whether your longest weapon in hand reaches them: "34 m away · in the yard · in reach of your
  shortbow (50 m)" or "beyond your arming sword's 1.1 m" (src/ui/play.ts whoDistance; PlayerView.player.reaches, each
  weapon in hand at its longest reach).
- **PS-173** Who's here lists everyone you perceive clearly in any zone, so a far foe in sight is there to aim at.
- **PS-174** Same again fills the box with the last order the game played out (a clarify and / commands are skipped);
  nothing is sent until Send (BG-190; src/ui/play.ts lastOrder).
- **PS-175** What the player put off last turn shows as a dimmed suggestion in the empty box ("From last turn · click it
  or Tab to use, Esc to clear", with Use it and Clear buttons). Clicking or tapping the empty box, Tab, or Use it puts
  it in the box, selected, so typing over it starts afresh; nothing is sent until Send.
- **PS-176** The next step of a queued order shows the same way with "Next step of your order · Enter plays it, Esc
  drops the rest" and Play it and Drop the rest: Enter in the empty box sends it (D-20 b).
- **PS-177** PageUp and PageDown scroll the story while the box has focus.

#### Clarifying questions

- **PS-180** When the game asks a clarifying question with no answers of its own, the people, places and things it names
  that the player's view knows can be tapped: people seen now or earlier, zones, items in hand or on the ground, matched
  with or without articles, longest first.
- **PS-181** A tap fills the box with the order it asks about, with that phrase in place of the name the order used ("I
  punch the man" and a tap on Osric Fell give "I punch Osric Fell"; with no single known name in the order, "…, I mean
  Osric Fell"), and nothing is sent until Send.
- **PS-182** The order is built from the first order of that run of questions, so taps never pile up (BF72).
- **PS-183** A question that came with its own answers has no tappable names: the answer buttons are the one way to
  answer it.
- **PS-184** The words sent after a question reach the Parser beside it (ANSWERING: the question and the first order it
  was about), and Parser rule 5 reads them as one order (src/agents/answering.ts; src/ui/play.ts clarifyPicks).
- **PS-185** The fake page's "punch the man" asks one.

#### Input keys, Aim toggle and rolls

- **PS-190** Input keys: the action box keeps focus; what it sends is trimmed, and an empty line sends nothing.
- **PS-191** Narration is paced (Play screen motion, M-10). Skipping uses a click on the story or Esc, never a key that
  types (Voyage A7, decided by Ali 07/11/2026; was OQ-24; M-12).
- **PS-192** Aim toggle: marks this turn's attack as aimed (Part 1 §7). An aimed turn's player line ends with "· aimed"
  (from the line's saved `aimed`).
- **PS-193** Rolls: while SHOW\_MECHANICS is on, each turn's dice, modifiers and damage fold under "Rolls" in that
  turn's results, wrapping.
- **PS-194** A "Show rolls" icon switch in the header (d20 icon, aria-pressed and an accent fill when on) sets the
  story's showMechanics (UI6; SD7).
- **PS-195** Every turn keeps its rolls on its story line whether the switch is on or off, and the switch only shows or
  hides them, so turning it on shows past turns' rolls too.
- **PS-196** A roll whose outcome moved by whole steps (gear beyond the holder's skill, cover, tier perks, the natural
  edge) shows the outcome before them, the steps and their sources, and the outcome after: "d100 49 → Near Miss [weapon
  +9], 8 steps down [Short of an old sword's requirement -8] → Critical Failure−−−−−−"; the same for attacks, defenses,
  contests and checks (BF70, `tiered` in src/agents/game.ts).
- **PS-197** An NPC's own gear in its view says when the gear is beyond its skill and by how many outcome steps, so it
  can choose its fists or another weapon (OwnGearView.beyondYou).

#### Hit cards

- **PS-200** Every blow that lands (grazed or better) with the player in it, the player's own and every one on the
  player, gets a card over the story as the turn lands, before the prose (after the gains moment when one opens), one at
  a time in the order the blows fell (Ali, 13/11/2026: "hitting someone is not satisfying"; BF66. Ali, 20/11/2026: "I want
  them to show in sequence for each hit", "show every hit I'm involved in, whether I'm hitting or being hit"; #1209).
- **PS-201** A card shows the outcome in large letters, who struck with what and where ("Your arming sword · the slime's
  body", "The slime's slam · your right arm"), and what the player saw it change ("The slime is Wounded")
  (LogLine.hits: the combat packet's actor, target, weapon, location and visible changes, all as words).
- **PS-202** Tiers by outcome: a graze only arrives; a full hit draws a slash across the card and pulses the word; a
  heavy hit (warning colour) or crushing hit (danger colour) adds the hit-stop on the word and a short shake of the card
  only. A blow on the player is in the danger colour (M-20).
- **PS-203** The cards come --m-trail apart, and past --m-results-cap the rest land together, so only how many blows
  landed sets the length (M-03). Each new card takes the stage and the ones before it fold to one line above it, every
  word kept. They sit over the foot of the story, where the results rows they repeat are, take no pointer events, and
  are hidden from screen readers (the results rows carry the same words, M-34).
- **PS-204** They stay until the player clicks the story once nothing moves (Ali, 20/11/2026: "they should only disappear
  when I click, so I still see them if I left the game on"); a click while anything moves only skips (M-12), which lands
  every card at once. Sending the next turn puts them away (src/ui/play.ts hitCards).
- **PS-205** The fake page's "attack", "attack light" and "attack hard" show a crushing hit on the player and then the
  player's heavy, full or crushing hit.

#### Undo, story list and out-of-character notices

- **PS-210** Undo: after /undo the undone turn's lines fold under one "Undone · turn N" row (struck through when
  opened), and the note reads "Turn N undone. Dice are not rolled back."
- **PS-211** Story list: the story is an append-only list (role=log) that announces each new turn once; the waiting line
  is a separate status.
- **PS-212** It draws the last 50 turns with a "Show earlier turns" button, and a redraw never closes an opened fold.
- **PS-213** Out-of-character notices: the scenario-planning failure marker (Agent Weaver), the rate-limit notice and
  the stop-play message (Leak prevention, validation and failure handling).
- **PS-214** A turn that lands opens at its start, the player's order and then the prose, so it can be read from the top
  while it reveals (M-10); the story stays at its foot only while a turn runs (BG-335).

#### Character page as one screen

- **PS-220** The Character page fits the window with no page scroll (Ali, 14/11/2026, CP1–CP5).
- **PS-221** The character card is on the left (who, health, level and XP, capstone choice, then the body figure across the
  card's width over a row of power, standing attack and defense and a row of the ratings), the skill trees on the right.
  The figure fills the space left on the card and shrinks with the window (its canvas scales; a click reads its on-screen
  box), so the card never scrolls.
- **PS-222** A strip of four tiles runs along the bottom, Essences, Perks, Gear and Personality, each with a one-line
  summary, each opening its section in a pop-up.
- **PS-223** There are two kinds of pop-up. Partial ones float, drag by their head and leave the page usable (Essences,
  Gear, Personality, a skill, the body, power). The full-screen one covers the page for a board too big for a panel
  (Perks), and partial pop-ups and the perk card open on top of it (CP2, CP3; src/ui/pop.ts).
- **PS-224** Both close with ✕ or Esc (the topmost first) and open and close with one short fade (exit faster) (CP2).
- **PS-225** Pop-ups form one stack: Esc, ✕ and the mouse's Back close the topmost first, and focus returns to what
  opened it. Only a full-screen pop-up blocks the page under it; partial pop-ups never do (B1).

#### Character card figures

- **PS-230** Every figure on the character card opens its parts, read from the function that makes it, so the lines add
  up. Standing attack and defense, total health and max morale join skills and Power (P2).
- **PS-231** Standing attack and defense list effectiveSkill's own line, then each gear, trade and augment line (P2).
- **PS-232** Total health lists base, Endurance, then body and prefix multipliers (P2; totalHp lists them).
- **PS-233** Max morale lists base, Resolve, achievements, opened from the morale numbers on the Play sheet, where
  morale is shown (P2; maxMorale lists them).
- **PS-234** Health and morale add what is lost and what is left under the total.
- **PS-235** Clicking a skill opens what makes up its number: true and raw, each part that adds to it (perks,
  achievements, each essence, Hollowed), its rolls' augments and trades, what it adds to, its learning range and its
  next perk milestone. It is read from trueSkill itself (it lists its parts) so the lines always add up (CP5).
- **PS-236** Clicking the body figure opens each part with its state and pool.
- **PS-237** The Gear tile lists what is held and worn, and a piece opens its stats (the Inventory's rows) with a link
  to it in the Inventory. The Personality tile opens the Personality block.
- **PS-238** Links from Play (the Essences row, the level-up line's perk link) open the page with that pop-up up
  (charFocus).

#### Perks (Character page): points and saving

- **PS-240** A perk point is spent any time on the Character page, from the Perks tile, which opens the board full
  screen. The rail shows a dot while one is unspent, and the level-up line on Play links there (Ali, 07/11/2026, K1–K4,
  S1, S7; K2).
- **PS-241** A taken perk can be undone until the next turn is played, then it is permanent (K3).
- **PS-242** Taking or undoing a perk, abandoning or pinning a quest, and picking a defense on the action deck, is saved
  at once (the saved turn is amended, no new turn), so a reload keeps it (CS12, Ali 13/11/2026).
- **PS-243** So is a command that changes the character: /essence take, pass, give, sell and remove, and /title (BF40,
  BG-208).

#### Perks (Character page): the board

- **PS-250** Every skill tree shows at once, each in its own compact box (the boxes side by side, wrapping into rows; a
  box as wide as its skills need), with no tabs and no By effect view (Ali, page comment, 14/11/2026).
- **PS-251** In a box each skill is a ladder of its seven milestones on a gold line showing true skill, the rail at the
  left of its column with the perk names beside it (a long name wraps to a second line, PS-32).
- **PS-252** The All-50/100/150 steps are dotted lines across the box. On narrow screens the ladders become horizontal
  tracks.
- **PS-253** The Story / Effect toggle for the perk write-ups sits where they are written: in the perk card's head and
  beside the Innate and Linked headings, kept per browser.
- **PS-254** Milestones not yet reached are sealed and show only their number; the page never hints at what comes next
  (K4).
- **PS-255** Tapping a taken or open milestone shows a small card beside it with the perk's text and, when open, "Take ·
  1 point". Mock-ups: https://claude.ai/artifact/TVfF7qs3WnDdDZzzM6Yjf5
- **PS-256** Every perk the Perks tile counts shows on the board. Perks on no ladder of the character's skills (a
  class perk, a Start's blessing, an achievement's, a Threadbound item's, an All-step's, Hollowed) are listed under
  Granted, beside Innate, each tagged with where it came from (BG-331; heldPerks and grantedPerks in src/ui/perks.ts).

#### Journal page

- **PS-260** People: actors seen clearly now, or whose name is known; a label until the name is known; health only from
  Wounded down (Voyage U26, U28; Ali, 07/11/2026).
- **PS-261** Under People, a Heard of group lists names heard of people never met, from PlayerView.heardOf; a name
  leaves it once the person is listed above (src/ui/pages.ts heardOfNames).
- **PS-262** Places: the current place and those above it, plus places of facts the character witnessed, folded under
  their parent place; the map draws their zones.
- **PS-263** A Timeline lists turns played since the page was opened.
- **PS-264** The Journal page is built from PlayerView, the Journal and the story log only, never the hidden store.

#### Power and skill rows (Character page)

- **PS-270** The character card shows power() as one number above Standing attack and defense: level + combat +
  non-combat parts, the measure defeat XP and the stronger-foe achievements use (Ali, 13/11/2026, D-273, FS17).
- **PS-271** Clicking it opens the details pop-up listing its parts from the same function, never a second formula
  (powerParts in src/engine/xp.ts, src/ui/power.ts).
- **PS-272** The parts are Level N (LEVEL\_RATING\_SHARE of the XP to reach it), Combat level L (the standard soldier it
  fights evenly; "placeholder" shows only in the GM view), and each non-combat group that adds something, largest first,
  with its rating and its share in words, then the total. The lines always add up to the number.
- **PS-273** Below the total a closed Ratings list shows every compound row and skill group with anything in it, in
  skill points, with its gear portion (GR7).
- **PS-274** Skill rows: each skill is one line: its icon (and any tag, flaw, used or marked sign), its true value, the
  bar, then its learning window as a bare range (a skill learned through another, Riposte via Parry, names it in the
  range's tip). The columns are fixed, with room kept for two marks whether a skill has them or not, so every bar in a
  band is the same length. The skill's name, with its SKILL\_SUB note ("sets HP"), is the row's tip and accessible
  name, never a line of its own.
- **PS-275** When the true value differs from raw, the value gets a dotted underline and the raw value shows in a small
  card beside it only on hover or keyboard focus.
- **PS-276** Under the card's power, attack and defense row, the six compound ratings (CONFIG.RATINGS, PS-273) sit in one row, each an icon
  and its whole number; the name, exact value and gear portion are the tip and accessible name (src/ui/power.ts
  ratingIcons; icons in scripts/icons.mjs).
- **PS-277** Every skill row starts with the skill's icon in place of its name, tinted its tree's colour (SKILL\_ICON in
  src/ui/itemIcons.ts; a skill shares an item or class icon where one fits). The tree bands are at least 190 px wide,
  so more trees sit in one row (five at 1600 px); a band's heading starts with its tree's icon, drawn large (TREE\_ICON
  in src/ui/itemIcons.ts), and shows its tree total as a bare number, with
  "points in this tree" as its tip, so it stays on one line.
- **PS-278** Each section tile under the Character page (Essences, Perks, Gear, Personality) shows its icon before its
  label (the tile_ picks in scripts/icons.mjs).
- **PS-279** The card's Power, Standing attack and Standing defense figures show an icon in place of their words; the
  words (with the weapon or the defense kind) are the tip and accessible name, and the number keeps the dotted underline
  that says it opens.

#### Inventory equipment

- **PS-280** The Inventory page opens with what the character has equipped, the way MMOs show it: one slot per Grip part
  (a two-grip item sits in its first grip; the other reads "(both grips)"), Body for armor, then each accessory slot,
  with empty slots dashed (Ali).
- **PS-281** Beside it, "In your pack" shows every unequipped item as an icon tile, with plain stacks of the same item
  merged and a ×N count. A container never merges, and its name button opens what it holds in place in a dashed box
  under it (nested ones too). Clicking a tile opens its side panel.
- **PS-282** A tile carries a mark only for the exception: damaged (a pool below 100) and locked (short of the
  requirement), each with its words in the tip (SD11).
- **PS-283** Each item has a filled-silhouette icon for its kind of thing (PS-300), tinted by item kind.
- **PS-284** Hovering an item, or focusing it from the keyboard, shows a card with its exact stats (the same rows as the
  side panel).
- **PS-285** Equipped items offer Unequip; weapons, shields, armor and accessories in the pack offer Equip.
- **PS-286** Each button sends the words a player would type ("I draw my…", "I put away my…", "I put on my…", "I take
  off my…") as a turn, so drawing, putting away and armor on or off all stay free. The buttons wait while a turn runs or
  after the player falls.

#### Gear compare

- **PS-290** Hovering, focusing or opening an item the player could equip, here and in the Loot pop-up, adds "Compared
  with your <what it pushes out>" (or "nothing (a free slot)") (P1).
- **PS-291** It lists each figure that changes: standing attack and defense, naming the weapon or defense when that
  changes too; the longest reach for a weapon; protection on each part the piece covers; the effective value of each
  skill its effects name; Power.
- **PS-292** Each shows its word, old → new and ▲ +n (ok colour) or ▼ −n (danger colour), or the compare reads "No
  figure changes".
- **PS-293** It equips the item on a copy of the player the way Equip would: into free grips, else in place of what is
  held of the same kind, else in place of everything held; armor in place of the pieces covering the same parts; an
  accessory into a free slot, else the first one.
- **PS-294** It reads the same functions as the Character page, never a second formula. Loot compares as if the thing
  were taken first (src/ui/compare.ts).

#### Icons

- **PS-300** Things in the world are filled silhouettes; screen controls stay line drawings (Ali, 14/11/2026, IC1–IC5).
- **PS-301** Sources are mixed: game-icons.net (CC BY 3.0) first, Fluent Emoji High Contrast (MIT) where it draws a
  subject better, and more filled sets may join.
- **PS-302** `scripts/icons.mjs` (npm run icons) copies only the picked icons into `src/ui/iconArt.ts` as SVG text: no
  network calls, no base64.
- **PS-303** Every library item, container and loot thing has an icon (items sharing a type share one), tinted by item
  kind; the loot pop-up shows each thing's icon.
- **PS-304** Each class has one, shown on the class tree, the Character page's Class line and the creation screen's
  Starts (a Start shows its class's; The Blessed shows a holy symbol).
- **PS-305** The map keeps its own glyphs (silhouettes blur at 12 px).
- **PS-306** The credit line sits at the foot of the GM page and the licences in `src/ui/assets/icons-LICENSE.txt`.
- **PS-307** Scales past 100: game-icons.net has supernatural subjects (rune blades, auras, creatures) for gear and
  beings above the human range.

#### Map, way rows and coin row

- **PS-310** Map: the full-screen Map and the minimap follow docs/spec/part-2-turn-engine/map.md.
- **PS-311** Way rows: a turn where the player tried, opened, locked, barred or picked a barrier adds Way rows under the
  story ("Door to kitchen: locked"); breaking one waits on the walls thread (LogLine.ways).
- **PS-312** Coin row: a turn that changed the player's coin adds a Coin row under the story with the difference in coin
  words, gold when gained (+1 silver and 5 copper) and red when lost (−12 copper), so a theft or a price never passes
  unseen (LogLine.coin, in copper).
- **PS-313** Coin is left out of the gear rows.
- **PS-314** Live, its amount flares in its colour and pulses once (M-20 strength), and the sheet's coin value swaps
  with a floating difference and then pulses.

#### Side sheet health, colours and depth

- **PS-320** Side sheet health: the health bar marks the health-track thresholds; its level is the bar's tip and
  accessible name ("Health: Unhurt"), never a word beside it (SD5).
- **PS-321** Clicking it opens each body part with its pool and state (Ali, 07/11/2026).
- **PS-322** Any part that is not Healthy shows as a chip under the bar ("Left leg crippled") in its state's colour, and
  the body figure opens by itself on a turn that changes a part.
- **PS-323** A "Held / worn" line names the gear in use.
- **PS-324** Colours and depth: every colour comes from a named token in `:root` (health levels run ok → warn → danger →
  grey; time of day uses c4, scenario-mark, c7 and accent; perk gold is --perk-20, which takes scenario-mark's colour, PS-460).
- **PS-325** No glows and no drop shadows except the toast shadow; tests/unit/styles-tokens.test.ts enforces both.

#### Place and scenario breaks, scenario ending moment

- **PS-330** When a turn takes the player to a new place, a quiet rule named for it ("River path · the Riverside") sits
  between the player's line and the prose. A new scenario in the same place gets the rule without a name.
- **PS-331** It reads the place and scenario saved on each narration line (`place`, `scenario`), so breaks survive a
  reload; undone turns are skipped when comparing.
- **PS-332** When a turn ends a scenario, the rule between scenarios carries the ending's name in its middle, in that
  ending's colour (resolved ok, escaped accent, left muted, lost danger, interrupted scenario-mark, worn out faint,
  broken off warn), with the place name after it when the place changed (SD1).
- **PS-333** While the turn runs nothing on the page says that a scenario ended: no rule draws above the waiting line,
  and the rail's perk-point badge keeps the count it had until the turn lands, so neither gives the ending or a level-up
  away (BF64, Ali).
- **PS-334** When the line arrives, a scenario that gave something opens its gains moment, which names the ending. That
  turn's results in the story leave out the Skills and XP rows, which the moment shows in full (Ali).
- **PS-335** Otherwise the turn's own rule draws with the ending's name, the closing sentence fades in above it in muted
  italic story type, and the opening follows below.
- **PS-336** Esc or a click on the story skips the motion (M-12). It reads scenarioEnd from the narration line, so it
  shows the same after a reload.

#### Morale bar

- **PS-340** The status strip and the full sheet show the player's morale under health, in its own colour (c5): the bar
  alone in the strip; morale left of max and the track's thresholds as ticks in the full sheet (MB11, MB16).
- **PS-341** The level is the bar's tip and accessible name ("Morale: Calm"), never a word beside it (SD5).
- **PS-342** Who's here shows another actor's morale level only from Afraid down, as PlayerView gives it.

#### Morale stakes and a broken nerve

- **PS-350** From CONFIG.MORALE\_HINT\_FROM (Terrified) down, the sheet's Morale label carries a tip that starts with
  the level, with the level's roll penalty and what Broken would stop ("−20% on every roll. One more fright and your
  nerve breaks: you won't be able to attack or go toward a foe."). It shows on hover or keyboard focus, with a dotted
  underline as the cue, never a line of its own (MB12 on screen; NB2).
- **PS-351** At Broken the tip reads "You can't attack or go toward a foe until the fight is behind you; you can still
  back away or run" (at Cowering: "You can't move or attack until the fight is behind you: you cower where you stand")
  (BF79).
- **PS-352** It also says how that comes (no one fighting you for ENGAGEMENT\_END\_TURNS turns, your yield taken, the
  scenario's end, or a rest: the composure rows that lift the bar off 100% lost) and what still works (talk, beg, yield,
  give, hide, use an item such as a bandage, pick something up, open a door or container within reach) (BF37).
- **PS-353** The Stamina label carries its level and roll penalty the same way (Tired and worse).

#### A broken nerve: orders and the deck

- **PS-360** The turn the nerve breaks adds a violet Nerve broken card under the story with the same words
  (LogLine.nerveBroke).
- **PS-361** An order of only what Broken blocks (an attack, a grab, a filch, a perk move, a walk toward a foe, with no
  words; at Cowering any walk) is turned away before the turn: the game answers like a clarify, nothing happens and no
  time passes (NB5, BF37, BF79; agents/game.ts NERVE\_REFUSED, NERVE\_COWERING\_REFUSED).
- **PS-362** With words or an allowed action beside it, the turn goes ahead and the engine takes the blocked part away
  (log broken\_cowers; a walk turned back where it runs logs nerve\_turned\_back).
- **PS-363** That, or an attack the engine refuses because the nerve broke during that same turn, adds a Nerve row
  (LogLine.nerveRefused).
- **PS-364** While Broken, the action deck's Fight and Move groups give way to "Your nerve is broken": Yield, Sneak, and
  Go to (only the ways that lead away from your foes), Back away from, Jump down (away) and a door within reach. At
  Cowering only Yield and Sneak (BF79).
- **PS-365** The deck playtest's code scorer picks Yield first while Broken (BF37); nothing is suggested on Play (PS-390).

#### The action deck and minimap

- **PS-370** Under the Say box, the action deck lists every action the code allows right now, in groups (Fight, Talk, Move, Stealth, Use,
  Perks), always open, one entry per action (AD1–AD16; src/ui/deck.ts, built from PlayerView only).
- **PS-371** Housekeeping on your own gear (Put away, Armor on or off, Set down) always comes last in its group,
  whatever the character leans to (Ali, 20/11/2026; deck.ts LAST).
- **PS-372** Clicking one asks only what it still needs in a small pop-up (whom, from the Who's here list; with Aim on,
  which body part; with what), then plays the turn at once.
- **PS-373** Code builds the Intent and GameApi.act sends it through the same legality checks as a Parser order
  (acceptIntent), with no Parser call (AD7).
- **PS-374** Persuade, Lie to, Threaten, Haggle and Demand surrender wait for your words in the Say box.

#### Limited moves and entry tips

- **PS-380** A move with a limit (once per engagement, a cooldown: Steady yourself, the perk moves, Rest) stays in its
  group while it can't be used, dimmed and not clickable, and shows its state by a mark, not words (A3, A3b).
- **PS-381** Waiting is a ring before its name filled by the share of the wait gone, stepping when a turn lands; used
  this fight is a hollow circle with a slash; ready again is one pulse (A3, A3b).
- **PS-382** The words ("Ready in 20 s", "Used this fight") are only in its tip and for screen readers, and such a move
  is never suggested or picked by the deck playtest.
- **PS-383** Every entry is taken to be your action, so no note says so. Only a free one (beside your action, not
  instead of it: gear ops, a warning shout, free perk moves) carries a mark, a lightning bolt after its name
  (`free_action` in scripts/icons.mjs). Which entries are free is the engine's rule, asked of the order each entry plays
  (src/engine/beside.ts ridesBeside, SX8), never set by hand.
- **PS-384** Pointing at an entry tells how long it takes, from its Action times row: "Takes 3 s", "Each blow takes 4
  s", "Takes the turn" with no row of its own, "Takes as long as the way there" for a move (resolve orderCost, for the
  first pick of each step; deck.ts timeTip).
- **PS-385** An entry is one line: what used to be its sub-line follows the time in the same tip ("Takes 3 s · hold them
  back unhurt") (SD6).
- **PS-386** Other actions the code doesn't allow stay hidden.

#### Suggestions, the Say box and Aim

- **PS-390** No suggested action shows on Play (HS7). The code scorer only picks moves for the deck playtest
  (src/ui/suggest.ts, CONFIG.SUGGEST levers).
- **PS-391** No keys pick actions (AD10).
- **PS-392** The Say box keeps free text through the Parser and / commands.
- **PS-393** Aim is on/off.
- **PS-394** The flavour-only attack stance (careful, normal, reckless) was removed (Ali, 18/11/2026).

#### Defense row

- **PS-400** Beside Aim, Dodge, Parry and Block pick the player's standing defense, free and with no turn. Until then
  only the creation default was ever used (Ali, 18/11/2026; GameApi.setDefense).
- **PS-401** Each shows its effective skill, the figure the defense roll uses (defenseValue in src/ruleset/gear.ts).
- **PS-402** One that can't be used now (Block without a shield in hand, Parry without a melee weapon or Open-Hand
  Guard) is Locked: a padlock after its name whose tip and accessible name say what it lacks ("Needs a shield in hand")
  (SD14; canDefend).
- **PS-403** A chosen defense that gear has since made unusable stays chosen with a dashed ring, and a note beside the
  row names the fallback ("Block needs a shield in hand, so you dodge for now") (usableDefense).
- **PS-404** The Character page's standing defense shows the defense actually used against a melee blow.

#### Right column

- **PS-410** The right column holds the folded health strip (a click opens the full condition), the minimap (map.md,
  Minimap), Who's here as rows (foes first, pins, scrolling; a click lists what you can do to or with them) and the
  short sheet (held, coin, level; skills on the Character page) (AD1–AD16).

#### After /yield

- **PS-420** While the player's yield stands, the status strip and the full sheet show a "You yielded" box under morale
  (warn tint): who took it, who is still deciding and who fights on (danger), by the names the player knows them by. It
  goes when the scenario ends (MB40–MB43).

#### Learning window

- **PS-430** Every skill bar, on the Character page and in the full sheet, draws the skill's learning window (raw −
  MARK_WINDOW to max(raw, true) + MARK_WINDOW) as an outlined range on the same 0–100 scale (SP2).
- **PS-431** The Character page also prints it as numbers ("20–40") beside the true skill.
- **PS-432** An augmenting skill (Riposte, Blade Dance, Shrewd Dealing) learns only on the rolls it adds to, at the
  roll's level, so its bar shows that roll's window, dashed, and the numbers read "via Parry 50–70" (AU1;
  augmentWindow).
- **PS-433** The play page shows only the player's own window, never the foe's skill.

#### Agent pop-up look

- **PS-440** "Watch an agent play" is an icon switch in the header beside Show rolls (agent icon; aria-pressed and an
  accent fill when open, its name in the tip) (SD7).
- **PS-441** Open, it is a large floating pop-up over the play screen, up to 880 px wide, its settings in as many
  columns as fit (Ali, 14/11/2026: "this whole thing should be a pop-up", then "make it a partial pop-up (large)").
- **PS-442** It is non-modal so the story stays in view. It opens first at the top right under the header and is dragged
  by its head to anywhere (kept there while the page lives); it stays open beside any details pop-up.
- **PS-443** Inside: which story; Mode, Playstyle, Pace, Style, Speaker and Speed two to a row, each list under its
  name; standing orders when guided; One turn and Play (main button); then the agent's spoken line in story type,
  labelled Agent, or the Your call card, and the status.
- **PS-444** ✕ in its head closes it and pauses the agent.

#### Fit the screen and divider lines

- **PS-450** The Play screen always fills the window, with no empty spaces (Ali).
- **PS-451** The right column is shown at every width; nothing in it folds away (AD1–AD16).
- **PS-452** The open sheet is a fixed 300 px (--sheet-w), as narrow as its skill rows, and every block on it is kept
  that compact: a small body figure with its key beside it, labels that don't wrap.
- **PS-453** The sheet shows no scrollbar: the mouse wheel scrolls it, and so does dragging it with the mouse (a drag
  doesn't count as a click).
- **PS-454** The story column fills all the space beside it, with no reading-width cap, and its type grows with the
  screen (clamp(16px, 0.45vw + 10px, 20px)) so wide lines stay readable. Speech lines are 16px.
- **PS-455** Divider lines: the gap under the story and the sheet sits inside each column, so the sheet's divider runs
  to the foot of the screen.

#### Perk series colours, linked perks and All-XXX counts

- **PS-460** The 20/60/100/140 milestones (perks that change what you can do) are gold and the 40/80/120 milestones
  (number boosts) are violet (tokens --perk-20 and --perk-40), the same wherever a perk shows: the ladder and track
  diamonds, perk names beside them, the perk card, and the "New perk unlocked" card on Play.
- **PS-461** Each diamond's tip names its series ("Breakthrough 60 · <perk>", "Refinement 40"): Breakthrough for 20, 60,
  100, 140 and Refinement for 40, 80, 120. There is no key (SD4).
- **PS-462** Sealed milestones stay neutral so nothing hints at what comes next (K4).
- **PS-463** A perk granted by a perk link (PERK_LINKS, OwnedPerk source 'link') shows in a Linked block under the Perks
  heading, beside Innate: its name, a Linked tag, the perks it came from with each one's skill and milestone ("From
  Dread Presence (Intimidation 100) + Overwhelm (Resolve 100)"), and its Story or Effect text (PS-253).
- **PS-464** A merge (for later) shows the tag Merged and its set struck through as asleep while the merge holds (LR5).
- **PS-465** The card of an owned perk that is part of a link says so ("Linked with Overwhelm: together they grant
  Crushing Presence.").
- **PS-466** A link not yet earned stays unseen, so the page never hints at what comes next (K4).
- **PS-467** Each All-50/100/150 line reads "n of need" once n is above 0, where need is the tree's rating requirement,
  the same rule the mastery achievements use; an inferior tree reads "never" (SD3; CONFIG.ALL_STEP_SKILLS via
  allStepNeed).

#### Keyboard order, "You fell" screen and GM debug view toggle

- **PS-470** Tab runs input, tool row, side sheet, then the rail (the rail is last in the page and placed in the first
  column by CSS). Rail names show in tips, so none has to fit the rail.
- **PS-471** The "You fell" screen shows when a lethal fight incapacitates the player and no foe spared them, offering
  /undo or reset (D-54, D-239).
- **PS-472** Undo goes back to the turn the foes decide, so the next turn asks them again.
- **PS-473** GM debug view toggle (Leak prevention, validation and failure handling).

#### Republish button

- **PS-480** A cloud-upload icon in the rail's foot, above the GM switch, named "Republish from main" in its tip (Ali,
  19/11/2026, hub page "Repo home set-up", RH13 and RH19 c).
- **PS-481** It opens a small pop-up with one main button, Republish from main, which starts the owner's saved task
  through the Claude Code Remote connector (fire_trigger, once per press, never retried).
- **PS-482** The task builds the latest `main`, runs the smoke tests and republishes the game page and the library
  viewer in a new project thread, which says when both are up.
- **PS-483** The pop-up shows Starting… while the call runs, then a plain result: Started, or why it didn't start and
  what to do (reconnect or add the connector, allow it for the page; no answer says it may have started).
- **PS-484** The task's id sits in the page's database (ops/republish), never in the code.
- **PS-485** The button shows only where the page reaches the connector's fire_trigger and that document names a task,
  so a viewer from another account never sees it (src/ui/republish.ts). It touches no save.

#### Open discrepancies

Where passages of the old single-paragraph rules disagree, both are kept as written above and the point is marked here.
Until the owner rules, the code decides what the game does (`AGENTS.md`, Order of authority). The other points from the
split were settled on 20/11/2026 where a later recorded decision and the code agreed (PR "Spec: settle play-screen
discrepancies").

- **PS-452 and the code, right column width (D-414):** "a fixed 300 px (--sheet-w), as narrow as its skill rows" (PS-452)
  against the code's 420px `--panel-w` (styles.css), set when the column took the minimap and Who's here (AD1–AD16).
- **PS-160, the Commands panel height (D-415):** "at most 40% of the story's height" (PS-160); the code sets no such cap.
- **PS-453, dragging the sheet (D-416):** "so does dragging it with the mouse" (PS-453); since the right column took the
  minimap (AD1–AD16) nothing wires the drag, and a drag on the minimap pans it.
