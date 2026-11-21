# Assets

Large and binary files: where each lives, its licence, and who can fetch it. Nothing whose licence forbids
redistribution is ever committed to this public repo.

## In the repo

- **Body figure models**, `assets/figures/models/*.glb`, baked by `npm run figures` into `assets/figures/*.json`.
  Each model is CC0 or CC BY 4.0. Credits and links: `assets/figures/models/LICENSE.txt`. CC BY models are credited
  wherever they are shown.
- **Sound effects**, `src/ui/assets/sfx/*.mp3`. Kenney packs, CC0. Details: `src/ui/assets/sfx/LICENSE.txt`.
- **Icons**, generated into `src/ui/iconArt.ts` by `npm run icons`. game-icons.net (CC BY 3.0), Fluent Emoji High
  Contrast (MIT), Material Symbols (Apache-2.0) and Health Icons (MIT). Details: `src/ui/assets/icons-LICENSE.txt`.
- **Fonts**, `src/ui/assets/*.woff2`. Literata (SIL OFL, `src/ui/assets/Literata-OFL.txt`) for story text, and the UI
  face named in the spec's "### Play screen". No licence note for the UI face is recorded in the repo: ask the
  owner before reusing it anywhere else.
- **Backdrops**, `src/ui/assets/backdrops/*.webp`, the play screen's pictures by place (PS-486; the table that picks
  them is `src/library/backdrops.ts`). Every one is a painting or print in the public domain (each painter died more
  than a century ago), taken from Wikimedia Commons, where each file page also records it as public domain or CC0.
  Cut to 1280 px or less and saved as WebP; a few busy ones are softened slightly to stay near 160 KB, since the
  screen shows them under a dark veil.
  - `cellar-piranesi-shell-arch.webp`: Giovanni Battista Piranesi, *The Arch with a Shell Ornament, Carceri d'Invenzione plate XI* (1761). https://commons.wikimedia.org/wiki/File:Giovanni_Battista_Piranesi_-_Le_Carceri_d'Invenzione_-_Second_Edition_-_1761_-_11_-_The_Arch_with_a_Shell_Ornament.jpg
  - `cellar-wright-cavern.webp`: Joseph Wright of Derby, *Cavern near Naples* (1774). https://commons.wikimedia.org/wiki/File:Wright_of_Derby,_Cavern,_near_Naples.JPG
  - `corridor-dewitte-oude-kerk.webp`: Emanuel de Witte, *The Interior of the Oude Kerk, Amsterdam* (c. 1660). https://commons.wikimedia.org/wiki/File:Emanuel_de_Witte,_The_Interior_of_the_Oude_Kerk,_Amsterdam,_c._1660,_NGA_130808.jpg
  - `field-bruegel-harvesters.webp`: Pieter Bruegel the Elder, *The Harvesters* (1565). https://commons.wikimedia.org/wiki/File:Pieter_Bruegel_the_Elder-_The_Harvesters_-_Google_Art_Project.jpg
  - `field-constable-hay-wain.webp`: John Constable, *The Hay Wain* (1821). https://commons.wikimedia.org/wiki/File:John_Constable_-_The_Hay_Wain_(1821).jpg
  - `field-friedrich-lonely-tree.webp`: Caspar David Friedrich, *The Lonely Tree* (1822). https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Der_einsame_Baum_-_Google_Art_Project.jpg
  - `gate-perov-last-tavern.webp`: Vasily Perov, *The Last Tavern at the Town Gate* (1868). https://commons.wikimedia.org/wiki/File:Last_Tavern_at_Town_Gate_(Perov,_1868)_-_Google_Art_Project.jpg
  - `gate-sandby-west-gate.webp`: Paul Sandby, *An Unfinished View of the West Gate, Canterbury* (c. 1780s). https://commons.wikimedia.org/wiki/File:Paul_Sandby_-_An_Unfinished_View_of_the_West_Gate,_Canterbury_-_Google_Art_Project.jpg
  - `gate-zais-vaulted-ruins.webp`: Giuseppe Zais, *Ruins of a Vaulted Building* (18th century). https://commons.wikimedia.org/wiki/File:(Venice)_Ruins_of_Vaulted_Building_by_Giuseppe_Zais_-_Gallerie_Accademia.jpg
  - `moor-danby-heath-sunset.webp`: Francis Danby, *Hampstead Heath, Sunset* (c. 1845). https://commons.wikimedia.org/wiki/File:Francis_Danby_-_Hampstead_Heath,_Sunset_-_Google_Art_Project.jpg
  - `moor-friedrich-dolmen-snow.webp`: Caspar David Friedrich, *Dolmen in the Snow* (1807). https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_H%C3%BCnengrab_im_Schnee.jpg
  - `night-vanderneer-moonlit-bridge.webp`: Aert van der Neer, *Moonlit Landscape with Bridge* (c. 1648–50). https://commons.wikimedia.org/wiki/File:Aert_van_der_Neer,_Moonlit_Landscape_with_Bridge,_probably_1648-1650,_NGA_71369.jpg
  - `road-constable-wooded-slope.webp`: John Constable, *Wooded Slope with a Receding Road* (c. 1802). https://commons.wikimedia.org/wiki/File:John_Constable_-_Wooded_Slope_with_a_Receding_Road_-_Google_Art_Project.jpg
  - `room-teniers-country-pub.webp`: David Teniers the Younger, *Country Pub* (c. 1660). https://commons.wikimedia.org/wiki/File:David_Teniers_II_-_Country_Pub_(c.1660).jpg
  - `room-teniers-herberg.webp`: David Teniers the Younger, *Interior of an Inn with Smoking Peasants* (c. 1645). https://commons.wikimedia.org/wiki/File:David_Teniers_(II)_-_Interieur_van_een_herbeg_met_rokende_boeren_(ca._1645).jpg
  - `square-berckheyde-grote-markt.webp`: Gerrit Berckheyde, *The Grote Markt in Haarlem with the Grote Kerk* (1696). https://commons.wikimedia.org/wiki/File:Berckheyde,_Gerrit_-_Grote_Markt_in_Haarlem_with_the_Grote_or_St_Bavokerk_-_Frans_Hals_Museum.jpeg
  - `stairs-piranesi-well.webp`: Giovanni Battista Piranesi, *The Well, Carceri d'Invenzione plate XIII* (1761). https://commons.wikimedia.org/wiki/File:Giovanni_Battista_Piranesi_-_Le_Carceri_d'Invenzione_-_Second_Edition_-_1761_-_13_-_The_Well.jpg
  - `stairs-rembrandt-philosopher.webp`: Rembrandt van Rijn, *Philosopher in Meditation* (1632). https://commons.wikimedia.org/wiki/File:Rembrandt_Harmensz._van_Rijn_038.jpg
  - `street-grimshaw-moonlight.webp`: John Atkinson Grimshaw, *Street Scene in Moonlight* (1875). https://commons.wikimedia.org/wiki/File:John_Atkinson_Grimshaw_-_Street_Scene_in_Moonlight.jpg
  - `woods-constable-hampstead-storm.webp`: John Constable, *A View at Hampstead with Stormy Weather* (c. 1830). https://commons.wikimedia.org/wiki/File:John_Constable_-_A_View_at_Hampstead_with_Stormy_Weather_-_Google_Art_Project.jpg
  - `woods-friedrich-abbey-oakwood.webp`: Caspar David Friedrich, *The Abbey in the Oakwood* (1809–10). https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Abtei_im_Eichwald_-_Google_Art_Project.jpg
  - `woods-hobbema-wooded-landscape.webp`: Meindert Hobbema, *A Wooded Landscape* (c. 1660s). https://commons.wikimedia.org/wiki/File:Hobbema,_Meindert_-_A_Wooded_Landscape_-_Google_Art_Project.jpg
  - `yard-durrie-farmyard-winter.webp`: George Henry Durrie, *Farmyard in Winter* (1858). https://commons.wikimedia.org/wiki/File:George_Henry_Durrie_-_Farmyard_in_Winter_-_Google_Art_Project.jpg
  - `yard-rowlandson-farmyard.webp`: Thomas Rowlandson, *The Farmyard* (c. 1800s). https://commons.wikimedia.org/wiki/File:Thomas_Rowlandson_-_The_Farmyard_-_Google_Art_Project.jpg
- **Questions hub background**, `src/ui/assets/night-sky.webp`, used only by the hub page. No licence note is
  recorded for it.
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
