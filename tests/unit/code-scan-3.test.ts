// Code scan round 3: BG-123 (the GM view lists and restores backups), shared time words, one rule for "down"
import { afterEach, describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
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
