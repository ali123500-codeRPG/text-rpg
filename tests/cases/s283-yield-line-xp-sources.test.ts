// 283 BG-199 (BF24): the lean man broke under Happi's shot, which counts as yielding to her: the game paid defeat XP
// and offered his essence, but nothing on screen said he gave up, his chip went back to Panicking, and the XP row said
// only "+N". Now the turn says who yielded, the chip says Broken or Surrendered while it lasts, every XP award names
// its source, and an essence comes only from a death, never a defeat.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { actor } from '../harness/village';
import { payDefeats } from '../../src/engine/xp';
import { offersFromDefeats } from '../../src/engine/essence';
import { lineExtras, xpSourceWords } from '../../src/agents/game';
import { buildPlayerView, callName } from '../../src/views';
import { createRng } from '../../src/rng';
import type { GameState, NarrationView } from '../../src/types';

const nv = { events: [], heard: [] } as unknown as NarrationView;
/** slime_1 beside the player, fought, then broken: up, with the yielded stance toward the player */
function broken(s: GameState) {
  place(s, 'slime_1', s.player.zone);
  const a = actor(s, 'slime_1');
  a.core.generation = 'rolled'; // notable: an essence could come from it
  a.mind!.hitByPlayer = true;
  a.mind!.moraleState = 'broken'; a.mind!.overrides = { player: 'yielded' };
  return a;
}

describe('283 yield line and XP sources (BG-199)', () => {
  it('a foe who breaks: the turn says it yields to you, and the XP names it and why', () => {
    const s = makeVillage();
    const a = broken(s);
    payDefeats(s, []);
    const name = callName(s, s.player.id, a.id);
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    expect(lineExtras(s, [], nv, '').changes).toContainEqual({ kind: 'condition', text: `${cap} breaks and yields to you` });
    const award = s.player.progression!.xpLog!.find((x) => x.source === `defeat:${a.id}`)!;
    expect(xpSourceWords(s, award)).toBe(`${cap} defeated (broke)`);
  });
  it('a surrender reads as one; a foe downed says down and gets no yield line', () => {
    const s = makeVillage();
    const a = broken(s);
    a.mind!.moraleState = 'surrendered';
    payDefeats(s, []);
    expect(lineExtras(s, [], nv, '').changes?.some((c) => / surrenders to you$/.test(c.text))).toBe(true);
    expect(xpSourceWords(s, { source: `defeat:${a.id}`, amount: 10, turn: s.turn, why: 'down' })).toMatch(/ defeated \(down\)$/);
  });
  it('the chip says Broken for as long as it lasts, whatever the bar crept back to', () => {
    const s = makeVillage();
    const a = broken(s);
    a.core.condition.moraleLost = 0; // the bar all the way back: by the bar alone this would show no mood
    expect(buildPlayerView(s).actors.find((x) => x.id === a.id)?.morale).toBe('Broken');
    a.mind!.moraleState = 'surrendered';
    expect(buildPlayerView(s).actors.find((x) => x.id === a.id)?.morale).toBe('Surrendered');
  });
  it('no essence from a defeat; one may come once the beaten foe dies', () => {
    const s = makeVillage();
    const a = broken(s);
    const defeated = payDefeats(s, []);
    offersFromDefeats(s, defeated, createRng(1));
    expect(s.log.some((l) => l.code === 'essence_appeared')).toBe(false);
    expect(a.mind!.essenceRolled).toBeFalsy();
    a.core.condition.hpLostPct = 200; // dies of its wounds, or a later blow
    offersFromDefeats(s, payDefeats(s, []), createRng(1));
    expect(a.mind!.essenceRolled).toBe(true);
  });
});
