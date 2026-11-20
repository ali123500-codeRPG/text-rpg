// NPC roles, themes, hooks, groups and templates (Part 4). prototypeLibrary() in data.ts reads them from here.
import { AM, GC, PA, VL } from './tableIds';
import { TP } from './templateIds';
import { GP, HK, PF, RO, TH } from './npcLayerIds';
import { RC } from './raceIds';
import { CONFIG } from '../config';
import type { GrandeurKey, RankKey } from '../scales';
import type { AttackMode, GroupDef, HookKindDef, MeetRow, NpcRoleDef, NpcTemplate, ThemeDef } from '../types';
import { SK } from './skillIds';
import { CL } from './classIds';
import { PK } from './perkIds';
import { IT } from './itemIds';
import { BODY_TYPES } from './bodyTypes';

/** AB13 a, AB20: natural armor stops ARMOR_FACTOR × Hide × the race's hide (Hide 25 at hide 1 is Common light armor); the
 * light multiplier stays */
export const HIDE = (hide: number) => ({ hide, multiplier: CONFIG.ARMOR_MULTIPLIER.light });
/** AB16 a: the skill each kind of natural attack rolls; a tail lash names its own (SK.tail) */
const NAT_SKILL: Record<string, string> = { [AM.bite]: SK.bite, [AM.claw]: SK.claws, [AM.kick]: SK.hooves_horns, [AM.gore]: SK.hooves_horns, [AM.slam]: SK.slam };
/** a race's natural attack: unarmed tree, its kind's skill unless given, reach in metres from the race's comment */
export const nat = (id: string, cls: AttackMode['class'], reachM: number, part: string | readonly string[], name: string, skill: string = NAT_SKILL[id]): AttackMode =>
  ({ id, tree: 'unarmed', class: cls, skill, reachM, reach: reachM, grips: 0, ...(typeof part === 'string' ? { partId: part } : { partIds: part }), name });
/** SZ1: a race's size factors, written from its cited metres [length, width, height] against its body type's size */
export const sized = (bt: string, [l, w, h]: [number, number, number]) => {
  const s = BODY_TYPES[bt].size!;
  return { sizeMult: { length: l / s.lengthM, width: w / s.widthM, height: h / s.heightM } };
};

/** AP2: an achievement's personality points, written in steps of CONFIG.ACH_PERSONALITY_STEP (the one balance lever) */
export const ap = (steps: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(steps).map(([k, n]) => [k, n * CONFIG.ACH_PERSONALITY_STEP]));

/** NG2, NG21: NPC roles: the skills each kind of work trains, by band (CONFIG.ROLE_BAND_SHARE of the rank's anchor); its kind
 * (NG13 rank floor), grandeur (NR40: mundane Worker, Hunter and Healer, grand Knight, the rest ordinary), personality lean
 * (NG14) and rank-trait pool (NG12). Leans and pools are placeholders. */
const role = (id: string, name: string, kind: NpcRoleDef['kind'], grandeur: GrandeurKey, bands: Record<string, readonly string[]>, leans?: NpcRoleDef['leans'], traits?: readonly string[], gear?: readonly string[]): NpcRoleDef =>
  ({ id, name, kind, grandeur, bands, ...(leans ? { leans } : {}), ...(traits ? { traits } : {}), ...(gear ? { gear } : {}) });
