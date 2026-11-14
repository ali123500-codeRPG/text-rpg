// IDs of the small library tables: body-part roles RL, healing sources HL, action durations DU, zone kinds ZK and
// attack modes AM. Each is fixed (type prefix + a number), never its name; display names live in the library rows.
// Code refers to them through these constants. Never reuse or renumber an ID.
export const RL = { sense: 'RL1', grip: 'RL2', move: 'RL3', fly: 'RL4', strike: 'RL5', speech: 'RL6' } as const;
/** healing sources (health); HL5 is retired (natural composure moved to the composure table, CP) */
export const HL = { rest: 'HL1', clinic: 'HL2', bandage: 'HL3', passive: 'HL4', perk: 'HL6', draught: 'HL7' } as const;
/** composure sources: what restores morale, a table of its own so morale tunes apart from health (an action like rest names a row in each) */
/** FT7 the stamina recovery table: Sleep, Rest, Catching your breath, and Perks (a counting row) */
export const RV = { sleep: 'RV1', rest: 'RV2', breath: 'RV3', perk: 'RV4' } as const;
export const CP = { rest: 'CP1', clinic: 'CP2', natural: 'CP3', danger_passed: 'CP4', perk: 'CP5', steady: 'CP6', foe_downed: 'CP7', rallied: 'CP8' } as const;
/** fears: what costs (or restores) morale (MB21–MB28) */
export const FR = { own_level: 'FR1', own_critical: 'FR2', bandmate_down: 'FR3', bandmate_broken: 'FR4', lost_intimidation: 'FR5', dread_presence: 'FR7', battle_cry: 'FR8', own_part_crippled: 'FR10', own_part_destroyed: 'FR11', dreaded_sight: 'FR12', steady_slipped: 'FR13' } as const; // FR6, FR9 retired: moved to the composure table (TM28)
/** PL6: personality axes; PL19: values; PL10: named personality types */
export const PA = { honesty: 'PA1', pride: 'PA2', temper: 'PA3', sociability: 'PA4', discipline: 'PA5', curiosity: 'PA6', levity: 'PA7', assertiveness: 'PA8' } as const;
export const VL = { duty: 'VL1', wealth: 'VL2', family: 'VL3', faith: 'VL4', power: 'VL5', freedom: 'VL6', safety: 'VL7', pleasure: 'VL8', knowledge: 'VL9', kindness: 'VL10',
  glory: 'VL11', adventure: 'VL12', reputation: 'VL13', humility: 'VL14', nature: 'VL15', justice: 'VL16', tolerance: 'VL17',
  loyalty: 'VL18', courtesy: 'VL19', order: 'VL20', propriety: 'VL21', gratitude: 'VL22', desire: 'VL23' } as const;
