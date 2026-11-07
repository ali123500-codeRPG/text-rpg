// W7 unit tests: schemas, the call runner (repair, fallback, error codes), legality, leak scan, fact check, clock, client.
import { describe, expect, it } from 'vitest';
import {
  checkIntent, checkPlanner, checkNarrator, checkStagePlan, runAgent, StopPlay, callParser, callPlanner, callVoice, callNarrator,
  callResponder, callWeaver, leakScan, factCheck, fallbackNarration, VirtualClock, parseTolerant, mapCode, sampleClient,
  GENERIC_CLARIFY, NEUTRAL_LINE, FIXED, PARSER_INSTRUCTIONS, type AgentCtx,
} from '../../src/agents';
import { resetConfig } from '../../src/config';
import type { AgentTurnLog, ClaudeErrorCode } from '../../src/types';
import { ScriptedClaude, sentText } from '../harness';
import { actorView, dialogueView, intentOf, narrationView, plannerOut, playerView, voiceOut } from './agent-views';

function setup() {
  resetConfig();
  const clock = new VirtualClock();
  const claude = new ScriptedClaude(clock);
  const logs: AgentTurnLog[] = [];
  const errors: ClaudeErrorCode[] = [];
  const ctx: AgentCtx = { client: claude, clock, turn: 3, log: (e) => logs.push(e), onError: (c) => errors.push(c) };
  return { clock, claude, logs, errors, ctx };
}
const fail = (error: ClaudeErrorCode) => ({ ok: false as const, error });

describe('prompts', () => {
  it('fixed part is the verbatim spec text, then the shape', () => {
    expect(FIXED.parser.startsWith(PARSER_INSTRUCTIONS)).toBe(true);
    expect(PARSER_INSTRUCTIONS).toContain('8. If the player names a body part of the target, put it in "targetPart". Never decide whether the attack is aimed.');
  });
});

describe('schemas', () => {
  it('intent: unknown keys (aimed) are stripped, nullable fields default', () => {
    const r = checkIntent({ action: { type: 'attack', skill: 'melee_medium', target: 'slime_1', aimed: true }, aimed: true });
    expect(r.errors).toEqual([]);
    expect(JSON.stringify(r.value)).not.toContain('aimed');
    expect(r.value.move).toBeNull();
    expect(r.value.deferred).toEqual([]);
  });
  it('planner: wrong enum and missing action are errors', () => {
    expect(checkPlanner({ action: { type: 'dance' } }).errors.join()).toContain('$.action.type');
    expect(checkPlanner({}).errors.join()).toContain('$.action: expected object');
  });
  it('narrator: empty text fails', () => {
    expect(checkNarrator({ text: ' ', narrated: [] }).errors).toEqual(['$.text: empty text']);
  });
  it('weaver: bad grade fails', () => {
    const r = checkStagePlan({ event: { summary: 's', challenge: 'huge', gain: 'none' }, places: [], zones: [], frontiers: [], bands: [], cast: [], seeds: { plans: [], triggers: [], secrets: [] }, rewards: [], hiddenTerms: [], weaverNote: '' });
    expect(r.errors).toEqual(['$.event.challenge: expected one of none, minor, moderate, major, extreme']);
  });
  it('weaver: band tactics are written as words and kept as levels 1 to 3', () => {
    const band = (t: unknown) => ({ key: 'b', name: 'b', goals: '', temperament: '', tacticsLevel: t, relations: {} });
    const plan = (t: unknown) => ({ event: { summary: 's', challenge: 'minor', gain: 'minor' }, places: [], zones: [], frontiers: [], bands: [band(t)], cast: [], seeds: { plans: [], triggers: [], secrets: [] }, rewards: [], hiddenTerms: [], weaverNote: '' });
    expect((checkStagePlan(plan('cunning')).value as { bands: { tacticsLevel: number }[] }).bands[0].tacticsLevel).toBe(3);
    expect((checkStagePlan(plan('simple')).value as { bands: { tacticsLevel: number }[] }).bands[0].tacticsLevel).toBe(1);
    expect(checkStagePlan(plan('clever')).errors).toEqual(['$.bands[0].tacticsLevel: expected one of simple, competent, cunning']);
  });
});

