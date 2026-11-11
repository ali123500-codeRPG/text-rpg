// IDs of the small library tables: body-part roles RL, healing sources HL, action durations DU, zone kinds ZK and
// attack modes AM. Each is fixed (type prefix + a number), never its name; display names live in the library rows.
// Code refers to them through these constants. Never reuse or renumber an ID.
export const RL = { sense: 'RL1', grip: 'RL2', move: 'RL3', fly: 'RL4', strike: 'RL5', speech: 'RL6' } as const;
/** healing sources (health); HL5 is retired (natural composure moved to the composure table, CP) */
export const HL = { rest: 'HL1', clinic: 'HL2', bandage: 'HL3', passive: 'HL4', perk: 'HL6' } as const;
/** composure sources: what restores morale, a table of its own so morale tunes apart from health (an action like rest names a row in each) */
export const CP = { rest: 'CP1', clinic: 'CP2', natural: 'CP3', danger_passed: 'CP4', perk: 'CP5' } as const;
/** fears: what costs (or restores) morale (MB21–MB28) */
export const FR = { own_level: 'FR1', own_critical: 'FR2', bandmate_down: 'FR3', bandmate_broken: 'FR4', lost_intimidation: 'FR5', foe_downed: 'FR6', dread_presence: 'FR7', battle_cry: 'FR8', rallied: 'FR9', own_part_crippled: 'FR10', own_part_destroyed: 'FR11' } as const;
/** linked perks: a set of perks that together grant one more perk, or merge into one (src/library/perkLinks.ts) */
export const LK = { crushing_presence: 'LK1' } as const;
export const DU = { fight_turn: 'DU1', action: 'DU2', trade: 'DU3', rest: 'DU4', sleep: 'DU5' } as const;
/** CO15 edge kinds: what a zone's side is (wall, open, low, window); a new kind is a new row */
/** CO17 prebuilt layouts: a building's zones and exits, which the Weaver picks by id; several per building type */
export const LY = { tavern: 'LY1', cottage: 'LY2', shop: 'LY3', smithy: 'LY4', gatehouse: 'LY5' } as const;
export const EK = { wall: 'EK1', open: 'EK2', low: 'EK3', window: 'EK4' } as const;
export const ZK = { room: 'ZK1', corridor: 'ZK2', stairs: 'ZK3', cellar: 'ZK4', street: 'ZK5', square: 'ZK6', gate: 'ZK7', yard: 'ZK8', field: 'ZK9', woods: 'ZK10', road: 'ZK11' } as const;
export const AM = {
  chop: 'AM1', club: 'AM2', cut: 'AM3', grapple: 'AM4', punch: 'AM5', shoot: 'AM6', slam: 'AM7', slash: 'AM8', stab: 'AM9', strike: 'AM10',
  throw: 'AM11', thrust: 'AM12', unarmed: 'AM13',
} as const;
/** gear classes: a class sets which skill an item asks for (its level sets how much) */
export const GC = {
  melee_light: 'GC1', melee_medium: 'GC2', melee_heavy: 'GC3', ranged_light: 'GC4', ranged_medium: 'GC5', ranged_heavy: 'GC6',
  improvised: 'GC7', armor_light: 'GC8', armor_medium: 'GC9', armor_heavy: 'GC10', shield: 'GC11',
} as const;
