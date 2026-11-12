import { TIME_OF_DAY } from '../scales';
// Routine bank import validator (designer tool): the "Routine bank import" checks of Leak prevention.
import type { ActivityDef, Routine, RoutineSet } from '../types';
import { slotsRead } from './routines';

export const STANDARD_SLOTS = ['post', 'route', 'refuge', 'exit', 'here'];

export function validateRoutineBank(bank: { routines: Record<string, Routine>; sets: Record<string, RoutineSet>; activities: Record<string, ActivityDef> }): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const setsOf = (rid: string) => Object.values(bank.sets).filter((s) => s.routines.includes(rid));
  for (const s of Object.values(bank.sets))
    for (const rid of s.routines) if (!bank.routines[rid]) errors.push(`set ${s.id}: unknown routine ${rid}`);
  for (const r of Object.values(bank.routines)) {
    const timed = Object.entries(r.times ?? {});
    const acts = r.kind === 'schedule' ? [...r.steps, ...timed.flatMap(([, st]) => st ?? [])].map((st) => st.activity) : [r.activity];
    for (const a of acts) if (!a || !bank.activities[a]) errors.push(`routine ${r.id}: unknown activity ${a ?? '(none)'}`);
    if (r.kind === 'schedule' && !r.steps.length) errors.push(`routine ${r.id}: schedule with no steps`);
    if (r.kind !== 'schedule' && (r.steps.length || timed.length)) errors.push(`routine ${r.id}: steps on a ${r.kind} routine`);
    // NW10: a time of day is one of TIME_OF_DAY's keys, and names at least one step
    for (const [k, st] of timed) if (!TIME_OF_DAY.has(k) || !st?.length) errors.push(`routine ${r.id}: times.${k} is not a time of day with steps`);
    if (r.alert && !bank.routines[r.alert]) errors.push(`routine ${r.id}: unknown alert routine ${r.alert}`);
    const sets = setsOf(r.id);
    const reads = slotsRead(r);
    if (sets.length > 1)
      for (const slot of reads) if (!STANDARD_SLOTS.includes(slot)) errors.push(`routine ${r.id}: shared routine reads non-standard slot ${slot}`);
    for (const s of sets) {
      for (const slot of reads) if (!s.slots[slot]) errors.push(`routine ${r.id}: reads slot ${slot} not declared in set ${s.id}`);
      if (r.alert && !s.routines.includes(r.alert)) errors.push(`routine ${r.id}: alert ${r.alert} not in set ${s.id}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
