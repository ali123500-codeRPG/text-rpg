// 320 BF61 (BG-236) and BF62 (BG-237): a giver offers only jobs the game can check and names only things that are there; a
// take of something not in view from a named place is a search there; a put-off line that is only a placeholder is dropped.
import { describe, expect, it } from 'vitest';
import { FIXED, PARSER_INSTRUCTIONS } from '../../src/agents/prompts';
import { actionWords, placeholderLine } from '../../src/agents/wrappers';
import type { PlayerView } from '../../src/types';

describe('320 checkable jobs and real takes', () => {
  it('BF61: every job-giving agent is told to offer only checkable jobs and name only what is there; "other" is not offered', () => {
    const givers = (['planner', 'responder', 'voice'] as const).map((k) => JSON.stringify(FIXED[k])).filter((p) => p.includes('A job is a deal'));
    expect(givers.length).toBeGreaterThan(0);
    for (const p of givers) {
      expect(p).toContain('Offer only a job of these kinds, which the game can check');
      expect(p).toContain('Never say a tool or thing is somewhere unless your view shows it there');
      expect(p).not.toMatch(/"kind\\?":"defeat"\|"deliver"\|"reach"\|"find"\|"other"/);
    }
  });

  it('BF62: the Parser reads a take from a named place as a search there, and never writes a stand-in put-off line', () => {
    expect(PARSER_INSTRUCTIONS).toContain('is a search there: that move with the search');
    expect(PARSER_INSTRUCTIONS).toContain('never an action name with a stand-in');
  });

  it('BF62: placeholder put-off lines are spotted; lines the player would type are not', () => {
    for (const l of ['interact them', 'interact', 'other', 'take it', 'use_item them', 'talk to IT12', '']) expect(placeholderLine(l), l).toBe(true);
    for (const l of ['take the hinge pins from the trough', 'ask Osric about the gate', 'search the trough']) expect(placeholderLine(l), l).toBe(false);
  });

  it('BF62: an action that waits for arrival waits as nothing when it has no line the player would type', () => {
    const view = { actors: [{ id: 'hob', name: 'Hob' }], lastSeen: [], talkingWith: [], player: { inventory: [] } } as unknown as PlayerView;
    const a = (type: string, target: string | null) => ({ type, target, skill: '', item: null, targetPart: null, mode: null, approach: '', stance: 'normal' }) as never;
    expect(actionWords(a('interact', 'trough'), view)).toBe('');
    expect(actionWords(a('talk', 'nobody_known'), view)).toBe('');
    expect(actionWords(a('talk', 'hob'), view)).toBe('talk to Hob');
  });
});
