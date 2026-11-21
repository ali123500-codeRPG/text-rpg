// 146 NPC speech rolls at the player (OQ-29, NT1–NT13): an agent NPC's persuade, deceive, intimidate or barter aimed at
// the player rolls, and the player answers with the same skill. The same rule works both ways: a listener that loses to
// intimidation is Shaken toward the speaker, to persuasion Swayed, by a flat amount per tier of the gap.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { actorById } from '../../src/engine/relations';
import { applySpeech, pushContest } from '../../src/engine/speech';
import { resolveSpeech } from '../../src/engine';
import { buildActorView, buildNarrationView } from '../../src/views';
import { ruleset } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { createRng } from '../harness';
import type { ContestResult, GameState, RollResult } from '../../src/types';
import { ago } from '../harness/time';
import { engagementEndS } from '../../src/ruleset/actionTime';

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

it('146a/b plain talk from an NPC does not roll; an NPC intimidation at the player rolls a contest the player answers', () => {
  const s = atTheGate();
  const talk = play(s, { agentOutputs: [plannerOut('guard_1', act('talk', 'player'), { dialogue: { line: 'Move along.', volume: 'normal' } })] });
  const said = talk.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')!;
  expect(said.contest).toBeUndefined();
  expect(said.push).toBeUndefined();
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

it('146c/d one rule both ways: Shaken and Swayed scale with the gap, the bigger stands, they count on every roll against the speaker (NT15), and they end with the engagement', () => {
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
  // NT15: Shaken and Swayed count on every roll against the speaker
  s.player.pressure = { guard_1: { shaken: 10, swayed: 5 } };
  const rng = createRng(1);
  const mods = (skill: string, against?: string) => ruleset.roll({ actorId: s.player.id, skill, modifiers: [], tierShifts: [], against }, s, rng).modifiers;
  expect(mods(SK.melee_medium, 'guard_1')).toContainEqual({ source: 'Shaken', type: 'status', value: -10 });
  expect(mods(SK.melee_medium, 'guard_1')).toContainEqual({ source: 'Swayed', type: 'status', value: -5 });
  expect(mods(SK.persuasion, 'guard_1')).toContainEqual({ source: 'Swayed', type: 'status', value: -5 });
  expect(mods(SK.melee_medium, 'trader').some((m) => m.type === 'status')).toBe(false);
  s.player.engagement = { start: 0, last: s.pending.turn - 1, kinds: ['talk'] };
  ago(s, s.pending.turn - 1, engagementEndS());
  play(s);
  expect(s.player.pressure).toBeUndefined();
});

it('146g a repeat try of the same kind at the same listener costs the speaker 15 per earlier try; talk never counts (NT3)', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const say = (type: 'talk' | 'persuade' | 'intimidate') => resolveSpeech(s, intent({ action: { type, target: 'trader' }, spoken: 'Come on.', addressees: ['trader'] }), ['trader'], createRng(3)).perSpokesperson.trader.contest.a.modifiers;
  const repeat = (m: { source: string }[]) => m.find((x) => x.source === 'Repeat try');
  expect(repeat(say('talk'))).toBeUndefined();
  expect(repeat(say('talk'))).toBeUndefined();
  expect(repeat(say('persuade'))).toBeUndefined();
  expect(repeat(say('persuade'))).toMatchObject({ source: 'Repeat try', type: 'situational', pct: -CONFIG.REPEAT_TRY });
  expect(repeat(say('persuade'))).toMatchObject({ source: 'Repeat try', type: 'situational', pct: -2 * CONFIG.REPEAT_TRY });
  expect(repeat(say('intimidate'))).toBeUndefined(); // another kind starts fresh
  const st = atTheGate(), guard = actorById(st, 'guard_1')!;
  pushContest(st, guard, 'intimidate', createRng(1));
  expect(pushContest(st, guard, 'intimidate', createRng(1)).a.modifiers).toContainEqual(expect.objectContaining({ source: 'Repeat try', type: 'situational', pct: -CONFIG.REPEAT_TRY }));
  expect(guard.speechTries).toEqual({ player: { intimidate: 2 } });
  s.player.engagement = { start: 0, last: s.pending.turn - 1, kinds: ['talk'] };
  ago(s, s.pending.turn - 1, engagementEndS());
  play(s);
  expect(s.player.speechTries).toBeUndefined(); // tries end with the engagement
});

it('146h a lie rolls Falsehood and the listener answers with Insight (NT16–NT18)', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const c = resolveSpeech(s, intent({ action: { type: 'deceive', target: 'trader' }, spoken: 'I am the reeve.', addressees: ['trader'] }), ['trader'], createRng(2)).perSpokesperson.trader.contest;
  expect(c.b.skill).toBe(SK.insight);
  const p = pushContest(atTheGate(), actorById(atTheGate(), 'guard_1')!, 'deceive', createRng(2));
  expect(p.b.skill).toBe(SK.insight);
});

