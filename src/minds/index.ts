// W5 — Routines (desired state), Explore mode (detection, ambush, alarm), the fallback combat list, the routine bank validator.
// Code minds (routines.ts) read only ActorView, never GameState (test 26).
export { FOLLOW_ROUTINE, offeredRoutines, followMove, desiredState, routineOrder, fallbackOrder, brokenOrder, bindTemplate, expandSteps, slotsRead, mapPath, UNREACHABLE } from './routines';
export { installRoutines, switchRoutine, updateAlarms, alertOrders, detectPlayer, stealthDetect, resolveAmbush, raiseAlarm, calmBandmatesSwitch } from './state';
export { validateRoutineBank, STANDARD_SLOTS } from './bank';
