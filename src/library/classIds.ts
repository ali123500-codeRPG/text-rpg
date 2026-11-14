// Class IDs: every class's ID is fixed (type prefix CL + a number), never its name, so renaming a class touches only its
// name in the library. Code refers to classes through CL; data and saves store the ID.
// Never reuse or renumber an ID; a new class takes the next free number.
export const CL = {
  swordsman: 'CL1', late_bloomer: 'CL2', sword_dancer: 'CL3', commoner: 'CL4', a_nobody: 'CL5', trader: 'CL6', merchant: 'CL7', guard: 'CL8',
  threadbounded: 'CL9', // the Threadbounded class (TB7): the class of The Threadbound start; not the item kind
  blessed_by_imbra: 'CL10', // DX1: Blessed by Imbra, the blessed start's class when Imbra blesses
} as const;
export type ClassId = (typeof CL)[keyof typeof CL];
