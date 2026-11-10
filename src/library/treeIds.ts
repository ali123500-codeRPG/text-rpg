// Skill tree IDs: every tree's ID is fixed (type prefix TR + a number), never its name, so renaming a tree touches only
// its name in the library. Code refers to trees through TR; data and saves store the ID. Never reuse or renumber an ID.
export const TR = {
  melee: 'TR1', ranged: 'TR2', unarmed: 'TR3', natural: 'TR4', defense: 'TR5',
  armor: 'TR6', perception: 'TR7', stealth: 'TR8', speech: 'TR9', swordsman: 'TR10',
  slime_senses: 'TR11', tools: 'TR12', sword_dancer: 'TR13',
} as const;
