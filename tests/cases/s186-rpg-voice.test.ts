// 186 RPG Voice: the agent's commentary carries an acting note and a few sound tags for the RPG Voice connector; the
// screen and Claude's voices get the line without them, and any failure of the connector says why and falls back.
import { describe, expect, it } from 'vitest';
import { AUTOPILOT_BRIEF, VOICE_TAGS, plainLine, readMove } from '../../src/agents/autopilot';
import { VOICE_SAMPLES, pickSample } from '../../src/ui/voiceSamples';
import { VOICE_STYLES as STYLES } from '../../src/agents/autopilot';
import { type Mcp, RPG_SERVER, RPG_VOICES, rpgFailure, rpgSpeak, rpgVoices, splitLine } from '../../src/ui/rpgVoice';

describe('186 RPG Voice', () => {
  it('the brief asks for an acting note and offers exactly the sound tags the voice acts', () => {
    expect(AUTOPILOT_BRIEF).toContain('"direction"');
    for (const t of VOICE_TAGS) expect(AUTOPILOT_BRIEF).toContain(`<${t}>`);
  });

  it('a move keeps the voice’s own tags, drops any other markup, and reads the acting note', () => {
    const m = readMove({ command: 'I strike the guard', say: '<GASP> He <b>missed</b>! <short pause> <dance> Again!', direction: 'breathless <x>, then fierce' })!;
    expect(m.say).toBe('<gasp> He missed! <short pause> Again!');
    expect(m.direction).toBe('breathless, then fierce');
    expect(plainLine(m.say)).toBe('He missed! Again!');
    expect(readMove({ command: 'I wait', say: 'Hm.' })!.direction).toBeUndefined();
  });

  it('a line is acted through the connector and played from its WAV', async () => {
    const calls: unknown[][] = [];
    const mcp: Mcp = { callTool: async (...a) => { calls.push(a); return a[1] === 'speak' ? { payload: { mime: 'audio/wav', audio: 'UklGRg==' } } : { payload: { voices: [{ voice: 'Puck', style: 'Upbeat' }] } }; } };
    expect(await rpgSpeak(mcp, '<gasp> Run!', 'scared', 'Leda')).toBe('data:audio/wav;base64,UklGRg==');
    expect(calls[0]).toEqual([RPG_SERVER, 'speak', { text: '<gasp> Run!', voice: 'Leda', direction: 'scared' }, { cache: false }]);
    expect(await rpgVoices(mcp)).toEqual([{ voice: 'Puck', style: 'Upbeat' }]);
    await expect(rpgSpeak({ callTool: async () => ({ payload: {} }) }, 'x', '', 'Leda')).rejects.toMatchObject({ code: 'no_audio' });
    expect(RPG_VOICES.find((v) => v.voice === 'Leda')?.style).toBe('Youthful');
    expect(RPG_VOICES).toHaveLength(30);
  });

  it('each failure says what to do; lasting ones stop trying until another voice is picked', () => {
    expect(rpgFailure({ code: 'needs_reauth' })).toMatchObject({ down: true, note: expect.stringContaining('Reconnect RPG Voice') });
    expect(rpgFailure({ code: 'server_not_connected' })).toMatchObject({ down: true, note: expect.stringContaining('Add RPG Voice') });
    expect(rpgFailure({ code: 'tool_error', message: 'Gemini 429: quota' })).toMatchObject({ down: true, note: expect.stringContaining('free allowance') });
    expect(rpgFailure({ code: 'tool_error', message: 'Gemini returned no audio' }).down).toBe(false);
    expect(rpgFailure({ code: 'server_unavailable' }).down).toBe(false);
  });

  it('a line is asked for as its first sentence and the rest, so the voice starts sooner', () => {
    expect(splitLine('<gasp> He missed! Ha, my turn now. Again!')).toEqual(['<gasp> He missed!', 'Ha, my turn now. Again!']);
    expect(splitLine('No! Not him. Run!')).toEqual(['No! Not him.', 'Run!']); // the first piece is never a lone word
    expect(splitLine('Just one sentence here.')).toEqual(['Just one sentence here.']);
    expect(splitLine('うそ！本当に当たった。もう一回！')).toEqual(['うそ！本当に当たった。', 'もう一回！']);
  });

  it('every style has its own bank of sample lines, and a pick never repeats the last', () => {
    expect(STYLES.map(([id]) => id)).toEqual(['plain', 'character']); // AI companion and Speaks Japanese parked (D-315)
    for (const [id] of STYLES) expect(VOICE_SAMPLES[id]?.length).toBeGreaterThanOrEqual(8);
    const first = pickSample('character', undefined, () => 0);
    for (let r = 0; r < 1; r += 0.05) expect(pickSample('character', first, () => r)).not.toBe(first);
  });
});
