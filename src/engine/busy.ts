// AT2/AT17/AT47: a long action under way (Actor.busy), read by the engine, the views and the pipeline.
import type { Actor } from '../types';
import { actionRow } from '../ruleset/actionTime';

/** AT47: an actor at a long action that goes on by itself (not paused) */
export const busyNow = (a: Actor): boolean => !!a.busy && !a.busy.paused;

/** AT11a (stage 4): a long action in words, and its seconds done and to go (whole seconds) */
export const busyWords = (b: { row: string; done: number; need: number }) => ({ what: actionRow(b.row)?.name ?? b.row, done: Math.round(b.done), left: Math.round(b.need - b.done) });
/** what an actor is busy at (busyWords), while it goes on */
export const doingOf = (a: Actor): { what: string; done: number; left: number } | undefined => (busyNow(a) ? busyWords(a.busy!) : undefined);
