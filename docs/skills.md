# Skills

Every skill the project uses: what it is for, where its master copy lives, and its licence. A skill is a folder
with a `SKILL.md` that an agent reads when its description fits the task. Which rules call for which skill is in
`docs/instructions.md`.

## The owner's skills (master copy in this repo)

Each is in `.agents/skills/<name>/SKILL.md`, in full. Change one only through a PR here, on the owner's word
(`AGENTS.md` rule 6). Copies elsewhere, such as in the owner's Claude account, follow the repo.

- **root-cause-first**: for any bug, error, failing test or "it is not working" report, before proposing a fix. Find
  the earliest point where things go wrong, list every plausible cause before settling on one, and search for
  siblings of the cause. Its method draws on `systematic-debugging` from
  obra/superpowers (MIT); no text is copied.
- **show-dont-tell-ui**: for any UI change. Mark only the exception with an icon, put words in tooltips and
  aria-labels, and cut hints the styling already gives. Based on `minimal-ui-design` from castle-x/skills-x (MIT);
  its licence is kept beside it as `LICENSE-source.txt`.
- **rpg-map**: the working method for the game's map, with its required render-and-check pass. The map's rules
  (layout, labels, tokens, door symbols, fog of what the player knows) are `docs/spec/part-2-turn-engine/map.md`. The
  rules serve the map: see `docs/memory/ui-decisions.md`.
- **game-feel**: screen shake, hit-stop, squash, bar drains and feedback sized by how rare an event is, for web UIs
  without an animation library. Adapted from gamedev-skills/awesome-gamedev-agent-skills (Apache-2.0); its licence
  and notice are kept beside it.
- **animation-principles**: the twelve classic animation principles applied to web and game UI, with plain CSS
  examples. Condensed from dylantarre/animation-principles (MIT); licence kept beside it.
- **motion-sequencing**: timelines, staggers, overwrite and cleanup, FLIP and reduced motion without a library.
  Borrows principles from greensock/gsap-skills (MIT); licence kept beside it.
- **design-spatial**: for any UI change. Render the built page, run its layout audit (`scripts/layout-audit.js`:
  overflow, collisions, contrast, tap size as gates; balance, alignment and spacing as signals only), look at the
  annotated screenshot, and measure what the change is about (an icon against what it labels, the gap to a
  neighbour). From connerkward/ckw-design-skill (MIT); the source's text and script are kept whole, with a part for
  this project on top, and its licence beside it.

The three motion skills are general craft. The game's own motion rules are in `docs/build-spec.md`, "### Play screen
motion", and win over them.

## Third-party skills (pointed to, not copied)

Fetch these from their master, at the latest version. Versions and links were checked on 19/11/2026 through each
repo's raw files. If you cannot fetch one, say in your report that it was not used.

- **ponytail**. The smallest complete change.
  - Master: https://github.com/DietrichGebert/ponytail (`skills/ponytail/SKILL.md`). Licence: MIT. The owner's copy
    replaces its testing line: look for an existing test first, add one only for a silent break nothing covers.
  - Core rules: solve the whole task with the least new code, taking the first option that fully works (not needed
    at all, already in the codebase, standard library, installed dependency, one clear line, else the minimum).
    Finish every part the change touches: callers, tests, fixtures. Never cut validation at trust boundaries, error
    handling that prevents data loss, security or accessibility. Here, "no config" gives way to the balancing rule,
    and tests follow `docs/instructions.md` section 8.
- **interface-design**. The primary lens for product UI: structure, hierarchy, density, tokens, states.
  - Master: https://github.com/Dammyjay93/interface-design. Licence: MIT.
  - Core rules: decide every choice instead of taking the default; state who the screen is for and what they must
    do before touching code; name tokens for the product's world; check the result against "would any similar
    prompt have produced this?".
- **impeccable**. Audit and critique of a frontend: anti-patterns, accessibility, theming, spacing, type, motion.
  - Master: https://github.com/pbakaus/impeccable. Licence: Apache 2.0. Version checked: 4.10.0 upstream; the
    owner's account copy is 4.8.1.
  - Core rules: read the project's `PRODUCT.md` first; run the audit and critique passes and grade each finding P0
    to P3; fix by the named discipline (layout, typeset, colorize, harden and so on). Its scripts need Node and
    download an engine on first run.
- **frontend-design**. Aesthetic direction.
  - Master: https://github.com/anthropics/skills (`skills/frontend-design`). Licence: Apache 2.0.
  - Core rules: commit to one deliberate visual point of view before building; make type, colour and layout choices
    that serve it; avoid the look of a templated default.
- **ui-ux-pro-max**. A searchable reference of styles, palettes, font pairings, UX guidelines and chart types.
  - Master: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill. Licence: MIT.
  - Core rules: search before designing (`python3 <skill folder>/scripts/search.py "<query>" --domain <domain>`),
    and cite what the search returned in the report. Needs Python 3.

## One provider only

- **rpg-motion**: exists only in the owner's Claude account, as a pointer to the spec's "### Play screen motion".
  Other agents read that section directly.
- Skills built into a provider's app (for documents, spreadsheets, browsing and so on) are not listed. Nothing in
  the working rules depends on them.

## Where tools look for skills

Read from each tool's documentation on 19/11/2026. Only the Claude row has been tested in this project.

- Reads `.agents/skills/` in the repo: Codex, Cursor, Gemini CLI, GitHub Copilot. Untested here.
- Claude Code reads `.claude/skills/` and the account's skills, not `.agents/skills/`. In this repo
  `.claude/skills/<name>` is a link to `.agents/skills/<name>`, so there is still one copy of each skill. Written
  from Claude's documentation on 19/11/2026: a cloud session or Claude Code on a computer loads the links; a thread
  inside a claude.ai project does not, and loads skills only from the account.
- To give a Claude account its own copies, run `npm run skills-zip`. It writes one zip per skill to `dist/skills/`,
  ready to upload under Customize, Skills. Third-party skills are uploaded from their masters above.
- A new skill in `.agents/skills/` gets its link in `.claude/skills/` in the same PR
  (`ln -s ../../.agents/skills/<name> .claude/skills/<name>`).
- Tested: an agent opens a `SKILL.md` from this list when the rules call for it.
