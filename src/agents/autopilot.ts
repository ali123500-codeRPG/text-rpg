// Autopilot: an agent that plays the game while the player watches (the play screen's "Watch an agent play"), and the
// personas the playtest script shares. Each turn it picks the next command and one short line of commentary, spoken aloud.
import type { Actor, GameState, LogLine } from '../types';
import { type Ask, type GuidedCtx, guidedPrompt, readAsk } from './crossroads';
import { milestonesUpTo, canTake, milestonePerk, milestoneState, trueSkill } from '../ruleset/perks';
import { healthLevel, partStates } from '../ruleset/body';
import { moraleLevel } from '../ruleset/morale';
import { HEALTH_LEVELS, MORALE_LEVELS, PART_STATES } from '../scales';
import { coinWords, coins } from '../engine/trade';
import { buildPlayerView } from '../views';
import { personalityText } from '../ruleset/personality';
import type { WayView } from '../types/views';
import { theName } from '../words';

/** playstyles: the playtest script's --persona and the autopilot's persona picker (eager: an over-enthusiastic adventurer
 * who drives the story forward on their own, the P7 pacing test) */
export const PERSONAS: Record<string, string> = {
  eager: `You are an over-enthusiastic adventurer. Never wait for the story to come to you: chase every lead, follow anyone
who leaves, go through every door, ask about rumours and jobs, pick fights you think are just, and when a place goes quiet,
move on to somewhere new at once.`,
  bloodthirsty: `You are a violent, bloodthirsty brute (a test of combat, XP and level-ups). You settle everything with your sword:
insult people, threaten them, and attack anyone who looks at you wrong, starting within your first few turns. Keep fighting
until your foes are down or flee, then look for the next fight. Now and then aim at a body part: /aim /strike <who> at <part>. Never talk your way out of a fight.`,
  rester: `You are a weary, patient traveller (a test of the game clock, waiting, sleeping, resting, healing, story beats
and the endurance skill). You cannot hurt yourself in this game, so to get wounds: early on, pick a real fight with the toughest-looking
person (punch them or draw on them, not just a shove), keep your shield down and let them land several hits until you
are clearly hurt, then fight back properly until they stop or flee.
Once nobody is threatening you: rest, use a bandage, wait until a later time of day (e.g. "I wait until dusk"), and sleep
through the night now and then. Try resting twice in a row, and try resting or waiting once while someone is still
threatening you, then defend yourself. When your wounds have healed, pick another small scrap and repeat. Do not chase
leads or start conversations yourself; answer briefly if spoken to, and see what the story does on its own.`,
  slimes: `You are a monster hunter clearing the slimes that trouble this village (a test of combat and skill growth). Find the
slimes (ask where they are if you must), go there and fight them, one after another. Between fights, check /stats once in a
while (never twice in a row) to see how your skills are growing, and keep hunting. Pay attention to when and how your skills improve.`,
  walker: `You are a scout mapping this village on foot (a test of moving between places and standing positions). Your goals,
in order, one per turn or two: 1) walk behind the bar; 2) go down the cellar steps, then to the back of the cellar; 3) come
all the way back up and out the front door into the street; 4) walk to the gate, then through it into the open field;
5) walk up close to someone or something in the field and stand right beside it; 6) sprint (run) back to the tavern door in
one go; 7) walk back inside and stand next to the barkeep. After each move, check the narration and the place line say you
are where you meant to be, how far you went, and who is near you; REPORT anything that seems off (wrong place, no progress,
teleporting, impossible distances, people in odd spots). If attacked, fight back, then carry on with the goals.`,
  gentle: `You are a gentle, honest, soft-spoken peacemaker (a test of talk and of playing against your character's
personality). Your goals, in order: 1) greet the barkeep politely and ask how she is; 2) ask someone about any trouble in
the village and offer to help; 3) when anyone is rude or threatening, calm them down with kind words, and never strike
first; 4) tell the truth even when a lie would be easier, e.g. admit you have little money; 5) give a small kindness to
someone (buy them a drink, share your food, or help with a chore). If you are attacked, defend yourself, then offer peace.`,
  shopper: `You are a thrifty traveller with a little coin (a test of buying, paying and haggling). Find whoever sells things
and spend your money: ask what they have and what it costs, buy a drink, then a meal, and a bed for the night. Haggle at
least twice ("that's too much, how about less?"), once politely and once rudely. Buy a drink for someone else. Pay someone
an exact small amount for help or a tip ("I hand her two coppers"). Try to buy something they do not sell, try to buy
more than you can afford, and try to buy from someone who is not a seller. Check /inv now and then to see your coin.`,
};

