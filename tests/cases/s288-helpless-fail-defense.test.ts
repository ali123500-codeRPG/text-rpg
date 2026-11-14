// BG-207 (BF30): Happi struck the downed Wren and he rolled a dodge (a downed target was only "unaware", -10 to its
// defense). Someone down, asleep or held in a grip now fails the defense outright: a Critical Failure, no dice, so the
// rest of the attack reads as usual.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';

const strike = (setup: (t: ReturnType<typeof beside>) => void) => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_2', 'guard_1', 'trader', 'patron_1'] });
  const t = beside(s, 'slime_1', 'player', 1);
  setup(t);
  for (let i = 0; i < 6; i++) {
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: t.id } }) });
    const hit = ev.find((e) => e.actorId === 'player' && e.kind === 'attack' && e.attack?.defense);
    if (hit) return hit.attack!;
  }
  throw new Error('no attack reached a defense roll');
};

it('a downed target fails its defense outright', () => {
  const r = strike((t) => { t.core.condition.hpLostPct = 105; });
  expect(r.defense!.tier).toBe('critical_failure');
  expect(r.defense!.d100).toBe(0);
  expect(r.defense!.modifiers[0].source).toBe("down: can't defend");
});

it('a target held in a grip fails its defense outright', () => {
  const r = strike((t) => { t.heldBy = 'drover'; });
  expect(r.defense!.tier).toBe('critical_failure');
  expect(r.defense!.modifiers[0].source).toBe("held: can't defend");
});
