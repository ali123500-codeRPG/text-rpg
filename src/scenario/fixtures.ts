// Fixture stage plans: the scripted Weaver answer for story start (STORY_PREMISE: the village tavern).
// Used by W6 tests, the pipeline (W7) and the integration owner. Expects the player's band id 'player_band'.
import { ZK } from '../library/tableIds';
import { TP } from '../library/templateIds';
import { SV } from '../library/serviceIds';
import type { Clock, GameState, Grade, StagePlan, Tier } from '../types';
import { IT } from '../library/itemIds';

/** a challenge/gain pair that fits each tier (Agent Weaver: grades table) */
export const FITTING_GRADES: Record<Tier, { challenge: Grade; gain: Grade }> = {
  critical_failure: { challenge: 'major', gain: 'minor' },
  failure: { challenge: 'moderate', gain: 'minor' },
  near_miss: { challenge: 'moderate', gain: 'minor' },
  success: { challenge: 'moderate', gain: 'moderate' },
  great_success: { challenge: 'minor', gain: 'major' },
  critical_success: { challenge: 'major', gain: 'extreme' },
};

/** Story start: Brookmere's tavern, the street and gate, the slime field, a frontier into the woods. */
export function villageStagePlan(tier: Tier = 'success'): StagePlan {
  const L = (to: string, label: string, sight = true) => ({ to, label, sight });
  return {
    event: { summary: 'slimes from a nest in the woods have started raiding the field', ...(FITTING_GRADES[tier] ?? FITTING_GRADES.success) },
    places: [
      { key: 'village', name: 'Brookmere', kind: 'settlement', parent: '' },
      { key: 'tavern', name: 'The Crooked Kettle', kind: 'place', parent: 'village' },
      { key: 'street', name: 'Market Street', kind: 'place', parent: 'village' },
      { key: 'field', name: 'the east field', kind: 'place', parent: 'village' },
    ],
    zones: [
      { key: 'tav_common', place: 'tavern', kind: ZK.room, name: 'common room', look: 'a low smoky room of benches and tables', cover: 'none', light: 'dim',
        links: [L('tav_counter', 'behind the bar'), L('street_door', 'out the front door', false)] },
      { key: 'tav_counter', place: 'tavern', kind: ZK.room, name: 'behind the bar', look: 'a scarred counter with kegs behind it', cover: 'some', light: 'dim',
        links: [L('tav_common', 'the common room'), L('tav_cellar', 'down the cellar steps', false)] },
      { key: 'tav_cellar', place: 'tavern', kind: ZK.cellar, name: 'cellar', look: 'a damp cellar of barrels', cover: 'some', light: 'dark',
        links: [L('tav_counter', 'up the cellar steps', false)] },
      { key: 'street_door', place: 'street', kind: ZK.street, name: 'outside the tavern', look: 'a muddy street before the tavern door', cover: 'none',
        links: [L('tav_common', 'inside the tavern', false), L('gate_inner', 'toward the gate')] },
      { key: 'gate_inner', place: 'street', kind: ZK.gate, name: 'the gate', look: 'a timber gate in the palisade', cover: 'none',
        links: [L('street_door', 'back toward the tavern'), L('field_mid', 'through the gate')] },
      { key: 'field_mid', place: 'field', kind: ZK.field, name: 'the open field', look: 'wet grass streaked with slime trails', cover: 'none',
        links: [L('gate_inner', 'back toward the gate'), L('field_far', 'the far side of the field')] },
      { key: 'field_far', place: 'field', kind: ZK.field, name: 'far side of the field', look: 'long grass by a line of trees', cover: 'some',
        links: [L('field_mid', 'back across the field'), L('woods', 'into the woods', false)] },
    ],
    frontiers: [{ key: 'woods', label: 'the woods' }],
    bands: [
      { key: 'village_watch', name: 'the village watch', goals: 'keep the slimes out of the village', temperament: 'tired but dutiful', tactics: 'competent', lethal: true, relations: { slimes: 'hostile' } },
      { key: 'tavern_folk', name: 'tavern folk', goals: 'keep the tavern open', temperament: 'wary of strangers', tactics: 'simple', lethal: true, relations: {} },
      { key: 'slimes', name: 'slimes', goals: 'feed', temperament: 'mindless', tactics: 'simple', lethal: true,
        relations: { player_band: 'hostile', village_watch: 'hostile', tavern_folk: 'hostile' } },
    ],
    cast: [
      { template: TP.guard, key: 'guard_1', label: 'a village guard', name: 'Bertram', pronouns: 'he', appearance: 'a stocky man in a dented mail shirt',
        band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'gate_inner' }, awarenessOfPlayer: 'unaware', motive: 'wants the slimes gone before harvest' },
      { template: TP.trader, key: 'barkeep', label: 'the barkeep', name: 'Mags', pronouns: 'she', appearance: 'a broad woman with flour on her apron', knownOnSight: true,
        knows: [{ id: 'slimes_field', text: 'Slimes have been coming over the east field most nights.' }],
        band: 'tavern_folk', routineSetId: 'barkeep', slots: { counter: 'tav_counter', refuge: 'tav_cellar' }, awarenessOfPlayer: 'aware', motive: 'wants someone to deal with the slimes cheaply',
        wares: { items: [{ item: IT.bandage, qty: 4 }], services: [SV.drink, SV.meal, SV.bed] } },
      { template: TP.patron, key: 'patron_1', label: 'an old drinker', name: 'Old Wim', pronouns: 'he', appearance: 'a stooped old man nursing a mug',
        band: 'tavern_folk', routineSetId: 'patron', slots: { seat: 'tav_common', refuge: 'tav_cellar', exit: 'street_door' }, awarenessOfPlayer: 'suspicious', motive: 'wants a free drink' },
      { template: TP.slime, key: 'slime_1', label: 'a slime', name: 'slime', pronouns: 'it', appearance: 'a quivering green mass',
        band: 'slimes', routineSetId: 'slime_wander', slots: { route: ['field_mid', 'field_far'], post: 'field_far' }, startAt: 'route', awarenessOfPlayer: 'unaware', motive: 'hunger' },
      { template: TP.slime, key: 'slime_2', label: 'a slime', name: 'slime', pronouns: 'it', appearance: 'a quivering green mass',
        band: 'slimes', routineSetId: 'slime_wander', slots: { route: ['field_far', 'field_mid'], post: 'field_mid' }, awarenessOfPlayer: 'unaware', motive: 'hunger' },
    ],
    seeds: { plans: [], triggers: [], secrets: [] },
    rewards: [{ item: IT.coin, qty: 5, place: { carriedBy: 'barkeep' } }],
    hiddenTerms: ['nest'],
    weaverNote: 'Opening: slimes raid the field from a nest in the woods. Mags will pay for help.',
    scenario: { question: 'will the slimes be driven off the field?', scale: 'episode', endings: [
      { when: { kind: 'band_out', band: 'slimes' }, as: 'resolved', text: 'the slimes are beaten or gone' },
      { when: { kind: 'judged' }, as: 'lost', text: 'the slimes overrun the field' },
    ] },
  };
}

