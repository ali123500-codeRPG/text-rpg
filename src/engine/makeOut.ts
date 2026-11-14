// PG3-PG9: making out what is half seen or half heard. Whenever an observer perceives an event of someone not hiding only in
// part, it rolls that sense automatically (no command) against how faint it is (perception faintness): a success makes it
// a full perception. Someone seen clearly whose words reach the observer only as a voice rolls hearing for the words
// (PG8). Everyone rolls by the same rule (PG3 a), once a turn for each person and sense (PG6 a); someone hiding is left
// to the stealth contests. The roll learns like any check (PG7 a). Only the player's roll is kept on the event, for the
// Rolls panel (PG9 a).
import type { Actor, GameEvent, GameState, Rng } from '../types';
import { CONFIG } from '../config';
import { FN } from '../library/functionIds';
import { SENSE_SKILL } from '../library/skillIds';
import { gradeMod, markUse, ruleset, tierAtLeast } from '../ruleset';
import { faintness, hasWords } from '../perception';
import { actorById, isAsleep } from './relations';
import { madeOutResult, recordMadeOut, type MadeOutSense } from '../perception/madeOut';

type Sense = MadeOutSense;

/** one make-out roll by `o` with `fn` on `ev`, or this turn's earlier result for that person and sense */
function rollOnce(state: GameState, o: Actor, ev: GameEvent, fn: Sense, rng: Rng): boolean {
  const earlier = madeOutResult(state, o.id, ev.actorId, fn);
  if (earlier !== undefined) return earlier;
  const grade = faintness(state, ev, o, fn === FN.hearing ? 'sound' : 'sight');
  if (!grade) return recordMadeOut(state, o.id, ev.actorId, fn, false);
  const target = CONFIG.DIFFICULTY[grade];
  const r = ruleset.roll({ actorId: o.id, skill: SENSE_SKILL[fn], fn, modifiers: [{ source: 'how faint', type: 'situational', value: gradeMod(target) }], tierShifts: [], rollKind: 'perception' }, state, rng);
  const passed = tierAtLeast(r.tier, 'success');
  markUse(state, o, r.skill, { actorId: o.id, skill: r.skill, target, passed, modifiers: [] }); // PG7 a: learns like a check
  if (o.id === state.player.id) ev.madeOut = { roll: r, target, passed };
  return recordMadeOut(state, o.id, ev.actorId, fn, passed);
}

/** PG3-PG8: every observer who half perceives `ev` tries to make it out; a success upgrades its perception in place */
export function makeOut(state: GameState, ev: GameEvent, rng: Rng): void {
  const s = actorById(state, ev.actorId);
  if (!s || s.posture === 'stealthy') return; // someone hiding: the stealth contests decide
  for (const [id, p] of Object.entries(ev.perception)) {
    const o = id === ev.actorId ? undefined : actorById(state, id);
    if (!o || (!o.mind && o.kind !== 'player') || isAsleep(o) || p.cue === 'touch' || p.cue === 'smell') continue; // AB18: a smell is never made out
    if (p.level === 'partial') {
      const fn: Sense = p.cue === 'sound' ? FN.hearing : FN.sight;
      if (!rollOnce(state, o, ev, fn, rng)) continue;
      ev.perception[id] = { level: 'full', cue: p.cue, ...(fn === FN.hearing || p.heard ? { heard: true } : {}) };
    }
    // PG8 a: seen clearly, but the words reach them only as a voice
    const cur = ev.perception[id];
    if (cur.level === 'full' && !cur.heard && hasWords(ev) && faintness(state, ev, o, 'sound') && rollOnce(state, o, ev, FN.hearing, rng)) cur.heard = true;
  }
}
