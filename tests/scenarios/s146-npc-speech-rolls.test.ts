// 146 NPC speech rolls at the player (OQ-29, NT1–NT13): an agent NPC's persuade, deceive, intimidate or barter aimed at
// the player rolls, and the player answers with the same skill. The same rule works both ways: a listener that loses to
// intimidation is Shaken toward the speaker, to persuasion Swayed, by a flat amount per tier of the gap.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { actorById } from '../../src/engine/relations';
import { applySpeech, pushContest } from '../../src/engine/speech';
import { getLibrary } from '../../src/library';
import { TP } from '../../src/library/templateIds';
import { resolveSpeech } from '../../src/engine';
import { buildActorView, buildNarrationView } from '../../src/views';
import { ruleset } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { createRng } from '../harness';
import type { ContestResult, GameState, RollResult } from '../../src/types';

const roll = (actorId: string, tier: RollResult['tier']): RollResult =>
  ({ actorId, skill: SK.intimidation, d100: 50, margin: 0, tier, natural: 0, modifiers: [], tierShifts: [] });
const won = (a: string, b: string, gap: number): ContestResult =>
  ({ a: roll(a, 'great_success'), b: roll(b, 'failure'), gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' });

function atTheGate(): GameState {
  const s = makeVillage({ playerZone: 'gate_inner' });
  const g = actorById(s, 'guard_1')!;
  g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'gate_inner', lastSeenTurn: 1, source: 'seen', revealed: [] } as never;
  return s;
}

it('146a an NPC intimidation at the player rolls a contest the player answers', () => {
  const s = atTheGate();
  const ev = play(s, { agentOutputs: [plannerOut('guard_1', act('intimidate', 'player'), { dialogue: { line: 'Drop the blade.', volume: 'normal' } })] });
  const e = ev.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')!;
  expect(e.contest!.a).toMatchObject({ actorId: 'guard_1', skill: SK.intimidation });
  expect(e.contest!.b).toMatchObject({ actorId: s.player.id });
  expect(e.push).toMatchObject({ type: 'intimidate', listener: s.player.id, landed: e.contest!.winner === 'a', seen: true });
  const shaken = s.player.pressure?.guard_1?.shaken;
  expect(shaken).toBe(e.contest!.winner === 'a' ? -e.contest!.gap * CONFIG.SHAKEN_PER_TIER : undefined);
  const nv = buildNarrationView(s, ev).events.find((x) => x.id === e.id)!;
  expect(nv.pressed?.how).toBeTruthy();
  expect(JSON.stringify(nv.pressed)).not.toMatch(/intimidat|tier|\d/i); // words only, no type or numbers
});

it('146b plain talk from an NPC does not roll', () => {
  const s = atTheGate();
  const ev = play(s, { agentOutputs: [plannerOut('guard_1', act('talk', 'player'), { dialogue: { line: 'Move along.', volume: 'normal' } })] });
  const e = ev.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')!;
  expect(e.contest).toBeUndefined();
  expect(e.push).toBeUndefined();
});

it('146c one rule both ways: Shaken and Swayed scale with the gap, the bigger stands, and they end with the engagement', () => {
  const s = atTheGate();
  const g = actorById(s, 'guard_1')!;
  expect(applySpeech(g, s.player, 'intimidate', won('guard_1', 'player', -3))).toEqual({ status: 'shaken' });
  expect(s.player.pressure!.guard_1.shaken).toBe(3 * CONFIG.SHAKEN_PER_TIER);
  applySpeech(g, s.player, 'intimidate', won('guard_1', 'player', -1));
  expect(s.player.pressure!.guard_1.shaken).toBe(3 * CONFIG.SHAKEN_PER_TIER);
  expect(applySpeech(s.player, g, 'persuade', won('player', 'guard_1', -2))).toEqual({ status: 'swayed' });
  expect(g.pressure!.player.swayed).toBe(2 * CONFIG.SWAYED_PER_TIER);
  expect(applySpeech(g, s.player, 'intimidate', won('guard_1', 'player', 0))).toEqual({});
  expect(applySpeech(g, s.player, 'deceive', won('guard_1', 'player', 1))).toEqual({ tell: true });
  expect(applySpeech(g, s.player, 'deceive', won('guard_1', 'player', -1))).toEqual({});
  s.player.engagement = { start: 0, last: 1 - CONFIG.ENGAGEMENT_END_TURNS, kinds: ['talk'] };
  play(s);
  expect(s.player.pressure).toBeUndefined();
});

it('146d Shaken and Swayed count on every roll against the speaker (NT15)', () => {
  const s = atTheGate();
  s.player.pressure = { guard_1: { shaken: 10, swayed: 5 } };
  const rng = createRng(1);
  const mods = (skill: string, against?: string) => ruleset.roll({ actorId: s.player.id, skill, modifiers: [], tierShifts: [], against }, s, rng).modifiers;
  expect(mods(SK.melee_medium, 'guard_1')).toContainEqual({ source: 'Shaken', type: 'status', value: -10 });
  expect(mods(SK.melee_medium, 'guard_1')).toContainEqual({ source: 'Swayed', type: 'status', value: -5 });
  expect(mods(SK.persuasion, 'guard_1')).toContainEqual({ source: 'Swayed', type: 'status', value: -5 });
  expect(mods(SK.melee_medium, 'trader').some((m) => m.type === 'status')).toBe(false);
});

it('146e the speaker sees how the player took it (NT10)', () => {
  const s = atTheGate();
  const ev = play(s, { agentOutputs: [plannerOut('guard_1', act('intimidate', 'player'), { dialogue: { line: 'Back off.', volume: 'normal' } })] });
  const e = ev.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')!;
  const mine = buildActorView(s, 'guard_1').perceived.find((x) => x.id === e.id)!;
  expect(mine.took).toBe(e.push!.status === 'shaken' ? 'they look shaken' : 'they seem unmoved');
});

it('146f the player\'s intimidation leaves the NPC Shaken; a listener that beats a lie gets a tell', () => {
  const say = (type: 'intimidate' | 'deceive', line: string) => intent({ action: { type, target: 'trader' }, spoken: line, addressees: ['trader'] });
  let shaken = 0, tells = 0;
  for (let seed = 1; seed < 40; seed++) {
    const s = makeVillage({ playerZone: 'tav_counter' });
    s.player.core.skills[SK.intimidation] = { raw: 90, state: 'normal' };
    const i = say('intimidate', 'Pay up.');
    const exchange = resolveSpeech(s, i, ['trader'], createRng(seed));
    play(s, { intent: i, spokespeople: ['trader'], exchange }, seed);
    const c = exchange.perSpokesperson.trader.contest;
    expect(actorById(s, 'trader')!.pressure?.player?.shaken).toBe(c.winner === 'a' ? -c.gap * CONFIG.SHAKEN_PER_TIER : undefined);
    if (c.winner === 'a') shaken++;
    const lie = resolveSpeech(s, say('deceive', 'I am the reeve.'), ['trader'], createRng(seed));
    const d = lie.perSpokesperson.trader;
    expect(!!d.tell).toBe(d.contest.winner === 'b');
    if (d.tell) tells++;
  }
  expect(shaken).toBeGreaterThan(0);
  expect(tells).toBeGreaterThan(0);
});

it('146g a repeat try of the same kind at the same listener costs the speaker 15 per earlier try; talk never counts (NT3)', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const say = (type: 'talk' | 'persuade' | 'intimidate') => resolveSpeech(s, intent({ action: { type, target: 'trader' }, spoken: 'Come on.', addressees: ['trader'] }), ['trader'], createRng(3)).perSpokesperson.trader.contest.a.modifiers;
  const repeat = (m: { source: string }[]) => m.find((x) => x.source === 'Repeat try');
  expect(repeat(say('talk'))).toBeUndefined();
  expect(repeat(say('talk'))).toBeUndefined();
  expect(repeat(say('persuade'))).toBeUndefined();
  expect(repeat(say('persuade'))).toEqual({ source: 'Repeat try', type: 'situational', value: -CONFIG.REPEAT_TRY });
  expect(repeat(say('persuade'))).toEqual({ source: 'Repeat try', type: 'situational', value: -2 * CONFIG.REPEAT_TRY });
  expect(repeat(say('intimidate'))).toBeUndefined(); // another kind starts fresh
  const st = atTheGate(), guard = actorById(st, 'guard_1')!;
  pushContest(st, guard, 'intimidate', createRng(1));
  expect(pushContest(st, guard, 'intimidate', createRng(1)).a.modifiers).toContainEqual({ source: 'Repeat try', type: 'situational', value: -CONFIG.REPEAT_TRY });
  expect(guard.speechTries).toEqual({ player: { intimidate: 2 } });
  s.player.engagement = { start: 0, last: 1 - CONFIG.ENGAGEMENT_END_TURNS, kinds: ['talk'] };
  play(s);
  expect(s.player.speechTries).toBeUndefined(); // tries end with the engagement
});

it('146h a lie rolls Lying and the listener answers with Insight; only the shady template lies (NT16–NT18)', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const c = resolveSpeech(s, intent({ action: { type: 'deceive', target: 'trader' }, spoken: 'I am the reeve.', addressees: ['trader'] }), ['trader'], createRng(2)).perSpokesperson.trader.contest;
  expect(c.b.skill).toBe(SK.insight);
  const p = pushContest(atTheGate(), actorById(atTheGate(), 'guard_1')!, 'deceive', createRng(2));
  expect(p.b.skill).toBe(SK.insight);
  const lib = getLibrary();
  expect(lib.trees[lib.skills[SK.lying].treeId].name).toBe('Trickery');
  expect(lib.trees[lib.skills[SK.insight].treeId].skills).toEqual([SK.eyesight, SK.earshot, SK.insight]);
  const liars = Object.values(lib.templates).filter((t) => t.minimums[SK.lying]).map((t) => t.id);
  expect(liars).toEqual([TP.thief]);
});