export const NPC_ROLES: Record<string, NpcRoleDef> = Object.fromEntries([
  role(RO.soldier, 'Soldier', 'combat', 'ordinary', { high: [SK.melee_medium, SK.block, SK.battle_sense], moderate: [SK.medium_armor, SK.endurance, SK.intimidation], low: [SK.parry] }, { traits: { [PA.discipline]: 40 } }, [PK.second_wind], [GC.melee_medium, GC.shield, GC.armor_medium]), // Block is their defense
  role(RO.skirmisher, 'Skirmisher', 'combat', 'ordinary', { high: [SK.melee_light, SK.dodge], moderate: [SK.light_armor, SK.ranged_light, SK.battle_sense], low: [SK.sneaking, SK.endurance] }, { traits: { [PA.levity]: 20 } }, [PK.second_wind], [GC.melee_light, GC.armor_light]),
  role(RO.brute, 'Brute', 'combat', 'ordinary', { high: [SK.melee_heavy, SK.unarmed_strike], moderate: [SK.endurance, SK.intimidation, SK.unarmed_grapple], low: [SK.heavy_armor] }, { traits: { [PA.temper]: 40 } }, [PK.second_wind, PK.heavy_sleeper], [GC.melee_heavy, GC.armor_heavy]),
  role(RO.shooter, 'Shooter', 'combat', 'ordinary', { high: [SK.ranged_medium], moderate: [SK.ranged_light, SK.eyesight, SK.dodge], low: [SK.light_armor, SK.melee_light] }, { traits: { [PA.discipline]: 20 } }, undefined, [GC.ranged_medium, GC.armor_light]),
  role(RO.sneak, 'Sneak', 'combat', 'ordinary', { high: [SK.sneaking, SK.melee_light, SK.stratagem], moderate: [SK.combat_stealth, SK.vanishing, SK.dodge], low: [SK.light_armor, SK.falsehood, SK.guile, SK.filching, SK.lockpicking] }, { traits: { [PA.honesty]: -40 }, values: [VL.wealth] }, [PK.insomniac], [GC.melee_light, GC.armor_light]),
  role(RO.watcher, 'Watcher', 'combat', 'ordinary', { high: [SK.eyesight, SK.earshot], moderate: [SK.insight, SK.intimidation], low: [SK.melee_medium, SK.persuasion] }, { traits: { [PA.curiosity]: 20 } }, [PK.insomniac], [GC.melee_medium]),
  role(RO.talker, 'Talker', 'civilian', 'ordinary', { high: [SK.persuasion, SK.barter], moderate: [SK.insight, SK.falsehood, SK.guile, SK.earshot], low: [SK.eyesight] }, { traits: { [PA.sociability]: 20 }, values: [VL.wealth] }),
  role(RO.worker, 'Worker', 'civilian', 'mundane', { high: [SK.endurance], moderate: [SK.unarmed_strike, SK.stamina], low: [SK.persuasion] }, { traits: { [PA.sociability]: 20 } }, [PK.heavy_sleeper]),
  // NR4: woods folk who live by the bow (hunters, foresters, trappers, poachers); civilian, Commoner class line (NR2)
  role(RO.hunter, 'Hunter', 'civilian', 'mundane', { high: [SK.ranged_medium, SK.sneaking, SK.fieldcraft], moderate: [SK.eyesight, SK.earshot, SK.endurance], low: [SK.melee_light, SK.stamina] }, { traits: { [PA.curiosity]: 20 }, values: [VL.nature, VL.freedom] }, undefined, [GC.ranged_medium, GC.melee_light, GC.armor_light]),
  // NR6: barber-surgeons, herb-wives, midwives; the one who sells clinic care (SV.clinic) where a place has it
  role(RO.healer, 'Healer', 'civilian', 'mundane', { high: [SK.healing, SK.insight, SK.persuasion], moderate: [SK.resolve, SK.earshot], low: [SK.barter] }, { traits: { [PA.sociability]: 20 }, values: [VL.kindness] }),
  // NR8: the person others answer to (headman, reeve, guild master); a quest giver. Its own class comes later (D-341)
  role(RO.leader, 'Leader', 'civilian', 'ordinary', { high: [SK.persuasion, SK.intimidation, SK.command], moderate: [SK.insight, SK.resolve], low: [SK.melee_medium, SK.barter] }, { traits: { [PA.pride]: 20 }, values: [VL.order, VL.reputation] }),
  // NR13: the armoured professional (man-at-arms, knight, champion); its master's class is Knight (CL11)
  role(RO.knight, 'Knight', 'combat', 'grand', { high: [SK.melee_medium, SK.heavy_armor], moderate: [SK.block, SK.resolve, SK.intimidation], low: [SK.melee_heavy, SK.persuasion] }, { traits: { [PA.discipline]: 40 }, values: [VL.duty, VL.glory] }, [PK.second_wind], [GC.melee_medium, GC.shield, GC.armor_heavy]),
  role(RO.beast, 'Beast', 'beast', 'ordinary', { high: [SK.bite, SK.claws, SK.hooves_horns, SK.tail, SK.slam], moderate: [SK.scent, SK.hide, SK.battle_sense, SK.stratagem], low: [SK.dodge, SK.tremor] }), // each only where its body can use it (presetBands); TC9 a: Tactics only for beasts that aren't unintelligent
].map((r) => [r.id, r]));