// NL1-NL4: a lie one NPC aims at another rolls the same contest; a caught false name is not kept and the listener's
// view of the line carries the tell; haggling at an NPC does not roll (D-155 b)
it('146-NL an NPC lie at another NPC rolls; caught = tell and no alias, believed = alias; haggling does not roll', () => {
  const outcomes = new Set<string>();
  for (let seed = 1; seed <= 40 && outcomes.size < 2; seed++) {
    const s = makeVillage();
    const g = actorById(s, 'guard_1')!, t = actorById(s, 'trader')!;
    g.zone = 'tav_common'; g.placeId = t.placeId; g.knownOnSight = undefined;
    t.mind!.knowledge.guard_1 = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: 1, source: 'seen', revealed: [] } as never;
    g.mind!.knowledge.trader = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: 1, source: 'seen', revealed: [] } as never;
    const ev = play(s, { agentOutputs: [plannerOut('guard_1', act('talk', 'trader'), { dialogue: { line: "Name's Tam, from the coast.", volume: 'normal' } })] }, seed);
    const e = ev.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')!;
    expect(e.contest!.a.asked ?? e.contest!.a.skill).toBe(SK.falsehood); // a stand-in may make the roll
    expect(e.contest!.b).toMatchObject({ actorId: 'trader', skill: SK.insight });
    expect(e.push).toMatchObject({ type: 'deceive', listener: 'trader' });
    const tv = buildActorView(s, 'trader').told.find((x) => x.id === e.id);
    if (e.push!.tell) {
      outcomes.add('caught');
      expect(t.mind!.aliases?.guard_1).toBeUndefined();
      expect(tv?.tell).toBeTruthy();
    } else {
      outcomes.add('believed');
      expect(t.mind!.aliases).toMatchObject({ guard_1: 'Tam' });
    }
    expect(s.player.journal!.aliases?.guard_1).toBe('Tam'); // the player, who heard it with no roll of their own, believes it
    if (seed === 1) { // D-155 b: haggling between NPCs does not roll (it stays player-only)
      const ev2 = play(s, { agentOutputs: [plannerOut('guard_1', act('barter', 'trader'), { dialogue: { line: 'Two copper, no more.', volume: 'normal' } })] }, seed);
      const e2 = ev2.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')!;
      expect(e2.contest).toBeUndefined();
      expect(e2.push).toBeUndefined();
    }
  }
  expect([...outcomes].sort()).toEqual(['believed', 'caught']);
});

// D-155 b: an NPC's persuasion or threat at another NPC rolls the same contest as at the player, with the same Shaken
// and Swayed results (and, engaged, the morale cost of losing to a threat); the listener's view says how it struck them
it('146-NN an NPC persuasion or threat at another NPC rolls, and the listener carries the result', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 40 && seen.size < 4; seed++) {
    for (const type of ['intimidate', 'persuade'] as const) {
      const s = makeVillage();
      const g = actorById(s, 'guard_1')!, t = actorById(s, 'trader')!;
      g.zone = 'tav_common'; g.placeId = t.placeId; g.knownOnSight = undefined;
      t.mind!.knowledge.guard_1 = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: 1, source: 'seen', revealed: [] } as never;
      g.mind!.knowledge.trader = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: 1, source: 'seen', revealed: [] } as never;
      const ev = play(s, { agentOutputs: [plannerOut('guard_1', act(type, 'trader'), { dialogue: { line: 'Do as I say.', volume: 'normal' } })] }, seed);
      const e = ev.find((x) => x.kind === 'speak' && x.actorId === 'guard_1')!;
      expect(e.contest!.a.asked ?? e.contest!.a.skill).toBe(type === 'intimidate' ? SK.intimidation : SK.persuasion);
      expect(e.contest!.b).toMatchObject({ actorId: 'trader' });
      expect(e.push).toMatchObject({ type, listener: 'trader', landed: e.contest!.winner === 'a' });
      const status = type === 'intimidate' ? 'shaken' : 'swayed';
      const per = type === 'intimidate' ? CONFIG.SHAKEN_PER_TIER : CONFIG.SWAYED_PER_TIER;
      expect(t.pressure?.guard_1?.[status]).toBe(e.contest!.winner === 'a' ? -e.contest!.gap * per : undefined);
      const tv = buildActorView(s, 'trader').told.find((x) => x.id === e.id);
      expect(tv?.pressed?.how).toBeTruthy();
      seen.add(`${type}:${e.contest!.winner === 'a' ? 'landed' : 'held'}`);
    }
  }
  expect(seen.size).toBe(4);
});
