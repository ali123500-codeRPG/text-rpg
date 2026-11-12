// Time of day display ("Time of day display"): T1 a coloured icon beside the story title (the day and
// time of day are in its tip), T2 b a divider in the story when a wait or sleep moves the clock, T3 b natural recovery as
// a quiet green line (src/ui/healing.ts). Icons and colours are keyed by TIME_OF_DAY key; names come from that table.
import { TIME_OF_DAY } from '../scales';
import { h } from './kit';

// one path set per key, drawn on a 24 grid with round strokes (same style as the other hs-i icons)
const PATHS: Record<string, string[]> = {
  dawn: ['M4 18h16', 'M7 18a5 5 0 0 1 10 0', 'M12 4v4', 'M9.5 6.5 12 4l2.5 2.5', 'M4.5 12.5l1.5 1', 'M19.5 12.5l-1.5 1'],
  morning: ['M12 9.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6z', 'M4 19h16', 'M12 4v2.5', 'M5.6 7.6l1.6 1.6', 'M18.4 7.6l-1.6 1.6', 'M3.5 14H6', 'M18 14h2.5'],
  afternoon: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M12 2.5v2.5', 'M12 19v2.5', 'M2.5 12H5', 'M19 12h2.5', 'M5.3 5.3l1.8 1.8', 'M16.9 16.9l1.8 1.8', 'M5.3 18.7l1.8-1.8', 'M16.9 7.1l1.8-1.8'],
  dusk: ['M4 18h16', 'M7 18a5 5 0 0 1 10 0', 'M12 4v4', 'M9.5 5.5 12 8l2.5-2.5', 'M4.5 12.5l1.5 1', 'M19.5 12.5l-1.5 1'],
  evening: ['M17 13.5A6 6 0 0 1 10.5 7a6 6 0 1 0 6.5 6.5z', 'M4 20h16', 'M19 5v2', 'M18 6h2'],
  night: ['M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'],
};

export function todIcon(key: string): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'tod-i'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  for (const d of PATHS[key] ?? PATHS.afternoon) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); s.append(p);
  }
  return s;
}

const words = (day: number, key: string) => `Day ${day} · ${TIME_OF_DAY.name(key as never)}`;

/** T1: the header's icon, coloured by time of day; the words are its tip and its label */
export const todBadge = (day: number, key: string) =>
  // its own tip, shown at once on hover or focus: the header is rebuilt often, which cancels the browser's slow title tip
  h('span', { class: `tod tod-${key}`, 'data-tip': words(day, key), tabindex: '0', role: 'img', 'aria-label': words(day, key) }, todIcon(key));

/** T2: "11 hours later · Day 2 · Dawn" between story lines */
export function timePassedRow(t: { minutes: number; day: number; timeOfDay: string }): HTMLElement {
  const hrs = Math.floor(t.minutes / 60), min = t.minutes % 60;
  const span = [hrs ? `${hrs} hour${hrs === 1 ? '' : 's'}` : '', min ? `${min} minute${min === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
  return h('p', { class: `tpass tod-${t.timeOfDay}`, role: 'status' }, todIcon(t.timeOfDay), `${span} later · ${words(t.day, t.timeOfDay)}`);
}