/** theme role kinds: who fits each world (a bandit with no fighting role makes no sense) */
const PEOPLE = ['combat', 'civilian'] as const, FIGHTERS = ['combat'] as const, BEASTS = ['beast'] as const;
/** NG21: NPC themes: what their world adds; per-theme rank titles come from the lore thread */
export const THEMES: Record<string, ThemeDef> = {
  [TH.village_folk]: { id: TH.village_folk, name: 'Village folk', grandeur: 'mundane', roleKinds: PEOPLE, bands: { low: [SK.persuasion] }, leans: { nerve: -40, values: [VL.family] }, traits: [PK.heavy_sleeper, PK.insomniac], wealth: 'common' }, // townsfolk keep out of danger
  [TH.town_watch]: { id: TH.town_watch, name: 'Town watch', grandeur: 'ordinary', roleKinds: FIGHTERS, bands: { moderate: [SK.eyesight], low: [SK.intimidation, SK.persuasion] }, leans: { values: [VL.duty] }, traits: [PK.insomniac], wealth: 'fine' },
  [TH.road_bandits]: { id: TH.road_bandits, name: 'Road bandits', grandeur: 'ordinary', roleKinds: FIGHTERS, bands: { moderate: [SK.intimidation], low: [SK.sneaking] }, leans: { values: [VL.wealth, VL.freedom] }, traits: [PK.heavy_sleeper], wealth: 'common' },
  [TH.wild_beasts]: { id: TH.wild_beasts, name: 'Wild beasts', grandeur: 'ordinary', roleKinds: BEASTS },
  // NR16: townsfolk who are not the watch; travellers on the roads; a lord's knights and servants; the few always-lethal
  // monster kinds, each in its own place (slimes and dragons stay Wild beasts: vermin and great beasts)
  [TH.town_folk]: { id: TH.town_folk, name: 'Town folk', grandeur: 'mundane', roleKinds: PEOPLE, bands: { low: [SK.barter] }, leans: { values: [VL.wealth] }, traits: [PK.insomniac], wealth: 'fine' },
  [TH.travellers]: { id: TH.travellers, name: 'Travellers', grandeur: 'mundane', roleKinds: PEOPLE, bands: { low: [SK.stamina] }, leans: { values: [VL.freedom, VL.adventure] }, traits: [PK.heavy_sleeper], wealth: 'common' },
  [TH.lords_household]: { id: TH.lords_household, name: "Lord's household", grandeur: 'ordinary', roleKinds: PEOPLE, bands: { low: [SK.persuasion] }, leans: { values: [VL.duty, VL.loyalty] }, wealth: 'superior' },
  [TH.monsters]: { id: TH.monsters, name: 'Monsters', grandeur: 'ordinary', roleKinds: BEASTS },
};

/** NR17: hook kinds. A real NPC earns its place with a hook (something to sell, work to give, a threat, a rival, a seat of
 * the Great); everyone else is crowd, written into how a place looks. Rank kinds are rolled from CONFIG.ROSTER_RANKS. */
export const HOOK_KINDS: Record<string, HookKindDef> = Object.fromEntries(([
  { id: HK.leader, name: 'Leader', gives: 'runs the place and has work or a quest to give', roles: [RO.leader], rank: 'lead' },
  { id: HK.service, name: 'Service', gives: 'sells food, drink and a bed, or tends wounds', roles: [RO.talker, RO.healer], rank: 'face' },
  { id: HK.face, name: 'Someone in need', gives: 'wants something from the player: a job, a favour, a way out of trouble', roles: [RO.talker, RO.worker, RO.hunter, RO.watcher], rank: 'face' },
  { id: HK.threat, name: 'Threat', gives: 'danger near the place: a gang that preys on it, or beasts that take its stock', groups: [GP.bandit_gang, GP.wolf_pack], rank: 'threat' },
  { id: HK.rival, name: 'Rival', gives: 'at odds with the leader or another hook: a feud the player can take a side in', roles: [RO.talker, RO.brute, RO.sneak, RO.soldier], rank: 'lead' },
  { id: HK.trader, name: 'Trader', gives: 'buys and sells goods', roles: [RO.talker], class: CL.trader, rank: 'face' },
  { id: HK.watch, name: 'Watch', gives: 'keeps the peace; trouble brings them', groups: [GP.watch_patrol], rank: 'face' },
  { id: HK.seat, name: 'Seat of the Great', gives: 'the one person past ordinary power who stands over this place: a name, the deeds that made them (motive), 1 to 3 goals; people call them the Great, never by a rank', roles: [RO.knight, RO.soldier, RO.leader, RO.hunter, RO.healer, RO.brute], rank: 'seat', goals: true },
] as HookKindDef[]).map((d) => [d.id, d]));

