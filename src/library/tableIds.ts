// IDs of the small library tables: body-part roles RL, healing sources HL, action durations DU, zone kinds ZK and
// attack modes AM. Each is fixed (type prefix + a number), never its name; display names live in the library rows.
// Code refers to them through these constants. Never reuse or renumber an ID.
export const RL = { sense: 'RL1', grip: 'RL2', move: 'RL3', fly: 'RL4', strike: 'RL5', speech: 'RL6' } as const;
export const HL = { rest: 'HL1', clinic: 'HL2', bandage: 'HL3', passive: 'HL4' } as const;
export const DU = { fight_turn: 'DU1', action: 'DU2', trade: 'DU3', rest: 'DU4', sleep: 'DU5' } as const;
export const ZK = { room: 'ZK1', corridor: 'ZK2', stairs: 'ZK3', cellar: 'ZK4', street: 'ZK5', square: 'ZK6', gate: 'ZK7', yard: 'ZK8', field: 'ZK9', woods: 'ZK10' } as const;
export const AM = {
  chop: 'AM1', club: 'AM2', cut: 'AM3', grapple: 'AM4', punch: 'AM5', shoot: 'AM6', slam: 'AM7', slash: 'AM8', stab: 'AM9', strike: 'AM10',
  throw: 'AM11', thrust: 'AM12', unarmed: 'AM13',
} as const;