/** persona names for the picker, the default (curious) first */
export const PERSONA_NAMES: [string, string][] = [['', 'Curious'], ['eager', 'Eager'], ['bloodthirsty', 'Bloodthirsty'], ['rester', 'Patient'], ['shopper', 'Shopper']];

/** sounds the RPG Voice acts out where they sit in a line; every other voice (and the screen) drops them */
export const VOICE_TAGS = ['gasp', 'laugh', 'chuckle', 'giggle', 'sigh', 'breath', 'short pause', 'long pause'];
const TAG = /<\s*\/?\s*([a-z ]{1,20}?)\s*>/gi;
/** a line for the RPG Voice: its own sound tags kept, anything else in angle brackets dropped */
const actedLine = (t: string) => t.split(TAG).map((x, i) => (i % 2 ? (VOICE_TAGS.includes(x.toLowerCase()) ? `<${x.toLowerCase()}>` : '') : x.replace(/[<>]/g, ''))).join('');
/** the same line to show on screen or read in a voice that doesn't act: no tags */
export const plainLine = (t: string) => t.replace(TAG, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').replace(/\s([,.!?…])/g, '$1').trim();

export const AUTOPILOT_BRIEF = `You are playing a text RPG as its player character while a person watches you play, live. Play naturally and
curiously: talk to people, explore, take on any trouble you find, fight if it comes to that, and sometimes try something
unusual. To attack, type /strike <who> (a blow with what you hold), /shoot <who> or /throw <what> at <who>; add
"at <body part>" to hit a part: /strike the guard at his sword arm. /aim goes in front of an attack that names a body part
and makes it aimed: a harder roll that, if it hits, is sure to land on that part (/aim /strike the guard at his left leg).
/aim never picks who you attack, and without a body part it does nothing. You are always told how hurt you are, your
morale and your coin, so you never need /stats: never stop, look or "check how bad you're hurt", and never say you will.
/inv and /quests list your gear and quests: use them rarely, and never in a fight or instead of acting.
Never ask for the same thing more than twice. If someone keeps putting you off, or the same try fails twice, stop and
try another way: go and look for yourself, ask someone else, or get on with something else.
Reply with ONLY a JSON object: {"command": "what you type next, one short line in plain words", "say": "what you say
out loud right now, 2 to 4 short sentences, at most 70 words", "direction": "how a voice actor should say it, a few English
words that change with the moment, e.g. breathless and scared, then relieved"}.
The watcher only hears "say", and it must sound like someone LIVING this moment, never like someone reporting it. Speak in the
present, in first person, as things hit you: react first (surprise, fear, glee, anger, relief), name what you see, hear or
feel right now, let the outcome of your last move and what the people around you just did come out in that reaction, then
blurt out what you do next and why, with feeling. Short bursts, exclamations, half-finished thoughts and questions to
yourself are good. Never list facts or say "I did X. Y happened. Now I will Z."
Dead: "I attacked the guard and hit his arm. He is wounded. I will attack again."
Alive: "Ha! Got his arm, he's clutching it and backing off... he's scared now. Don't let him breathe. Again, at the same arm!"
Never skip how your last move turned out. The line is read aloud by a voice actor: no asterisks or emoji, and never
anything your character could not know. Where a sound really happens you may put one of these tags in the line, at most
two a line and not every line: ${VOICE_TAGS.map((t) => `<${t}>`).join(', ')}. No other stage directions.`;

/** In character: the agent is the character, from its personality line (given each move with its signatures): its words
 *  and its moves; the playstyle only leans */
const IN_CHARACTER = `You ARE the player character, never a companion or a narrator. "say" is the character's own voice, what
they say or mutter as it happens, worded the way this person talks, so the watcher hears who they are. Anything your command
has them say to someone is worded the same way. Who they are (below) also decides what they do: pick each move as this person
would. A playstyle above is only a leaning; where it clashes with who they are, who they are wins. Let who they are set the
words, the tone and what they notice; never name their traits or explain them. Its signatures are habits, not lines to recite: follow an if-then one when
its "if" comes up, and say a saying or catchphrase only where the moment calls for it, never on two moves running.
Everything else they say is in fresh words.`;

/** how the agent speaks (the agent bar's Style); the voice itself is the bar's Speaker. AI companion and Speaks Japanese: D-315 */
export const VOICE_STYLES: [string, string, string][] = [
  ['plain', 'Plain', ''],
  ['character', 'In character', IN_CHARACTER],
];

/** BG-26: what the character knows of itself, given every move so it never stops to look at its sheet */
export function condition(s: GameState): string {
  const p = s.player, hurt = partStates(s, p).filter((x) => x.state !== 'healthy').map((x) => `${x.id.replace(/_/g, ' ')} ${PART_STATES.name(x.state)}`);
  const points = p.progression?.unspentPerkPoints ?? 0;
  return `How you are right now (you always know this; never stop to check it): health ${HEALTH_LEVELS.name(healthLevel(p))}${hurt.length ? `, ${hurt.join(', ')}` : ', no wounded parts'}; morale ${MORALE_LEVELS.name(moraleLevel(p))}; you carry ${coinWords(coins(p))}${points ? `; ${points} perk point${points > 1 ? 's' : ''} to spend` : ''}.`;
}

/** BG-30: where the character stands and the ways out it can see (what the player sees on the map), so it never invents one */
export function surroundings(s: GameState): string {
  const v = buildPlayerView(s), here = new Set(v.zone.links.map((l) => l.to));
  const ways = v.zone.links.map((l) => {
    const w = l.way as WayView | undefined, to = v.zones.find((z) => z.id === l.to)?.name;
    const shut = [w?.locked && 'locked', w?.barred && 'barred', w?.blocked && 'blocked'].filter(Boolean).join(', ');
    return `${l.label}${to && to !== l.label ? ` (to ${theName(to)})` : ''}${shut ? ` [${shut}]` : ''}`;
  });
  const known = (v.known ?? []).filter((k) => k.id !== v.zone.id && !here.has(k.id)).map((k) => k.name);
  return `Where you are: ${theName(v.zone.name)}. Ways out you can see from here: ${ways.join('; ') || 'none'}.${known.length ? ` Other places you know, which a move can name: ${known.join('; ')}.` : ''} To leave, use only these: never head for a door, stair or path that isn't listed, however likely one seems (a tavern may have no cellar door you know of).`;
}

/** the per-turn part: the latest story lines, as the player sees them (spoken lines under the narration), and the agent's
 *  own recent commentary, so it doesn't keep repeating itself */
export function autopilotTurn(lines: LogLine[], persona: string, style = '', said: string[] = [], guided?: { state: GameState | null; ctx: GuidedCtx }, me?: GameState | null): string {
  const recent = lines.slice(-14).map((l) => [`[${l.kind}] ${l.text}`, ...(l.speech ?? []).map((sp) => `  ${sp.speaker}: "${sp.text}"`)].join('\n')).join('\n');
  const base = VOICE_STYLES.find(([id]) => id === style)?.[2];
  const voice = base && style === 'character' && me ? `${base}\nWho you are: ${personalityText(me, me.player, MORALE_LEVELS.name(moraleLevel(me.player)))}` : base;
  return `${PERSONAS[persona] ? `Your playstyle: ${PERSONAS[persona]}\n\n` : ''}${voice ? `Your voice: ${voice}\n\n` : ''}${said.length ? `What you said on your last turns (never reuse their exclamations, openings or phrases, signature sayings included):\n${said.map((x) => `- ${x}`).join('\n')}\n\n` : ''}The story so far (latest last):\n${recent || '(the story is about to start)'}${me ? `\n\n${condition(me)}\n${surroundings(me)}` : ''}${guided ? `\n\n${guidedPrompt(guided.state, lines, guided.ctx, voice !== base)}` : ''}`;
}

/** the agent's reply, made safe: one line of at most 200 characters, and a commentary of at most 500 characters; in
 *  guided play it may instead be a question for the watcher (ask, with no command) */
export type Move = { command: string; say: string; direction?: string; ask?: Ask };
export function readMove(v: unknown, mustKind?: string): Move | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const say = typeof o.say === 'string' ? actedLine(o.say).replace(/\s+/g, ' ').trim().slice(0, 500) : '';
  const direction = typeof o.direction === 'string' ? plainLine(o.direction).slice(0, 120) : '';
  const ask = o.ask !== undefined || mustKind ? readAsk(o.ask, mustKind) : null;
  const command = ask ? '' : typeof o.command === 'string' ? o.command.split('\n')[0].trim().slice(0, 200) : '';
  if (!command && !ask) return null;
  return { command, say, ...(direction ? { direction } : {}), ...(ask ? { ask } : {}) };
}

/** the perk an agent playing its own save takes with a spare point: the open milestone of its highest skill */
export function autoPerk(p: Actor): string | null {
  const open = Object.keys(p.core.skills).flatMap((sk) => milestonesUpTo(trueSkill(p, sk)).filter((m) => milestoneState(p, sk, m) === 'open' && !canTake(p, milestonePerk(sk, m)!.id)).map((m) => ({ id: milestonePerk(sk, m)!.id, sk, m })))
    .sort((a, b) => trueSkill(p, b.sk) - trueSkill(p, a.sk) || a.m - b.m);
  return open[0]?.id ?? null;
}
