// Nerve and personality (PL1–PL19): Nerve line and tier, trait words, the archetype, "but" traits, tensions, rewards that
// add points, the agent's CHARACTER line (rows checked against the voice-tested prototype), and the Weaver's pick.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { getLibrary, npcTemplate } from '../../src/library';
import { presetPersonality, spawnNpc } from '../../src/library/spawn';
import { PA, PY, TN, VL } from '../../src/library/tableIds';
import { TP } from '../../src/library/templateIds';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { archetypeOf, butsOf, nerveLine, nerveTier, personalityFrom, personalityOf, personalityText, tensionsOf, traitWords } from '../../src/ruleset/personality';
import { bornDayFor } from '../../src/ruleset/age';
import { buildOppositionView } from '../../src/views';
import { makeVillage } from '../harness';
import { formatDialogueView, formatOppositionView } from '../../src/agents/format';
import type { Actor } from '../../src/types';
import { actorView } from './agent-views';

// the preset's centre personality, without the copy's spread (NG14), so the words below are the layers'
const npc = (tp: string) => { const a = spawnNpc(null, tp, { id: 'x', zone: 'z', placeId: 'p', bandId: 'b' }); a.core.personality = presetPersonality(npcTemplate(null, tp)); return a; };
const withResolve = (a: Actor, r: number) => { a.core.skills[SK.resolve] = { raw: r, state: 'normal' }; return a; };

describe('Nerve', () => {
  it('leans at PERSONALITY_LEAN: cautious, steady, daring', () => {
    expect(nerveLine({ nerve: -CONFIG.PERSONALITY_LEAN, traits: {}, values: [] })).toBe('cautious');
    expect(nerveLine({ nerve: CONFIG.PERSONALITY_LEAN - 1, traits: {}, values: [] })).toBe('steady');
    expect(nerveLine({ nerve: CONFIG.PERSONALITY_LEAN, traits: {}, values: [] })).toBe('daring');
  });
  it('the tier follows raw Resolve: timid at 30 becomes careful at 40; 100 is superhuman, + every 50 past it', () => {
    const barkeep = npc(TP.trader);
    expect(barkeep.core.skills[SK.resolve].raw).toBe(30);
    expect(nerveTier(barkeep)).toBe('Timid');
    expect(nerveTier(withResolve(barkeep, 40))).toBe('Careful');
    expect(nerveTier(withResolve(barkeep, 100))).toBe('Unflappable');
    expect(nerveTier(withResolve(barkeep, 150))).toBe('Unflappable+');
    expect(nerveTier(withResolve(barkeep, 210))).toBe('Unflappable++');
    expect(nerveTier(npc(TP.guard))).toBe('Steady');
  });
});

