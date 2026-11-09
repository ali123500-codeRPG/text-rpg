// Class IDs: every class's ID is a fixed number, never its name, so renaming a class touches only its name in the
// library. Code refers to classes through CL; data and saves store the number (as a string key).
// Never reuse or renumber an ID; a new class takes the next free number.
export const CL = {
  swordsman: '1', late_bloomer: '2', sword_dancer: '3', commoner: '4', a_nobody: '5',
} as const;
export type ClassId = (typeof CL)[keyof typeof CL];
