// NPC template IDs: every template's ID is fixed (type prefix TP + a number), never its name, so renaming one touches
// only the library. Code refers to templates through TP; data, saves and the Weaver's cast use the ID. Never reuse or
// renumber an ID.
export const TP = {
  slime: 'TP1', guard: 'TP2', trader: 'TP3', thief: 'TP4', patron: 'TP5', child: 'TP6',
} as const;
