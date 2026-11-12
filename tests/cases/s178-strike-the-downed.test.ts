// 178 From a playtest game (BG-24, BG-25): the player stood over a downed woman and swung three times; every blow was wasted
// in silence (attacks on anyone down were refused), and the Narrator made up a blade stuck in the floor and shaking hands.
// The sword "drawn" again while already in hand was logged as a mistake. Now a blow on someone down lands (they can't
// defend), only the dead can't be struck, a wasted action says why, and drawing what is in hand is nothing to do.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { isActive } from '../../src/engine/relations';
import { applyGearOps } from '../../src/engine/gear';
import { buildNarrationView } from '../../src/views';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';

describe('178 striking someone down (BG-25)', () => {
  it('a blow on someone Incapacitated lands with no defense and pushes them toward Dead', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const wim = place(s, 'patron_1', 'tav_common');
    wim.core.condition.hpLostPct = 110;
    expect(isActive(wim)).toBe(false);
    const sword = s.player.core.inventory.find((i) => i.equippedIn?.some((x) => x.startsWith('hand:')));
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: sword?.id ?? null } }) });
    const hit = ev.find((e) => e.actorId === s.player.id && e.kind === 'attack');
    expect(hit).toBeDefined();
    expect(ev.some((e) => e.actorId === s.player.id && e.kind === 'wasted')).toBe(false);
    expect(wim.core.condition.hpLostPct).toBeGreaterThan(110);
  });

  it('the dead can\'t be struck, and the wasted blow says why; the story is told not to invent a miss', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const wim = place(s, 'patron_1', 'tav_common');
    wim.core.condition.hpLostPct = 150;
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) });
    const w = ev.find((e) => e.actorId === s.player.id && e.kind === 'wasted');
    expect(w?.reason).toBe('already_dead');
    expect(buildNarrationView(s, ev, null).events.find((e) => e.id === w!.id)?.reason).toBe('already dead');
    expect(NARRATOR_INSTRUCTIONS).toContain('Never make up a miss, a stuck blade or shaking hands');
  });
});

describe('178 drawing what is already drawn (BG-24)', () => {
  it('is nothing to do, not an invalid gear op', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const sword = s.player.core.inventory.find((i) => i.equippedIn?.some((x) => x.startsWith('hand:')))!;
    expect(sword).toBeDefined();
    expect(applyGearOps(s, s.player, [{ op: 'draw', item: sword.id }]).invalid).toEqual([]);
    expect(sword.equippedIn?.some((x) => x.startsWith('hand:'))).toBe(true);
  });
});
