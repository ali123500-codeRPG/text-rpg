// IAA-108: the Chronicler. One background call per ended scenario: it reads that scenario's turns and the achievement
// library and proposes deeds no achievement counts yet. Its ideas go to the GM view's Wanted list (hidden.templateWants,
// of 'deed') for the owner to review; an approved one becomes an achievement only as a code rule (PROG-118).
import type { GameState, LogLine, ScenarioRecord, TemplateWant } from '../types';
import { getLibrary } from '../library';
import { ACH_RULE_TEXT } from '../library/achievementIds';
import { runAgent, type AgentCtx } from './call';
import { FIXED } from './prompts';
import { checkChronicler } from './schema';

export type DeedWant = TemplateWant;

/** the Chronicler's data: the scenario, its turns as the player saw them, what the library's achievements count, and the deeds already proposed */
export function chroniclerData(s: GameState, r: ScenarioRecord, lines: readonly LogLine[]): string {
  const turns = lines.filter((l) => l.turn >= r.startTurn && l.turn <= r.endTurn && (l.kind === 'player' || l.kind === 'narration'))
    .map((l) => `[turn ${l.turn}] ${l.kind}: ${l.text}${l.scenarioEnd?.closing ? ` ${l.scenarioEnd.closing}` : ''}`);
  const byRule = new Map<string, string[]>();
  for (const d of Object.values(getLibrary().achievements ?? {})) byRule.set(d.rule, [...(byRule.get(d.rule) ?? []), d.name]);
  const library = [...byRule].map(([rule, names]) => `- ${ACH_RULE_TEXT[rule as keyof typeof ACH_RULE_TEXT] ?? rule}: ${names.join('; ')}`);
  const proposed = (s.hidden.templateWants ?? []).filter((w) => w.of === 'deed').map((w) => `- ${w.label}${w.wanted ? `: ${w.wanted}` : ''}`); // a turned-down idea keeps only its name
  return [`SCENARIO: ${JSON.stringify({ number: r.number, question: r.question, ending: r.ending, outcome: r.text, turns: `${r.startTurn}-${r.endTurn}` })}`,
    `TURNS:\n${turns.join('\n') || '(none)'}`,
    `LIBRARY (what achievements count, then the names that count it):\n${library.join('\n')}`,
    `PROPOSED (already proposed; do not repeat):\n${proposed.join('\n') || '(none)'}`].join('\n\n');
}

/** one Chronicler call for scenario r; its ideas as Wanted rows (none on a failed call) */
export async function callChronicler(s: GameState, r: ScenarioRecord, lines: readonly LogLine[], ctx: AgentCtx): Promise<DeedWant[]> {
  const run = await runAgent(ctx, { agent: 'chronicler', fixed: FIXED.chronicler, data: chroniclerData(s, r, lines), schema: checkChronicler });
  return (run.value?.ideas ?? []).filter((i) => i.name.trim() && i.deed.trim()).map((i) => ({
    turn: i.turn >= r.startTurn && i.turn <= r.endTurn ? i.turn : r.endTurn, scenario: r.number, actorId: s.player.id,
    label: i.name.trim(), wanted: i.seen?.trim() ? `${i.deed.trim()} (${i.seen.trim()})` : i.deed.trim(), template: '', of: 'deed' as const,
  }));
}
