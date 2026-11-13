// The "You fell" screen's words: one sassy line about the blow that dropped the player, and the plain facts under it.
// Built only from what the player knew (LogLine.downedBy): an unseen attacker stays "someone" and its weapon unnamed.
import type { DownedBy } from '../types/game';
import { cap } from '../words';

const a = (x: string) => `${/^[aeiou]/i.test(x) ? 'an' : 'a'} ${x}`;

/** the sassy line; `seed` (the turn) picks among the lines that fit what the player knew */
export function fellLine(d: DownedBy | undefined, seed: number): string {
  if (!d) return 'You went down, and nobody is owning up to it.';
  const your = d.part ? `your ${d.part}` : 'you';
  const pick = (xs: string[]) => xs[Math.abs(seed) % xs.length];
  if (d.unseen) return pick([
    `Something you never saw found ${your}. You didn’t even get to be offended about it.`,
    `A blow out of nowhere took ${your}. Rude. Effective, but rude.`,
    `You never saw who did it. ${cap(your)} would like a word with them, later.`,
  ]);
  const by = d.by, By = cap(d.by);
  if (d.outcome === 'grazed') return pick([
    `Just a graze from ${by}. Turns out that was the last thing holding you up.`,
    `${By} barely touched ${your}. Your body took it as a final notice.`,
  ]);
  if (!d.weapon) return pick([
    `${By} hit ${your} with nothing but bad intentions, and that was plenty.`,
    `${By} took ${your} apart by hand. Humbling, really.`,
  ]);
  return pick([
    `${By} put ${a(d.weapon)} into ${your}, and your body decided the conversation was over.`,
    `${By} swung ${a(d.weapon)} at ${your}. You had plans. They didn’t survive the ${d.outcome}.`,
    `A ${d.outcome} to ${your}, courtesy of ${by} and ${a(d.weapon)}. You took it personally. The ground took you.`,
    `${By}’s ${d.weapon} met ${your}, and only one of you got back up.`,
  ]);
}

/** the plain facts: "Last blow: heavy hit · head · the bandit’s short sword" */
export function fellFacts(d: DownedBy | undefined): string {
  if (!d) return '';
  const from = d.unseen ? 'someone you never saw' : d.weapon ? `${d.by}’s ${d.weapon}` : d.by;
  return `Last blow: ${[d.outcome, d.part, from].filter(Boolean).join(' · ')}`;
}
