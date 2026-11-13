// The Universe (HF6, HF17, HF22): the hidden layer over every world, kept apart from each story's save. For now it holds
// the shared calendar: the furthest day any world has reached. A new world starts on the day after it.
import type { Store } from './index';

const CALENDAR = 'universe/calendar';

/** the furthest day any world has reached (0 before the first story) */
export const universeDay = async (store: Store): Promise<number> => (await store.get<{ day: number }>(CALENDAR))?.day ?? 0;

/** a world reached `day`: the Universe date follows the furthest one */
export async function reachDay(store: Store, day: number): Promise<void> {
  if (day > (await universeDay(store))) await store.set(CALENDAR, { day });
}
