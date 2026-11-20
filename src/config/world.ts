// CONFIG defaults: breaking, steadying, filching and the floor plan. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.

export const WORLD = {
  // ---- breaking walls and barriers by strength (BW1, BW18-BW26; src/ruleset/breaking.ts; placeholders) ----
  /** BW19 a: the lift (kg) at a strength, straight lines between these anchors up to 100: 75 and 100 are the power ladder's
   * (TL17: the real record 510 kg, about 600 kg at the mortal limit); 250 kg at 50 is a placeholder for a working
   * professional (no source yet) */
  LIFT_KG_AT: [[0, 0], [50, 250], [75, 510], [100, 600]] as [number, number][],
  /** BW19 a: past the last anchor the lift doubles every this many points, with no top (TL17) */
  LIFT_DOUBLING_PER: 50,
  /** BW22 a: what a breaking tool in use (a sledgehammer, a pick; a heavy weapon with Shield Breaker) adds to the force, kg */
  BREAK_TOOL_KG: 150,
  /** BW20 a: breaking time = the material's time at 50 × ((lift at 50 + BREAK_TOOL_KG) ÷ your force) ^ BREAK_FORCE_POWER */
  BREAK_FORCE_POWER: 3,
  /** BW20: the strength the materials' times are for (a working professional) */
  BREAK_REF_STRENGTH: 50,
  /** BW21 a: a wall or barrier that would take this long or less does not stop a walker: they go through it as part of a move */
  WALK_THROUGH_S: 2,
  /** BW11 a: a hole broken through a wall, Destroyed: a doorway's size, width × height (m), no higher than the wall */
  BREAK_HOLE_M: [0.9, 2] as [number, number],
  /** BW9 b: work on a material that regrows (living wood, slime membrane) is lost after this many seconds with nobody at it */
  REGROW_S: 60,
  /** BW13 a, BW23 a: out of a fight one order breaks for at most this long (then the order is given again); each full spell
   * of work with a tool or weapon is one breakage check on it (placeholder: an hour) */
  BREAK_SPELL_S: 3600,
  // ---- steadying yourself (SY1; src/engine/steady.ts; placeholders) ----
  /** % of max morale a steady roll wins back (+) or loses (−) by tier; past Critical Success each step adds STEADY_PAST_PCT, past
   * Critical Failure each step takes it away */
  STEADY_PCT: { critical_failure: -10, failure: -5, near_miss: 5, success: 10, great_success: 15, critical_success: 20 } as Record<string, number>,
  STEADY_PAST_PCT: 5,
  /** seconds of game time before the same actor may steady itself again (5 fight turns) */
  STEADY_COOLDOWN_S: 30,
  /** Mentally steady (Great Success or better): the next morale loss × this */
  STEADY_BUFF_MULT: 0.5,
  // ---- filching (FL1–FL7, TN1–TN4; src/engine/filch.ts; placeholders) ----
  /** TN3 (open, round 3 TN3b): how visible a filch is, one row for every filch; Close is made out clearly within 6 m */
  FILCH_VISIBILITY: 'slight' as import('../scales').VisibilityKey,
  /** TN1: the sound of a filch at Near Miss or better; each tier the roll falls below Near Miss makes it one level louder */
  FILCH_NOISE: 'hushed' as import('../scales').NoiseKey,
  /** TN4: added to a watcher's sight and hearing rolls by how closely they watch (their activity's attention; talking with
   * the filcher is alert) */
  FILCH_ATTENTION: { alert: 13, normal: 0, distracted: -13, asleep: 0 } as Record<import('../scales').AttentionKey, number>,
  /** TN4: added to a watcher's rolls by the item's size (its bulk: 0 pocket-sized, 1 hand-sized, 2 arm-sized, 3 bigger);
   * the penalty grows faster than the size, and sizes above FILCH_MAX_BULK can't be filched (a perk can open them) */
  FILCH_SIZE: [0, 7, 20, 40] as number[], // % of the average roll (D-76), like FILCH_ATTENTION
  FILCH_MAX_BULK: 2,
  /** FL2: the share of a purse's coin one try takes (at least 1) */
  FILCH_PURSE_SHARE: 0.25,
  /** FL5: stance steps colder when caught: the owner, and every other watcher who caught it */
  FILCH_CAUGHT_OWNER_STEPS: 2,
  FILCH_CAUGHT_WITNESS_STEPS: 1,
  STOREY_HEIGHT: 3, // placeholder: metres one flight of stairs climbs: a title up or down a way of kind up or down sits this far above or below (PZ7)
  // ---- PZ1-PZ17 titles and the floor plan (src/plan); placeholders unless a source is given ----
  /** PZ1 a: how high a title under the open sky reaches above its floor (its space's top), so the smallest space wins */
  OPEN_AIR_TOP_M: 30,
  /** PZ2: a low wall or counter, and a fence or rail, stand this high above their floor (a bar counter is about 1.1 m) */
  LOW_WALL_M: 1.1,
  FENCE_M: 1.2,
  /** PZ2: a wall's thickness in metres when drawn by a template (a timber-framed wall of wattle and daub, about 0.15 to
   * 0.3 m; an estimate); its material is left out until the walls thread breaks walls (BW1) */
  WALL_THICKNESS_M: 0.25,
  /** PZ2: an open way (an arch, a counter's gap) cut across a wall is this wide, or the wall's length if shorter */
  ARCH_M: 2,
  /** PZ8: a walk round a wall's end keeps this far from the corner (a little more than half a person's width) */
  CORNER_CLEAR_M: 0.4,
  /** PZ5: a title's lights hang this far below its top indoors; outdoors a lamp stands this high (a lamp post) */
  LIGHT_BELOW_TOP_M: 0.5,
  LIGHT_POST_M: 2.5,
  /** PZ12 a: the Map's fog in the open where no land lies under it is kept in squares this many metres across (1 m under a
   * roof); fog chunks are FOG_CHUNK squares a side; each turn the player's eye marks the squares it sees within FOG_ROOF_M
   * under a roof and FOG_OPEN_M in the open */
  FOG_OPEN_SQUARE_M: 10,
  FOG_CHUNK: 32,
  FOG_ROOF_M: 30,
  FOG_OPEN_M: 200,
  /** RD6 how far each kind of thrown weapon is aimed at a man-sized target, in metres (a throw mode's reachM; perks add
   * PerkDef.throwReach metres): a spear or javelin 17.5 (the Roman pilum's effective range, 15–20 m, Wikipedia "Pilum");
   * a knife 7 (the longest standard distance in
   * European knife-throwing rules, EuroThrowers 2019); an improvised object 5 (no source: a placeholder) */
  THROW_M: { spear: 17.5, knife: 7, improvised: 5 }, // a throwing axe would be 12 (the francisca, Wikipedia "Francisca")
  /** the throw action is a combined roll: the weapon's own skill (a melee weapon's melee skill) and the ranged skill of
   * the same class, each with its own stand-ins, at these shares */
  THROW_BLEND: { weapon: 0.75, ranged: 0.25 },
};
