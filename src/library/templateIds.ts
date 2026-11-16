// NPC template IDs: every template's ID is fixed (type prefix TP + a number), never its name, so renaming one touches
// only the library. Code refers to templates through TP; data, saves and the Weaver's cast use the ID. Never reuse or
// renumber an ID.
export const TP = {
  slime: 'TP1', guard: 'TP2', trader: 'TP3', thief: 'TP4', patron: 'TP5', // TP6 (a village child) retired: no children in the game
  // the people and beasts behind the roster hooks and groups (NR17-NR20, NR27): each gives a challenge, a benefit or a story
  hunter: 'TP7', healer: 'TP8', headman: 'TP9', knight: 'TP10', bandit: 'TP11', bandit_chief: 'TP12', watch_sergeant: 'TP13',
  pedlar: 'TP14', hired_guard: 'TP15', wolf: 'TP16', boar: 'TP17', bear: 'TP18', dog: 'TP19', dire_wolf: 'TP20',
} as const;
