### 5. Locations and story memory

Every turn happens at one node of a location tree (the place of the player's zone), so a castle in one city is never confused with a castle in another. A scenario can cross several nodes.

**Place tree.**

- Nodes have opaque ids and a parent link. Depth is unlimited; each node has a kind (country, settlement, place, and any added later), and the library says which kinds may nest under which.
- Each of Part 2's zones belongs to one place. The stage (the zones in play) may hold zones from several neighbouring places; a fact is saved at the place of the zone where it happened.
- Actors are not in the tree. Each actor holds a placeId pointer, which always equals the place of its zone; every move updates it, so people and creatures move freely between cities.
- When Claude names a place ("the castle"), code resolves it in the current settlement first, then upward. Claude never handles ids.

**Renames.** Places and people keep a current name plus past names. Old names still resolve. Fact text stores references, not names (met {npc:leona} at {place:gilded\_cup}), filled in with current names when a view is built, so a rename never needs a rewrite.

**State versus history.** Two records are kept apart so old details can't contradict new ones:

| Record | Holds | Rule |
| --- | --- | --- |
| State slots | What is true now (gilded\_cup.north\_wall: repaired) | One value per slot; a new value overwrites. Written by code from events, or by a validated set\_place\_state proposal naming subject and attribute |
| History facts | What happened ("the brawl broke the north wall") | Append-only, past tense, never edited |
| Player memory | The last value the player saw per slot, and when | Lets narration avoid "knowing" about a change the character never saw |

Whether every slot tracks player memory, or only narrated slots, is deferred.

**Facts and promotion.** A fact is saved once, at the node where it happened, linked to the entities it involves. Location facts are things the player witnessed or was told; world truth the player doesn't know stays in the hidden store. Promotion copies a short headline to an ancestor node:

- Code rules promote the important events: first meeting with a named NPC, a named death, a quest step, a revealed secret.
- Claude may propose promote\_fact; the validator accepts it within a per-scenario cap (placeholder).

**What a view receives.** PlayerView, NarrationView and WeaverView receive all facts for the current place, the top HEADLINES\_PER\_PLACE (3) headlines of each ancestor (CS7), and any fact linked to an entity present. Leona's "met at the Gilded Cup" arrives with her in another country. NPC views (OppositionView, DialogueView, ActorView) never receive facts or headlines: facts record what the player witnessed or was told.
