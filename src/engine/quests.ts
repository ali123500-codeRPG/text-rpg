// Quests (OQ-28, D-105, QT1–QT28). A quest is a deal (hidden.agreements) with a job in it, given to the player by an
// NPC. The giver's agent offers the job in talk and writes it down when the player accepts; code checks the goal from
// events, ends the quest (the deal is locked until then), pays XP from the quests' own reward table, tracks the promised
// payment and the deadline, and steps the giver's stance.
import type { Actor, GameEvent, GameState, JobOffer, Quest, QuestEnd, QuestGoal, QuestState } from '../types';
import { CONFIG } from '../config';
import { bodyType, getLibrary, itemDef } from '../library';
import { TIME_OF_DAY } from '../scales';
import { DAY_MINUTES, dayOf, now } from '../time';
import { IT } from '../library/itemIds';
import { healthLevel } from '../ruleset/body';
import { rewardXp } from '../ruleset/achRewards';
import { buildLeakContext, leakScan } from '../agents/narration';
import { actorById, allActors, zoneById } from './relations';
import { applyMemoryOps } from './memory';
import { logCode, stepStance } from './effects';
import { awardXp, power, tally, weakFoeTaper } from './xp';
import { coinWords } from './trade';

export const isOpen = (q: Quest) => q.state === 'active' || q.state === 'ready';
const safe = <T>(f: () => T): T | undefined => { try { return f(); } catch { return undefined; } };
const whole = (n: number | null | undefined, min = 1) => Math.max(min, Math.floor(n ?? min));
const norm = (s: string) => s.trim().toLowerCase().replace(/s$/, '');
const instances = (state: GameState) => [...allActors(state).flatMap((a) => a.core.inventory), ...state.zones.flatMap((z) => z.groundItems)].flatMap((i) => [i, ...(i.contents ?? [])]); // CT1: and what containers hold

/** a library row by id, or by its name (singular or plural) */
function libKey(rows: Record<string, { name: string }> | undefined, t: string): string | undefined {
  if (!rows || !t) return undefined;
  if (rows[t]) return t;
  return Object.entries(rows).find(([, r]) => norm(r.name) === norm(t))?.[0];
}

/** QT6/QT7: the giver's goal as a kind code can check from events; anything else is "other" */
function readGoal(state: GameState, g: JobOffer['goal']): QuestGoal {
  const t = g.target?.trim() ?? '';
  const other = (id: string | null | undefined) => { const a = actorById(state, id ?? ''); return a && a !== state.player ? a : undefined; };
  const lib = getLibrary();
  if (g.kind === 'defeat') {
    const count = whole(g.count);
    if (other(t)) return { kind: 'defeat', by: 'actor', of: t, count: 1 };
    const noun = /^[A-Z]{2}\d+$/.test(t) ? {} : { noun: t }; // the giver's word, not a typed id
    const bt = safe(() => bodyType(state, t)) ? t : libKey(lib.bodyTypes, t);
    if (bt) return { kind: 'defeat', by: 'body_type', of: bt, count, ...noun };
    const race = libKey(lib.races, t);
    if (race) return { kind: 'defeat', by: 'race', of: race, count, ...noun };
  }
  if (g.kind === 'deliver' && other(g.to) && g.item) {
    if (instances(state).some((i) => i.id === g.item)) return { kind: 'deliver', item: g.item, inst: true, qty: 1, to: g.to! };
    if (safe(() => itemDef(state, g.item!))) return { kind: 'deliver', item: g.item, qty: whole(g.qty), to: g.to! };
  }
  if (g.kind === 'reach' && (zoneById(state, t) || state.places.some((p) => p.id === t))) return { kind: 'reach', place: t };
  if (g.kind === 'find' && other(t)) return { kind: 'find', actor: t };
  return { kind: 'other' };
}