/** A one-zone extension for the 'woods' frontier off the village field (entry zone 'grove'). */
export function grovePlan(tier: Tier = 'success'): StagePlan {
  return {
    ...villageStagePlan(tier), places: [], bands: [], cast: [], rewards: [], frontiers: [{ key: 'deep_woods', label: 'deeper into the woods' }], hiddenTerms: [],
    event: { summary: 'a quiet grove', ...(FITTING_GRADES[tier] ?? FITTING_GRADES.success) },
    scenario: { question: 'what is in the grove?', scale: 'moment', endings: [
      { when: { kind: 'judged' }, as: 'resolved', text: 'the grove is explored' }, { when: { kind: 'judged' }, as: 'left', text: 'the player walks on' }] },
    zones: [{ key: 'grove', place: 'field', kind: ZK.woods, name: 'a grove', look: 'a quiet grove of birches', cover: 'some', links: [{ to: 'field_far', label: 'back to the field', sight: true }, { to: 'deep_woods', label: 'deeper into the woods', sight: false }] }],
  };
}

/** Test support: a story-start state from any fixture state — no places, zones, NPCs or bands but the player's; turn 0. */
export function toStoryStart(state: GameState, placeId = 'tavern'): GameState {
  state.turn = 0;
  state.places = [];
  state.zones = [];
  state.actors = [];
  state.bands = state.bands.filter((b) => b.id === state.player.bandId).map((b) => ({ ...b, relations: {} }));
  state.stage = { zoneIds: [], tier: 'success', scenarioNumber: 0, scenarioStartTurn: 0 };
  state.hidden = { plans: {}, memory: {}, secrets: [], firedLog: [], weaverNote: '', stage: { eventSummary: '', challenge: 'none', gain: 'none', hiddenTerms: [] } };
  state.player.zone = '';
  state.player.placeId = placeId;
  return state;
}

/** Test support: a virtual Clock. sleep() resolves when advance() passes its time. */
export class VirtualClock implements Clock {
  t = 0;
  private waits: { at: number; done: () => void }[] = [];
  now(): number {
    return this.t;
  }
  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = { at: this.t + ms, done: resolve };
      this.waits.push(w);
      signal?.addEventListener('abort', () => {
        this.waits = this.waits.filter((x) => x !== w);
        reject(new Error('aborted'));
      });
    });
  }
  async advance(ms: number): Promise<void> {
    this.t += ms;
    const due = this.waits.filter((w) => w.at <= this.t);
    this.waits = this.waits.filter((w) => w.at > this.t);
    for (const w of due) w.done();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }
}
