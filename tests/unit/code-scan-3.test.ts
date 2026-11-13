// Code scan round 3: BG-123 (the GM view lists and restores backups), shared time words, one rule for "down"
import { afterEach, describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { loadHistory, memoryStore, saveHistory, saveTurn } from '../../src/save';
import { CONFIG, resetConfig } from '../../src/config';
import { clockText, durationText } from '../../src/time';
import type { GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
const tick = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

afterEach(() => resetConfig());

describe('BG-123 GM backups', () => {
  it('lists the backups after a load and restores one, keeping play going from that turn', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const s = makeVillage(); // resets the config, so the lever is set after it
    CONFIG.BACKUP_EVERY = 2;
    for (let t = 1; t <= 4; t++) { s.turn = t; s.flags.last = t; await saveTurn(store, s, rec(s)); }
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    expect(await g.resume()).toBe(true);
    await tick();
    expect(g.gm().backups.map((b) => b.turn)).toEqual([4, 2]);
    await g.restoreBackup(2);
    expect(g.state()?.flags.last).toBe(2);
    expect(g.lines().at(-1)?.text).toBe('Restored the backup from turn 2.');
    expect(g.notices().some((n) => n.kind === 'load_refused')).toBe(false);
  });

  it('BG-161: a restored backup drops the story text of the turns after it, on screen and in the saved story', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const s = makeVillage();
    CONFIG.BACKUP_EVERY = 2;
    for (let t = 1; t <= 4; t++) { s.turn = t; s.flags.last = t; await saveTurn(store, s, rec(s)); }
    await saveHistory(store, s.storyId, [1, 2, 3, 4].map((turn) => ({ turn, kind: 'narration' as const, text: `turn ${turn}` })), 0);
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await g.resume();
    await tick();
    await g.restoreBackup(2);
    const told = (ls: { kind: string; turn: number }[]) => ls.filter((l) => l.kind === 'narration').map((l) => l.turn);
    expect(told(g.lines())).toEqual([1, 2]);
    expect(told(await loadHistory(store, s.storyId))).toEqual([1, 2]);
  });

  it('a backup that is not there is refused with a notice, and the story stays as it was', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const s = makeVillage();
    s.turn = 1; s.flags.last = 1;
    await saveTurn(store, s, rec(s));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await g.resume();
    await g.restoreBackup(7);
    expect(g.state()?.flags.last).toBe(1);
    expect(g.notices().some((n) => n.kind === 'load_refused')).toBe(true);
  });
});

describe('shared time words (one formatter for trips, waits and watches)', () => {
  it('durationText and clockText', () => {
    expect(durationText(0)).toBe('0 min');
    expect(durationText(45)).toBe('45 min');
    expect(durationText(180)).toBe('3 h');
    expect(durationText(125.4)).toBe('2 h 5 min');
    expect(clockText(7 * 60 + 5)).toBe('07:05');
    expect(clockText(-30)).toBe('23:30');
    expect(clockText(24 * 60 + 90)).toBe('01:30');
  });
});

describe('one rule for "down"', () => {
  it('isActive reads the health track: past Critical is down, even short of 100% lost', async () => {
    const { isActive } = await import('../../src/engine/relations');
    const { healthLevel } = await import('../../src/ruleset');
    const s = makeVillage();
    const g = s.actors.find((a) => a.id !== s.player.id)!;
    g.core.condition.hpLostPct = 99.9995;
    expect(healthLevel(g)).toBe('incapacitated');
    expect(isActive(g)).toBe(false);
    g.core.condition.hpLostPct = 99;
    expect(isActive(g)).toBe(true);
  });
});

