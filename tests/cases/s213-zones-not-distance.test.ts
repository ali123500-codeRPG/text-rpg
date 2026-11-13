// 213 Zones are places, not distances: every "near enough" check is in metres (the zone-as-distance review).
// A fight's closing in, One-Two's follow-up punch, a parry's strike back, Bluff's and Dirt in the Eyes' targets, Cover Ally,
// Spotter and how far a person is made out are measured in metres.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fit, forcedRng, makeVillage, place } from '../harness';
import { CONFIG } from '../../src/config';
import { ruleset } from '../../src/ruleset';
import { placeAll } from '../../src/engine/position';
import { noteFighting } from '../../src/engine/engagement';
import { perkMoveBlock } from '../../src/engine/perkMoves';
import { selectSpokespeople } from '../../src/engine/speech';
import { coverFor } from '../../src/engine/perkMarks';
import { shareSpotted } from '../../src/ruleset/allSteps';
import { buildPlayerView } from '../../src/views';
import type { Actor, AttackResult, GameEvent, GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

/** the test village (real rectangles since ZR8), the player in the square */
const mapped = (): GameState => makeVillage({ playerZone: 'street_square' });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
/** puts `id` in the player's zone, `m` metres east of the player */
const besidePlayer = (s: GameState, id: string, m: number) => {
  const a = place(s, id, s.player.zone);
  a.pos = { x: s.player.pos!.x + m, y: s.player.pos!.y };
  return a;
};
const hold = (a: Actor, itemId: string, id: string) => {
  for (const i of a.core.inventory) if (i.equippedIn?.some((h) => h.startsWith('grip:'))) delete i.equippedIn;
  a.core.inventory.push({ id, itemId, name: id, equippedIn: ['grip:right_arm'] } as never);
  fit(a, itemId);
};
afterEach(() => vi.restoreAllMocks());

describe('213 zones are not distances', () => {
  it('closing in is metres: a hostile that steps nearer inside one zone, at no one in particular, is hunting', () => {
    const s = mapped();
    const foe = besidePlayer(s, 'patron_1', 10);
    foe.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] } as never;
    foe.mind!.overrides = { player: 'hostile' };
    const from = { ...foe.pos! };
    foe.pos = { x: from.x - 6, y: from.y };
    const step = { id: 'e1', turn: s.turn, actorId: foe.id, kind: 'move', zone: foe.zone, pos: { ...foe.pos }, fromPos: from, effects: [], noise: 'quiet', visibility: 'normal', perception: {} } as unknown as GameEvent;
    noteFighting(s, [step]);
    expect(foe.mind!.knowledge.player.status).toBe('hunting');
    // a step away is not closing in
    const s2 = mapped();
    const f2 = besidePlayer(s2, 'patron_1', 4);
    f2.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] } as never;
    f2.mind!.overrides = { player: 'hostile' };
    const was = { ...f2.pos! };
    f2.pos = { x: was.x + 5, y: was.y };
    noteFighting(s2, [{ ...step, zone: f2.zone, pos: { ...f2.pos }, fromPos: was }]);
    expect(f2.mind!.knowledge.player.status).toBe('aware');
  });

  it('One-Two: no free punch at a foe the bottle reaches (1.2 m) but fists do not (0.7 m)', () => {
    const run = (m: number) => {
      const s = mapped();
      besidePlayer(s, 'patron_1', m);
      for (const i of s.player.core.inventory) delete i.equippedIn;
      s.player.core.inventory.push({ id: 'bottle', itemId: IT.improvised_light, name: 'bottle', equippedIn: ['grip:right_arm'] } as never);
      give(s.player, PK.one_two);
      const calls: string[] = [];
      const real = ruleset.attack;
      vi.spyOn(ruleset, 'attack').mockImplementation((req, st) => {
        calls.push(req.weaponId);
        const r = real(req, st, forcedRng([50, 50, 50, 50]));
        return req.weaponId === 'bottle' ? { ...r, outcome: 'full_hit', damage: 0 } : r;
      });
      play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'bottle', skill: SK.unarmed_improvised } }) });
      vi.restoreAllMocks();
      return calls.length;
    };
    expect(run(0.5)).toBe(4); // AT78: two blows, each with its punch
    expect(run(1)).toBe(2);
  });

  it('a parry strikes back only as far as the parrying weapon reaches: a dagger does not reach a spearman 2 m off', () => {
    const run = (m: number) => {
      const s = mapped();
      const p = besidePlayer(s, 'patron_1', m);
      hold(s.player, IT.spear, 'spear');
      hold(p, IT.dagger, 'dag');
      p.core.skills[SK.parry] = { raw: 60, state: 'normal' };
      p.core.standingDefense = 'parry';
      const calls: string[] = [];
      const real = ruleset.attack;
      vi.spyOn(ruleset, 'attack').mockImplementation((req, st) => {
        calls.push(req.attackerId);
        const r = real(req, st, forcedRng([50, 50, 50, 50]));
        return req.targetId === 'patron_1' ? { ...r, defenseType: 'parry', gap: 3, outcome: 'parried', multiplier: 0, damage: 0, location: null, strikeBack: true } as AttackResult : r;
      });
      play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'spear' } }) });
      vi.restoreAllMocks();
      return calls.slice(0, 2);
    };
    expect(run(0.8)).toEqual(['player', 'patron_1']);
    expect(run(2)).toEqual(['player', 'player']); // no strike back between the spear's two blows (AT78)
  });

  it('Bluff needs the foe to hear the lie clearly at a normal voice, not to share a zone', () => {
    const s = mapped();
    give(s.player, PK.bluff);
    const foe = besidePlayer(s, 'patron_1', 2);
    foe.mind!.overrides = { player: 'hostile' };
    expect(perkMoveBlock(s, s.player, PK.bluff, foe.id)).toBeNull();
    foe.zone = 'tav_counter'; // through the tavern's shut door
    foe.placeId = s.places.find((p) => p.zones.some((z) => z.id === 'tav_counter'))!.id;
    delete foe.pos;
    placeAll(s);
    expect(perkMoveBlock(s, s.player, PK.bluff, foe.id)).toBe('no_target');
  });

  it('BG-103: talking to a band, the nearest member in metres answers, not the first by id among those in one zone', () => {
    const s = mapped();
    besidePlayer(s, 'trader', 6); // Mags, tavern folk, 6 m off
    besidePlayer(s, 'patron_1', 2); // Old Wim, tavern folk, 2 m off
    const ask = intent({ action: { type: 'talk', target: null }, spoken: 'Evening, all.', addressees: ['tavern_folk'] });
    expect(selectSpokespeople(s, ask)).toEqual(['patron_1']);
    s.actors.find((a) => a.id === 'patron_1')!.pos!.x -= 10; // now 8 m off, the other way
    expect(selectSpokespeople(s, ask)).toEqual(['trader']);
  });

  it('ZR1: Dirt in the Eyes reaches as far as an improvised throw (5 m), not the whole zone', () => {
    const s = mapped();
    give(s.player, PK.dirt_in_the_eyes);
    const foe = besidePlayer(s, 'patron_1', CONFIG.THROW_M.improvised - 1);
    expect(perkMoveBlock(s, s.player, PK.dirt_in_the_eyes, foe.id)).not.toBe('no_target');
    foe.pos!.x += 2;
    expect(perkMoveBlock(s, s.player, PK.dirt_in_the_eyes, foe.id)).toBe('no_target');
  });

  it('ZR2: Cover Ally needs the ally within the coverer\'s grip reach', () => {
    const s = mapped();
    const ally = besidePlayer(s, 'patron_1', 0.5);
    s.bands.find((b) => b.id === 'player_band')!.relations.tavern_folk = 'friendly';
    s.bands.find((b) => b.id === 'tavern_folk')!.relations.player_band = 'friendly';
    s.player.core.standingDefense = 'block';
    ally.core.standingDefense = 'dodge';
    ally.core.skills[SK.dodge] = { raw: 5, state: 'normal' };
    give(s.player, PK.cover_ally);
    expect(coverFor(s, ally)?.id).toBe('player');
    ally.pos!.x += 3; // 3.5 m off: out of arm's reach
    expect(coverFor(s, ally)).toBeUndefined();
  });

  it('ZR4: Spotter tells a band-mate who hears or sees it, not one in the same zone out of both', () => {
    const run = (mateAt: (s: GameState) => void) => {
      const s = mapped();
      const o = besidePlayer(s, 'trader', 3), mate = npc(s, 'patron_1');
      mateAt(s);
      give(o, PK.spotter);
      o.mind!.knowledge.player = { ...(o.mind!.knowledge.player ?? {}), status: 'aware' } as never;
      mate.mind!.knowledge.player = { ...(mate.mind!.knowledge.player ?? {}), status: 'unaware' } as never;
      shareSpotted(s, o);
      return mate.mind!.knowledge.player.status;
    };
    expect(run((s) => besidePlayer(s, 'patron_1', 5))).toBe('suspicious');
    expect(run((s) => { const m = place(s, 'patron_1', 'tav_cellar'); delete m.pos; placeAll(s); })).toBe('unaware');
  });

  it('ZR6: a person is made out by the sight table: still at 18 m is "someone", walking at 18 m is known', () => {
    const s = mapped();
    s.player.pos = { x: s.player.pos!.x - 9, y: s.player.pos!.y };
    const wim = besidePlayer(s, 'patron_1', 18);
    s.events = [];
    expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')).toMatchObject({ level: 'partial', label: 'someone' });
    s.events = [{ id: 'e1', turn: s.turn, actorId: wim.id, kind: 'move', zone: wim.zone, pos: { ...wim.pos! }, effects: [], noise: 'quiet', visibility: 'normal', perception: {} } as unknown as GameEvent];
    expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')).toMatchObject({ level: 'full' });
  });
});
