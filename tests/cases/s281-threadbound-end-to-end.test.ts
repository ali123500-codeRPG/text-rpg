// 281 Threadbound items end to end: The Threadbound start gets Varo's Loop in play, scenario-start event rolls earn the
// achievements that open its abilities, a passive changes the next scenario's event roll, and an active fires by itself
// on the essence roll when the player beats a notable foe in a real fight turn.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { play, intent } from './w4-kit';
import { replayScenarioStart } from '../../src/scenario/director';
import { endScenario } from '../../src/engine/scenarioEnd';
import { CONFIG } from '../../src/config';
import { ACH } from '../../src/library/achievementIds';
import { IT } from '../../src/library/itemIds';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import type { GameState } from '../../src/types';

const earned = (s: GameState, id: string) => !!s.player.progression?.achievements?.some((a) => a.key === id);
const itemPerk = (s: GameState, id: string) => s.player.core.perks.some((p) => p.perkId === id && p.source === 'item');
const loop = (s: GameState) => s.player.core.inventory.find((i) => i.itemId === IT.varos_loop);
/** a scenario start whose event roll shows this die (the Weaver call fails, so the fallback stage is used). A running
 * scenario ends first: achievements earned while one runs are granted at its end (D-226) */
const scenario = (s: GameState, d: number) => {
  if (s.stage.scenario) endScenario(s, 'interrupted');
  replayScenarioStart(s, [null], forcedRng([d, d, d, d]));
  return s.stage.scenario!;
};

describe('281 a Threadbound item from start to use', () => {
  it('granted, opened by event-roll achievements, used on event rolls and on an essence roll', () => {
    const s = makeVillage();
    // 1. The Threadbound start's level 1 perk: the earring arrives bound and worn at the end of the turn
    s.player.core.perks.push({ perkId: PK.always_yours, source: 'class', gainedTurn: 0 });
    play(s, { intent: intent({}) });
    expect(loop(s)).toMatchObject({ boundTo: 'player', equippedIn: ['acc:0'] });
    expect(s.player.core.perks.some((p) => p.source === 'item')).toBe(false); // nothing earned yet

    // 2. A scenario starts on a natural 100: Critical Success. The next turn earns the achievement and opens Loose Odds
    expect(scenario(s, 100).tier).toBe('critical_success');
    play(s, { intent: intent({}) });
    expect(earned(s, ACH.event_crit_1)).toBe(true);
    expect(itemPerk(s, PK.loose_odds)).toBe(true);

    // 3. Loose Odds in use: 88 is Great Success without the earring, Critical Success with it
    expect(scenario(s, 88).tier).toBe('critical_success');
    play(s, { intent: intent({}) });

    // 4. Critical Success+ (a natural 100 now reaches one past Critical): Fortune's Favourite Accident opens Call the Toss
    const f = scenario(s, 100);
    expect([f.tier, f.beyond]).toEqual(['critical_success', 1]);
    endScenario(s, 'interrupted'); // earned during the scenario, granted at its end
    play(s, { intent: intent({}) });
    expect(earned(s, ACH.event_crit_2)).toBe(true);
    expect(itemPerk(s, PK.call_the_toss)).toBe(true);

    // 5. A real fight turn: the player downs a notable slime; its essence appears and Call the Toss fires by itself
    const appear = CONFIG.ESSENCE_APPEAR_CHANCE.foe;
    CONFIG.ESSENCE_APPEAR_CHANCE.foe = 100;
    try {
      const slime = s.actors.find((a) => a.id === 'slime_1')!;
      slime.core.generation = 'rolled'; // notable
      slime.core.condition.hpLostPct = 99;
      Object.assign(s.player, { zone: slime.zone, placeId: slime.placeId, ...(slime.pos ? { pos: { ...slime.pos } } : {}) }); // the fallback scenarios moved the player; meet the slime
      let fired = false;
      for (let t = 0; t < 12 && !fired; t++) {
        play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1', skill: SK.melee_medium } }) });
        fired = s.log.some((l) => l.code === 'essence_roll_auto' && (l.detail as { perk?: string })?.perk === PK.call_the_toss);
      }
      expect(fired).toBe(true);
      expect(loop(s)!.usedAt?.[PK.call_the_toss]).toBeDefined();
    } finally {
      CONFIG.ESSENCE_APPEAR_CHANCE.foe = appear;
    }

    // 6. Taken off, the abilities leave at the end of the turn; summoned back from the ground, they return
    const here = s.places.flatMap((p) => p.zones).find((z) => z.id === s.player.zone)!;
    const inst = loop(s)!;
    s.player.core.inventory.splice(s.player.core.inventory.indexOf(inst), 1);
    delete inst.equippedIn;
    here.groundItems.push(inst);
    play(s, { intent: intent({}) });
    expect(itemPerk(s, PK.loose_odds)).toBe(false);
    play(s, { intent: { ...intent({}), gear: [{ op: 'summon', item: inst.id }] } as never });
    expect(loop(s)?.equippedIn).toEqual(['acc:0']);
    expect(itemPerk(s, PK.loose_odds)).toBe(true);
  });
});
