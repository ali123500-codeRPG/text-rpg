// BG-93: an NPC put a stage direction inside its spoken line ("*She's already got half of it in her mouth* Mmf.")
import { describe, expect, it } from 'vitest';
import { callPlanner, callVoice, VirtualClock, type AgentCtx } from '../../src/agents';
import { checkParserLegality, spokenOnly } from '../../src/agents/legality';
import { PARSER_INSTRUCTIONS, PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS } from '../../src/agents/prompts';
import { resetConfig } from '../../src/config';
import { ScriptedClaude } from '../harness';
import { actorView, dialogueView, intentOf, plannerOut, playerView, voiceOut } from './agent-views';

function setup() {
  resetConfig();
  const clock = new VirtualClock();
  const claude = new ScriptedClaude(clock);
  const errs: string[][] = [];
  const ctx: AgentCtx = { client: claude, clock, turn: 3, log: (e) => errs.push(e.errors), onError: () => {} };
  return { claude, ctx, errs };
}

describe('BG-93: a line is only the words spoken', () => {
  it('cuts stage directions, keeps the words', () => {
    expect(spokenOnly("*She's already got half of it in her mouth.* Mmf. Good bread.")).toBe('Mmf. Good bread.');
    expect(spokenOnly('[laughs] Fine.')).toBe('Fine.');
    expect(spokenOnly('*nods*')).toBe('');
  });
  it('one rule for every speaker: Planner, Voice and the player', async () => {
    const { claude, ctx, errs } = setup();
    const p = plannerOut();
    claude.push('planner', { ...p, dialogue: { line: '*grins* Hello there.', volume: 'normal' } });
    expect((await callPlanner(actorView(), ctx, { world: new Set() })).value?.dialogue?.line).toBe('Hello there.');
    expect(errs[0]).toContain('stage_direction');
    claude.push('voice', voiceOut({ line: '*chews* Mmf. Aye.' }));
    expect((await callVoice(dialogueView(), ctx, { world: new Set() })).output.line).toBe('Mmf. Aye.');
    const i = checkParserLegality({ ...intentOf(), spoken: '*bows* Good evening.' }, playerView());
    expect(i.intent.spoken).toBe('Good evening.');
  });
  it('every speaking agent is told so', () => {
    for (const t of [PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS]) expect(t).toContain('Your line holds only the words you say aloud');
    expect(PARSER_INSTRUCTIONS).toContain('"spoken" holds only words said aloud');
  });
});
