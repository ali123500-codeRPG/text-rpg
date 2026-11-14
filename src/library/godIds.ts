// God IDs: every god's ID is fixed (type prefix GD + a number), never its name. Never reuse or renumber an ID.
export const GD = {
  varo: 'GD1', // extreme fortunes; no blessings yet
  essences: 'GD2', // essence manipulation; name a placeholder until NM1
} as const;
export type GodId = (typeof GD)[keyof typeof GD];
