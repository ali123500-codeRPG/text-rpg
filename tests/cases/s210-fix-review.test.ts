// 210 Bug-fix review: siblings the earlier fixes missed. BG-83 (BG-71's exchange event), BG-87 (BG-62/BG-74
// across a doorway), BG-88 (one "hears clearly" rule), BG-89 (BG-72: only contact is felt), BG-90 (BG-73 for followers),
// BG-91 (BG-76: part-state names).
import { expect, it } from 'vitest';
import type { GameEvent, Intent } from '../../src/types';
import { createRng, makeVillage, place, ScriptedClaude } from '../harness';
import { resolveSpeech, resolveTurn, selectSpokespeople } from '../../src/engine';
import { approachMove } from '../../src/engine/merge';
import { hearsOrder } from '../../src/engine/trade';
import { hearsClearly, perceptionOf } from '../../src/perception';
import { createDirector } from '../../src/agents/director';
import { grovePlan, VirtualClock } from '../../src/scenario/fixtures';
import { headTo } from '../../src/minds';
import { MOD_SOURCES } from '../../src/ruleset/modSources';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { intent, play } from './w4-kit';

it('BG-83: the player\'s words in a conversation are said, and heard, at the volume chosen', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  for (const v of ['whisper', 'shout'] as const) {
    const i = intent({ action: { type: 'talk', skill: SK.persuasion }, spoken: 'A word.', addressees: ['patron_1'], volume: v });
    const sp = selectSpokespeople(s, i);
    const ev = play(s, { intent: i, spokespeople: sp, exchange: resolveSpeech(s, i, sp, createRng(1)) });
    const e = ev.find((x) => x.kind === 'speak' && x.actorId === s.player.id)!;
    expect(e.line?.volume).toBe(v);
    expect(e.noise).toBe(v === 'whisper' ? 'hushed' : 'loud');
  }
});

it('BG-87: stepping up to someone in view through a doorway ends beside them, not at the door', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const lane = s.zones.find((z) => z.id === 'tav_common')!.links.find((l) => l.to === 'street_door')!;
  lane.sight = true;
  const w = place(s, 'patron_1', 'street_door');
  expect(approachMove(s, s.player, { type: 'talk', target: w.id, volume: 'whisper' }, null)).toMatchObject({ toZone: 'street_door', spot: { near: w.id } });
  expect(approachMove(s, s.player, { type: 'give', target: w.id }, { toZone: 'street_door' })).toMatchObject({ toZone: 'street_door', spot: { near: w.id } });
});

it('BG-88: one "hears it clearly" rule: Keen Ear counts for orders and answers as it does for perception', () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  const room = s.zones.find((x) => x.id === 'tav_common')!;
  room.background = 'busy'; room.rect = { x: 0, y: 0, w: 8, d: 8 };
  const p = place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common';
  s.player.pos = { x: -3.5, y: -3.5 }; p.pos = { x: 3.5, y: 0.5 }; // 8.1 m in a busy room: a normal voice is not clear
  expect(hearsOrder(s, s.player, p)).toBe(false);
  p.core.perks.push({ perkId: PK.keen_ear, source: 'level', gainedTurn: 0 });
  expect(hearsClearly(s, s.player, p, CONFIG.ORDER_NOISE)).toBe(hearsOrder(s, s.player, p));
  expect(hearsOrder(s, s.player, p)).toBe(true);
  expect(approachMove(s, s.player, { type: 'talk', target: p.id }, null)).toBeNull(); // he hears; no need to step up
});

it('BG-89: only contact is felt: a silent walk toward someone, a wasted action or a trade from out of sight is not', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  place(s, 'guard_1', 'tav_cellar');
  const ev = (kind: string) => ({ id: kind, turn: 1, actorId: 'guard_1', kind, zone: 'tav_cellar', target: s.player.id, effects: [], noise: 'silent', visibility: 'unseen', perception: {} }) as GameEvent;
  for (const k of ['move', 'wasted', 'buy_refused', 'speak']) expect(perceptionOf(ev(k), s, s.player)).toBeNull();
  expect(perceptionOf(ev('attack'), s, s.player)).toMatchObject({ level: 'partial', cue: 'touch' });
});

it('BG-90: an NPC that follows the player through a frontier comes in with a move event of its own', async () => {
  const s = makeVillage({ playerZone: 'field_far', without: ['slime_1', 'slime_2', 'patron_1'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.zone = 'field_far'; g.placeId = 'field'; delete g.pos;
  headTo(s, g, 'woods');
  s.turn += 1;
  const go = { move: { toZone: 'woods' }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null } as unknown as Intent;
  const events = resolveTurn(s, { intent: go, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
  const clock = new VirtualClock();
  const added = await createDirector(clock).afterResolve(s, events, createRng(1), { client: new ScriptedClaude().push('weaver', grovePlan()), clock, turn: s.turn, log: () => {} });
  expect(g.zone).toBe(s.player.zone);
  const mv = added.find((e) => e.kind === 'move' && e.actorId === g.id)!;
  expect(mv).toMatchObject({ zone: s.player.zone, fromZone: 'field_far' });
  expect(mv.perception[s.player.id]).toBeTruthy();
});

it('BG-91: the Stacking tab names part states, not their keys', () => {
  const row = MOD_SOURCES.find((r) => r.at === 'src/ruleset/body.ts' && String(r.value).includes('Crippled'));
  expect(row).toBeTruthy();
  expect(String(row!.value)).not.toMatch(/\bcrippled\b/);
});
