// Start IDs (DX1): every Start's ID is fixed (type prefix ST + a number), never its name. Never reuse or renumber an ID.
// Retired: ST1 (the Swordsman start, removed; the Swordsman class stays, unlocked in play) and ST3 (the A Nobody start,
// removed by CC3; the A Nobody class stays, opened by Commoner's capstone).
export const ST = { late_bloomer: 'ST2', threadbound: 'ST4', blessed: 'ST5' } as const;
export type StartId = (typeof ST)[keyof typeof ST];