/** QT10/QT23: a definite promise as data; an instance id reads as its library item */
function readPay(state: GameState, p: JobOffer['pay']): Quest['pay'] {
  const coin = Math.max(0, Math.floor(p?.coin ?? 0));
  const item = p?.item ? (instances(state).find((i) => i.id === p.item)?.itemId ?? (safe(() => itemDef(state, p.item!)) ? p.item : undefined)) : undefined;
  if (p?.item && !item) logCode(state, 'invalid_quest_pay', { item: p.item });
  return coin || item ? { ...(coin ? { coin } : {}), ...(item ? { item, qty: whole(p?.qty) } : {}) } : undefined;
}

/** QT25: "in N days", optionally "by" a time of day, as a clock time; without a time of day, the end of that day */
function dueAt(state: GameState, d: NonNullable<JobOffer['due']>): number {
  const day = dayOf(now(state)) + whole(d.days, 0);
  if (!d.by) return day * DAY_MINUTES;
  const t = (day - 1) * DAY_MINUTES + CONFIG.TIME_OF_DAY_FROM[d.by];
  return t > now(state) ? t : t + DAY_MINUTES;
}

/** QT1–QT5: the player accepted a job in words the giver heard; the deal is already made. A refused quest keeps the deal. */
export function makeQuest(state: GameState, giver: Actor, dealId: string, job: JobOffer, heardPlayer: boolean): void {
  const refuse = (reason: string, more: Record<string, unknown> = {}) => logCode(state, 'quest_refused', { giver: giver.id, dealId, reason, ...more });
  const text = job.line.trim().slice(0, CONFIG.TEXT_CAP);
  if (!heardPlayer) return refuse('not_heard');
  if (state.quests.some((q) => q.giver === giver.id && isOpen(q))) return refuse('open_quest');
  if (!text) return refuse('no_line');
  const leaks = leakScan(text, '', buildLeakContext(state));
  if (leaks.length) return refuse('leak', { leaks });
  const goal = readGoal(state, job.goal);
  if (goal.kind === 'other') logCode(state, 'quest_goal_gap', { text, giver: giver.id, asked: job.goal }); // QT27
  let id = `quest_${state.turn}_${giver.id}`;
  for (let i = 2; state.quests.some((q) => q.id === id); i++) id = `quest_${state.turn}_${giver.id}_${i}`;
  // QT24: the quest it follows, as named; else the giver's own job handed in during this talk
  const named = job.after ? state.quests.find((q) => q.id === job.after) : undefined;
  if (job.after && !named) logCode(state, 'invalid_quest_after', { id, after: job.after });
  const talk = state.player.engagement?.start;
  const prev = named ?? (talk === undefined ? undefined
    : state.quests.filter((q) => q.giver === giver.id && q.state === 'done' && (q.endTurn ?? -1) >= talk).at(-1));
  const pay = readPay(state, job.pay);
  const q: Quest = {
    id, state: 'active', text, giver: giver.id, dealId, goal, progress: 0,
    level: CONFIG.QUEST_GAIN_LEVEL[state.hidden.stage.gain] ?? 'zero', startTurn: state.turn,
    ...(prev ? { after: prev.id } : {}),
    ...(pay ? { pay, paid: { coin: 0, qty: 0 } } : {}),
    ...(job.due ? { due: dueAt(state, job.due), startAt: now(state), ...(job.due.by ? { dueBy: job.due.by } : {}) } : {}),
  };
  state.quests.push(q);
  logCode(state, 'quest_made', { id, giver: giver.id, goal: goal.kind, level: q.level });
}

/** code ends a quest and the deal that holds it; done pays XP and warms the giver, the player's failures cool it (QT13) */
/** a done quest's XP: its reward level's amount; a defeat job is cut by the defeat-XP taper of its foes' average power
 * (as each fell) against the player's power at hand-in (QX2, QX4) */
export function questXp(state: GameState, q: Quest): number {
  const xp = rewardXp(q.level);
  if (q.goal.kind !== 'defeat' || !q.progress || q.foePower === undefined) return xp;
  return Math.round(xp * weakFoeTaper(q.foePower / q.progress, power(state, state.player)));
}

