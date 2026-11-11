// Autopilot: an agent that plays the game while the player watches (the play screen's "Watch an agent play"), and the
// personas the playtest script shares. Each turn it picks the next command and one short line of commentary, spoken aloud.
import type { Actor, LogLine } from '../types';
import { MILESTONES, canTake, milestonePerk, milestoneState, trueSkill } from '../ruleset/perks';

/** playstyles: the playtest script's --persona and the autopilot's persona picker */
/** --persona eager: an over-enthusiastic adventurer who drives the story forward on their own (P7 pacing test) */
export const PERSONAS: Record<string, string> = {
  eager: `You are an over-enthusiastic adventurer. Never wait for the story to come to you: chase every lead, follow anyone
who leaves, go through every door, ask about rumours and jobs, pick fights you think are just, and when a place goes quiet,
move on to somewhere new at once.`,
  bloodthirsty: `You are a violent, bloodthirsty brute (a test of combat, XP and level-ups). You settle everything with your sword:
insult people, threaten them, and attack anyone who looks at you wrong, starting within your first few turns. Keep fighting
until your foes are down or flee, then look for the next fight. Use /aim now and then. Never talk your way out of a fight.`,
  rester: `You are a weary, patient traveller (a test of the game clock, waiting, sleeping, resting, healing, story beats
and the endurance skill). You cannot hurt yourself in this game, so to get wounds: early on, pick a real fight with the toughest-looking
person (punch them or draw on them, not just a shove), keep your shield down and let them land several hits until you
are clearly hurt, then fight back properly until they stop or flee.
Once nobody is threatening you: rest, use a bandage, wait until a later time of day (e.g. "I wait until dusk"), and sleep
through the night now and then. Try resting twice in a row, and try resting or waiting once while someone is still
threatening you, then defend yourself. When your wounds have healed, pick another small scrap and repeat. Do not chase
leads or start conversations yourself; answer briefly if spoken to, and see what the story does on its own.`,
  slimes: `You are a monster hunter clearing the slimes that trouble this village (a test of combat and skill growth). Find the
slimes (ask where they are if you must), go there and fight them, one after another. Between fights, check /stats now and
then to see how your skills are growing, and keep hunting. Pay attention to when and how your skills improve.`,
  shopper: `You are a thrifty traveller with a little coin (a test of buying, paying and haggling). Find whoever sells things
and spend your money: ask what they have and what it costs, buy a drink, then a meal, and a bed for the night. Haggle at
least twice ("that's too much, how about less?"), once politely and once rudely. Buy a drink for someone else. Pay someone
an exact small amount for help or a tip ("I hand her two coppers"). Try to buy something they do not sell, try to buy
more than you can afford, and try to buy from someone who is not a seller. Check /inv now and then to see your coin.`,
};

/** persona names for the picker, the default (curious) first */
export const PERSONA_NAMES: [string, string][] = [['', 'Curious'], ['eager', 'Eager'], ['bloodthirsty', 'Bloodthirsty'], ['rester', 'Patient'], ['shopper', 'Shopper']];

export const AUTOPILOT_BRIEF = `You are playing a text RPG as its player character while a person watches you play, live. Play naturally and
curiously: talk to people, explore, take on any trouble you find, fight if it comes to that, and sometimes try something
unusual. Now and then use a command: /stats, /inv, /quests or /aim <text>.
Reply with ONLY a JSON object: {"command": "what you type next, one short line in plain words", "say": "one short spoken
line of commentary for the watcher, first person, at most 20 words: what you noticed or why you do this"}.
The commentary is read aloud: plain words, no stage directions, never anything your character could not know.`;

/** the per-turn part: the latest story lines, as the player sees them (spoken lines under the narration) */
export function autopilotTurn(lines: LogLine[], persona: string): string {
  const recent = lines.slice(-14).map((l) => [`[${l.kind}] ${l.text}`, ...(l.speech ?? []).map((sp) => `  ${sp.speaker}: "${sp.text}"`)].join('\n')).join('\n');
  return `${PERSONAS[persona] ? `Your playstyle: ${PERSONAS[persona]}\n\n` : ''}The story so far (latest last):\n${recent || '(the story is about to start)'}`;
}

/** the agent's reply, made safe: one line of at most 200 characters, a short commentary line */
export function readMove(v: unknown): { command: string; say: string } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const command = typeof o.command === 'string' ? o.command.split('\n')[0].trim().slice(0, 200) : '';
  if (!command) return null;
  const say = typeof o.say === 'string' ? o.say.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  return { command, say };
}

/** the perk an agent playing its own save takes with a spare point: the open milestone of its highest skill */
export function autoPerk(p: Actor): string | null {
  const open = Object.keys(p.core.skills).flatMap((sk) => MILESTONES.filter((m) => milestoneState(p, sk, m) === 'open' && !canTake(p, milestonePerk(sk, m)!.id)).map((m) => ({ id: milestonePerk(sk, m)!.id, sk, m })))
    .sort((a, b) => trueSkill(p, b.sk) - trueSkill(p, a.sk) || a.m - b.m);
  return open[0]?.id ?? null;
}
