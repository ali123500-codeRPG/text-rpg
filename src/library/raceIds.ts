// Race and body type IDs: every race's and body type's ID is fixed (type prefixes RC and BT + a number), never its
// name, so renaming one touches only its name in the library. Code refers to them through RC and BT; data and saves
// store the ID. Never reuse or renumber an ID.
export const RC = {
  human: 'RC1', elf: 'RC2', slime: 'RC3', dragon: 'RC4',
  dog: 'RC5', wolf: 'RC6', tiger: 'RC7', bear: 'RC8', boar: 'RC9', horse: 'RC10', lizard: 'RC11', python: 'RC12',
  spider: 'RC13', lion: 'RC14', leopard: 'RC15', hyena: 'RC16', crocodile: 'RC17',
} as const;
export const BT = {
  humanoid: 'BT1', amorphous: 'BT2', winged_quadruped: 'BT3', quadruped: 'BT4', serpent: 'BT5', eight_legged: 'BT6',
} as const;
