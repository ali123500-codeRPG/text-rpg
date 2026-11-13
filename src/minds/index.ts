// W5 — Routines (desired state), Explore mode (detection, ambush, alarm), the fallback combat list, the routine bank validator.
// Code minds (routines.ts) read only ActorView, never GameState (test 26).
export { FOLLOW_ROUTINE, HEAD_TO, offeredRoutines, followMove, desiredState, routineOrder, fallbackOrder, brokenOrder, bindTemplate, expandSteps, slotsRead, mapPath, UNREACHABLE } from './routines';
export { installRoutines, switchRoutine, headTo, headArrivals, staying, updateAlarms, alertOrders, detectPlayer, stealthDetect, searchFor, searchAreaM2, searchItems, searchPerson, handsOn, openToHands, revealedTo, resolveAmbush, raiseAlarm, calmBandmatesSwitch, knownFromTheStart } from './state';
export { validateRoutineBank, STANDARD_SLOTS } from './bank';
