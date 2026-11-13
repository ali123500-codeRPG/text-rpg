// AT2/AT17/AT47: a long action under way (Actor.busy), read by the engine, the views and the pipeline.
import type { Actor } from '../types';
import { actionRow } from '../ruleset/actionTime';

/** AT47: an actor at a long action that goes on by itself (not paused) */
export const busyNow = (a: Actor): boolean => !!a.busy && !a.busy.paused;

/** AT11a (stage 4): what an actor is busy at, in words, and its seconds done and to go (whole seconds) */
export const doingOf = (a: Actor): { what: string; done: number; left: number } | undefined =>
  busyNow(a) ? { what: actionRow(a.busy!.row)?.name ?? a.busy!.row, done: Math.round(a.busy!.done), left: Math.round(a.busy!.need - a.busy!.done) } : undefined;