describe('personality', () => {
  it('trait words are graded, strongest first, and the middle is left out', () => {
    expect(traitWords({ nerve: 0, traits: { [PA.pride]: 75, [PA.honesty]: -45, [PA.sociability]: 25, [PA.curiosity]: 19 }, values: [] }))
      .toEqual(['very proud', 'deceitful', 'a bit talkative']);
  });
  it('the archetype is the nearest type, drives counted twice; "but" traits are the ones it does not explain', () => {
    // Corin (the Mera voice tests): Mature at heart, but humble and earnest
    const corin = { nerve: -10, traits: { [PA.honesty]: 50, [PA.pride]: -40, [PA.temper]: -40, [PA.discipline]: 70, [PA.levity]: -40 }, values: [VL.loyalty, VL.duty, VL.family] };
    expect(archetypeOf(corin).id).toBe(PY.mature);
    expect(butsOf(corin, archetypeOf(corin))).toEqual([{ axis: PA.pride, v: -40 }, { axis: PA.levity, v: -40 }]);
    // no lean at all is Ordinary, the first row (ties go to the earlier row)
    expect(archetypeOf({ nerve: 0, traits: {}, values: [] }).id).toBe(PY.ordinary);
  });
  it('tensions read Nerve, Resolve, the best skills, age and drives, in table order', () => {
    const s = makeVillage(), a = s.player;
    a.core.classes = []; a.core.perks = [];
    a.core.personality = { nerve: -40, traits: { [PA.discipline]: 60 }, values: [] };
    a.core.skills = { [SK.melee_medium]: { raw: 50, state: 'normal' } };
    a.core.bornDay = bornDayFor(s, 30);
    expect(tensionsOf(s, a).map((t) => t.id)).toEqual([TN.wary_dangerous]);
    a.core.bornDay = bornDayFor(s, 8); // a disciplined child
    expect(tensionsOf(s, a).map((t) => t.id)).toEqual([TN.old_head, TN.wary_dangerous]);
    a.core.skills = { [SK.resolve]: { raw: 90, state: 'normal' } }; // Resolve is never the craft
    expect(tensionsOf(s, a).map((t) => t.id)).toEqual([TN.old_head]);
  });
  it('perks, the current class and achievements add points while held (PL15, PL16)', () => {
    const a = npc(TP.guard);
    const lib = getLibrary();
    const perk = a.core.perks[0]?.perkId ?? Object.keys(lib.perks)[0];
    if (!a.core.perks.length) a.core.perks.push({ perkId: perk, source: 'template', gainedTurn: 0 });
    const before = lib.perks[perk].personality;
    lib.perks[perk].personality = { nerve: 10, [PA.pride]: 15 };
    try {
      const p = personalityOf(a);
      expect(p.nerve).toBe(10);
      expect(p.traits[PA.pride]).toBe(15);
      expect(p.traits[PA.discipline]).toBe(40 + CONFIG.ACH_PERSONALITY_STEP); // the template's 40, and the current Guard class's step (PN5)
      expect(a.core.personality!.nerve).toBe(0); // the stored points don't change
    } finally { lib.perks[perk].personality = before; }
  });
  it('the agent reads it in CHARACTER; the Voice never does', () => {
    const s = makeVillage(), guard = npc(TP.guard);
    expect(personalityText(s, guard, 'Tense')).toBe('Nerve: Steady (neither seeks nor flees danger; Tense right now). Mature at heart (thinks before acting, keeps a cool head, owns their mistakes). Drives: duty (does what is expected of them, sees obligations through).');
    const v = actorView();
    expect(formatOppositionView(v)).toContain(`"personality":"${v.personality}"`);
    expect(formatOppositionView(v).split(v.personality).length).toBe(2); // once, in CHARACTER only
    expect(formatDialogueView({ ...v, knows: [], dialogue: [] })).not.toContain(v.personality);
  });
  it('the voice-tested line: Aldo (the Rudeus voice tests) reads exactly as the prototype built it', () => {
    const s = makeVillage(), a = s.player;
    a.core.classes = []; a.core.perks = [];
    a.core.personality = { nerve: -40, traits: { [PA.honesty]: -30, [PA.pride]: -20, [PA.temper]: -40, [PA.sociability]: -20, [PA.discipline]: 60, [PA.curiosity]: 70, [PA.levity]: -20 }, values: [VL.knowledge, VL.loyalty] };
    a.core.skills = { [SK.resolve]: { raw: 20, state: 'normal' }, [SK.melee_medium]: { raw: 50, state: 'normal' } };
    a.core.bornDay = bornDayFor(s, 7);
    expect(personalityText(s, a, 'Calm')).toBe('Nerve: Timid (keeps out of danger when they can; Calm right now). Mature at heart (thinks before acting, keeps a cool head, owns their mistakes), but very curious (wants to know how things work, asks and pokes) and a bit deceitful (bends the truth when it suits them). Drives: knowledge first (studies, practises and seeks out learning), then loyalty (stands by their friends and their own). Tensions: old head on young shoulders (talks and plans like a grown-up, though still a child); wary but dangerous (avoids danger, yet hits hard when pushed).');
  });
  it('a rolled NPC gets its template\'s signatures after Nerve and its title with its name; a copy gets neither', () => {
    const s = makeVillage(), t = getLibrary().templates[TP.guard], g = s.actors.find((x) => x.id === 'guard_1')!;
    t.title = 'the Gatekeeper'; t.signatures = ['Never leaves the gate unwatched.'];
    try {
      expect(personalityText(s, g, 'Calm')).not.toContain('Never leaves');
      expect(buildOppositionView(s, g.id).title).toBeUndefined();
      g.core.generation = 'rolled';
      expect(personalityText(s, g, 'Calm')).toMatch(/^Nerve: [^.]+\. Never leaves the gate unwatched\. Mature at heart/);
      const v = buildOppositionView(s, g.id);
      expect(formatOppositionView(v)).toContain(`"name":"${v.self.name}, the Gatekeeper"`);
      expect(formatDialogueView({ ...v, knows: [], dialogue: [] })).not.toContain('Gatekeeper'); // the Voice is player-side
    } finally { delete t.title; delete t.signatures; }
  });
  it('the Weaver may name a line, types and values on top of the template (PL12)', () => {
    const t = npcTemplate(null, TP.guard);
    const p = personalityFrom(presetPersonality(t), { nerve: 'daring', types: [PY.childish, 'nonsense'], values: [VL.family, 'VL999'] });
    expect(p.nerve).toBe(CONFIG.NERVE_LINE_POINTS);
    expect(p.traits[PA.discipline]).toBe(-70); // Childish's target
    expect(p.traits[PA.temper]).toBe(30);
    expect(personalityFrom({ nerve: 0, traits: { [PA.temper]: 50 }, values: [] }, { types: [PY.childish] }).traits[PA.temper]).toBe(50); // already past it
    expect(p.values).toEqual([VL.family]);
    expect(presetPersonality(t).traits[PA.discipline]).toBe(40); // the layers are untouched (the soldier role's lean)
  });
});

