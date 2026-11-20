// 378 Play Dead (TC32 a, TC44-TC48; Guile 20): drop as if Down after a bad blow; foes that lose the roll take you for Down.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';
import { buildNarrationView, buildOppositionView, buildPlayerView } from '../../src/views';
import { openPlayDead, playDeadChecks, playDeadOpen } from '../../src/engine/playDead';
import { act, intent, play, plannerOut } from './w4-kit';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const lostAt = (level: string) => CONFIG.HEALTH_TRACK.find(([l]) => l === level)![1];
const skill = (a: Actor, sk: string, raw: number) => { a.core.skills[sk] = { raw, state: 'normal' }; };

/** a hostile, agent-run patron beside the player that sees it */
function foe(s: GameState, id = 'patron_1'): Actor {
  const p = place(s, id, s.player.zone);
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
  skill(p, SK.insight, 0);
  delete p.asleep;
  return p;
}
/** the player owns Play Dead, sure to win its roll, and was just hurt to Wounded */
function owner(s: GameState): void {
  give(s.player, PK.play_dead);
  skill(s.player, SK.guile, 1000);
  s.player.core.condition.hpLostPct = lostAt('wounded');
  openPlayDead(s, s.player);
}
const drop = (s: GameState) => play(s, { intent: intent({ perkMove: { perk: PK.play_dead, target: null } }) });

describe('378 Play Dead', () => {
  it('opens only after a blow leaves the owner Wounded or worse but not Down, for that turn and the next', () => {
    const s = makeVillage();
    give(s.player, PK.play_dead);
    s.player.core.condition.hpLostPct = lostAt('injured');
    openPlayDead(s, s.player);
    expect(playDeadOpen(s, s.player)).toBe(false);
    expect(buildPlayerView(s).player.perkMoves).toBeUndefined(); // not offered while shut
    s.player.core.condition.hpLostPct = lostAt('wounded');
    openPlayDead(s, s.player);
    expect(playDeadOpen(s, s.player)).toBe(true);
    expect(buildPlayerView(s).player.perkMoves?.map((m) => m.id)).toContain(PK.play_dead);
    s.turn += 2;
    expect(playDeadOpen(s, s.player)).toBe(false);
  });

  it('a foe that loses the roll takes the owner for Down and stops attacking it; anything but lying still ends the act', () => {
    const s = makeVillage();
    foe(s);
    owner(s);
    const ev = drop(s);
    expect(ev.find((e) => e.kind === 'play_dead')?.effects.some((f) => f.kind === 'play_dead_fooled' && f.actorId === 'patron_1')).toBe(true);
    expect(s.player.playingDead?.believers).toEqual(['patron_1']);
    const v = buildOppositionView(s, 'patron_1');
    expect(v.beliefs.find((b) => b.about === s.player.id)?.active).toBe(false);
    expect(v.seen.find((x) => x.id === s.player.id)?.health).toBe('incapacitated');
    // its agent still swings at the "body": the blow is turned into its fight list, which has no one left to hit
    const ev2 = play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('attack', s.player.id))] });
    expect(ev2.some((e) => e.kind === 'attack' && e.actorId === 'patron_1' && e.target === s.player.id)).toBe(false);
    expect(s.player.playingDead).toBeDefined();
    // the owner rises and strikes: the blow lands as on an unaware foe, and the act is over
    const ev3 = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.unarmed_strike } }), agentOutputs: [plannerOut('patron_1', act('hold'))] });
    expect(ev3.find((e) => e.kind === 'attack' && e.actorId === s.player.id)?.attack?.unaware).toBe(true);
    expect(s.player.playingDead).toBeUndefined();
  });

  it('a foe that wins sees through it and may attack; the owner defending ends the act for everyone (TC45 a)', () => {
    const s = makeVillage();
    const sharp = foe(s, 'guard_1');
    skill(sharp, SK.insight, 1000);
    owner(s);
    skill(s.player, SK.guile, 0);
    const ev = drop(s);
    expect(ev.find((e) => e.kind === 'play_dead')?.effects.some((f) => f.kind === 'play_dead_seen_through' && f.actorId === 'guard_1')).toBe(true);
    // it swings at the owner, this turn or the next; the owner defends as usual, and that ends the act
    const all = [...ev, ...(s.player.playingDead ? play(s, { intent: intent(), agentOutputs: [plannerOut('guard_1', act('attack', s.player.id))] }) : [])];
    const blow = all.find((e) => e.kind === 'attack' && e.actorId === 'guard_1' && e.target === s.player.id && !!e.attack?.defense);
    expect(blow?.effects.some((f) => f.kind === 'play_dead_ends')).toBe(true);
    expect(s.player.playingDead).toBeUndefined();
  });

  it('a newcomer rolls when it first sees the owner clearly (TC47 a); a believer in grip reach rolls again (TC46 a)', () => {
    const s = makeVillage();
    owner(s);
    drop(s);
    expect(s.player.playingDead?.judged).toEqual([]);
    foe(s, 'patron_1');
    const first = playDeadChecks(s, createRng(1));
    expect(first[0]?.effects.map((f) => f.actorId)).toEqual(['patron_1']);
    expect(s.player.playingDead?.believers).toEqual(['patron_1']);
    const p = s.actors.find((x) => x.id === 'patron_1')!;
    p.pos = s.player.pos && { ...s.player.pos };
    skill(p, SK.insight, 1000);
    skill(s.player, SK.guile, 0);
    playDeadChecks(s, createRng(1));
    expect(s.player.playingDead?.believers).toEqual([]); // close up, it saw the breathing
  });

  it('an NPC can play dead too (TC49): a player it fools is told only of a fall', () => {
    const s = makeVillage();
    const p = foe(s);
    give(p, PK.play_dead);
    skill(p, SK.guile, 1000);
    skill(s.player, SK.insight, 0);
    p.core.condition.hpLostPct = lostAt('wounded');
    openPlayDead(s, p);
    expect(buildOppositionView(s, p.id).self.perkMoves?.map((m) => m.id)).toContain(PK.play_dead);
    const ev = play(s, { intent: intent(), agentOutputs: [plannerOut(p.id, act('hold'), { perkMove: { perk: PK.play_dead, target: null } })] });
    expect(p.playingDead?.believers).toEqual([s.player.id]);
    const told = buildNarrationView(s, ev).events.find((e) => e.id === ev.find((x) => x.kind === 'play_dead')!.id);
    expect(told?.kind).toBe('collapse');
    expect(JSON.stringify(told)).not.toContain('playing dead');
    expect(buildPlayerView(s).actors.find((x) => x.id === p.id)?.health).toBe('incapacitated');
  });
});