describe('runAgent', () => {
  it('two user turns, model tier from CONFIG, one repair with changed input, then fallback', async () => {
    const { claude, ctx, logs } = setup();
    claude.push('planner', { nope: 1 }).push('planner', { nope: 2 });
    const r = await callPlanner(actorView(), ctx, { world: new Set() });
    expect(r.value).toBeNull();
    expect(claude.calls).toHaveLength(2);
    const [a, b] = claude.calls;
    expect(a.input.map((m) => m.role)).toEqual(['user', 'user']);
    expect(a.input[0].content).toBe(FIXED.planner);
    expect(a.modelTier).toBe('default');
    expect(b.input[1].content).not.toBe(a.input[1].content);
    expect(b.input[1].content).toContain('REPAIR');
    expect(logs[0].status).toBe('fallback');
    expect(logs[0].rawOutputs).toHaveLength(2);
  });
  it('weaver names its model and effort', async () => {
    const { claude, ctx } = setup();
    claude.push('weaver', {});
    await callWeaver({ catalogs: {} } as never, ctx).catch(() => {});
    expect(claude.calls[0]).toMatchObject({ model: 'claude-opus-5-5', modelTier: 'complex', effort: 'high' });
  });
  it('repaired answer is accepted', async () => {
    const { claude, ctx, logs } = setup();
    claude.push('planner', { bad: true }).push('planner', plannerOut());
    const r = await callPlanner(actorView(), ctx, { world: new Set() });
    expect(r.value?.action.target).toBe('street_square');
    expect(logs[0].status).toBe('repaired');
  });
  it('rate_limited and upstream_error: no retry, fallback, reported', async () => {
    const { claude, ctx, logs, errors } = setup();
    claude.pushResponse({ agent: 'planner', response: fail('rate_limited') });
    expect((await callPlanner(actorView(), ctx, { world: new Set() })).value).toBeNull();
    claude.pushResponse({ agent: 'planner', response: fail('upstream_error') });
    await callPlanner(actorView(), ctx, { world: new Set() });
    expect(claude.calls).toHaveLength(2);
    expect(errors).toEqual(['rate_limited', 'upstream_error']);
    expect(logs.map((l) => l.errors[0])).toEqual(['rate_limited', 'call_failed']);
  });
  it('invalid_json and truncated get the one repair', async () => {
    const { claude, ctx } = setup();
    claude.pushResponse({ agent: 'planner', response: fail('invalid_json') }).push('planner', plannerOut());
    expect((await callPlanner(actorView(), ctx, { world: new Set() })).value).not.toBeNull();
    claude.pushResponse({ agent: 'planner', response: { ok: true, value: plannerOut(), truncated: true } }).push('planner', plannerOut());
    expect((await callPlanner(actorView(), ctx, { world: new Set() })).status).toBe('repaired');
    expect(claude.calls).toHaveLength(4);
  });
  it('not_granted / sampling_disabled / session_expired stop play', async () => {
    for (const code of ['not_granted', 'sampling_disabled', 'session_expired'] as const) {
      const { claude, ctx } = setup();
      claude.pushResponse({ agent: 'parser', response: fail(code) });
      await expect(callParser('look', playerView(), ctx)).rejects.toBeInstanceOf(StopPlay);
    }
  });
  it('modelTierApplied is logged', async () => {
    const { claude, ctx, logs } = setup();
    claude.pushResponse({ agent: 'planner', response: { ok: true, value: plannerOut(), modelTierApplied: 'default' } });
    await callPlanner(actorView(), ctx, { world: new Set() });
    expect(logs[0].modelTierApplied).toBe('default');
  });
  it('a direct runAgent with no accept returns the schema-clean value', async () => {
    const { claude, ctx } = setup();
    claude.push('narrator', { text: 'hi', narrated: [] });
    const r = await runAgent(ctx, { agent: 'narrator', fixed: 'F', data: 'D', schema: checkNarrator });
    expect(r.value).toEqual({ text: 'hi', narrated: [] });
  });
});

describe('Parser legality', () => {
  it('a target outside PlayerView stops the turn with a generic question', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ action: { ...intentOf().action!, type: 'attack', skill: 'melee_medium', target: 'guard_1' } }));
    const r = await callParser('attack the guard', playerView(), ctx);
    expect(r.intent).toBeNull();
    expect(r.clarify).toBe(GENERIC_CLARIFY);
  });
  it('the Parser\'s own clarify is passed on', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ action: null, clarify: 'Which mug?' }));
    expect((await callParser('take it', playerView(), ctx)).clarify).toBe('Which mug?');
  });
  it('an illegal gear op or mode is dropped (invalid_gear); the action stands', async () => {
    const { claude, ctx, logs } = setup();
    claude.push('parser', intentOf({
      action: { ...intentOf().action!, type: 'attack', skill: 'melee_medium', target: 'patron_1', item: 'sword_1', mode: 'smash' },
      gear: [{ op: 'draw', item: 'axe_9' }, { op: 'pick_up', item: 'mug_1' }],
    }));
    const r = await callParser('hit him', playerView(), ctx);
    expect(r.intent?.action?.mode).toBeNull();
    expect(r.intent?.gear).toEqual([{ op: 'pick_up', item: 'mug_1' }]);
    expect(logs[0].errors).toContain('invalid_gear');
  });
  it('only PlayerView and the text are sent', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf());
    await callParser('look around', playerView(), ctx);
    expect(claude.calls[0].input[1].content).toBe(`PLAYER_INPUT:\nlook around\n\nPLAYER_VIEW:\n${JSON.stringify(playerView())}`);
  });
});

