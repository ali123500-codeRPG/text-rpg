// Body types: every body shape and its parts (Part 3). prototypeLibrary() in data.ts reads them from here.
import { AM, RL } from './tableIds';
import { BT } from './raceIds';
import { HUMANOID_SIZE } from './bodySize';
import type { BodyType, PartDef, RoleId } from '../types';
import { SK } from './skillIds';
import { FISTS, held } from './items';

/** BV7 a: a four-legged body has one part per leg, each small, so the four together keep a pair's old odds (2 × normal) */
export const FORELEGS = ['left_foreleg', 'right_foreleg'] as const, HIND_LEGS = ['left_hind_leg', 'right_hind_leg'] as const;
const fourLegs = (roles: RoleId[]): PartDef[] => [...FORELEGS, ...HIND_LEGS].map((id) => ({ id, size: 'small' as const, impact: 'normal' as const, roles }));
export const BODY_TYPES: Record<string, BodyType> = {
  [BT.humanoid]: {
    id: BT.humanoid, name: 'Humanoid', general: { name: 'torso', size: 'normal' },
    size: HUMANOID_SIZE, // SZ3 (library/bodySize)
    // SZ8: a grapple takes hold a hand's breadth inside the arm's full reach
    naturalAttacks: [FISTS,
      { id: AM.grapple, tree: 'unarmed', class: 'grapple', skill: SK.unarmed_grapple, ...held(-0.1), grips: 0, name: 'grapple' }],
    parts: [
      { id: 'head', size: 'small', impact: 'essential', roles: [RL.sense, RL.speech], adjacent: ['general', 'neck'] },
      // FR2, SZ8: an arm reaches half the arm span less half the shoulders past the body (library/bodySize armReachM)
      { id: 'left_arm', size: 'normal', impact: 'normal', roles: [RL.grip], arm: true },
      { id: 'right_arm', size: 'normal', impact: 'normal', roles: [RL.grip], arm: true },
      { id: 'left_leg', size: 'normal', impact: 'normal', roles: [RL.move] },
      { id: 'right_leg', size: 'normal', impact: 'normal', roles: [RL.move] },
      { id: 'neck', size: 'extra_small', impact: 'essential', roles: [], adjacent: ['head', 'general'] },
    ],
    fallback: { attackSkill: SK.unarmed_strike },
    // Side-sheet figure: one SVG path per part id, 'general' is the torso. Facing the viewer, so the
    // character's right side is drawn on the left.
    figure: {
      viewBox: '0 0 200 258',
      parts: {
        head: 'M100 5a19 22 0 1 0 0.01 0z',
        neck: 'M91 47h18l2 14H89z',
        general: 'M70 64q30-8 60 0l-4 46q-2 22 0 40H74q2-18 0-40z',
        right_arm: 'M68 66q-14 4-18 22l-8 52q-1 8 6 9t9-7l8-44z',
        left_arm: 'M132 66q14 4 18 22l8 52q1 8-6 9t-9-7l-8-44z',
        right_leg: 'M74 152h25l-2 96q0 6-7 6h-8q-6 0-6-6z',
        left_leg: 'M101 152h25l-2 96q0 6-6 6h-8q-7 0-7-6z',
      },
    },
  },
  // BR4: shape names, so later races can reuse them; Slime and Dragon are races
  [BT.amorphous]: {
    id: BT.amorphous, name: 'Amorphous', general: { name: 'body', size: 'normal' },
    size: { lengthM: 0.5, widthM: 0.5, heightM: 0.3 }, // SZ3: the Slime: a low mound of about 30 kg (its HP multiplier's mass); an estimate
    // SZ9: reach is metres past the body's edge: a slam lunges a little way out of the mound (estimate)
    naturalAttacks: [{ id: AM.slam, tree: 'unarmed', class: 'slam', skill: SK.slam, reachM: 0.2, reach: 0.2, grips: 0, name: 'slam' }],
    parts: [],
    fallback: { attackSkill: SK.slam },
  },
  [BT.winged_quadruped]: {
    id: BT.winged_quadruped, name: 'Winged quadruped', general: { name: 'body', size: 'big' },
    // SZ3: the Dragon: about 1,000 kg, a horse's shape at twice its weight (each measure × 2^(1/3)), wings folded; an estimate
    size: { lengthM: 3, widthM: 0.85, heightM: 2 },
    naturalAttacks: [],
    parts: [
      // FR4: a quadruped takes and carries things in its jaws, as a dog or a horse does. SZ9: reach is metres past the body's
      // edge (its nose): the long neck stretches about 0.8 m further (estimate)
      { id: 'head', size: 'normal', impact: 'essential', roles: [RL.sense, RL.strike, RL.speech, RL.grip], adjacent: ['general', 'neck'], reachM: 0.8 },
      // BV8 a: the long neck is a small part (the quadruped's is extra small), essential like every neck
      { id: 'neck', size: 'small', impact: 'essential', roles: [], adjacent: ['head', 'general'] },
      { id: 'left_wing', size: 'normal', impact: 'non_essential', roles: [RL.fly] },
      { id: 'right_wing', size: 'normal', impact: 'non_essential', roles: [RL.fly] },
      ...fourLegs([RL.move]),
      { id: 'tail', size: 'small', impact: 'non_essential', roles: [RL.strike] },
    ],
    fallback: { attackSkill: SK.bite },
  },
  // NR14 a: one four-legged shape for every land beast; each race sets its own speeds and attacks (a dog, a tiger, a horse)
  [BT.quadruped]: {
    id: BT.quadruped, name: 'Quadruped', general: { name: 'body', size: 'big' },
    size: { lengthM: 1.3, widthM: 0.3, heightM: 0.8 }, // SZ3: the Wolf (head and body 1.0–1.6 m, shoulder 0.6–0.85 m; Mech 1970)
    naturalAttacks: [], // by race: bite force differs too much between a dog and a tiger for one shape attack
    parts: [
      // FR4: takes and carries things in its jaws. SZ9: reach is metres past the body's edge (its nose): the neck stretches
      // about 0.2 m (estimate); SZ10: × the race's length
      { id: 'head', size: 'small', impact: 'essential', roles: [RL.sense, RL.strike, RL.grip], adjacent: ['general', 'neck'], reachM: 0.2 },
      { id: 'neck', size: 'extra_small', impact: 'essential', roles: [], adjacent: ['head', 'general'] },
      ...fourLegs([RL.move, RL.strike]),
      { id: 'tail', size: 'small', impact: 'non_essential', roles: [RL.strike] },
    ],
    fallback: { attackSkill: SK.bite },
  },
  // legless: the coils move it and squeeze; nothing to carry with (grip reach 0, as amorphous)
  [BT.serpent]: {
    id: BT.serpent, name: 'Serpent', general: { name: 'body', size: 'normal' },
    // SZ3: the Python lies coiled or bent (5–6 m long, about 0.25 m thick), a coil about 1 m across; an estimate
    size: { lengthM: 1, widthM: 1, heightM: 0.3 },
    naturalAttacks: [],
    parts: [
      { id: 'head', size: 'small', impact: 'essential', roles: [RL.sense, RL.strike] },
      { id: 'coils', size: 'normal', impact: 'normal', roles: [RL.move, RL.strike] },
      { id: 'tail', size: 'small', impact: 'non_essential', roles: [RL.move] },
    ],
    fallback: { attackSkill: SK.bite },
  },
  // a spider's shape (CS24: 5 of 8 legs Crippled, or 4 Destroyed, stop it running); fangs on the head; no grip
  [BT.eight_legged]: {
    id: BT.eight_legged, name: 'Eight-legged', general: { name: 'body', size: 'normal' },
    size: { lengthM: 1.5, widthM: 1.3, heightM: 0.6 }, // SZ3: the Giant spider, a wolf's weight: legs spread 1.5 by 1.3 m; an estimate
    naturalAttacks: [],
    parts: [
      { id: 'head', size: 'small', impact: 'essential', roles: [RL.sense, RL.strike] },
      ...[1, 2, 3, 4].flatMap((n) => (['left', 'right'] as const).map((side) => ({ id: `${side}_leg_${n}`, size: 'extra_small' as const, impact: 'normal' as const, roles: [RL.move] }))),
    ],
    fallback: { attackSkill: SK.bite },
  },
};
