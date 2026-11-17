// 355 BG-285: in deck playtest run 16 the causeway listed "the cottage row" twice (Go to, Look at). When the frontier
// toward the cottages was built, the cottage row's own way back to the causeway first got a way back added on the
// causeway (named after the zone), and only then was the frontier joined, turning it into a second way to the same zone.
// The frontier is now joined first; a save that already has the twin drops the one code added when it loads.
import { expect, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan } from '../../src/scenario/apply';
import { grovePlan } from '../../src/scenario/fixtures';
import { zoneById } from '../../src/engine/relations';
import { getLibrary } from '../../src/library';
import { repairReferences } from '../../src/save/checks';
import { toPages } from '../../src/save/pages';

it('a built frontier whose entry names the way back leaves one way in, named as the frontier was', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  const kind = Object.keys(getLibrary().zoneKinds ?? {})[0];
  const p: StagePlan = grovePlan();
  p.zones = [{ key: 'glade', place: 'field', kind, name: 'the glade', look: 'a glade', links: [{ to: 'field_far', label: 'back to the field', sight: true }] }];
  const label = zoneById(s, 'field_far')!.links.find((l) => l.to === 'woods')!.label;
  applyStagePlan(s, p, { kind: 'extension', tier: 'success', placeId: 'field', frontierKey: 'woods' }, { entry: 'open' }, createRng(1));
  const glade = s.zones.find((z) => z.name === 'the glade')!;
  const ways = zoneById(s, 'field_far')!.links.filter((l) => l.to === glade.id);
  expect(ways).toHaveLength(1);
  expect(ways[0].label).toBe(label);
});

it('a save with a second way to the same zone, added by code, keeps only the named way', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  const far = zoneById(s, 'field_far')!, mid = zoneById(s, 'field_mid')!;
  const named = far.links.find((l) => l.to === 'field_mid')!;
  far.links.push({ to: 'field_mid', label: mid.name, sight: true });
  const pages = toPages(s);
  const r = { repairs: [] as string[], changed: new Set<string>() };
  repairReferences(pages, getLibrary(), r as never);
  const zones = Object.values(pages).flatMap((pg) => ((pg as { zones?: { id: string; links: { to: string; label: string }[] }[] }).zones ?? []));
  const ways = zones.find((z) => z.id === 'field_far')!.links.filter((l) => l.to === 'field_mid');
  expect(ways.map((l) => l.label)).toEqual([named.label]);
});
