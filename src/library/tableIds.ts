// IDs of the small library tables: body-part roles RL, healing sources HL, action durations DU, zone kinds ZK and
// attack modes AM. Each is fixed (type prefix + a number), never its name; display names live in the library rows.
// Code refers to them through these constants. Never reuse or renumber an ID.
export const RL = { sense: 'RL1', grip: 'RL2', move: 'RL3', fly: 'RL4', strike: 'RL5', speech: 'RL6' } as const;