export const PY = { prideful: 'PY1', mature: 'PY2', childish: 'PY3', honourable: 'PY4', schemer: 'PY5', bully: 'PY6', busybody: 'PY7', ordinary: 'PY8', loner: 'PY9', free_spirit: 'PY10' } as const;
/** tensions: two parts of a character that pull against each other (personality line) */
export const TN = { unshakeable_scatterbrained: 'TN1', bold_unbacked: 'TN2', wary_dangerous: 'TN4', home_temptation: 'TN5', talent_undisciplined: 'TN6', crooked_means: 'TN7' } as const; // TN3 (old head on young shoulders) retired: no children
/** linked perks: a set of perks that together grant one more perk, or merge into one (src/library/perkLinks.ts) */
export const LK = { crushing_presence: 'LK1', ghost_blade: 'LK2', combination: 'LK3', blind_spot: 'LK4', bulwark: 'LK5' } as const;
/** the Action times table (AT11); DU1 (the fight turn) is retired: it is CONFIG.FIGHT_TURN_S */
export const DU = {
  action: 'DU2', trade: 'DU3', rest: 'DU4', sleep: 'DU5', blow: 'DU6', throw: 'DU7', bow_light: 'DU8', bow_medium: 'DU9', crossbow_shot: 'DU10',
  span_light: 'DU11', span_stirrup: 'DU12', span_crossbow: 'DU13', battle_cry: 'DU14', talk: 'DU15', draw: 'DU16', stow: 'DU17', swap: 'DU18',
  pick_up_reach: 'DU19', pick_up_ground: 'DU20', hand_over: 'DU21', door: 'DU22', bar: 'DU23', key: 'DU24', pick_lock: 'DU25', bandage: 'DU26',
  drink: 'DU27', hide: 'DU28', look: 'DU29', armor_light_on: 'DU30', armor_light_off: 'DU31', armor_medium_on: 'DU32', armor_medium_off: 'DU33',
  armor_heavy_on: 'DU34', armor_heavy_off: 'DU35', wait: 'DU36', break_open: 'DU37', from_pack: 'DU38',
} as const;
/** CO15 edge kinds: what a zone's side is (wall, open, low, window); a new kind is a new row */
/** CO17 prebuilt layouts: a building's zones and exits, which the Weaver picks by id; several per building type */
export const LY = { tavern: 'LY1', cottage: 'LY2', shop: 'LY3', smithy: 'LY4', gatehouse: 'LY5' } as const;
export const EK = { wall: 'EK1', open: 'EK2', low: 'EK3', window: 'EK4' } as const;
/** SD3–SD5 barrier kinds: what stands on a way (door, gate, grate, hatch, rubble); a new kind is a new row */
export const BK = { door: 'BK1', gate: 'BK2', grate: 'BK3', hatch: 'BK4', rubble: 'BK5' } as const;
/** FR1 furniture kinds: what a named piece of furniture is (its map icon follows the kind); a new kind is a new row */
export const FU = {
  counter: 'FU1', hearth: 'FU2', table: 'FU3', bench: 'FU4', bed: 'FU5', barrels: 'FU6', shelves: 'FU7', crates: 'FU8', sacks: 'FU9',
  anvil: 'FU10', forge: 'FU11', rack: 'FU12', brazier: 'FU13', woodpile: 'FU14', water_barrel: 'FU15', stool: 'FU16', chair: 'FU17',
  cupboard: 'FU18', well: 'FU19', cart: 'FU20', fence: 'FU21', rail: 'FU22', altar: 'FU23', other: 'FU24',
} as const;
/** WZ11 region kinds: one look per region (its land, cover and settlements); a new kind is a new row */
export const RK = { river_valley: 'RK1', forest: 'RK2', upland_moor: 'RK3' } as const;
/** WZ1 land covers: what a cell of a region's land is under; a new cover is a new row */
export const LC = { farmland: 'LC1', pasture: 'LC2', woods: 'LC3', heath: 'LC4', moor: 'LC5', marsh: 'LC6', rock: 'LC7', settlement: 'LC8', water_meadow: 'LC9' } as const;
/** WZ2 landmark kinds a region brief may ask for (a quarry in the hills, a ruin); seek is where code looks for room */
export const LM = { quarry: 'LM1', mill: 'LM2', ruin: 'LM3', shrine: 'LM4', tower: 'LM5', mine: 'LM6', standing_stones: 'LM7', camp: 'LM8' } as const;
export const ZK = { room: 'ZK1', corridor: 'ZK2', stairs: 'ZK3', cellar: 'ZK4', street: 'ZK5', square: 'ZK6', gate: 'ZK7', yard: 'ZK8', field: 'ZK9', woods: 'ZK10', road: 'ZK11' } as const;
export const AM = {
  chop: 'AM1', club: 'AM2', cut: 'AM3', grapple: 'AM4', punch: 'AM5', shoot: 'AM6', slam: 'AM7', slash: 'AM8', stab: 'AM9', strike: 'AM10',
  throw: 'AM11', thrust: 'AM12', unarmed: 'AM13', bite: 'AM14', claw: 'AM15', kick: 'AM16', gore: 'AM17',
} as const;
/** gear classes: a class sets which skill an item asks for (its level sets how much) */
export const GC = {
  melee_light: 'GC1', melee_medium: 'GC2', melee_heavy: 'GC3', ranged_light: 'GC4', ranged_medium: 'GC5', ranged_heavy: 'GC6',
  improvised: 'GC7', armor_light: 'GC8', armor_medium: 'GC9', armor_heavy: 'GC10', shield: 'GC11',
} as const;
