// W7 unit tests: schemas, the call runner (repair, fallback, error codes), legality, leak scan, fact check, clock, client.
import { describe, expect, it } from 'vitest';
import {
  checkIntent, checkPlanner, checkNarrator, checkStagePlan, runAgent, StopPlay, callParser, callPlanner, callVoice, callNarrator,
  callResponder, callWeaver, leakScan, factCheck, fallbackNarration, VirtualClock, parseTolerant, mapCode, sampleClient,
  GENERIC_CLARIFY, NEUTRAL_LINE, FIXED, PARSER_INSTRUCTIONS, type AgentCtx,
} from '../../src/agents';
import { resetConfig } from '../../src/config';
import { modelFor } from '../../src/agents/call';
import type { AgentTurnLog, ClaudeErrorCode } from '../../src/types';
import { ScriptedClaude, sentText } from '../harness';
import { actorView, dialogueView, intentOf, narrationView, plannerOut, playerView, voiceOut } from './agent-views';
import { SK } from '../../src/library/skillIds';

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
  it('fixed part is the instruction text, then the shape', () => {
    expect(FIXED.parser.startsWith(PARSER_INSTRUCTIONS)).toBe(true);
    expect(PARSER_INSTRUCTIONS).toContain('8. If the player names a body part of the target, put it in "targetPart". Set "aimed": true only when the player says they aim at that part or go for it');
  });
});

