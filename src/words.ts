// Text matching shared by the Weaver validator and the narration checks.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** whole-word, case-insensitive phrase match */
export function mentions(text: string, phrase: string): boolean {
  const p = esc(phrase.trim());
  const pre = /^\w/.test(phrase.trim()) ? '\\b' : '';
  const post = /\w$/.test(phrase.trim()) ? '\\b' : '';
  return new RegExp(`${pre}${p}${post}`, 'i').test(text);
}
