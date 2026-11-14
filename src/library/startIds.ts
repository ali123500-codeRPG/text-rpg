// Start IDs (DX1): every Start's ID is fixed (type prefix ST + a number), never its name. Never reuse or renumber an ID.
// Retired: ST3 (the A Nobody start, removed by CC3; the A Nobody class stays, opened by Commoner's capstone).
export const ST = { swordsman: 'ST1', late_bloomer: 'ST2', threadbound: 'ST4', blessed: 'ST5' } as const;
export type StartId = (typeof ST)[keyof typeof ST];