describe('NPC legality', () => {
  it('a real id outside the view is view_leak; an unknown id is invalid_target; both drop the order', async () => {
    const { claude, ctx, logs } = setup();
    claude.push('planner', plannerOut({ type: 'attack', target: 'trader' })).push('planner', plannerOut({ type: 'attack', target: 'ghost' }));
    expect((await callPlanner(actorView(), ctx, { world: new Set(['trader']) })).value).toBeNull();
    expect((await callPlanner(actorView(), ctx, { world: new Set(['trader']) })).value).toBeNull();
    expect(logs.map((l) => l.errors[0])).toEqual(['view_leak', 'invalid_target']);
    expect(claude.calls).toHaveLength(2); // legality drops; no repair
  });
  it('a gear op on an item it does not hold is dropped; a bad routine switch is dropped (invalid_routine)', async () => {
    const { claude, ctx, logs } = setup();
    const out = plannerOut();
    out.gear = [{ op: 'draw', item: 'crossbow_1' }, { op: 'stow', item: 'spear_1' }];
    out.planUpdate = { goal: 'g', steps: [], triggers: [], memoryNote: 'm', routine: 'dance_all_night' };
    claude.push('planner', out);
    const r = await callPlanner(actorView(), ctx, { world: new Set() });
    expect(r.value?.gear).toEqual([{ op: 'stow', item: 'spear_1' }]);
    expect(r.value?.planUpdate?.routine).toBeNull();
    expect(logs[0].errors).toEqual(['invalid_gear', 'invalid_routine']);
  });
  it('Responder: a reveal it does not hold is dropped (invalid_reveal); a failed call gives the neutral line', async () => {
    const { claude, ctx, logs } = setup();
    const v = { ...actorView(), secrets: [{ id: 's1', holderId: 'guard_1', fact: 'x', leakTerms: ['x'], revealWhen: { type: 'event_in_zone' as const, kind: 'k', zone: 'z' } }] };
    claude.push('responder', { ...plannerOut({ type: 'talk', target: 'player' }), dialogue: { line: 'Fine.', volume: 'normal' }, reveals: ['s1', 's2'] });
    expect((await callResponder(v, [{ spoken: 'hi', impression: null }], ctx, { world: new Set() })).output.reveals).toEqual(['s1']);
    expect(logs[0].errors).toContain('invalid_reveal');
    claude.pushResponse({ agent: 'responder', response: fail('upstream_error') });
    const r = await callResponder(v, [{ spoken: 'hi', impression: null }], ctx, { world: new Set() });
    expect(r.output.dialogue?.line).toBe(NEUTRAL_LINE);
    expect(r.output.action.type).toBe('talk');
  });
  it('Voice: shares outside knows regenerate once, then the neutral line', async () => {
    const { claude, ctx, logs } = setup();
    claude.push('voice', voiceOut({ shares: ['f_secret'] })).push('voice', voiceOut({ shares: ['f_secret'] }));
    const r = await callVoice(dialogueView(), ctx, { world: new Set() });
    expect(claude.calls).toHaveLength(2);
    expect(r.output.line).toBe(NEUTRAL_LINE);
    expect(r.output.shares).toEqual([]);
    expect(logs[0].status).toBe('fallback');
  });
  it('Voice: a name outside its view regenerates', async () => {
    const { claude, ctx } = setup();
    claude.push('voice', voiceOut({ line: 'Ask Rook at the mill.', shares: [] })).push('voice', voiceOut());
    const r = await callVoice(dialogueView(), ctx, { world: new Set(), names: ['Rook', 'Mags'] });
    expect(r.output.line).toBe('The north road floods in spring.');
    expect(sentText(claude.calls[1])).not.toContain('Rook'); // the note never repeats the name
  });
});

