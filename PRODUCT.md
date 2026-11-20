# Product

<!-- impeccable:product-schema 1 -->

Product context for design work (read by the impeccable design skill). Drafted from docs/build-spec.md and the project rules. Anything marked [Inferred] is a reading of those sources that Ali has not confirmed. Where this file and the build spec differ, the build spec wins; this file only points at it.

## Platform

web

## Users

One player: Ali, the game's designer. The game is for personal use only, published only as a Claude artifact, with no public release. He plays on PC, signed in to the same Claude account on every PC, and also uses the game to test and tune his own rules, so he reads rolls, numbers and build details closely, not just the story.

## Product Purpose

A text RPG where code owns every number and fact and Claude agents only read intent, voice characters, plan scenarios and narrate. The player builds a character (skills, perks, essences, gear, classes) and plays it through a living world with a story.

It is a build-crafting game first and a story second: the build screens (creation, Character page, perks, essences, gear) lead, and the story serves the build.

Success: a build reads and compares at a glance, every figure is trustworthy and traceable to its source, and the story never knows or hints at anything the character could not know.

## Positioning

- One set of rules for everyone: the player and every NPC go through the same roll code.
- Agents never see hidden state; enemies commit to orders without seeing the player's action.
- Real-world numbers for people who are supernatural by nature: skill 50 is the average real professional, 75 the real-world peak, 100 the limit of a human body, and the scale keeps climbing past it.
- Long-term goal: a living world with a story, where personalities shift with actions.

## Operating Context

- Runs as one self-contained page in a Claude artifact, PC only (no phone layout), using only the game's own Claude and database capabilities; no other network calls.
- The story lives in the artifact's database, so any PC on the same account continues it; browser storage holds only per-PC conveniences such as panel layout.
- The play screen design rules live in docs/build-spec.md, section "### Play screen", with motion in "### Play screen motion". The approved creation screen layout is linked from that section.
- Look changes are shown to Ali as 2 to 4 named options drawn over the real page, one recommended, and he picks one. Questions for Ali go through the channel AGENTS.md rule 10 and the provider file name (for Claude: one question on a decision card, two or more on the Questions hub), never loose in a chat message.

## Capabilities and Constraints

- No model computes a roll, sets health, adds an item or decides success; the screen only shows what code has resolved.
- Timing and on-screen changes never reveal which mode, agents or secrets are involved, and nothing on the play screen changes while a turn runs (motion rules M-01 to M-74).
- Every balancing number lives in config or a library table, never in UI or logic code.
- Every distance uses real-life metres.
- No invented mechanics: a gap is reported as a numbered question with a recommendation.
- Terms the screens use: tiers (Critical Failure, Failure, Near Miss, Success, Great Success, Critical Success), perks named by milestone ("20 perk", "40 perk"), quirks for negative perks, XP called Thread in the lore, essences, scars, achievements.
- Open: the game's look (UI font, palette, main button) is being chosen in the look study; cards and pop-ups (HS7) are open.

## Brand Commitments

- Story voice: close on the hero's shoulder, short lines, dry and never solemn; the supernatural is told only through results. Full tone rules: docs/build-spec.md "### World, tone and the power ladder".
- Interface words: plain words, one name per thing, no internal ids. Colour always comes with a word. Real-world dates read DD/MM/YYYY; in-world time reads "Day 2 · Morning".
- Setting look, not lore: an anime-style isekai fantasy world with game-like rules that only looks about 1400 (plate, crossbows, walled towns, guilds and coin).
- No decision stamps (names and dates of rulings) in code, comments or game text.

## Evidence on Hand

- Content: the game library (skills, perks, essences, items, classes, achievements, body types) in src/library, viewable in the library viewer artifact.
- Icons: game-icons.net (CC BY 3.0) and Fluent Emoji High Contrast (MIT), copied in by scripts/icons.mjs; 3D body figures built by scripts/figures.mjs.
- Story font: Literata (SIL OFL), embedded.
- Real play logs from playtests and in-game bug reports.
- None of the following exist and none may be made up: testimonials, players other than Ali, reviews, pricing, store pages.

## Product Principles

1. Build first: lead with how a build reads and compares; the story comes second.
2. Code decides, the screen shows: every figure on screen comes from one function in code, never a second formula in the UI.
3. Show only what the character knows: no screen, timing or animation leaks hidden state.
4. Trustworthy numbers: estimates start with ≈ and show their source; rolls and their sources are one click away.
5. Ali decides: look changes and undecided rules go to him as options with a recommendation; nothing is guessed into the design.

## Accessibility & Inclusion

- Readability first: Ali rejected looks for poor readability, so text size and contrast are judged on the real pixels, not on contrast ratios alone. [Inferred from the look study; the exact minimum text size is still an open question there.]
- Reduced motion, or the Motion switch beside Show rolls, means nothing moves.
- Full keyboard use: a set Tab order, tips on keyboard focus as well as hover, skipping narration with a click on the story or Esc, never a typing key.
- Colour is never the only signal: it always comes with a word.
