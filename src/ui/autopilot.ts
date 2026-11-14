// Watch an agent play: an autopilot bar on the Play screen. The agent picks each command (typed into the box where you can
// see it) and says a few lines of commentary, acted out by the RPG Voice connector or read in one of Claude's own voices. It plays on your story,
// or on its own save (one story per owner: yours and the agent's), and you can switch between them. Mode "Asks me at
// crossroads" (GA1–GA17) hands the big calls to the watcher in a question card here in the bar.
import type { GameApi } from '../types';
import { h } from './kit';
import { PERSONA_NAMES, VOICE_STYLES, autoPerk, plainLine } from '../agents/autopilot';
import { type Mcp, type McpError, RPG_DEFAULT_VOICE, RPG_VOICES, rpgFailure, rpgSpeak, rpgVoices, splitLine } from './rpgVoice';
import { CONFIG } from '../config';
import { type Sample, pickSample } from './voiceSamples';
import { type Crossroad, type TurnSnap, askKey, spotCrossroads, turnSnap } from '../agents/crossroads';
import { getLibrary } from '../library';
import { recommendedBuild } from '../library/spawn';
import { cap } from '../words';

const KEY = 'rpg.autopilot';
/** style: a VOICE_STYLES id; voiceName: 'rpg:<voice>' (the RPG Voice connector) or 'claude:<voice>' (one of Claude's own
 *  voices); empty = the RPG Voice's Leda where the page can reach it, else Buttery;
 *  mode: 'alone' plays every turn itself, 'guided' asks the watcher at crossroads (GA1) */