describe('achievement personality points (AP1-AP20)', () => {
  const STEP = CONFIG.ACH_PERSONALITY_STEP;
  const earn = (a: Actor, ...rows: { key: string; of?: string }[]) => {
    a.progression = { ...(a.progression ?? {}), achievements: rows.map((r) => ({ id: r.key, ...r, turn: 0 })) } as Actor['progression'];
    return a;
  };
  it('rows are written in steps of the ACH_PERSONALITY_STEP lever (AP2)', () => {
    const lib = getLibrary().achievements!;
    expect(lib[ACH.unaware_1].personality).toEqual({ [PA.honesty]: -STEP });
    expect(lib[ACH.outnumbered_1].personality).toEqual({ nerve: STEP });
    expect(lib[ACH.morale_breaks_1].personality).toEqual({ nerve: -STEP }); // a scar pushes its own way (AP3)
    expect(lib[ACH.no_blow_1].personality).toBeUndefined(); // AP8 turned down
    expect(lib[ACH.defeated_5].personality).toEqual({ [PA.pride]: -STEP }); // AP18: losing humbles
    expect(lib[ACH.spar_losses_1].personality).toEqual({ [PA.pride]: -STEP });
  });
  it('a held chain level adds its own step plus every lower level by reference (AP1)', () => {
    const base = personalityOf(npc(TP.guard));
    const p = personalityOf(earn(npc(TP.guard), { key: ACH.unaware_50 }));
    expect((p.traits[PA.honesty] ?? 0) - (base.traits[PA.honesty] ?? 0)).toBe(-3 * STEP);
  });
  it('a by-skill row adds its per-skill points only for the skill it was earned with (AP12)', () => {
    const base = personalityOf(npc(TP.guard));
    const lie = personalityOf(earn(npc(TP.guard), { key: ACH.speech_10, of: SK.lying }));
    const talk = personalityOf(earn(npc(TP.guard), { key: ACH.speech_10, of: SK.persuasion }));
    const d = (p: typeof base, k: string) => (p.traits[k] ?? 0) - (base.traits[k] ?? 0);
    expect(d(lie, PA.sociability)).toBe(STEP);
    expect(d(lie, PA.honesty)).toBe(-STEP);
    expect(d(talk, PA.sociability)).toBe(STEP);
    expect(d(talk, PA.honesty)).toBe(0);
  });
});
