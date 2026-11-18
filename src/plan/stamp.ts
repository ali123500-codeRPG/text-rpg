// The floor plan's change stamp: bumped whenever walls or openings change shape, so look-up grids and path graphs built on
// them are rebuilt (src/plan/line.ts, src/plan/path.ts).
let stamp = 0;
export const planStamp = (): number => stamp;
export const planChanged = (): void => { stamp++; };
