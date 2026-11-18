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
  { id: FX.draw_into_pack, name: 'Draw into the pack', skill: SK.stratagem, min: 40 }, // S1: fights one foe alone: falls back toward a bandmate in sight who isn't fighting
  // TC18 a, TC25 a: Fieldcraft rows walk to a zone within one move; none fires while a foe is near enough to strike it
  { id: FX.out_of_sight, name: "Out of the shooter's sight", skill: SK.fieldcraft, min: 30 }, // F1: shot at from beyond reach: walks where the shooter can't see
  { id: FX.into_cover, name: 'Into cover', skill: SK.fieldcraft, min: 50 }, // F2: a foe it sees holds a ranged weapon: walks to more cover
  { id: FX.into_dark, name: 'Into the dark', skill: SK.fieldcraft, min: 75 }, // F3: walks to a darker zone where it still sees its foes clearly
  { id: FX.finish_hurt, name: 'Finish the hurt one', skill: SK.battle_sense, min: 75 }, // B5: two or more foes, one visibly hurt: it attacks that one
  { id: FX.strike_from_hiding, name: 'Strike from hiding', skill: SK.stratagem, min: 55 }, // S2: sees no foe now: sneaks toward the one it hunts instead of closing in openly
];
