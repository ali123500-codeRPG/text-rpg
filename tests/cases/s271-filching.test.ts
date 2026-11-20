// 271 FL1–FL7, TN1, TN2, TN4, CT4 (Containers and Filching): Filching is its own skill; it and Lockpicking make the Sleight
// group and stand in for each other at 0.3. One Filching roll per try; everyone who sees the act rolls Sight against it,
// everyone the sound reaches rolls Hearing (TN1: Hushed, one level louder per tier below Near Miss). Made out clearly and
// won: caught; glimpsed or heard partly and won, or a tie: suspicious (TN2). Caught: nothing taken, the owner two stance
// steps colder, every other catcher one, all remember. A fumble takes nothing and leaves the owner suspicious. Taken: the
// item keeps who it was taken from, its owner knows it on sight and won't buy it back (FL6). NPCs filch too (FL7).
import { expect, it } from 'vitest';
import type { Actor, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { actorById, stance, zoneById } from '../../src/engine/relations';
import { CONFIG } from '../../src/config';
import { sightAt } from '../../src/perception';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import { effectiveSkill } from '../../src/ruleset/gear';
import { tierLevel } from '../../src/ruleset';
import { NOISE } from '../../src/scales';
import { createRng } from '../../src/rng';
import { filchContest, takeFilched } from '../../src/engine/filch';
import { sell } from '../../src/engine/trade';
import { lay } from '../harness';

const village = (): { s: GameState; wim: Actor } => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const wim = actorById(s, 'patron_1')!;
  if (wim.pos) s.player.pos = { ...wim.pos };
  wim.core.inventory.push({ id: 'ring', itemId: IT.charmed_ring }, { id: 'purse', itemId: IT.coin, qty: 40 }, { id: 'axe', itemId: IT.greataxe });
  return { s, wim };
};
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };

it('FL1: Filching and Lockpicking are the Sleight group and stand in for each other at 0.3', () => {
  const { s } = village();
  skill(s.player, SK.lockpicking, 50);
  expect(effectiveSkill(s, s.player, FN.filching, { fullValue: [SK.filching] }).value).toBeCloseTo(15);
});

it('TN1: the sound is Hushed at Near Miss or better and one level louder per tier below', () => {
  const { s, wim } = village();
  for (let seed = 1; seed < 40; seed++) {
    const f = filchContest(s, s.player, wim, wim, 0, createRng(seed), []);
    expect(NOISE.pos(f.noise)).toBe(NOISE.pos('hushed') + Math.max(0, tierLevel('near_miss') - tierLevel(f.roll)));
  }
});

it('FL4/FL5: a sharp-eyed owner catches a clumsy hand: nothing taken, two steps colder, remembered', () => {
  const { s, wim } = village();
  skill(wim, SK.eyesight, 400);
  const before = stance(s, wim, s.player);
  const ev = play(s, { intent: intent({ action: { type: 'filch', target: 'patron_1', item: 'ring' } }) });
  const e = ev.find((x) => x.kind === 'filch')!;
  expect(e.filch).toBe('caught');
  expect(wim.core.inventory.some((i) => i.id === 'ring')).toBe(true);
  expect(stance(s, wim, s.player)).not.toBe(before);
  expect(s.hidden.memory.patron_1?.some((m) => /trying to steal my charmed ring/.test(m.text))).toBe(true);
});

it('FL6: a filched item keeps its owner: seen on the thief it shows to them, and they refuse to buy it', () => {
  const { s, wim } = village();
  const got = takeFilched(s, s.player, wim.core.inventory, wim.core.inventory.find((i) => i.id === 'ring')!, wim.id);
  expect(got.stolenFrom).toBe('patron_1');
  expect(wim.core.inventory.some((i) => i.id === 'ring')).toBe(false);
  expect(sell(s, s.player, wim, 'ring', 1)).toMatchObject({ ok: false });
});

it('FL2: a purse gives up a share of its coin; held, worn or too big things cannot be filched', () => {
  const { s, wim } = village();
  const purse = wim.core.inventory.find((i) => i.id === 'purse')!;
  const got = takeFilched(s, s.player, wim.core.inventory, purse, wim.id);
  expect(got.qty).toBe(10);
  expect(purse.qty).toBe(30);
  expect(got.stolenFrom).toBeUndefined();
  const ev = play(s, { intent: intent({ action: { type: 'filch', target: 'patron_1', item: 'axe' } }) });
  expect(ev.find((x) => x.kind === 'wasted')?.reason).toBe('too_big');
});

it('CT4: opening a chest its owner watches is a filch contest, never a flat refusal', () => {
  const { s, wim } = village();
  skill(wim, SK.eyesight, 400);
  lay(s, 'tav_common', { id: 'box', itemId: IT.chest, owner: 'patron_1', contents: [] }, wim.pos);
  const ev = play(s, { intent: intent({ action: { type: 'open', target: 'box' } }) });
  expect(ev.some((e) => e.kind === 'wasted' && e.reason === 'theft')).toBe(false);
  expect(ev.find((e) => e.kind === 'filch')?.filch).toBe('caught');
});

it('FL7: an NPC filches from the player; a sharp-eyed player catches it', () => {
  const { s, wim } = village();
  s.player.core.inventory.push({ id: 'charm', itemId: IT.lucky_charm });
  skill(s.player, SK.eyesight, 400);
  const f = filchContest(s, wim, s.player, s.player, 0, createRng(3), []);
  expect(f.outcome).toBe('caught');
  expect(f.caught).toContain(s.player);
  expect(f.perception[s.player.id]?.level).toBe('full');
});

it('a filch is a Slight sight: a sharp-eyed watcher 10 m off sees nothing of it (Close once let it be glimpsed to 20 m)', () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'guard_1'] });
  const wim = actorById(s, 'patron_1')!, eye = actorById(s, 'trader')!;
  for (const x of [wim, eye, s.player]) x.zone = 'field_mid';
  wim.pos = { x: 120, y: 0 };
  s.player.pos = { x: 120, y: 0 };
  eye.pos = { x: 130, y: 0 }; // 10 m off in open ground: past Slight's 6 m glimpse, inside Close's 20 m
  wim.core.inventory.push({ id: 'ring', itemId: IT.charmed_ring });
  skill(wim, SK.eyesight, 0);
  skill(eye, SK.eyesight, 400);
  expect(sightAt(s, eye, wim, 'close')).toBe('partial'); // as it was
  expect(sightAt(s, eye, wim, CONFIG.FILCH_VISIBILITY)).toBeNull();
  for (let seed = 1; seed < 10; seed++) {
    const f = filchContest(s, s.player, wim, wim, 0, createRng(seed), []);
    expect(f.perception[eye.id]?.cue).not.toBe('sight');
  }
});
