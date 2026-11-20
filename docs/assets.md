# Assets

Large and binary files: where each lives, its licence, and who can fetch it. Nothing whose licence forbids
redistribution is ever committed to this public repo.

## In the repo

- **Body figure models**, `assets/figures/models/*.glb`, baked by `npm run figures` into `assets/figures/*.json`.
  Each model is CC0 or CC BY 4.0. Credits and links: `assets/figures/models/LICENSE.txt`. CC BY models are credited
  wherever they are shown.
- **Sound effects**, `src/ui/assets/sfx/*.mp3`. Kenney packs, CC0. Details: `src/ui/assets/sfx/LICENSE.txt`.
- **Icons**, generated into `src/ui/iconArt.ts` by `npm run icons`. game-icons.net (CC BY 3.0) and Fluent Emoji High
  Contrast (MIT). Details: `src/ui/assets/icons-LICENSE.txt`.
- **Fonts**, `src/ui/assets/*.woff2`. Literata (SIL OFL, `src/ui/assets/Literata-OFL.txt`) for story text, and the UI
  face named in the spec's "### Play screen". No licence note for the UI face is recorded in the repo: ask the
  owner before reusing it anywhere else.
- **Background image**, `src/ui/assets/night-sky.webp`. No licence note is recorded for it either.
- **Licences of adapted skills**, beside each skill in `.agents/skills/`.

The Questions hub page uses the same font and image files, published with the page under `kit/`.

## Not in the repo

Only Claude threads on the owner's account can reach these. They sit in the Claude project's shared folder or on
the private game page.

- **Licensed sound sources** (broadcast and studio sound libraries). Their licences allow use in the owner's private
  game and forbid redistribution. They are uploaded only to the private game page. Never commit them.
- **Playtest runs**: the full transcripts, stores and error logs of every run, kept for bug checks. Machine output,
  large, and of no use to a build. The parts the tests replay are in the repo (above).
- **Review pages and their builders**: the sources of the owner's question and review pages.
- **Study notes** on published fiction used as design reference. Left out because they quote other people's work.
- **Recorded motion clips** made while checking animations.
- **Stand-in data for the hub's regression checks** (`tools/questions-hub/README.md`).

Two of these also have a copy that does not depend on that shared folder: the builders of the question pages and
the study notes are in the owner's private companion repo, `text-rpg-private`, next to a set-up kit for a Claude
account that is new to the project. Only agents the owner has given access can open it. It holds text only, and
nothing in it overrides the rules here.

If a task needs one of these and you cannot reach it, say so in the PR. Do not recreate it from memory.
