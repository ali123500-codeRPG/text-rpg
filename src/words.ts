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
export const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
