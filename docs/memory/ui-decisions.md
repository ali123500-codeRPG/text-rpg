# UI decisions

Kind: decision. Choices about the game's screens that are not obvious from the code. Layout, look and motion rules
are in `docs/build-spec.md` ("### Play screen", "### Play screen motion").

- **Build screens lead** (17/11/2026). The game is build-crafting first and story second, so creation, the Character
  page, perks, essences and gear lead a design. Reason: a review had framed the play screen around reading the
  story, and that is not what the game is for.
- **Details open in a small movable panel** (08/11/2026). Clicking an entry shows its full details in a floating
  panel that can be dragged and closed, never a page jump or a blocking dialog. Reason: details without losing your
  place. First said about the library viewer, as a philosophy for everywhere; check with the owner before replacing
  a play screen's existing side panel.
- **Searching the library viewer opens every fold** (10/11/2026). While the search box has text, folded sections
  show unfolded and fold clicks are ignored; clearing the search restores each fold as it was (body class
  `lv-searching`). Reason: find things in folded sections without losing the folds that were set.
- **Everything in the library viewer comes from code** (08/11/2026). Numbers shown call the same functions the rules
  use. Colour coding uses the filter buttons as its key.
- **The look is the game's own** (09/11/2026, widened 17/11/2026). A design system borrowed from another project was
  only a starting point and no longer applies anywhere. Where the design skills call for something else, follow the
  skills. The category colours in `src/ui/styles.css` stay as named game tokens.
- **The map rules serve the map** (14/11/2026). The `rpg-map` skill was written to rescue a broken first map. When a
  request from the owner clashes with one of its rules, build the request, name the clash once, and update the
  rule. Reason: the rules are means, not ends.
- **An icon replaces its name, never sits beside it** (20/11/2026). Once a thing has an icon (a skill, a skill tree, a
  rating, a Character page section, a card figure), the icon stands in place of its name, and the name moves to the
  icon's tip and accessible name. Reason: the owner asked why they had to read the same thing twice; `show-dont-tell-ui`
  already says so. An icon shared by several things (a class falls back to the Commoner's) keeps its name shown.
- Dates for rules stated in `docs/instructions.md` section 7: play and creation are PC only (12/11/2026); the
  library viewer also works on phones (15/11/2026); screens fill the window (10/11/2026).