describe('schemas', () => {
  it('intent: unknown keys (a top-level aimed) are stripped, nullable fields default; the action keeps its aimed (BG-200)', () => {
    const r = checkIntent({ action: { type: 'attack', skill: SK.melee_medium, target: 'slime_1', aimed: true }, aimed: true });
    expect(r.errors).toEqual([]);
    expect(r.value).not.toHaveProperty('aimed');
    expect(r.value.action?.aimed).toBe(true);
    expect(r.value.move).toBeNull();
    expect(r.value.deferred).toEqual([]);
  });
  it('intent: improvised takes only an improvised base (loot L3)', () => {
    const ok = checkIntent({ action: { type: 'attack', skill: SK.melee_light, target: 'slime_1', improvised: { base: 'improvised_light', name: 'a bottle' } } });
    expect(ok.errors).toEqual([]);
    expect(ok.value.action!.improvised).toEqual({ base: 'improvised_light', name: 'a bottle' });
    expect(checkIntent({ action: { type: 'attack', skill: SK.melee_light, target: 'slime_1', improvised: { base: 'greataxe', name: 'x' } } }).errors.join()).toContain('improvised.base');
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
  it('weaver: band tactics are written as words and kept as keys', () => {
    const band = (t: unknown) => ({ key: 'b', name: 'b', goals: '', temperament: '', tactics: t, relations: {} });
    const plan = (t: unknown) => ({ event: { summary: 's', challenge: 'minor', gain: 'minor' }, places: [], zones: [], frontiers: [], bands: [band(t)], cast: [], seeds: { plans: [], triggers: [], secrets: [] }, rewards: [], hiddenTerms: [], weaverNote: '' });
    expect(checkStagePlan(plan('Cunning')).value.bands[0].tactics).toBe('cunning');
    expect(checkStagePlan(plan('simple')).value.bands[0].tactics).toBe('simple');
    expect(checkStagePlan(plan('clever')).errors).toEqual(['$.bands[0].tactics: expected one of simple, competent, cunning']);
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
  it('narrator runs on Fable 5.2 low with the complex tier as fallback; Opus 5.5 low for NPC replies and plans; the parser on Sonnet with the quick tier as fallback', () => {
    expect(modelFor('narrator')).toEqual({ model: 'claude-fable-5-2', modelTier: 'complex', effort: 'low' });
    expect(modelFor('parser')).toEqual({ model: 'claude-sonnet-5-5', modelTier: 'quick' });
    for (const a of ['responder', 'voice', 'planner'] as const) expect(modelFor(a)).toEqual({ model: 'claude-opus-5-5', modelTier: 'default', effort: 'low' });
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
  it('a target outside PlayerView stops the turn with a question about who is meant (P2)', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ action: { ...intentOf().action!, type: 'attack', skill: SK.melee_medium, target: 'guard_1' } }));
    const r = await callParser('attack the guard', playerView(), ctx);
    expect(r.intent).toBeNull();
    expect(r.clarify).toMatch(/^Who do you mean\?/);
    expect(r.clarify).not.toBe(GENERIC_CLARIFY);
  });
  it('walking over to someone out of sight moves now and keeps the words for arrival (Q16)', async () => {
    const { claude, ctx } = setup();
    const pv = playerView();
    const to = pv.zone.links[0].to;
    claude.push('parser', intentOf({ move: { toZone: to }, action: { ...intentOf().action!, type: 'talk', target: 'bren' }, spoken: 'Bren, a word?', addressees: ['bren'] }));
    const r = await callParser('I walk back to the bar to ask Bren', pv, ctx);
    expect(r.clarify).toBeNull();
    expect(r.intent).toMatchObject({ move: { toZone: to }, action: null, spoken: null, addressees: null, deferred: ['Bren, a word?'] });
    expect(r.run.log.errors).toContain('deferred_to_arrival');
  });
  it('a speech action\'s skill is set by code, so a made-up one is not an error (P2)', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ action: { ...intentOf().action!, type: 'intimidate', skill: 'intimidate', target: null } }));
    const r = await callParser('back off', playerView(), ctx);
    expect(r.clarify).toBeNull();
    expect(r.intent!.action!.skill).toBe('');
  });
  it('a move to the zone the player already stands in is dropped, not a clarify (runs 11–13)', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ move: { toZone: 'tav_common' } }));
    const r = await callParser('I sit by the fire and wait', playerView(), ctx);
    expect(r.clarify).toBeNull();
    expect(r.intent!.move).toBeNull();
    expect(r.run.log.errors).toEqual([]);
  });
  it('hide and sneak pass the Parser; code picks the stealth skill (ST2)', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ action: { ...intentOf().action!, type: 'hide', skill: 'sneak', target: null } }));
    const r = await callParser('I duck behind the barrels', playerView(), ctx);
    expect(r.clarify).toBeNull();
    expect(r.intent!.action).toMatchObject({ type: 'hide', skill: '' });
  });
  it('a wait names a time of day, not a person (run 18); an unknown time asks until when', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ action: { ...intentOf().action!, type: 'wait', skill: '', target: 'Dusk' } }));
    const r = await callParser('I wait until dusk', playerView(), ctx);
    expect(r.clarify).toBeNull();
    expect(r.intent!.action!.target).toBe('dusk');
    claude.push('parser', intentOf({ action: { ...intentOf().action!, type: 'wait', skill: '', target: 'late evening' } }))
      .push('parser', intentOf({ action: { ...intentOf().action!, type: 'wait', skill: '', target: 'late evening' } }));
    expect((await callParser('I wait until late evening', playerView(), ctx)).clarify).toBe('Until when? You can wait until dawn, morning, afternoon, dusk, evening or night.');
  });
  it('a sneak with a move keeps both (ST3: the posture is free)', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ move: { toZone: 'tav_counter' }, action: { ...intentOf().action!, type: 'sneak', skill: 'sneak', target: null } }));
    const r = await callParser('I creep over to the counter', playerView(), ctx);
    expect(r.clarify).toBeNull();
    expect(r.intent!.move).toEqual({ toZone: 'tav_counter' });
    expect(r.intent!.action!.type).toBe('sneak');
  });
  it('a vanish with no move asks where to slip away (ST13)', async () => {
    const { claude, ctx } = setup();
    const v = intentOf({ action: { ...intentOf().action!, type: 'vanish', skill: '', target: null } });
    claude.push('parser', v).push('parser', v);
    expect((await callParser('I vanish', playerView(), ctx)).clarify).toMatch(/^Where do you slip away to\?/);
  });
  it('the Parser\'s own clarify is passed on', async () => {
    const { claude, ctx } = setup();
    claude.push('parser', intentOf({ action: null, clarify: 'Which mug?' }));
    expect((await callParser('take it', playerView(), ctx)).clarify).toBe('Which mug?');
  });
  it('an illegal gear op or mode is dropped (invalid_gear); the action stands', async () => {
    const { claude, ctx, logs } = setup();
    claude.push('parser', intentOf({
      action: { ...intentOf().action!, type: 'attack', skill: SK.melee_medium, target: 'patron_1', item: 'sword_1', mode: 'smash' },
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
  it('Responder: a line saying an own secret unlisted counts as revealed and is flagged (Q3)', async () => {
    const { claude, ctx, logs } = setup();
    const sec = (id: string, term: string) => ({ id, holderId: 'guard_1', fact: id, leakTerms: [term], revealWhen: { type: 'event_in_zone' as const, kind: 'k', zone: 'z' } });
    const v = { ...actorView(), secrets: [sec('s1', 'smuggling'), sec('s2', 'cellar'), sec('s3', 'ledger')] };
    claude.push('responder', { ...plannerOut({ type: 'talk', target: 'player' }), dialogue: { line: 'The smuggling runs through the cellar.', volume: 'normal' }, reveals: [] });
    const r = await callResponder(v, [{ spoken: 'hi', impression: null }], ctx, { world: new Set(), slips: ['s2'] });
    expect(r.output.reveals).toEqual(['s1']); // s2 is a slip, revealed by code; s3 was not said
    expect(r.unlisted).toEqual(['s1']);
    expect(logs[0].errors).toContain('unlisted_reveal');
  });
  it('Voice: CHARACTER carries no band goals, temperament or tactics (Q1)', async () => {
    const { claude, ctx } = setup();
    claude.push('voice', voiceOut());
    await callVoice(dialogueView(), ctx, { world: new Set() });
    const sent = sentText(claude.calls[0]);
    for (const w of ['keep the gate', 'dutiful', 'bandGoals', 'temperament', 'tactics']) expect(sent).not.toContain(w);
  });
  it('Voice: a secret or hidden term in the line regenerates without repeating it, then the neutral line (F5)', async () => {
    const { claude, ctx, logs } = setup();
    const leaky = voiceOut({ line: 'The smuggling ring meets below.', shares: [] });
    claude.push('voice', leaky).push('voice', leaky);
    const r = await callVoice(dialogueView(), ctx, { world: new Set(), terms: ['smuggling'] });
    expect(claude.calls).toHaveLength(2);
    expect(sentText(claude.calls[1])).not.toContain('smuggling');
    expect(r.output.line).toBe(NEUTRAL_LINE);
    expect(logs[0].errors).toContain('voice_leak');
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
    // the schema's "|null" copied into a value (run 16); a "|null" inside a string is left alone
    expect(parseTolerant('{"move":{"toZone":"bar"}|null,"action":{"t":"x|null"}|null,"n":1 | null}'))
      .toEqual({ ok: true, value: { move: { toZone: 'bar' }, action: { t: 'x|null' }, n: 1 } });
    // a reply that corrects itself: the last whole object wins (run 17)
    expect(parseTolerant('{"line":"Hm? Cat got your\n\nWait, correction:\n\n{"action":{"a":1},"line":"Hm?"}'))
      .toEqual({ ok: true, value: { action: { a: 1 }, line: 'Hm?' } });
    expect(parseTolerant('{"a":1,"b":{"c":2}')).toEqual({ ok: false }); // cut off: not mistaken for {"c":2}
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
  it('gives a call up when its signal fires, even if the page never answers it', async () => {
    const hung = sampleClient(() => new Promise(() => {})); // a runtime that ignores the abort
    const c = new AbortController();
    const r = hung.call({ agent: 'autopilot', input: [], json: true, signal: c.signal });
    c.abort();
    expect(await r).toEqual({ ok: false, error: 'cancelled', message: 'the call was given up' });
  });
});