function endQuest(state: GameState, q: Quest, to: QuestState, why: string, colder = false): void {
  q.state = to;
  q.endTurn = state.turn;
  delete q.pinned;
  state.hidden.agreements = (state.hidden.agreements ?? []).filter((g) => g.id !== q.dealId);
  logCode(state, 'quest_ended', { id: q.id, state: to, why });
  const giver = actorById(state, q.giver);
  if (to === 'done') { awardXp(state, questXp(state, q), `quest:${q.id}`); tally(state, 'quests_done'); questFeats(state, q); }
  if (giver && (to === 'done' || colder)) stepStance(state, giver, state.player, to === 'done' ? 'friendlier' : 'colder');
}

/** N9: the quest achievements read from the quest list: jobs done for this giver, different givers, finished runs of
 * follow-ups (QT24 `after`, counted once per first quest), done before half the time ran out, done with no pay promised */
function questFeats(state: GameState, q: Quest): void {
  const done = state.quests.filter((x) => x.state === 'done');
  tally(state, 'quests_for_giver', { by: 'giver', of: q.giver, to: done.filter((x) => x.giver === q.giver).length });
  tally(state, 'quest_givers', { to: new Set(done.map((x) => x.giver)).size });
  // a run: a done follow-up whose every earlier quest is done too; it counts once, by the run's first quest
  const runFirst = (x: Quest): string | null => {
    let cur = x;
    for (let i = 0; cur.after && i < 100; i++) {
      const prev = state.quests.find((y) => y.id === cur.after);
      if (!prev || prev.state !== 'done') return null;
      cur = prev;
    }
    return cur === x ? null : cur.id;
  };
  tally(state, 'quest_chains', { to: new Set(done.map(runFirst).filter((x) => x !== null)).size });
  if (q.due !== undefined && q.startAt !== undefined && now(state) - q.startAt <= (q.due - q.startAt) / 2) tally(state, 'quests_early');
  if (!q.pay?.coin && !q.pay?.item) tally(state, 'quests_unpaid');
}

/** QT12: the player gives up a job (the Quests page, or telling the giver) */
export function abandonQuest(state: GameState, id: string): boolean {
  const q = state.quests.find((x) => x.id === id && isOpen(x));
  if (!q) return false;
  endQuest(state, q, 'abandoned', 'player', true);
  tally(state, 'quests_abandoned'); // a scar chain counts quests the player gave up
  const giver = actorById(state, q.giver);
  if (giver) applyMemoryOps(state, giver, { add: [`The player gave up the job: ${q.text}`], drop: [] });
  return true;
}

/** only one quest is pinned to the Play screen's quest line; pinning it again unpins it */
export function pinQuest(state: GameState, id: string): void {
  const on = !state.quests.find((q) => q.id === id)?.pinned;
  for (const q of state.quests) delete q.pinned;
  const q = state.quests.find((x) => x.id === id && isOpen(x));
  if (q && on) q.pinned = true;
}

/** QT6/QT12/QT22: the giver's agent ends a job: called off in words the player heard, an "other" job judged done at
 * report-back, or given up by the player in words the giver heard */
export function agentQuestEnd(state: GameState, a: Actor, e: QuestEnd, heardPlayer: boolean, playerHeard: boolean): void {
  const q = state.quests.find((x) => x.id === e.id && x.giver === a.id && isOpen(x));
  // BF6: a giver may judge any job done on the player's report; code ends it only if the goal is really met
  const ok = q && (e.outcome === 'called_off' ? playerHeard : heardPlayer && (e.outcome === 'abandoned' || q.goal.kind === 'other' || q.state === 'ready'));
  if (q && !ok && e.outcome === 'done' && heardPlayer) { logCode(state, 'quest_report_believed', { actorId: a.id, id: q.id }); return; }
  if (!ok) { logCode(state, 'invalid_quest_end', { actorId: a.id, ...e }); return; }
  if (e.outcome === 'abandoned') abandonQuest(state, q.id);
  else endQuest(state, q, e.outcome, 'giver');
}

/** QT8: a job whose goal is met is done when the player talks to the giver in person, if the giver saw it met (BF6: a
 * giver who did not see it judges the player's report through its agent's questEnd) */
