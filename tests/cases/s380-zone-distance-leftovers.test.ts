// BG-293..BG-297 (ZO2 a): five checks that read "the same zone" as "near" now read metres, grip reach and the senses.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor, GameState, Intent, ParserActionType } from '../../src/types';
import { beside, byDoor, createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import { playerAtRest } from '../../src/engine/essence';
import { isEngaged } from '../../src/engine/relations';
import { walksAway } from '../../src/engine/nerve';
import { distM } from '../../src/engine/position';
import { installRoutines } from '../../src/minds';
import { spawnNpc } from '../../src/library/spawn';
import { TP } from '../../src/library/templateIds';
import { buildPlayerView } from '../../src/views';
import { lootSources } from '../../src/ui/loot';
import { IT } from '../../src/library/itemIds';
import { newInstanceId } from '../../src/library/spawn';
import { startClock } from '../../src/time';
import { sleepDebtFor } from '../harness/sleep';
import { TURN_CHECK, checkTurn, snapTurn } from '../../src/save/turnCheck';

const actor = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const act = (type: ParserActionType): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '' },
});
const companion = (s: GameState, id: string, zone: string): Actor => {
  const c = spawnNpc(null, TP.patron, { id, zone, placeId: s.zones.find((z) => z.id === zone)!.placeId, bandId: s.player.bandId, name: id });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  return c;
};

describe('380 zones are never a distance (BG-293 to BG-297)', () => {
  beforeEach(() => { TURN_CHECK.strict = false; });
  afterEach(() => { TURN_CHECK.strict = true; });

  it('BG-293: an essence change needs only to be out of a fight; a hostile in the same room no longer blocks it', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    const p = beside(s, 'patron_1', 'player', 3);
    p.mind!.overrides = { player: 'hostile' };
    expect(playerAtRest(s)).toBe(!isEngaged(s, s.player));
  });

  it('BG-294: a broken actor weighs a foe a step away through a doorway, though it stands in another zone', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    const foe = byDoor(s, 'trader', 'tav_counter', 'tav_common', 0.5);
    const step = byDoor(s, 'patron_1', 'tav_common', 'tav_counter', 0.5); // where the walk would end: by the doorway
    const toward = { zone: step.zone, pos: { ...step.pos! } };
    const patron = byDoor(s, 'patron_1', 'tav_common', 'tav_counter', 4);
    patron.mind!.overrides = { trader: 'hostile' };
    patron.mind!.moraleState = 'broken';
    expect(distM(s, toward, foe)).toBeLessThan(2);
    expect(walksAway(s, patron, toward)).toBe(false); // the walk stays in its zone but ends nearer that foe: refused
  });

  it('BG-295: a companion in the next room shares the watches; one out of earshot does not', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'patron_1'] });
    byDoor(s, 'player', 'tav_common', 'tav_counter', 1);
    const near = companion(s, 'comp_near', 'tav_counter');
    byDoor(s, 'comp_near', 'tav_counter', 'tav_common', 1);
    companion(s, 'comp_far', 'field_far');
    place(s, 'comp_far', 'field_far');
    startClock(s, 'evening');
    sleepDebtFor(s, 8);
    s.turn += 1;
    resolveTurn(s, { intent: act('sleep'), aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
    const started = s.log.find((l) => l.code === 'night_started')?.detail as { watches: { actorId: string }[] } | undefined;
    const who = started?.watches.map((w) => w.actorId) ?? [];
    expect(who).toContain(near.id);
    expect(who).not.toContain('comp_far');
  });

  it('BG-296: the loot list offers a downed body just through a doorway', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    byDoor(s, 'player', 'tav_common', 'tav_counter', 1);
    const npc = byDoor(s, 'patron_1', 'tav_counter', 'tav_common', 1);
    npc.core.condition.hpLostPct = 100;
    const it = { id: newInstanceId(), itemId: IT.bandage, qty: 1 };
    npc.core.inventory.push(it);
    s.player.journal = { ...s.player.journal!, revealed: [...(s.player.journal?.revealed ?? []), `item:${it.id}`] };
    expect(lootSources(buildPlayerView(s)).some((x) => x.kind === 'body' && x.items.some((i) => i.id === it.id))).toBe(true);
  });

  it('BG-297: the turn check flags a hold out of grip reach, not a hold across a doorway', () => {
    const rules = (s: GameState) => checkTurn(s, snapTurn(s), []).map((b) => b.rule);
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    byDoor(s, 'player', 'tav_common', 'tav_counter', 0.3);
    const held = byDoor(s, 'patron_1', 'tav_counter', 'tav_common', 0.3);
    held.heldBy = 'player';
    expect(rules(s)).not.toContain('links_real');
    const far = makeVillage({ without: ['slime_1', 'slime_2'] });
    beside(far, 'patron_1', 'player', 2).heldBy = 'player';
    expect(rules(far)).toContain('links_real');
  });
});
