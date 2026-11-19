---
name: "rpg-map"
description: "Map rules for the text-rpg artifact app's stage map: zone layout, labels, tokens, door/exit symbols, fog of what the player knows, plus a mandatory render-and-check pass. Use whenever building, changing, reviewing or debugging the game map, even small fixes, and whenever a builder prompt for the map is being written."
---

# RPG map

Rules for the stage map in the text-based RPG artifact app. Code controls the numbers, and that includes coordinates: the map is laid out by code from stage data, then checked by code, then looked at.

Rules carry IDs (MAP-xx) so reviews and change docs can cite them. Map animation follows the spec's motion rules (`docs/build-spec.md`, `### Play screen motion`, M-01 to M-74). The rules serve a clear, readable map: when the owner asks for something that a rule blocks, the owner's request wins, and the rule is updated to match.

## Before starting

Load and apply these skills first: `frontend-design` (aesthetic direction), `interface-design` (product UI), `ui-ux-pro-max` (palette and type), `impeccable` (final audit pass), and, for any map motion, the spec's `### Play screen motion` section (M-01 to M-74). If any of them conflicts with a rule here, this skill wins for the map.

## 1. Pipeline (highest priority)

- **MAP-01** Stage data, then layout, then render, then check, then look. Never skip a step and never reorder.
- **MAP-02** Claude agents never produce coordinates. Agent Weaver gives zone ids, sizes in metres, parent place and links; layout code turns that into positions.
- **MAP-03** Layout is deterministic: the same stage data gives the same map. Positions are stored with the stage once computed, so a stage extension adds zones at the edges and never reshuffles existing ones.
- **MAP-04** A map change ships only when the checker (section 6) reports zero findings on every test stage.

## 2. Geometry

- **MAP-10** One grid, 1 cell = 1 m. Every zone size and position snaps to it. The scale bar is drawn from the same constant. A zone is only a title: a name plus an outline (any shape) between a floor and a top. The map draws every title where it lies on the floor plan, and its walls, openings and furniture come from the floor plan (state.walls, state.openings), never from zone links. There is no exit diagram and no force layout.
- **MAP-11** Zones never partially overlap. Only full containment is allowed (a zone inside its parent place). Any partial overlap is a violation.
- **MAP-12** Outdoor zones (streets, yards, roads) sit beside building footprints and never run through them. A building is one connected footprint.
- **MAP-13** A place's footprint is the bounding box of the seen ground of its zones plus padding, so it never tells how far unseen ground runs. Its title sits outside the footprint, above the top-left corner (a title wider than the place may run out past that corner).
- **MAP-14** Each doorway, gap, window or stair is drawn once, at its own point (Opening.at) on its wall, never at the middle of a shared edge and never by a compass word. An exit to somewhere not on the map is an arrow straight out of its own doorway, turned a little only when that spot is taken. There are no connector lines between titles.
- **MAP-15** Every zone is reachable from the player's zone through links (flood fill over the stage data). An unreachable zone is a finding, not a style choice.
- **MAP-16** Fog (PZ12 a): the map and the minimap draw a title's floor, walls and furniture only where the fog says the player has seen (journal.seenSquares; over the land, the land's cells). Unseen ground stays dark. A title seen none of shows no name; a name sits in the biggest seen part of its title. The minimap uses the same plan and the same fog, and only seen ground can be pointed at.

## 3. Labels

- **MAP-20** A zone's name is drawn in bold letters inside its zone, centred, on up to three lines, as large as fit with at least 6 px padding (up to 32 px). In a small zone the letters shrink to stay inside. A zone too small even for 4 px letters shows its name in its tooltip and accessible label only. The name never moves outside its zone.
- **MAP-21** A name is never cut with an ellipsis. It shrinks instead (MAP-20).
- **MAP-22** A zone's name is a background layer behind every mark. Tokens and icons may sit on it, and it takes no room from them, so it never pushes a mark aside.
- **MAP-23** When marks collide, yield in this order (first wins): player token, place titles, other tokens, exit notes, icons.
- **MAP-25** A mark inside a zone (furniture, stairs, the player, people) keeps one spot at every zoom, as a share of its zone. It is placed once, at the widest of a few set zooms that has room for it. Zoomed out, an icon that would cover another mark hides in its own spot and comes back there. The player and people are never hidden; they step aside only then.
- **MAP-24** Exit notes use one format, attached to their exit: `→ target · state` (for example `→ the plank gate · unexplored`).

## 4. Symbols and states

