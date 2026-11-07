// 61 Bands from the plan: a plan creates a smugglers band opposed to the guards' band and sets the guards suspicious
// of it; each guard gets a suspicious belief about every smuggler on the stage (written through updateBeliefs), and
// one guard's personal stance overrides its band's relation.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng, actor } from '../harness';
import type { StagePlan } from '../../src/types';
import { stance } from '../../src/engine/relations';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scene';
import { toStoryStart, villageStagePlan } from '../../src/scene/fixtures';

export function smugglerPlan(): StagePlan {
  const p = villageStagePlan();
  // room under PLAN_CAPS: this plan has no slimes
  p.cast = p.cast.filter((c) => c.band !== 'slimes');
  p.bands = p.bands.filter((b) => b.key !== 'slimes').map((b) => ({ ...b, relations: {} }));
  p.bands.push({ key: 'smugglers', name: 'cellar folk', goals: 'move the crates unseen', temperament: 'cagey', tacticsLevel: 2, lethal: true, relations: { village_watch: 'opposed' } });
  const smuggler = (key: string, name: string) => ({
    template: 'patron', key, label: 'a hooded drinker', name, appearance: 'a hood pulled low',
    band: 'smugglers', routineSetId: 'patron', slots: { seat: 'tav_cellar', refuge: 'tav_cellar', exit: 'street_door' },
    openingBelief: 'unaware' as const, motive: 'shift the goods tonight',
  });
  p.cast.push(smuggler('smuggler_1', 'Rook'), smuggler('smuggler_2', 'Finch'));
  p.cast.push({ template: 'guard', key: 'guard_2', label: 'a young guard', name: 'Hal', appearance: 'a gangly youth with a spear',
    band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'street_door' }, openingBelief: 'unaware', motive: 'eager',
    overrides: [{ actor: 'smuggler_1', stance: 'opposed' }] });
  for (const c of p.cast) if (c.band === 'village_watch') c.bandBeliefs = [{ band: 'smugglers', status: 'suspicious' }];
  return p;
}

describe('61 Bands from the plan', () => {
  it('creates the band, beliefs per member and a personal stance', () => {
    const s = toStoryStart(makeVillage());
    const ctx: PlanContext = { tier: 'Success', kind: 'scene', placeId: 'tavern' };
    const p = smugglerPlan();
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const band = s.bands.find((b) => b.id === 'smugglers')!;
    expect(band.relations.village_watch).toBe('opposed');
    expect(band.lethal).toBe(true);
    for (const g of ['guard_1', 'guard_2']) {
      for (const m of ['smuggler_1', 'smuggler_2']) {
        expect(actor(s, g).mind!.knowledge[m]).toMatchObject({ status: 'suspicious', lastKnownZone: actor(s, m).zone });
      }
    }
    const rook = actor(s, 'smuggler_1');
    expect(stance(s, actor(s, 'guard_1'), rook)).toBe('neutral'); // the band's relation
    expect(stance(s, actor(s, 'guard_2'), rook)).toBe('opposed'); // the personal stance
    expect(stance(s, rook, actor(s, 'guard_1'))).toBe('opposed');
  });
});
