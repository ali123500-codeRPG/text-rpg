// God IDs: every god's ID is fixed (type prefix GD + a number), never its name. Never reuse or renumber an ID.
export const GD = {
  varo: 'GD1', // Varo, minor god of extreme fortunes; no blessings yet
  imbra: 'GD2', // Imbra, minor goddess of essence manipulation
} as const;
export type GodId = (typeof GD)[keyof typeof GD];
