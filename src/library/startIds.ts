// Start IDs (DX1): every Start's ID is fixed (type prefix ST + a number), never its name. Never reuse or renumber an ID.
export const ST = { swordsman: 'ST1', late_bloomer: 'ST2', a_nobody: 'ST3', threadbound: 'ST4', blessed: 'ST5' } as const;
export type StartId = (typeof ST)[keyof typeof ST];