describe('Narrator checks', () => {
  const leak = { terms: ['ambush'], names: ['Rook'], ids: ['guard_1'] };
  it('leak scan: hidden terms, unknown names and ids not in the view', () => {
    expect(leakScan('An ambush waits. Rook grins. guard_1 moves.', 'nothing', leak)).toEqual(['term:ambush', 'name:Rook', 'id:guard_1']);
    expect(leakScan('Rook nods.', '{"actors":[{"name":"Rook"}]}', leak)).toEqual([]);
    expect(leakScan('The bushes rustle.', '', leak)).toEqual([]); // whole words only
  });
  it('fact check: unknown narrated id, a missing full presence event', () => {
    const v = narrationView();
    expect(factCheck({ text: 't', narrated: ['e1'] }, v)).toEqual([]);
    expect(factCheck({ text: 't', narrated: ['e9'] }, v)).toEqual(['unknown_event:e9', 'missing_event:e1']);
  });
  it('fact check: a full event changing the player\'s condition must be narrated', () => {
    const v = narrationView();
    v.events.push({ id: 'e3', kind: 'attack', level: 'full', cue: 'sight', actor: 'a slime', target: 'Aldric', changes: ['you are Hurt'] });
    expect(factCheck({ text: 't', narrated: ['e1'] }, v)).toEqual(['missing_event:e3']);
  });
  it('fallback narration uses the view only and lists every event', () => {
    const out = fallbackNarration(narrationView());
    expect(out.narrated).toEqual(['e1', 'e2']);
    expect(out.text).toContain('An old drinker is here, nursing a mug.');
    expect(out.text).toContain('You hear something behind the bar.');
  });
  it('leak → regenerate once with a note that does not repeat the term → fallback', async () => {
    const { claude, ctx, logs } = setup();
    claude.push('narrator', { text: 'You sense the ambush.', narrated: ['e1'] }).push('narrator', { text: 'Still an ambush.', narrated: ['e1'] });
    const r = await callNarrator(narrationView(), ctx, leak);
    expect(claude.calls).toHaveLength(2);
    expect(claude.calls[1].input[1].content).not.toContain('ambush');
    expect(r.output.text).not.toContain('ambush');
    expect(logs[0].errors).toContain('narrator_leak');
  });
});

describe('VirtualClock', () => {
  it('auto mode wakes concurrent sleeps in time order', async () => {
    const c = new VirtualClock();
    const order: string[] = [];
    await Promise.all([c.sleep(900).then(() => order.push(`b${c.now()}`)), c.sleep(300).then(() => order.push(`a${c.now()}`))]);
    expect(order).toEqual(['a300', 'b900']);
  });
  it('abort resolves early; manual mode advances', async () => {
    const c = new VirtualClock(0, false);
    const ac = new AbortController();
    let woke = false;
    const p = c.sleep(1000, ac.signal).then(() => (woke = true));
    await c.advance(500);
    expect(woke).toBe(false);
    ac.abort();
    await p;
    expect(c.now()).toBe(500);
  });
});

describe('browser client', () => {
  it('tolerant JSON parse like sample.json', () => {
    expect(parseTolerant('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseTolerant('Sure:\n```json\n{"a":2}\n```')).toEqual({ ok: true, value: { a: 2 } });
    expect(parseTolerant('Here it is {"a":3} done')).toEqual({ ok: true, value: { a: 3 } });
    expect(parseTolerant('no json')).toEqual({ ok: false });
  });
  it('maps runtime codes and passes tier, model, effort, signal', async () => {
    expect(mapCode('capability_removed')).toBe('not_granted');
    expect(mapCode('empty_completion')).toBe('invalid_json');
    expect(mapCode('queue_overflow')).toBe('upstream_error');
    let seen: unknown;
    const client = sampleClient(async (_input, opts) => {
      seen = opts;
      return { text: '{"x":1}', truncated: false, modelTierApplied: 'complex', modelApplied: 'claude-opus-5-5' };
    });
    const r = await client.call({ agent: 'weaver', input: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }], model: 'claude-opus-5-5', modelTier: 'complex', effort: 'high', json: true });
    expect(r).toEqual({ ok: true, value: { x: 1 }, truncated: false, modelTierApplied: 'complex', modelApplied: 'claude-opus-5-5' });
    expect(seen).toMatchObject({ model: 'claude-opus-5-5', modelTier: 'complex', effort: 'high', cache: false });
    const bad = sampleClient(async () => Promise.reject({ code: 'rate_limited', message: 'slow down' }));
    expect(await bad.call({ agent: 'parser', input: [], json: true })).toEqual({ ok: false, error: 'rate_limited', message: 'slow down' });
  });
});
