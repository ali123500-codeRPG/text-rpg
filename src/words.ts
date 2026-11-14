// Text matching shared by the Weaver validator and the narration checks.
import { CONFIG } from './config';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** whole-word, case-insensitive phrase match */
export function mentions(text: string, phrase: string): boolean {
  const p = esc(phrase.trim());
  const pre = /^\w/.test(phrase.trim()) ? '\\b' : '';
  const post = /\w$/.test(phrase.trim()) ? '\\b' : '';
  return new RegExp(`${pre}${p}${post}`, 'i').test(text);
}
/** BG-95: the line holds the name whole or its first word that is not a title (CONFIG.NAME_TITLE_WORDS), with capitals kept */
export const nameSaid = (text: string, name: string): boolean => {
  const short = name.split(/\s+/).find((w) => !CONFIG.NAME_TITLE_WORDS.includes(w.toLowerCase()));
  // case kept, so the name Will is not the word "will"
  return [name, short].some((w) => !!w && new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
};
/** NM3: a name the speaker gives for themselves ("Name's Tam", "call me Tam") that is not theirs, or undefined */
export function falseName(speaker: { names: { current: string } }, text: string | undefined): string | undefined {
  for (const m of (text ?? '').matchAll(/\b(?:[Nn]ame's|[Nn]ame is|I'm|I am|[Cc]all me|[Kk]nown as)\s+([A-Z][a-z]+)\b(?!')/g)) {
    if (!speaker.names.current.split(/\s+/).includes(m[1]) && !CONFIG.NAME_TITLE_WORDS.includes(m[1].toLowerCase())) return m[1];
  }
  return undefined;
}

/** the text with its first letter in capitals */
/** "a lean man" -> "the lean man": someone already met, said again */
export const theOf = (label: string): string => label.replace(/^(a|an)\s+/i, 'the ');
/** BG-218: a place or zone name in a phrase. A name that starts with an article, a capital (a proper name, Thornbury) or a
 *  place word (behind the counter) stands as it is; any other takes "the" (common room → the common room). */
export const theName = (n: string): string =>
  /^(the|a|an|behind|beside|outside|inside|under|above|below|beyond|by|near|past|across|along|off)\s/i.test(n) || /^[A-Z]/.test(n) ? n : `the ${n}`;
export const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
/** "a, b and c" (or "a, b or c"): a list as a sentence says it */
export const listWords = (xs: string[], last: 'and' | 'or' = 'and'): string =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`;
/** a number rounded to one decimal, the way metres, XP and stats are shown and kept */
export const r1 = (x: number): number => Math.round(x * 10) / 10;