export function handInQuests(state: GameState, talkedTo: (id: string) => boolean): void {
  for (const q of state.quests) if (q.state === 'ready' && q.giverSaw && talkedTo(q.giver)) endQuest(state, q, 'done', 'hand_in');
}

// ---- goal checks, shared by quest goals and scenario endings (SC7: one rule for the same thing) ----
/** is the player in zone or place `place` (a place counts with every place inside it) */
export function playerIn(state: GameState, place: string): boolean {
  const p = state.player;
  if (p.zone === place) return true;
  const chain: string[] = [];
  for (let id: string | null = zoneById(state, p.zone)?.placeId ?? p.placeId; id && !chain.includes(id); id = state.places.find((x) => x.id === id)?.parentId ?? null) chain.push(id);
  return chain.includes(place);
}
/** has the player seen this actor clearly */
export const playerFound = (state: GameState, actor: string): boolean => state.player.journal?.clearSight?.[actor] !== undefined;
/** how many of `item` (a library item id, or one item instance's id with inst) the player gave `to` in these events */
export function givenTo(state: GameState, events: GameEvent[], item: string, to: string, inst?: true): number {
  let n = 0;
  for (const e of events) {
    if (e.kind !== 'give' || e.actorId !== state.player.id || e.target !== to) continue;
    const got = actorById(state, to)?.core.inventory.find((i) => i.id === e.itemId);
    if (e.itemId === item || (!inst && got?.itemId === item)) n += inst ? 1 : (e.qty ?? 1);
  }
  return n;
}

const need = (g: QuestGoal) => (g.kind === 'defeat' ? g.count : g.kind === 'deliver' ? g.qty : 1);
const dead = (a: Actor | undefined) => !!a && healthLevel(a) === 'dead';
const owedOf = (q: Quest) => ({ coin: Math.max(0, (q.pay?.coin ?? 0) - (q.paid?.coin ?? 0)), qty: q.pay?.item ? Math.max(0, (q.pay.qty ?? 1) - (q.paid?.qty ?? 0)) : 0 });
export const owes = (q: Quest) => { const o = owedOf(q); return o.coin > 0 || o.qty > 0; };

/** per turn, after the defeats are paid and time has passed: goal progress, payments, failures and deadlines */
export function updateQuests(state: GameState, events: GameEvent[], defeated: Actor[]): void {
  const p = state.player;
  for (const q of state.quests.filter((x) => x.state === 'active')) {
    const g = q.goal;
    if (g.kind === 'defeat') for (const t of defeated.filter((x) => (g.by === 'actor' ? x.id : g.by === 'race' ? x.core.raceId : x.core.bodyTypeId) === g.of)) {
      q.progress++;
      q.foePower = (q.foePower ?? 0) + power(state, t); // QX4: each foe's power when it falls
    }
    if (g.kind === 'deliver') q.progress += givenTo(state, events, g.item, g.to, g.inst);
    if (g.kind === 'reach' && playerIn(state, g.place)) q.progress = 1;
    if (g.kind === 'find' && playerFound(state, g.actor)) q.progress = 1;
    if (g.kind === 'other' || q.progress < need(g)) continue;
    q.progress = need(g);
    q.state = 'ready';
    // BF6: did the giver perceive the deed that met it: the counted foes' last fall, the hand-over, the player there
    const foes = new Set(defeated.map((x) => x.id));
    q.giverSaw = events.some((e) => !!e.perception[q.giver] && (g.kind === 'defeat' ? foes.has(e.actorId) || (!!e.target && foes.has(e.target)) : e.actorId === p.id));
    logCode(state, 'quest_ready', { id: q.id });
    if (g.kind === 'deliver' && g.to === q.giver) endQuest(state, q, 'done', 'delivered'); // QT8: handing it to the giver finishes it
  }
  // QT23: anything the giver hands the player counts toward what it promised, oldest job first
  for (const e of events) {
    if (e.kind !== 'give' || e.target !== p.id) continue;
    const itemId = p.core.inventory.find((i) => i.id === e.itemId)?.itemId;
    let left = e.qty ?? 1;
    for (const q of state.quests) {
      if (q.giver !== e.actorId || !q.pay || q.unpaid || !left) continue;
      const k = itemId === IT.coin ? 'coin' : itemId === q.pay.item ? 'qty' : null;
      if (!k) continue;
      const take = Math.min(left, owedOf(q)[k]);
      q.paid![k] += take;
      left -= take;
    }
  }
  // QT11: code fails a job that can no longer be done; QT25: a goal not met by the deadline fails, the player's doing
  for (const q of state.quests.filter((x) => x.state === 'active')) {
    const g = q.goal;
    const target = g.kind === 'defeat' && g.by === 'actor' ? g.of : g.kind === 'find' ? g.actor : g.kind === 'deliver' ? g.to : undefined;
    if (dead(actorById(state, q.giver))) endQuest(state, q, 'failed', 'giver_dead');
    else if (target && dead(actorById(state, target))) endQuest(state, q, 'failed', 'target_dead');
    else if (g.kind === 'deliver' && g.inst && !instances(state).some((i) => i.id === g.item)) endQuest(state, q, 'failed', 'item_gone');
    else if (q.due !== undefined && now(state) > q.due) endQuest(state, q, 'failed', 'deadline', true);
  }
}

