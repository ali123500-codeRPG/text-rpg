// 349 BG-278: a body half seen in the dark showed as a plain "Someone": the deck offered talk and attack against it, and
// the narrator made it stand. A half-seen actor who lies still (down, dead or asleep) now says so, without saying which.
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { actor, beside, makeVillage } from '../harness';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import { setTitleLight } from '../../src/plan/draw';

const dark = () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.night;
  for (const z of s.zones) setTitleLight(s, z, 'dark');
  beside(s, 'guard_1', 'player', 1.4);
  return s;
};
const targets = (s: ReturnType<typeof dark>, kind: string): { id: string; note?: string }[] => {
  const step = deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions).find((a) => a.kind === kind)?.steps[0];
  return step && 'picks' in step && step.picks ? step.picks({}) : [];
};

it('a dead body half seen in the dark lies still, and the deck offers a look and a blow but no talk', () => {
  const s = dark();
  actor(s, 'guard_1').core.condition.hpLostPct = 150;
  const seen = buildPlayerView(s).actors.find((a) => a.id === 'guard_1');
  expect(seen).toMatchObject({ label: 'someone', level: 'partial', lying: true });
  expect(seen?.health).toBeUndefined(); // dead, down or asleep: not which
  for (const kind of ['talk', 'persuade', 'deceive', 'intimidate', 'barter']) expect(targets(s, kind).map((p) => p.id)).not.toContain('guard_1');
  expect(targets(s, 'attack').map((p) => p.id)).toContain('guard_1'); // BF84: it can still be struck
  expect(targets(s, 'look_at')).toContainEqual(expect.objectContaining({ id: 'guard_1', note: expect.stringContaining('lying still') }));
  expect(buildNarrationView(s, s.events).actors.find((a) => a.label === 'someone')).toMatchObject({ lying: true });
});

it('a sleeper half seen lies still too; someone standing in the dark does not', () => {
  const s = dark();
  actor(s, 'guard_1').asleep = { since: 0 };
  expect(buildPlayerView(s).actors.find((a) => a.id === 'guard_1')).toMatchObject({ level: 'partial', lying: true });
  delete actor(s, 'guard_1').asleep;
  const up = buildPlayerView(s).actors.find((a) => a.id === 'guard_1');
  expect(up).toMatchObject({ level: 'partial' });
  expect(up?.lying).toBeUndefined();
  expect(targets(s, 'talk').map((p) => p.id)).toContain('guard_1');
});
