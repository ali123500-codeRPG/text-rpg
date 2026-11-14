// BF72: answering a question the Parser asked: which order and which question the player's next words answer.
import type { LogLine } from '../types';

/** BF72: the newest story line is a question asked this turn: the words now sent answer it. The order it was about is the first
 * order of that run of orders and questions, so a second answer is still read against what the player first asked for. */
export function answering(ls: readonly LogLine[], turn: number): { question: string; order: string } | null {
  const q = ls.at(-1);
  if (q?.kind !== 'clarify' || q.turn !== turn) return null;
  let order: string | null = null;
  for (let i = ls.length - 2; i >= 0 && ls[i].turn === turn && ls[i].kind === 'player'; i -= 2) {
    order = ls[i].text;
    if (ls[i - 1]?.kind !== 'clarify' || ls[i - 1].turn !== turn) break;
  }
  return order ? { question: q.text, order } : null;
}