/** NR27 (D-308): group recipes. The leader is `step` ranks above the group's rank; followers' races are rolled (NR31) unless fixed */
export const GROUPS: Record<string, GroupDef> = Object.fromEntries(([
  { id: GP.pedlar, name: 'Pedlar', theme: TH.travellers, lead: { role: RO.talker, label: 'a pedlar', class: CL.trader } },
  { id: GP.traveller, name: 'Traveller', theme: TH.travellers, lead: { role: RO.talker, label: 'a traveller with news or a job' } },
  { id: GP.caravan, name: 'Caravan', theme: TH.travellers, lead: { role: RO.talker, label: 'a caravan master', class: CL.trader }, follow: { role: RO.soldier, label: 'a hired guard', count: [2, 2] } },
  { id: GP.pilgrims, name: 'Pilgrims', theme: TH.travellers, lead: { role: RO.worker, label: 'a pilgrim' }, follow: { role: RO.worker, label: 'a pilgrim', count: [1, 4] } },
  { id: GP.bandit_gang, name: 'Bandit gang', theme: TH.road_bandits, lead: { role: RO.brute, label: 'a bandit chief', step: 1 }, follow: { roles: [RO.skirmisher, RO.sneak], label: 'a bandit', count: [2, 4] } },
  { id: GP.watch_patrol, name: 'Watch patrol', theme: TH.town_watch, lead: { role: RO.soldier, label: 'a watch sergeant', step: 1 }, follow: { role: RO.soldier, label: 'a watchman', count: [1, 2] } },
  { id: GP.watch_post, name: 'Watch post', theme: TH.town_watch, lead: { role: RO.watcher, label: 'a lookout' }, follow: { role: RO.soldier, label: 'a guard', count: [1, 1] } },
  { id: GP.wolf_pack, name: 'Wolf pack', theme: TH.wild_beasts, lead: { role: RO.beast, race: RC.wolf, label: 'the pack leader', step: 1 }, follow: { role: RO.beast, race: RC.wolf, label: 'a wolf', count: [2, 5] } },
  { id: GP.boar, name: 'Wild boar', theme: TH.wild_beasts, lead: { role: RO.beast, race: RC.boar, label: 'a wild boar' } },
  { id: GP.bear, name: 'Bear', theme: TH.wild_beasts, lead: { role: RO.beast, race: RC.bear, label: 'a bear' } },
  { id: GP.hunter, name: 'Hunter', theme: TH.village_folk, lead: { role: RO.hunter, label: 'a hunter (a guide, or a poacher)' } },
  { id: GP.dog, name: 'Dog at the fold', theme: TH.wild_beasts, lead: { role: RO.beast, race: RC.dog, label: 'a dog at the fold' } },
  { id: GP.slimes, name: 'Slimes', theme: TH.wild_beasts, lead: { template: TP.slime, label: 'a slime' }, follow: { template: TP.slime, label: 'a slime', count: [1, 4] } },
] as GroupDef[]).map((d) => [d.id, d]));
export const meet = (group: string, weight: number, when?: 'day' | 'night'): MeetRow => ({ group, weight, ...(when ? { when } : {}) });

/** NG1, NG21: today's five templates as presets (same TP IDs): race, role, theme and rank, at the ranks they played at.
 * minimums are hand-set floors the story needs; class floors are added in code. Rank floors, Keen Ear for patrols (NG13),
 * milestone perks (NG11), rank traits (NG12) and personality from the layers (NG14) are the generator's; personality here
 * only pins what differs from the layers. */
/** named presets from race, role, theme and rank, with the composed defaults for the role's kind (as composeTemplate);
 * people are rolled (each one its own person), beasts are copies */
