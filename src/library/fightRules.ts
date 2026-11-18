// D-17 (TC3 a): the code-run fight list's skilled rows. A row may fire when the NPC's value for its skill reaches the row's
// minimum (TC7: its own skill, or the best Command of a bandmate it hears, src/views/tactics.ts). Code checks the rows in
// table order (TC21 a: set by hand), after the broken rule and before today's attack, close in, search and hold
// (minds/routines.ts fallbackOrder). Minimums are placeholders on the 0-100 scale (50 a trained soldier, 75 the best).
import { SK } from './skillIds';
import { FX } from './tableIds';

export type FightRule = { id: string; name: string; skill: string; min: number };

export const FIGHT_RULES: readonly FightRule[] = [
  { id: FX.call_help, name: 'Call for help', skill: SK.battle_sense, min: 20 }, // B1: its fight has more foes than allies; once a fight
  { id: FX.gang_up, name: 'Gang up', skill: SK.battle_sense, min: 35 }, // B2: an ally fights a foe within one move: it attacks that foe
  { id: FX.back_off, name: 'Back off when hurt', skill: SK.battle_sense, min: 65 }, // B4: Wounded or worse and outnumbered: walks to a bandmate not fighting
  { id: FX.finish_hurt, name: 'Finish the hurt one', skill: SK.battle_sense, min: 75 }, // B5: two or more foes, one visibly hurt: it attacks that one
];
