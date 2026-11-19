// IDs of the small library tables: body-part roles RL, healing sources HL, action durations DU, zone kinds ZK and
// attack modes AM. Each is fixed (type prefix + a number), never its name; display names live in the library rows.
// Code refers to them through these constants. Never reuse or renumber an ID.
export const RL = { sense: 'RL1', grip: 'RL2', move: 'RL3', fly: 'RL4', strike: 'RL5', speech: 'RL6' } as const;
/** healing sources (health); HL5 is retired (natural composure moved to the composure table, CP) */
export const HL = { rest: 'HL1', clinic: 'HL2', bandage: 'HL3', passive: 'HL4', perk: 'HL6', draught: 'HL7', heal: 'HL8' } as const;
/** FT7 the stamina recovery table: Sleep, Rest, Catching your breath, and Perks (a counting row) */
export const RV = { sleep: 'RV1', rest: 'RV2', breath: 'RV3', perk: 'RV4' } as const;
/** composure sources: what restores morale, a table of its own so morale tunes apart from health (an action like rest names a row in each) */
export const CP = { rest: 'CP1', clinic: 'CP2', natural: 'CP3', danger_passed: 'CP4', perk: 'CP5', steady: 'CP6', foe_downed: 'CP7', rallied: 'CP8' } as const;
/** D-17 FIGHT_RULES rows (TC17-TC23): the code-run fight list's skilled rows (src/library/fightRules.ts) */
export const FX = { call_help: 'FX1', gang_up: 'FX2', ready_shield: 'FX3', back_off: 'FX4', finish_hurt: 'FX5', out_of_sight: 'FX6', into_cover: 'FX7', into_dark: 'FX8', draw_into_pack: 'FX9', strike_from_hiding: 'FX10', feigned_flight: 'FX11', warn: 'FX12' } as const;
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
export const LK = { crushing_presence: 'LK1', ghost_blade: 'LK2', combination: 'LK3', blind_spot: 'LK4', bulwark: 'LK5', endless_answer: 'LK6' } as const;
/** the Action times table (AT11); DU1 (the fight turn) is retired: it is CONFIG.FIGHT_TURN_S; DU28 (Vanish in place) is retired: no Vanish action (VS6) */
export const DU = {
  action: 'DU2', trade: 'DU3', rest: 'DU4', sleep: 'DU5', blow: 'DU6', throw: 'DU7', bow_light: 'DU8', bow_medium: 'DU9', crossbow_shot: 'DU10',
  span_light: 'DU11', span_stirrup: 'DU12', span_crossbow: 'DU13', battle_cry: 'DU14', talk: 'DU15', draw: 'DU16', stow: 'DU17', swap: 'DU18',
  pick_up_reach: 'DU19', pick_up_ground: 'DU20', hand_over: 'DU21', door: 'DU22', bar: 'DU23', key: 'DU24', pick_lock: 'DU25', bandage: 'DU26',
  drink: 'DU27', look: 'DU29', armor_light_on: 'DU30', armor_light_off: 'DU31', armor_medium_on: 'DU32', armor_medium_off: 'DU33',
  armor_heavy_on: 'DU34', armor_heavy_off: 'DU35', wait: 'DU36', break_open: 'DU37', from_pack: 'DU38',
  blow_unarmed: 'DU39', blow_medium: 'DU40', blow_heavy: 'DU41', // blows by class (DU6 blow is the light weapon blow)
  speech: 'DU42', // TK1 c: persuade, lie or threaten, however long
  rally: 'DU43', // TC39 a Rally (DU42 is held by another thread)
  play_dead: 'DU44', // TC44 a Play Dead
  break_through: 'DU45', // BW13 a: breaking through a wall or a barrier
} as const;
/** CO17 prebuilt layouts: a building's zones and exits, which the Weaver picks by id; several per building type */
export const LY = { tavern: 'LY1', cottage: 'LY2', shop: 'LY3', smithy: 'LY4', gatehouse: 'LY5' } as const;
/** PZ2 wall kinds: what a wall on the floor plan is (EK edge kinds are retired with zone sides); open draws no wall; a new
 * kind is a new row */