/** QT23: a payment still owed when the engagement the player handed in during ends is a broken promise */
export function unpaidQuests(state: GameState): void {
  for (const q of state.quests) {
    if (q.state !== 'done' || q.unpaid || !owes(q)) continue;
    q.unpaid = true;
    logCode(state, 'quest_unpaid', { id: q.id, giver: q.giver });
    const giver = actorById(state, q.giver);
    if (giver) applyMemoryOps(state, giver, { add: [`Did not pay the player what I promised for the job: ${q.text}`], drop: [] });
  }
}

// ---------- what views and screens show ----------

export const QUEST_STATE_NAME: Record<QuestState, string> = {
  active: 'Active', ready: 'Ready to hand in', done: 'Done', failed: 'Failed', abandoned: 'Abandoned', called_off: 'Called off',
};

/** "10 copper and 1 healing draught" */
function payWords(state: GameState, coin: number, item: string | undefined, qty: number): string {
  const name = item ? safe(() => itemDef(state, item).name) ?? item : '';
  return [coin ? coinWords(coin) : '', item && qty ? `${qty} ${name}` : ''].filter(Boolean).join(' and ');
}
/** QT14: the promise while nothing is owed yet stated, "Owed …" until paid, "Unpaid …" once the promise is broken */
export function payText(state: GameState, q: Quest): string {
  if (!q.pay) return '';
  const o = owedOf(q);
  if (!owes(q)) return `Paid ${payWords(state, q.pay.coin ?? 0, q.pay.item, q.pay.qty ?? 0)}`;
  return `${q.unpaid ? 'Unpaid' : 'Owed'} ${payWords(state, o.coin, q.pay.item, o.qty)}`;
}
/** the day a quest is due on */
export const dueDay = (q: Quest): number | undefined => (q.due === undefined ? undefined : q.dueBy ? dayOf(q.due) : q.due / DAY_MINUTES);
/** QT25: "Due day 3, dusk"; without a time of day, "Due end of day 3" */
export function dueText(q: Quest): string {
  if (q.due === undefined) return '';
  return q.dueBy ? `Due day ${dueDay(q)}, ${TIME_OF_DAY.name(q.dueBy).toLowerCase()}` : `Due end of day ${dueDay(q)}`;
}
/** QT24: the linked quests a quest belongs to, by start, and its step number in them */
export function questChain(state: GameState, q: Quest): Quest[] {
  let root = q;
  for (let i = 0; root.after && i < 50; i++) root = state.quests.find((x) => x.id === root.after) ?? root;
  const out = [root];
  for (let i = 0; i < out.length; i++) out.push(...state.quests.filter((x) => x.after === out[i].id && !out.includes(x)));
  return out.sort((a, b) => a.startTurn - b.startTurn);
}