- **MAP-30** One icon has one meaning. The legend is always available and lists every icon on the current map.
- **MAP-31** Icons never overlap each other or a wall corner. Doors sit at their own point on their wall (MAP-14).
- **MAP-32** Every exit arrow names its target. No arrow points at empty space without a note.
- **MAP-33** Zone states are fixed: current (highlighted), explored, seen-not-visited, unexplored (dashed outline). Locked is shown on the door, not on the zone.
- **MAP-34** Every state is readable without colour: outline style plus an icon or text, never colour alone.

## 5. What the map may show

- **MAP-40** The map shows only what the player character knows: zones, exits and actors the player has perceived. Hidden Weaver fields never reach the map.
- **MAP-41** Unperceived NPCs are not drawn. Perceived but unnamed NPCs use their stranger label.
- **MAP-42** Background stage extensions are invisible until the player perceives the new zone (matches the spec's motion rule M-04). No layout shift, no new outline, no indicator.

## 6. Check, then look

- **MAP-50** The renderer tags every map element with `data-role` (`zone`, `place`, `label`, `token`, `icon`, `exit`) and `data-id`. Labels also carry `data-for` (the zone id) and `data-placement` (`inside` or `outside`). Zone names carry `data-layer="back"`. Zones carry `data-parent` when they sit inside a place. Exits carry `data-target`.
- **MAP-51** After every render, run `checkMap` below on the live SVG (it measures real text sizes, so it must run after the browser lays out the text). Run `checkReach` on the stage data. Any finding fails the change.
- **MAP-52** Test stages: (a) the Bent Nail (kitchen, common room, behind the counter) beside the high street with the hidden yard and its locked plank gate; (b) a single room; (c) a 12-zone stage with long zone names. Render each, take a screenshot, and look at it before reporting.
- **MAP-53** Report every finding verbatim. Never say all checks passed if any check reported something.

```js
// Geometry checker. Run in the page after the map renders. Returns a list of findings.
function checkMap(svg) {
  const out = [];
  const els = [...svg.querySelectorAll('[data-role]')].map(el => {
    const b = el.getBoundingClientRect();
    return { el, role: el.dataset.role, id: el.dataset.id, b };
  });
  const by = r => els.filter(e => e.role === r);
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const inside = (a, b, pad = 0) => a.left >= b.left + pad && a.right <= b.right - pad && a.top >= b.top + pad && a.bottom <= b.bottom - pad;
  const box = svg.getBoundingClientRect();
  const zones = by('zone');
  // MAP-11: zones may not partially overlap
  for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
    const a = zones[i], b = zones[j];
    if (hit(a.b, b.b) && !inside(a.b, b.b) && !inside(b.b, a.b)) out.push(`MAP-11 zones ${a.id} and ${b.id} partially overlap`);
  }
  // MAP-20: inside labels must fit their zone with padding
  for (const l of by('label')) {
    const z = zones.find(z => z.id === l.el.dataset.for);
    if (l.el.dataset.placement === 'inside' && z && !inside(l.b, z.b, 6)) out.push(`MAP-20 label ${l.id} does not fit zone ${z.id}`);
  }
  // MAP-22, MAP-31: labels, tokens and icons must not overlap each other; zone names (data-layer back) are background
  const marks = [...by('label').filter(l => l.el.dataset.layer !== 'back'), ...by('token'), ...by('icon')];
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
    const a = marks[i], b = marks[j];
    if (hit(a.b, b.b)) out.push(`MAP-22/31 ${a.role} ${a.id} overlaps ${b.role} ${b.id}`);
  }
  // MAP-32: every exit names its target
  for (const x of by('exit')) if (!x.el.dataset.target) out.push(`MAP-32 exit ${x.id} has no target`);
  // Nothing may render outside the map
  for (const e of els) if (!inside(e.b, box)) out.push(`MAP-50 ${e.role} ${e.id} extends past the map edge`);
  return out;
}

// MAP-15: reachability over stage data. links: [[zoneA, zoneB], ...]
function checkReach(zoneIds, links, startId) {
  const adj = new Map(zoneIds.map(id => [id, []]));
  for (const [a, b] of links) { adj.get(a)?.push(b); adj.get(b)?.push(a); }
  const seen = new Set([startId]), todo = [startId];
  while (todo.length) for (const n of adj.get(todo.pop()) || []) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  return zoneIds.filter(id => !seen.has(id)).map(id => `MAP-15 zone ${id} is unreachable from ${startId}`);
}
```

## Credits

Ideas adapted from community skills: containment-or-no-overlap and verify-before-merge (cathrynlavery/diagram-design), detect-fix-revalidate loop (metabench/svg-collisions), deterministic generation and flood-fill connectivity (gamedev-skills roguelike), and report-every-warning plus look-at-every-render (agent-sprite-forge generate2dmap).