describe('CS11: NPCs use their own keys while time skips', () => {
  async function setup(opts: { key?: boolean; playerZone?: string; bar?: boolean } = {}) {
    const { createRng } = await import('../harness');
    const { installRoutines, desiredState } = await import('../../src/minds');
    const { buildActorView } = await import('../../src/views');
    const { zoneById } = await import('../../src/engine/relations');
    const { now, startClock } = await import('../../src/time');
    const { IT } = await import('../../src/library/itemIds');
    const { BK } = await import('../../src/library/tableIds');
    const s = makeVillage({ playerZone: opts.playerZone ?? 'tav_cellar', without: ['slime_1', 'slime_2', 'patron_1'] });
    startClock(s, 'morning');
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    g.zone = 'gate_inner';
    delete g.pos;
    installRoutines(g, 'gate_guard', { post: 'street_square' }, undefined, s.turn, createRng(1), now(s)); // its post is past the door
    expect(desiredState(buildActorView(s, g.id))!.zone).toBe('street_square');
    const b = { id: 'gate_door', kind: BK.door, grade: 'minor' as const, lock: { locked: true },
      ...(opts.bar ? { bar: { drawn: true, side: 'gate_inner' } } : {}) };
    (s.barriers ??= {})[b.id] = b;
    zoneById(s, 'gate_inner')!.links.find((l) => l.to === 'street_square')!.barrier = b.id;
    zoneById(s, 'street_square')!.links.find((l) => l.to === 'gate_inner')!.barrier = b.id;
    if (opts.key !== false) g.core.inventory.push({ id: 'key_g', itemId: IT.key, opens: [b.id] });
    return { s, g, b };
  }
  it('with its key and unseen, it walks through and locks the door again behind it', async () => {
    const { catchUp } = await import('../../src/engine/resolve');
    const { s, g, b } = await setup();
    catchUp(s, 60);
    expect(g.zone).toBe('street_square');
    expect(b.lock.locked).toBe(true);
    expect(s.log.some((l) => l.code === 'catch_up_way')).toBe(true);
  });
  it('without a key, or with the player in view, the door still stops it', async () => {
    const { catchUp } = await import('../../src/engine/resolve');
    const a = await setup({ key: false });
    catchUp(a.s, 60);
    expect(a.g.zone).toBe('gate_inner');
    const b = await setup({ playerZone: 'street_square' });
    catchUp(b.s, 60);
    expect(b.g.zone).toBe('gate_inner');
    expect(b.b.lock.locked).toBe(true);
  });
  it('a bar slid back from its own side stays open once it is through (it cannot be drawn from the far side)', async () => {
    const { catchUp } = await import('../../src/engine/resolve');
    const { s, g, b } = await setup({ bar: true });
    catchUp(s, 60);
    expect(g.zone).toBe('street_square');
    expect(b.lock.locked).toBe(true);
    expect((b as { bar?: { drawn: boolean } }).bar!.drawn).toBe(false);
  });
});

describe('CS12: perk picks and quest changes are saved at once', () => {
  it('a perk taken between turns survives a reload and can still be undone; the undo is saved too', async () => {
    const { canTake, canUndo } = await import('../../src/ruleset');
    const { getLibrary } = await import('../../src/library');
    const { SK } = await import('../../src/library/skillIds');
    const clock = new VirtualClock(), store = memoryStore();
    const s = makeVillage();
    s.turn = 1;
    s.player.core.skills[SK.melee_medium].raw = 58;
    s.player.progression!.unspentPerkPoints = 1;
    await saveTurn(store, s, rec(s));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await g.resume();
    const st = g.state()!;
    const id = Object.keys(getLibrary().perks).find((k) => !canTake(st.player, k))!;
    expect(id).toBeTruthy();
    g.takePerk(id);
    await tick();
    const again = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await again.resume();
    const p = again.state()!.player;
    expect(p.core.perks.some((x) => x.perkId === id)).toBe(true);
    expect(p.progression!.unspentPerkPoints).toBe(0);
    expect(canUndo(again.state()!, p, id)).toBe(true); // still the unplayed turn (K3)
    again.undoPerk(id);
    await tick();
    const third = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    await third.resume();
    expect(third.state()!.player.core.perks.some((x) => x.perkId === id)).toBe(false);
    expect(third.state()!.player.progression!.unspentPerkPoints).toBe(1);
  });
});
