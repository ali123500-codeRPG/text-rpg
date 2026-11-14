// LN1-LN8 (Narrator length per turn): the narration ran about 171 words, 3-4 paragraphs, on every turn.
// Code now picks a band per turn (Quick, Normal, Big) from what was resolved, tells the Narrator its words and paragraphs
// (scaled by the story's Narration length setting; spoken lines come on top), and records each narration's band and words.
import { describe, expect, it } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';
import { CONFIG } from '../../src/config';
import { lengthReport } from '../../src/agents/narration';
import type { LogLine } from '../../src/types';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';

const styleOf = (req: { input: { content: string }[] }) => {
  const data = req.input[1].content;
  return JSON.parse(data.slice(data.indexOf('STYLE:\n') + 7).split('\n\n')[0]) as { length: string };
};
const words = (band: 'quick' | 'normal' | 'big', k = 1) => CONFIG.NARRATION_LENGTH[band].words.map((w) => Math.max(1, Math.round(w * k))).join(' to ');

describe('LN narration length', () => {
  it('a look where nothing changes is Quick; walking into a zone never stood in is Big; the line records band and words', async () => {
    const g = wholeTurn({ without: ['slime_1', 'slime_2', 'guard_1'] });
    await g.turn(intent());
    expect(styleOf(g.claude.callsFor('narrator').at(-1) as never).length).toContain(`${words('quick')} words`);
    expect(g.game.lines().at(-1)?.length).toMatchObject({ band: 'quick', words: 4, top: CONFIG.NARRATION_LENGTH.quick.words[1] });

    await g.turn(intent({ move: { toZone: 'tav_counter' }, action: null }));
    expect(styleOf(g.claude.callsFor('narrator').at(-1) as never).length).toContain(`${words('big')} words`);
    await g.turn(intent({ move: { toZone: 'tav_common' }, action: null })); // back where it started: no longer a first visit
    expect(g.game.lines().at(-1)?.length?.band).not.toBe('big');
  });

  it('the story setting scales the words; spoken lines are said to come on top', async () => {
    const g = wholeTurn({ without: ['slime_1', 'slime_2', 'guard_1'] });
    g.game.state()!.settings.narrationLength = 'shorter';
    await g.turn(intent());
    const length = styleOf(g.claude.callsFor('narrator').at(-1) as never).length;
    expect(length).toContain(`${words('quick', CONFIG.NARRATION_LENGTH_SCALE.shorter)} words`);
    expect(length).toContain('spoken lines shown under your text come on top');
  });

  it('the playtest report flags a narration over NARRATION_OVER times its band top', () => {
    const line = (turn: number, w: number): LogLine => ({ turn, kind: 'narration', text: 'x', length: { band: 'quick', words: w, top: 60 } });
    const md = lengthReport([line(1, 50), line(2, 60 * CONFIG.NARRATION_OVER + 1)]);
    expect(md).toContain('Quick: 2 turns');
    expect(md).toContain('turn 2:');
    expect(md).not.toContain('turn 1:');
  });

  it('TL4 d: the running commentary is asked for, and the view carries what shapes it (nerve, morale, health, wounds)', async () => {
    expect(NARRATOR_INSTRUCTIONS).toContain('running commentary');
    const g = wholeTurn({ without: ['slime_1', 'slime_2', 'guard_1'] });
    await g.turn(intent());
    const data = (g.claude.callsFor('narrator').at(-1) as { input: { content: string }[] }).input[1].content;
    const p = JSON.parse(data.slice(data.indexOf('NARRATION_VIEW:\n') + 16).split('\n\n')[0]).player;
    expect(p.personality).toMatch(/^Nerve: /);
    expect(p).toMatchObject({ morale: expect.any(String), health: expect.any(String), parts: expect.any(Array) });
  });
});
