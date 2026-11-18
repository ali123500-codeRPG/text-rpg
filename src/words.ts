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
  return [name, short].some((w) => !!w && new RegExp(`\\b${esc(w)}\\b`).test(text));
};
/** NM3: a name the speaker gives for themselves ("Name's Tam", "call me Tam") that is not theirs, or undefined */
export function falseName(speaker: { names: { current: string } }, text: string | undefined): string | undefined {
  for (const m of (text ?? '').matchAll(/\b(?:[Nn]ame's|[Nn]ame is|I'm|I am|[Cc]all me|[Kk]nown as)\s+([A-Z][a-z]+)\b(?!')/g)) {
    if (!speaker.names.current.split(/\s+/).includes(m[1]) && !CONFIG.NAME_TITLE_WORDS.includes(m[1].toLowerCase())) return m[1];
  }
  return undefined;
}

/** "a lean man" -> "the lean man": someone already met, said again */
export const theOf = (label: string): string => label.replace(/^(a|an)\s+/i, 'the ');
/** an item's name with "the": its own article turned to the, else the added */
export const theItem = (n: string): string => (/^(the|a|an|some)\s/i.test(n) ? theOf(n) : `the ${n}`);
/** BG-218: a place or zone name in a phrase. A name that starts with an article, a capital (a proper name, Thornbury) or a
 *  place word (behind the counter) stands as it is; any other takes "the" (common room → the common room). */
export const theName = (n: string): string =>
  /^(the|a|an|behind|beside|outside|inside|under|above|below|beyond|by|near|past|across|along|off)\s/i.test(n) || /^[A-Z]/.test(n) ? n : `the ${n}`;
/** the text with its first letter in capitals */
export const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
/** "a, b and c" (or "a, b or c"): a list as a sentence says it */
export const listWords = (xs: string[], last: 'and' | 'or' = 'and'): string =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`;
/** a number rounded to one decimal, the way metres, XP and stats are shown and kept */
export const r1 = (x: number): number => Math.round(x * 10) / 10;

/** G3: every game term on screen has one tip with its plain meaning, from this one table, the same on every page */
export const GAME_TERMS: Record<string, string> = {
  'Critical Failure': 'Far below what was needed: the worst result a roll can give.',
  Failure: 'Below what was needed: it doesn’t work.',
  'Near Miss': 'Just short of what was needed: it doesn’t quite work.',
  Success: 'What was needed: it works.',
  'Great Success': 'Well above what was needed: it works better than planned.',
  'Critical Success': 'Far above what was needed: the best result a roll can give.',
  Burden: 'The more skill points you hold, the harder an untagged skill is to improve: Burden comes off its improvement rolls.',
  Thread: 'Your XP. It gathers from what you do and brings character levels.',
  'All-50': 'When enough skills of one tree reach this step (three in most trees), the tree gives a perk for free. The steps go on every 50: All-100, All-150.',
  Breakthrough: 'The perks at 20, 60, 100 and 140 of a skill: each changes what you can do.',
  Refinement: 'The perks at 40, 80 and 120 of a skill: each raises numbers.',
};
/** a term's plain meaning; a tier with + or − marks, "The Thread" and any All step read their base term */
export const termMeaning = (word: string): string | undefined =>
  GAME_TERMS[word] ?? GAME_TERMS[word.replace(/[+−]+$/, '')] ?? GAME_TERMS[word.replace(/^The /, '')] ?? (/^All-\d+$/.test(word) ? GAME_TERMS['All-50'] : undefined);
/** attributes that give an element its term's tip (and the dotted underline that says it has one) */
export const termAttrs = (word: string): Record<string, string> => { const m = termMeaning(word); return m ? { title: m, 'data-term': '' } : {}; };