export const WK = { wall: 'WK1', open: 'WK2', low: 'WK3', glazed: 'WK4', fence: 'WK5', arcade: 'WK6' } as const;
/** PZ2 opening kinds: what a way is (a doorway, a gap, a window, stairs); a new kind is a new row */
export const OP = { doorway: 'OP1', gap: 'OP2', window: 'OP3', stairs: 'OP4' } as const;
/** PZ5 light source kinds (D-391); a new kind is a new row */
export const LS = { candle: 'LS1', oil_lamp: 'LS2', lantern: 'LS3', torch: 'LS4', hearth: 'LS5', lights: 'LS6' } as const;
/** SD3–SD5 barrier kinds: what stands on a way (door, gate, grate, hatch, rubble); a new kind is a new row */
export const BK = { door: 'BK1', gate: 'BK2', grate: 'BK3', hatch: 'BK4', rubble: 'BK5', window: 'BK6', arrow_slit: 'BK7', barred_window: 'BK8', large_window: 'BK9' } as const;
/** BW24 barrier materials: what a wall, a barrier or rubble is made of, and how long it takes to break (src/ruleset/breaking.ts); a new material is a new row */
export const BM = { wattle: 'BM1', planks: 'BM2', oak: 'BM3', brick: 'BM4', iron: 'BM5', stone: 'BM6', glass: 'BM7', rubble: 'BM8', ice: 'BM9', living_wood: 'BM10', slime_membrane: 'BM11', lair_stone: 'BM12', starmetal: 'BM13' } as const;
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
/** title kinds (PZ14 a, drawing templates); ZK11 (road) is retired: a road is its line on the land (PZ9) */
export const ZK = { room: 'ZK1', corridor: 'ZK2', stairs: 'ZK3', cellar: 'ZK4', street: 'ZK5', square: 'ZK6', gate: 'ZK7', yard: 'ZK8', field: 'ZK9', woods: 'ZK10' } as const;
export const AM = {
  chop: 'AM1', club: 'AM2', cut: 'AM3', grapple: 'AM4', punch: 'AM5', shoot: 'AM6', slam: 'AM7', slash: 'AM8', stab: 'AM9', strike: 'AM10',
  throw: 'AM11', thrust: 'AM12', unarmed: 'AM13', bite: 'AM14', claw: 'AM15', kick: 'AM16', gore: 'AM17',
} as const;
/** IR23: gear types. A piece's reach (weapons) or coverage (armor) comes from its type, never from the piece */
export const GT = {
  knife: 'GT1', short: 'GT2', sword: 'GT3', great: 'GT4', pole: 'GT5',
  short_bow: 'GT6', flatbow: 'GT7', recurve: 'GT8', longbow: 'GT9', warbow: 'GT10', crossbow_light: 'GT11', crossbow_stirrup: 'GT12', crossbow_heavy: 'GT13',
  cuirass: 'GT14', coat: 'GT15', half_suit: 'GT16', full_harness: 'GT17', helmet: 'GT18', helmet_neck: 'GT19', fist: 'GT20',
} as const;
/** IR30-IR33: item families. Mundane pieces scale only by their level; special families (Threadbound, Relic) stand on a
 * Mundane base and add their own extras */
export const IF = { mundane: 'IF1', threadbound: 'IF2', relic: 'IF3' } as const;
/** gear classes: a class sets which skill an item asks for (its level sets how much) */
export const GC = {
  melee_light: 'GC1', melee_medium: 'GC2', melee_heavy: 'GC3', ranged_light: 'GC4', ranged_medium: 'GC5', ranged_heavy: 'GC6',
  improvised: 'GC7', armor_light: 'GC8', armor_medium: 'GC9', armor_heavy: 'GC10', shield: 'GC11', gauntlets: 'GC12', // IR28: an unarmed weapon
} as const;