function presets(rows: [string, string, string, string, RankKey, string, Partial<NpcTemplate>?][]): Record<string, NpcTemplate> {
  return Object.fromEntries(rows.map(([id, raceId, roleId, themeId, rank, label, extra]) => {
    const d = CONFIG.COMPOSED_NPC[NPC_ROLES[roleId].kind];
    return [id, { id, raceId, generation: NPC_ROLES[roleId].kind === 'beast' ? 'copy' : 'rolled', minimums: {}, roleId, themeId, rank, resolve: d.resolve, control: d.control, chase: d.chase, label, ...extra }];
  }));
}
export const TEMPLATES: Record<string, NpcTemplate> = {
  [TP.slime]: {
    id: TP.slime, raceId: RC.slime, generation: 'copy', minimums: { [SK.slam]: 30, [SK.scent]: 50 }, // AB19 a: slimes smell, not feel
    roleId: RO.beast, themeId: TH.wild_beasts, rank: 'rank_0', resolve: 50, control: 'code', label: 'a slime', chase: 'far', // CH5: monsters hunt anywhere
    fallback: { attackSkill: SK.slam },
  },
  [TP.guard]: {
    id: TP.guard, raceId: RC.human, classId: CL.guard, generation: 'copy', // its class floors (the Guard unlock) raise its minimums
    minimums: { [SK.melee_medium]: 50, [SK.medium_armor]: 50, [SK.block]: 30, [SK.dodge]: 20, [SK.eyesight]: 40, [SK.earshot]: 30, [SK.intimidation]: 30, [SK.persuasion]: 20 }, // AR9/EQ5: meets its loadout's requirements; BF17: Eyesight 40, a search's skill, above a thief's
    roleId: RO.soldier, themeId: TH.town_watch, rank: 'rank_2',
    resolve: 50, loadout: [IT.arming_sword, IT.mail_hauberk, IT.round_shield], control: 'agent', label: 'a village guard', chase: 'ground', // a gate warden's shield: Block, not Parry; CH5: guards keep to the scenario's ground
  },
  [TP.trader]: {
    id: TP.trader, raceId: RC.human, classId: CL.trader, generation: 'copy',
    minimums: { [SK.eyesight]: 25, [SK.earshot]: 25, [SK.barter]: 40, [SK.persuasion]: 30 }, roleId: RO.talker, themeId: TH.village_folk, rank: 'rank_1',
    resolve: 30, control: 'code', label: 'the barkeep', chase: 'post', // CH5: townsfolk never leave their own place
  },
  // NS7: a village thief, the first stealthy NPC
  [TP.thief]: {
    id: TP.thief, raceId: RC.human, generation: 'copy',
    minimums: { [SK.sneaking]: 40, [SK.combat_stealth]: 30, [SK.vanishing]: 30, [SK.melee_light]: 35, [SK.light_armor]: 25, [SK.dodge]: 30, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.falsehood]: 30, [SK.guile]: 30 }, roleId: RO.sneak, themeId: TH.village_folk, rank: 'rank_2',
    resolve: 30, control: 'agent', label: 'a shifty villager', // its dagger and gambeson are picked by role and wealth (NG10) chase: 'post',
  },
  [TP.patron]: {
    id: TP.patron, raceId: RC.human, generation: 'copy',
    minimums: { [SK.unarmed_strike]: 20, [SK.eyesight]: 20, [SK.persuasion]: 30 }, roleId: RO.worker, themeId: TH.village_folk, rank: 'rank_1',
    resolve: 30, personality: { values: [VL.pleasure] }, control: 'code', label: 'a tavern patron', chase: 'post',
  },
  // the people and beasts the rosters and groups cast (NR17-NR20, NR27), named so the World builder and the catalog have
  // them; the rank is the one their roster row rolls most often, and Resolve, control and chase are the composed defaults
  ...presets([
    [TP.hunter, RC.human, RO.hunter, TH.village_folk, 'rank_2', 'a hunter'], // a guide, or a poacher (GP11)
    [TP.healer, RC.human, RO.healer, TH.village_folk, 'rank_2', 'a healer'], // the service hook that tends wounds (HK2)
    [TP.headman, RC.human, RO.leader, TH.village_folk, 'rank_3', 'a village headman'], // the leader hook: work or a quest (HK1)
    [TP.knight, RC.human, RO.knight, TH.lords_household, 'rank_4', 'a knight', { classId: CL.knight_trainee }], // a lord's sworn sword (NR36: a Knight Trainee short of the full Knight)
    [TP.bandit, RC.human, RO.skirmisher, TH.road_bandits, 'rank_2', 'a bandit'], // GP5 follower
    [TP.bandit_chief, RC.human, RO.brute, TH.road_bandits, 'rank_3', 'a bandit chief'], // GP5 leader, one step up
    [TP.watch_sergeant, RC.human, RO.soldier, TH.town_watch, 'rank_3', 'a watch sergeant'], // GP6 leader, one step up
    [TP.pedlar, RC.human, RO.talker, TH.travellers, 'rank_2', 'a pedlar', { classId: CL.trader }], // GP1: goods on the road
    [TP.hired_guard, RC.human, RO.soldier, TH.travellers, 'rank_2', 'a hired guard'], // GP3 follower
    [TP.wolf, RC.wolf, RO.beast, TH.wild_beasts, 'rank_2', 'a wolf'], // GP8
    [TP.boar, RC.boar, RO.beast, TH.wild_beasts, 'rank_3', 'a wild boar'], // GP9
    [TP.bear, RC.bear, RO.beast, TH.wild_beasts, 'rank_4', 'a bear'], // GP10
    [TP.dog, RC.dog, RO.beast, TH.wild_beasts, 'rank_1', 'a dog'], // GP12: a dog at the fold
    [TP.dire_wolf, RC.wolf, RO.beast, TH.wild_beasts, 'rank_3', 'a dire wolf', { prefix: PF.dire }], // NR37: a wolf one rank up, half again the health
  ]),
};