type Prefs = { persona: string; waitS: number; voice: boolean; style: string; voiceName: string; rate: number; mode: 'alone' | 'guided' };
const WAITS = [2, 5, 10];
const RATES = [1, 1.25, 1.5]; // speaking speed (Claude's voices read at most 1.5×)
const PREFS: Prefs = { persona: '', waitS: 5, voice: true, style: 'plain', voiceName: '', rate: 1.5, mode: 'alone' };
const MODES: [Prefs['mode'], string][] = [['alone', 'Plays alone'], ['guided', 'Asks me at crossroads']];
/** GA16: standing orders, kept with each story (on this PC) */
const ORDERS = (storyId: string) => `rpg.autopilot.orders.${storyId}`;
const readOrders = (storyId: string) => { try { return localStorage.getItem(ORDERS(storyId)) ?? ''; } catch { return ''; } };
const writeOrders = (storyId: string, t: string) => { try { localStorage.setItem(ORDERS(storyId), t); } catch { /* per-PC convenience only */ } };
/** a question on the card: the agent's (or code's, worded by the agent), or the perk card (GA6) */
type Question = { kind: string; about: string; key: string; say: string; direction?: string; choices: string[]; pick: number; perk?: { id: string; name: string; points: number } };
type Answer = { choice: string } | { words: string } | { decide: true } | { played: true } | { perk: true } | { later: true };
function readPrefs(): Prefs {
  try { return { ...PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...PREFS }; }
}
/** Claude's own voices: the page's tts capability (null where it can't speak, e.g. not declared or not offered) */
const CLAUDE_VOICES = ['buttery', 'airy', 'glassy', 'rounded'];
type Tts = { speak(text: string, o: { voice: string; rate: number; language: string }): Promise<unknown>; stop(): Promise<void>; onState?(cb: (s: { state: string }) => void): unknown; voices?(): Promise<unknown> };
const writePrefs = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* per-PC convenience only */ } };
/** what the bar was doing, kept for this tab so a reload or a new version of the page carries on where it was */
const RUN = 'rpg.autopilot.run';
type Run = { open: boolean; playing: boolean; owner: 'player' | 'agent' };
function readRun(): Run | null { try { return JSON.parse(sessionStorage.getItem(RUN) ?? 'null'); } catch { return null; } }
const writeRun = (r: Run) => { try { sessionStorage.setItem(RUN, JSON.stringify(r)); } catch { /* per-tab convenience only */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** a step still running after this long shows how long it has taken */
const SLOW_MS = 5000;

/** el: the bar under Who's here (empty while closed); opener: the header switch beside Show rolls; asking: a question
 * waits for the watcher (the action box is theirs then); playedTurn: they played a turn themselves */
export type Autopilot = { el: HTMLElement; opener: HTMLElement; update: () => void; playing: () => boolean; asking: () => boolean; playedTurn: () => void };

/** `typeAndSend` types the command into the action box, then sends it like the Send button (resolves when the turn is done) */
export function autopilotBar(api: GameApi, typeAndSend: (text: string) => Promise<void>, redraw: () => void): Autopilot {
  const prefs = readPrefs();
  let restore = readRun(); // carried on once the story has loaded
  let open = !!restore?.open, playing = false, stepping = false, switching = false;
  let status = '', said = '', voiceNote = '';
  let tts: Tts | null = null, claudeVoices = CLAUDE_VOICES;
  // the RPG Voice (the page's mcp capability): the line playing, which speak() is current, and whether it has failed for good
  let mcp: Mcp | null = null, audio: HTMLAudioElement | null = null, speakSeq = 0, rpgDown = false, voices = RPG_VOICES, listed = false;
  // guided mode (GA1–GA17)
  let question: Question | null = null, answer: ((a: Answer | null) => void) | null = null;
  let lastCall = '', guidance: { text: string; scenario: number } | null = null, settled = { scenario: -1, items: new Map<string, string>() };
  let pending: Crossroad[] = [], before: TurnSnap | null = null, fightOk = false;
  const baseTitle = document.title;
  void (async () => {
    try { tts = ((await (globalThis as { claude?: { use(n: string): Promise<unknown> } }).claude?.use('tts')) ?? null) as Tts | null; } catch { tts = null; }
    tts?.onState?.(() => update());
    // the voices Claude offers pages right now (four today), so a new one shows up without a change here
    try { const v = await tts?.voices?.(); if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string')) claudeVoices = v; } catch { /* keep the known four */ }
    update();
  })();
  if (CONFIG.RPG_VOICE_ON) void (async () => {
    try { mcp = ((await (globalThis as { claude?: { use(n: string): Promise<unknown> } }).claude?.use('mcp')) ?? null) as Mcp | null; } catch { mcp = null; }
    update();
  })();
  const el = h('section', { class: 'auto', 'aria-label': 'Watch an agent play' });
  const opener = h('button', { type: 'button', class: 'hs-btn-text auto-open', title: 'An agent plays while you watch, with spoken commentary',
    onclick: () => { if (open) pause(''); open = !open; update(); } });
  const agentStory = () => api.state()?.meta.owner === 'agent';
  const stopped = () => api.notices().some((n) => n.kind === 'stop_play' || n.kind === 'read_only');

  const claudeVoice = () => (prefs.voiceName.startsWith('claude:') && claudeVoices.includes(prefs.voiceName.slice(7)) ? prefs.voiceName.slice(7) : claudeVoices[0]);
  /** the RPG Voice's voice to use, or null for Claude's */
  const rpgVoice = () => (!mcp ? null : prefs.voiceName.startsWith('rpg:') ? prefs.voiceName.slice(4) : prefs.voiceName ? null : RPG_DEFAULT_VOICE);
  function hush() {
    speakSeq++;
    if (audio) { audio.pause(); audio = null; }
    void tts?.stop();
  }
  /** acted out by the RPG Voice (its tags and the acting note), else read in the chosen Claude voice;
   *  where neither can speak, the line is only shown. Resolves once the voice has started (or won't): the RPG Voice makes
   *  the whole clip before it plays, so its first sentence is asked for on its own beside the rest and starts sooner. */
  function speak(text: string, direction = '', force = false): Promise<void> {
    if ((!prefs.voice && !force) || !text) return Promise.resolve();
    hush();
    const seq = speakSeq, v = rpgVoice();
    if (!v || rpgDown) { claudeSpeak(plainLine(text)); return Promise.resolve(); }
    update();
    const chunks = splitLine(text), clips = chunks.map((c) => rpgSpeak(mcp!, c, direction, v));
    clips.forEach((c) => c.catch(() => undefined)); // each failure is handled when its turn to play comes
    return new Promise<void>((started) => {
      const play = (i: number) => clips[i].then((url) => {
        if (seq !== speakSeq || (!prefs.voice && !force)) return started();
        const a = new Audio(url);
        a.playbackRate = prefs.rate;
        audio = a; voiceNote = '';
        const done = () => {
          if (audio !== a) return;
          audio = null;
          if (i + 1 < clips.length && seq === speakSeq) void play(i + 1);
          else update();
        };
        a.onended = done; a.onerror = done;
        a.play().then(() => started(), () => { audio = null; voiceNote = 'The browser held the voice back: click anywhere on the page, and the next line is heard.'; update(); started(); });
        if (!listed) { listed = true; void rpgVoices(mcp!).then((l) => { if (l) { voices = l; update(); } }, () => undefined); }
      }, (e: McpError) => {
        if (seq !== speakSeq) return started();
        const f = rpgFailure(e);
        rpgDown = f.down;
        claudeSpeak(plainLine(chunks.slice(i).join(' ')));
        voiceNote = f.note; update(); started();
      });
      void play(0);
    });
  }
  /** read in the chosen Claude voice */
  function claudeSpeak(line: string) {
    if (!tts || !line) return;
    tts.speak(line, { voice: claudeVoice(), rate: Math.min(prefs.rate, RATES.at(-1)!), language: 'en' }).then(() => { if (!rpgDown) voiceNote = ''; }, (e: { code?: string; message?: string }) => {
      if (e?.code === 'stopped' || e?.code === 'viewer_stopped') return;
      console.warn('Claude voice could not read a line:', e?.code, e?.message);
      if (e?.code === 'rate_limited') { voiceNote = 'Claude’s voice has used its allowance for now, so this line is shown only.'; update(); }
    });
  }
  /** a line from the chosen style's bank, read in the chosen voice and speed, so the watcher hears what a pick does (heard only,
   *  with no sample text in the bar) */
  let sample: Sample | undefined;
  function preview() {
    sample = pickSample(prefs.style, sample);
    void speak(sample.say, '', true);
  }
  // the status line counts the seconds of a long wait, so a slow Claude call or a stuck turn shows as such, never as nothing
  let statusAt = 0;
  const set = (s: string) => { status = s; statusAt = Date.now(); update(); };
  const ticking = setInterval(() => { if (!el.isConnected && !open) return; if (playing && status.endsWith('…') && Date.now() - statusAt >= SLOW_MS) update(); }, 1000);
  void ticking;
  function pause(why = '') { playing = false; stepping = false; answer?.(null); set(why); redraw(); }

  const scenario = () => api.state()?.stage?.scenarioNumber ?? 0;
  /** GA12: calls made this scenario; a new scenario starts empty, and so does guidance */
  function scenarioCalls() {
    if (settled.scenario !== scenario()) settled = { scenario: scenario(), items: new Map() };
    if (guidance && guidance.scenario !== scenario()) guidance = null;
    return settled.items;
  }
  /** shows the question and waits, with no time limit, for the watcher (null: dropped by Pause or ×) */
  function ask(q: Question): Promise<Answer | null> {
    question = q; said = q.say;
    document.title = `Your call · ${baseTitle}`;
    speak(q.say, q.direction);
    set('');
    redraw();
    return new Promise((r) => { answer = (a) => { answer = null; question = null; document.title = baseTitle; r(a); }; });
  }
  const reply = (a: Answer) => { const q = question; if (!q || !answer) return; lastCall = `${plainLine(q.say) || q.about} → ${'choice' in a ? a.choice : 'words' in a ? a.words : 'decide' in a ? `you let me decide: ${q.choices[q.pick]}` : 'played' in a ? 'you played it yourself' : 'perk' in a ? 'perk taken' : 'not now'}`; answer(a); redraw(); };

  async function loop() {
    let failures = 0;
    while (playing) {
      if (api.busy()) set('Waiting for the story to finish the turn…');
      while (api.busy() && playing) await sleep(300);
      if (!playing) break;
      if (stopped()) { pause('Stopped: the story can’t take turns right now.'); break; }
      if (api.fell()) { pause('The character fell. Undo a turn or reset to go on.'); break; }
      const guided = prefs.mode === 'guided', s = api.state();
      // GA3–GA5: what the last turn brought, spotted by code
      if (guided && before && s) pending.push(...spotCrossroads(before, s, api.lines().filter((l) => l.kind === 'narration').at(-1), fightOk));
      before = null; fightOk = false;
      const calls = scenarioCalls();
      pending = pending.filter((c) => !calls.has(askKey(c.kind, c.key ?? c.about)));
      // GA6: a perk point waiting on the watcher's story: suggest the agent's pick, then play on
      const p = s?.player;
      if (guided && p?.progression && !agentStory() && p.progression.unspentPerkPoints > 0 && !calls.has('perk_point: perk')) {
        const id = autoPerk(p);
        if (id) {
          const name = getLibrary().perks[id]?.name ?? id;
          const a = await ask({ kind: 'perk_point', about: 'perk', key: 'perk_point: perk', say: `A perk point is waiting. I’d take ${name}.`, choices: [], pick: 0, perk: { id, name, points: p.progression.unspentPerkPoints } });
          if (!a || !playing) break;
          if ('later' in a) calls.set('perk_point: perk', 'not now');
          continue;
        }
      }
      const must = guided ? pending[0] : undefined;
      set(must ? 'Something needs your call…' : 'Thinking about the next move…');
      const ctx = guided ? { orders: s ? readOrders(s.storyId) : '', guidance: guidance?.text, settled: [...calls].map(([k, v]) => `${k} → ${v}`), mustAsk: must } : undefined;
      const mv = await api.agentMove(prefs.persona, prefs.style, ctx);
      if (!playing) break;
      if (!mv) { if (++failures >= 2) { pause('The agent couldn’t decide: the Claude call failed twice.'); break; } continue; }
      failures = 0;
      let command = mv.command, voice: [string, string] | null = mv.ask ? null : [mv.say, mv.direction ?? ''];
      said = mv.say;
      if (mv.ask) {
        const q = mv.ask, key = askKey(q.kind, must?.key ?? q.about);
        if (must) pending = pending.filter((c) => c !== must);
        if (calls.has(key)) command = q.choices[q.pick]; // already settled this scenario: no second question
        else {
          const a = await ask({ ...q, key, say: mv.say, direction: mv.direction });
          if (!a || !playing) break;
          calls.set(key, 'choice' in a ? a.choice : 'words' in a ? a.words : 'played' in a ? 'the watcher played it' : q.choices[q.pick]);
          if ('played' in a) continue;
          command = 'choice' in a ? a.choice : 'decide' in a ? q.choices[q.pick] : '';
          if ('words' in a) {
            // GA14: the watcher's words become the next move, and guidance until the scenario ends
            guidance = { text: a.words, scenario: scenario() };
            set('Thinking about your answer…');
            const mv2 = await api.agentMove(prefs.persona, prefs.style, { ...ctx!, mustAsk: undefined, guidance: a.words, answered: { about: q.about, words: a.words } });
            if (!playing) break;
            if (!mv2) { pause('The agent couldn’t act on your answer: the Claude call failed.'); break; }
            said = mv2.say; voice = [said, mv2.direction ?? ''];
            command = mv2.command || (mv2.ask ? mv2.ask.choices[mv2.ask.pick] : '');
          }
          fightOk = q.kind === 'start_fight' || q.kind === 'fight_started';
        }
      }
      if (!command) continue;
      // the command waits for the voice to start (at most AUTOPILOT_VOICE_WAIT_MS), so what you hear matches the move
      if (voice) { set('Finding the words…'); await Promise.race([speak(...voice), sleep(CONFIG.AUTOPILOT_VOICE_WAIT_MS)]); if (!playing) break; }
      set('Typing…');
      before = api.state() ? turnSnap(api.state()!) : null;
      await typeAndSend(command);
      // on its own save the agent spends its perk points itself (the open milestone of its highest skill)
      const pl = api.state()?.player;
      if (agentStory() && pl?.progression) for (let id = autoPerk(pl); pl.progression.unspentPerkPoints > 0 && id; id = autoPerk(pl)) api.takePerk(id);
      if (stepping || !playing) { pause(''); break; }
      set(`Next move in ${prefs.waitS} s`);
      await sleep(prefs.waitS * 1000);
    }
  }
  function play(step = false) {
    if (playing || switching) return; // a turn still running is waited for, never a reason to ignore the click
    playing = true; stepping = step; redraw();
    void loop().catch((e) => pause(`The agent stopped: ${(e as Error).message}`));
  }

  const waitNote = 'You can switch stories once this turn has been written';
  /** switch the Play screen to the agent's own save (made on first use) or back to the player's story */
  async function useSave(owner: 'player' | 'agent') {
    if (switching || api.busy() || (owner === 'agent') === agentStory()) return; // BG-63: never mid-opening or mid-turn
    pause('');
    switching = true; set(owner === 'agent' ? 'Opening the agent’s own story…' : 'Opening your story…');
    try {
      const found = await api.resume(owner);
      if (!found && owner === 'agent') await api.newStory({ ...recommendedBuild(), name: 'Wren' }, { owner: 'agent' });
      set('');
    } catch (e) { set(`Couldn’t switch: ${(e as Error).message}`); }
    finally { switching = false; redraw(); }
  }

  const pickBox = h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Which story' });
  const fieldsBox = h('div', { class: 'auto-fields' }), goBox = h('div', { class: 'auto-go' });
  const ordersBox = h('div', { class: 'auto-row' }), liveBox = h('div', { class: 'auto-live' });
  const panel = h('div', { class: 'auto-panel' }, h('div', { class: 'auto-row' }, pickBox, fieldsBox, goBox), ordersBox, liveBox);
  /** a list open or a box being typed in inside this part */
  const held = (box: Element) => { const f = document.activeElement; return !!f && box.contains(f) && (f.tagName === 'SELECT' || f.tagName === 'INPUT'); };
  function update() {
    if (restore && api.state() && !api.busy() && !switching) {
      const r = restore; restore = null;
      void (async () => { await sleep(0); /* after the screen has finished building */ if (r.owner === 'agent' && !agentStory()) await useSave('agent'); if (r.playing) play(); })();
    }
    if (!restore && api.state()) writeRun({ open, playing: playing && !stepping, owner: agentStory() ? 'agent' : 'player' });
    if (question?.perk && (api.state()?.player.progression?.unspentPerkPoints ?? 0) < question.perk.points) reply({ perk: true }); // taken on the sheet
    const btn = (label: string, on: () => void, o: { pressed?: boolean; disabled?: boolean; main?: boolean; title?: string; agent?: boolean } = {}) => h('button', {
      type: 'button', class: (o.main ? 'hs-btn-main' : 'hs-btn-text') + (o.agent ? ' auto-agent' : ''), onclick: on, disabled: o.disabled, title: o.title,
      'aria-pressed': o.pressed === undefined ? undefined : String(o.pressed) }, label);
    const mine = agentStory() ? null : h('p', { class: 'hs-note' }, 'The agent’s turns are saved to your story like your own. Undo works one turn back.');
    opener.textContent = open ? '✓ Watch an agent play' : 'Watch an agent play';
    opener.setAttribute('aria-pressed', String(open));
    // on the agent's own story the opener and the "Agent’s" choice turn yellow instead of a banner (no extra row)
    opener.classList.toggle('auto-agent', agentStory());
    opener.title = agentStory() ? 'You’re watching the agent’s own story. Your story is kept as it is.' : 'An agent plays while you watch, with spoken commentary';
    if (!open) { el.replaceChildren(); return; }
    if (el.firstChild !== panel) el.replaceChildren(panel);
    const persona = h('select', { 'aria-label': 'Playstyle', onchange: (e: Event) => { prefs.persona = (e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      PERSONA_NAMES.map(([id, name]) => h('option', { value: id, selected: prefs.persona === id }, name)));
    const style = h('select', { 'aria-label': 'Voice style', onchange: (e: Event) => { prefs.style = (e.target as HTMLSelectElement).value; writePrefs(prefs); preview(); } },
      VOICE_STYLES.map(([id, name]) => h('option', { value: id, selected: prefs.style === id }, name)));
    const rv = rpgVoice();
    const voicePick = h('select', { 'aria-label': 'Speaking voice', onchange: (e: Event) => {
        // "Off" mutes the commentary (it is still shown); any voice turns it on and plays a sample
        const v = (e.target as HTMLSelectElement).value;
        if (v === 'off') { prefs.voice = false; hush(); } else { prefs.voice = true; prefs.voiceName = v; rpgDown = false; voiceNote = ''; }
        writePrefs(prefs);
        if (prefs.voice) preview();
      } },
      h('option', { value: 'off', selected: !prefs.voice }, 'Off'),
      mcp ? h('optgroup', { label: 'RPG Voice (acted)' }, voices.map(({ voice, style }) => h('option', { value: `rpg:${voice}`, selected: prefs.voice && rv === voice }, style ? `${voice} · ${style}` : voice))) : '',
      h('optgroup', { label: 'Claude' }, claudeVoices.map((v) => h('option', { value: `claude:${v}`, selected: prefs.voice && !rv && claudeVoice() === v }, cap(v)))));
    const rate = h('select', { 'aria-label': 'Speaking speed', onchange: (e: Event) => { prefs.rate = +(e.target as HTMLSelectElement).value; writePrefs(prefs); preview(); } },
      RATES.map((r) => h('option', { value: String(r), selected: prefs.rate === r }, `${r}×`)));
    const noVoice = prefs.voice && !tts && !rv ? 'Claude’s voice isn’t available in this view, so the commentary is shown only.' : '';
    const wait = h('select', { 'aria-label': 'Wait between turns', onchange: (e: Event) => { prefs.waitS = +(e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      WAITS.map((s) => h('option', { value: String(s), selected: prefs.waitS === s }, `${s} s`)));
    const mode = h('select', { 'aria-label': 'Mode', onchange: (e: Event) => { prefs.mode = (e.target as HTMLSelectElement).value as Prefs['mode']; writePrefs(prefs); update(); } },
      MODES.map(([id, name]) => h('option', { value: id, selected: prefs.mode === id }, name)));
    const sid = api.state()?.storyId;
    const orders = prefs.mode === 'guided' && sid ? h('label', { class: 'auto-field auto-orders' }, 'Standing orders',
      h('input', { type: 'text', value: readOrders(sid), placeholder: 'e.g. never kill; save coin for a horse', 'aria-label': 'Standing orders the agent always follows',
        onchange: (e: Event) => writeOrders(sid, (e.target as HTMLInputElement).value), onblur: () => update() })) : '';
    const q = question;
    const own = h('input', { type: 'text', placeholder: 'Or say what to do in your own words', 'aria-label': 'Your own answer',
      onkeydown: (e: KeyboardEvent) => { const t = (e.target as HTMLInputElement).value.trim(); if (e.key === 'Enter' && t) { (e.target as HTMLInputElement).blur(); reply({ words: t }); } } }) as HTMLInputElement; // Enter leaves the box, so the answered card can go
    const card = q ? h('div', { class: 'auto-ask', role: 'group', 'aria-label': 'Your call' },
      h('p', { class: 'auto-say' }, h('span', { class: 'auto-who' }, 'Your call'), `“${plainLine(q.say)}”`),
      q.perk
        ? h('div', { class: 'auto-choices' },
          btn(`Take ${q.perk.name}`, () => { api.takePerk(q.perk!.id); reply({ perk: true }); }, { main: true }),
          btn('Not now', () => reply({ later: true })),
          h('span', { class: 'hs-note' }, 'Or pick another on the sheet.'))
        : h('div', { class: 'auto-choices' },
          ...q.choices.map((c, i) => btn(i === q.pick ? `${c} · my pick` : c, () => reply({ choice: c }), { main: i === q.pick })),
          btn('You decide', () => reply({ decide: true })),
          h('span', { class: 'auto-own' }, own, btn('Use my words', () => { const t = own.value.trim(); if (t) reply({ words: t }); }))),
      q.perk ? '' : h('p', { class: 'hs-note' }, 'It waits for you. A turn you play yourself in the box below also answers.')) : '';
    // each part is rebuilt on every update except one holding a list or box in use (an open list would close, typed words would
    // go). The whole bar used to wait while any list had focus, which after a pick is until a click elsewhere: the agent's
    // status, its words and a guided question never showed, so it looked as if it did nothing
    pickBox.replaceChildren(
      btn('Player’s', () => void useSave('player'), { pressed: !agentStory(), disabled: switching || api.busy(), title: api.busy() ? waitNote : 'The agent plays on your story' }),
      btn('Agent’s', () => void useSave('agent'), { pressed: agentStory(), disabled: switching || api.busy(), agent: true, title: api.busy() ? waitNote : 'The agent plays its own story; yours is kept as it is' }));
    if (!held(fieldsBox)) fieldsBox.replaceChildren(
      h('label', { class: 'auto-field' }, mode), // its choices name themselves (Plays alone, Asks me at crossroads); the list keeps its Mode label for screen readers
      h('label', { class: 'auto-field' }, 'Playstyle', persona),
      h('label', { class: 'auto-field' }, 'Pace', wait),
      h('label', { class: 'auto-field' }, 'Style', style),
      h('label', { class: 'auto-field' }, 'Speaker', voicePick),
      h('label', { class: 'auto-field' }, 'Speed', rate));
    goBox.replaceChildren(
      btn('One turn', () => play(true), { disabled: playing || switching || !api.state() }),
      playing ? btn('Pause', () => pause('Paused'), { main: true }) : btn('Play', () => play(), { main: true, disabled: switching || !api.state() }),
      h('button', { type: 'button', class: 'hs-btn-text auto-x', 'aria-label': 'Close the agent bar', title: 'Close', onclick: () => { pause(''); open = false; update(); } }, '×'));
    if (!held(ordersBox)) { ordersBox.replaceChildren(orders); ordersBox.hidden = !orders; }
    if (!held(liveBox)) liveBox.replaceChildren(
      card || (said ? h('p', { class: 'auto-say' }, h('span', { class: 'auto-who' }, 'Agent'), `“${plainLine(said)}”`) : ''),
      !q && prefs.mode === 'guided' && guidance && guidance.scenario === scenario() ? h('p', { class: 'hs-note' }, `Your guidance this scenario: ${guidance.text}`) : '',
      !q && prefs.mode === 'guided' && lastCall ? h('p', { class: 'hs-note' }, `Last call: ${lastCall}`) : '',
      status || (!playing && mine) ? h('p', { class: 'hs-note', role: 'status' }, status ? `${status}${playing && status.endsWith('…') && Date.now() - statusAt >= SLOW_MS ? ` ${Math.floor((Date.now() - statusAt) / 1000)} s` : ''}` : mine!.textContent) : '',
      noVoice || voiceNote ? h('p', { class: 'hs-note' }, noVoice || voiceNote) : '');
  }
  update();
  return { el, opener, update, playing: () => playing, asking: () => !!question,
    playedTurn: () => { if (!question || question.perk) return; before = api.state() ? turnSnap(api.state()!) : null; reply({ played: true }); } };
}
