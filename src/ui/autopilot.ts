// Watch an agent play: an autopilot bar on the Play screen. The agent picks each command (typed into the box where you can
// see it) and says a few lines of commentary, acted out by the RPG Voice connector or read in one of Claude's own voices. It plays on your story,
// or on its own save (one story per owner: yours and the agent's), and you can switch between them. Mode "Asks me at
// crossroads" (GA1–GA17) hands the big calls to the watcher in a question card here in the bar.
import type { GameApi } from '../types';
import { h } from './kit';
import { PERSONA_NAMES, VOICE_STYLES, autoPerk, plainLine } from '../agents/autopilot';
import { type Mcp, type McpError, RPG_DEFAULT_VOICE, RPG_VOICES, rpgFailure, rpgSpeak, rpgVoices } from './rpgVoice';
import { type Crossroad, type TurnSnap, askKey, spotCrossroads, turnSnap } from '../agents/crossroads';
import { getLibrary } from '../library';
import { recommendedBuild } from '../library/spawn';

const KEY = 'rpg.autopilot';
/** style: a VOICE_STYLES id; voiceName: 'rpg:<voice>' (the RPG Voice connector) or 'claude:<voice>' (one of Claude's own
 *  voices); empty = the RPG Voice's Leda where the page can reach it, else Buttery;
 *  mode: 'alone' plays every turn itself, 'guided' asks the watcher at crossroads (GA1) */
type Prefs = { persona: string; waitS: number; voice: boolean; style: string; voiceName: string; rate: number; mode: 'alone' | 'guided' };
const WAITS = [2, 5, 10];
const RATES = [1, 1.25, 1.5]; // speaking speed (Claude's voices read at most 1.5×)
const PREFS: Prefs = { persona: '', waitS: 5, voice: true, style: 'companion', voiceName: '', rate: 1.5, mode: 'alone' };
const MODES: [Prefs['mode'], string][] = [['alone', 'Plays alone'], ['guided', 'Asks me at crossroads']];
/** GA16: standing orders, kept with each story (on this PC) */
const ORDERS = (storyId: string) => `rpg.autopilot.orders.${storyId}`;
const readOrders = (storyId: string) => { try { return localStorage.getItem(ORDERS(storyId)) ?? ''; } catch { return ''; } };
const writeOrders = (storyId: string, t: string) => { try { localStorage.setItem(ORDERS(storyId), t); } catch { /* per-PC convenience only */ } };
/** a question on the card: the agent's (or code's, worded by the agent), or the perk card (GA6) */
type Question = { kind: string; about: string; key: string; say: string; ja: string; direction?: string; choices: string[]; pick: number; perk?: { id: string; name: string; points: number } };
type Answer = { choice: string } | { words: string } | { decide: true } | { played: true } | { perk: true } | { later: true };
function readPrefs(): Prefs {
  try { return { ...PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...PREFS }; }
}
/** Claude's own voices: the page's tts capability (null where it can't speak, e.g. not declared or not offered) */
const CLAUDE_VOICES = ['buttery', 'airy', 'glassy', 'rounded'];
type Tts = { speak(text: string, o: { voice: string; rate: number; language: string }): Promise<unknown>; stop(): Promise<void>; onState?(cb: (s: { state: string }) => void): unknown };
const writePrefs = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* per-PC convenience only */ } };
/** what the bar was doing, kept for this tab so a reload or a new version of the page carries on where it was */
const RUN = 'rpg.autopilot.run';
type Run = { open: boolean; playing: boolean; owner: 'player' | 'agent' };
function readRun(): Run | null { try { return JSON.parse(sessionStorage.getItem(RUN) ?? 'null'); } catch { return null; } }
const writeRun = (r: Run) => { try { sessionStorage.setItem(RUN, JSON.stringify(r)); } catch { /* per-tab convenience only */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** el: the bar under Who's here (empty while closed); opener: the header switch beside Show rolls */
/** asking: a question waits for the watcher (the action box is theirs then); playedTurn: they played a turn themselves */
export type Autopilot = { el: HTMLElement; opener: HTMLElement; update: () => void; playing: () => boolean; asking: () => boolean; playedTurn: () => void };

/** `typeAndSend` types the command into the action box, then sends it like the Send button (resolves when the turn is done) */
export function autopilotBar(api: GameApi, typeAndSend: (text: string) => Promise<void>, redraw: () => void): Autopilot {
  const prefs = readPrefs();
  let restore = readRun(); // carried on once the story has loaded
  let open = !!restore?.open, playing = false, stepping = false, switching = false;
  let status = '', said = '', saidJa = '', voiceNote = '';
  let tts: Tts | null = null, talking = false;
  // the RPG Voice (the page's mcp capability): the line playing, which speak() is current, and whether it has failed for good
  let mcp: Mcp | null = null, audio: HTMLAudioElement | null = null, speakSeq = 0, rpgDown = false, voices = RPG_VOICES, listed = false;
  // guided mode (GA1–GA17)
  let question: Question | null = null, answer: ((a: Answer | null) => void) | null = null;
  let lastCall = '', guidance: { text: string; scene: number } | null = null, settled = { scene: -1, items: new Map<string, string>() };
  let pending: Crossroad[] = [], before: TurnSnap | null = null, fightOk = false;
  const baseTitle = document.title;
  void (async () => {
    try { tts = ((await (globalThis as { claude?: { use(n: string): Promise<unknown> } }).claude?.use('tts')) ?? null) as Tts | null; } catch { tts = null; }
    tts?.onState?.((s) => { talking = s.state !== 'idle' || !!audio; update(); });
    update();
  })();
  void (async () => {
    try { mcp = ((await (globalThis as { claude?: { use(n: string): Promise<unknown> } }).claude?.use('mcp')) ?? null) as Mcp | null; } catch { mcp = null; }
    update();
  })();
  const el = h('section', { class: 'auto', 'aria-label': 'Watch an agent play' });
  const opener = h('button', { type: 'button', class: 'hs-btn-text auto-open', title: 'An agent plays while you watch, with spoken commentary',
    onclick: () => { if (open) pause(''); open = !open; update(); } });
  const agentStory = () => api.state()?.meta.owner === 'agent';
  const stopped = () => api.notices().some((n) => n.kind === 'stop_play' || n.kind === 'read_only');

  const claudeVoice = () => (prefs.voiceName.startsWith('claude:') ? prefs.voiceName.slice(7) : CLAUDE_VOICES[0]);
  /** the RPG Voice's voice to use, or null for Claude's */
  const rpgVoice = () => (!mcp ? null : prefs.voiceName.startsWith('rpg:') ? prefs.voiceName.slice(4) : prefs.voiceName ? null : RPG_DEFAULT_VOICE);
  function hush() {
    speakSeq++;
    if (audio) { audio.pause(); audio = null; }
    void tts?.stop();
    talking = false;
  }
  /** acted out by the RPG Voice (its tags and the acting note), else read in the chosen Claude voice (Japanese as Japanese);
   *  where neither can speak, the line is only shown */
  function speak(text: string, ja = '', direction = '') {
    if (!prefs.voice || !text) return;
    hush();
    const seq = speakSeq, line = ja || text, v = rpgVoice();
    if (!v || rpgDown) return claudeSpeak(plainLine(line), !!ja);
    talking = true; update();
    rpgSpeak(mcp!, line, direction, v).then((url) => {
      if (seq !== speakSeq || !prefs.voice) return;
      const a = new Audio(url);
      a.playbackRate = prefs.rate;
      audio = a; voiceNote = '';
      const done = () => { if (audio === a) { audio = null; talking = false; update(); } };
      a.onended = done; a.onerror = done;
      a.play().catch(() => { done(); voiceNote = 'The browser held the voice back: click anywhere on the page, and the next line is heard.'; update(); });
      if (!listed) { listed = true; void rpgVoices(mcp!).then((l) => { if (l) { voices = l; update(); } }, () => undefined); }
    }, (e: McpError) => {
      if (seq !== speakSeq) return;
      const f = rpgFailure(e);
      rpgDown = f.down; talking = false;
      claudeSpeak(plainLine(line), !!ja);
      voiceNote = f.note; update();
    });
  }
  function claudeSpeak(line: string, ja: boolean) {
    if (!tts || !line) return;
    tts.speak(line, { voice: claudeVoice(), rate: Math.min(prefs.rate, RATES.at(-1)!), language: ja ? 'ja' : 'en' }).then(() => { if (!rpgDown) voiceNote = ''; }, (e: { code?: string }) => {
      if (e?.code === 'stopped' || e?.code === 'viewer_stopped') return;
      voiceNote = e?.code === 'rate_limited' ? 'Claude’s voice has used its allowance for now, so this line is shown only.' : 'Claude’s voice couldn’t read that line.';
      update();
    });
  }
  const set = (s: string) => { status = s; update(); };
  function pause(why = '') { playing = false; stepping = false; answer?.(null); set(why); redraw(); }

  const scene = () => api.state()?.stage?.sceneNumber ?? 0;
  /** GA12: calls made this scene; a new scene starts empty, and so does guidance */
  function sceneCalls() {
    if (settled.scene !== scene()) settled = { scene: scene(), items: new Map() };
    if (guidance && guidance.scene !== scene()) guidance = null;
    return settled.items;
  }
  /** shows the question and waits, with no time limit, for the watcher (null: dropped by Pause or ×) */
  function ask(q: Question): Promise<Answer | null> {
    question = q; said = q.say; saidJa = q.ja;
    document.title = `Your call · ${baseTitle}`;
    speak(q.say, q.ja, q.direction);
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
      const calls = sceneCalls();
      pending = pending.filter((c) => !calls.has(askKey(c.kind, c.key ?? c.about)));
      // GA6: a perk point waiting on the watcher's story: suggest the agent's pick, then play on
      const p = s?.player;
      if (guided && p?.progression && !agentStory() && p.progression.unspentPerkPoints > 0 && !calls.has('perk_point: perk')) {
        const id = autoPerk(p);
        if (id) {
          const name = getLibrary().perks[id]?.name ?? id;
          const a = await ask({ kind: 'perk_point', about: 'perk', key: 'perk_point: perk', say: `A perk point is waiting. I’d take ${name}.`, ja: '', choices: [], pick: 0, perk: { id, name, points: p.progression.unspentPerkPoints } });
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
      let command = mv.command, voice: [string, string, string] | null = mv.ask ? null : [mv.say, mv.ja ?? '', mv.direction ?? ''];
      said = mv.say; saidJa = mv.ja ?? '';
      if (mv.ask) {
        const q = mv.ask, key = askKey(q.kind, must?.key ?? q.about);
        if (must) pending = pending.filter((c) => c !== must);
        if (calls.has(key)) command = q.choices[q.pick]; // already settled this scene: no second question
        else {
          const a = await ask({ ...q, key, say: mv.say, ja: mv.ja ?? '', direction: mv.direction });
          if (!a || !playing) break;
          calls.set(key, 'choice' in a ? a.choice : 'words' in a ? a.words : 'played' in a ? 'the watcher played it' : q.choices[q.pick]);
          if ('played' in a) continue;
          command = 'choice' in a ? a.choice : 'decide' in a ? q.choices[q.pick] : '';
          if ('words' in a) {
            // GA14: the watcher's words become the next move, and guidance until the scene ends
            guidance = { text: a.words, scene: scene() };
            set('Thinking about your answer…');
            const mv2 = await api.agentMove(prefs.persona, prefs.style, { ...ctx!, mustAsk: undefined, guidance: a.words, answered: { about: q.about, words: a.words } });
            if (!playing) break;
            if (!mv2) { pause('The agent couldn’t act on your answer: the Claude call failed.'); break; }
            said = mv2.say; saidJa = mv2.ja ?? ''; voice = [said, saidJa, mv2.direction ?? ''];
            command = mv2.command || (mv2.ask ? mv2.ask.choices[mv2.ask.pick] : '');
          }
          fightOk = q.kind === 'start_fight' || q.kind === 'fight_started';
        }
      }
      if (!command) continue;
      if (voice) speak(...voice);
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

  /** switch the Play screen to the agent's own save (made on first use) or back to the player's story */
  async function useSave(owner: 'player' | 'agent') {
    if (switching || (owner === 'agent') === agentStory()) return;
    pause('');
    switching = true; set(owner === 'agent' ? 'Opening the agent’s own story…' : 'Opening your story…');
    try {
      const found = await api.resume(owner);
      if (!found && owner === 'agent') await api.newStory({ ...recommendedBuild(), name: 'Wren' }, { owner: 'agent' });
      set('');
    } catch (e) { set(`Couldn’t switch: ${(e as Error).message}`); }
    finally { switching = false; redraw(); }
  }

  function update() {
    if (restore && api.state() && !api.busy() && !switching) {
      const r = restore; restore = null;
      void (async () => { await sleep(0); /* after the screen has finished building */ if (r.owner === 'agent' && !agentStory()) await useSave('agent'); if (r.playing) play(); })();
    }
    if (!restore && api.state()) writeRun({ open, playing: playing && !stepping, owner: agentStory() ? 'agent' : 'player' });
    if (question?.perk && (api.state()?.player.progression?.unspentPerkPoints ?? 0) < question.perk.points) reply({ perk: true }); // taken on the sheet
    const focus = document.activeElement;
    if (focus && el.contains(focus) && (focus.tagName === 'SELECT' || focus.tagName === 'INPUT')) return; // don't close an open list or a box being typed in
    const btn = (label: string, on: () => void, o: { pressed?: boolean; disabled?: boolean; main?: boolean; title?: string; agent?: boolean } = {}) => h('button', {
      type: 'button', class: (o.main ? 'hs-btn-main' : 'hs-btn-text') + (o.agent ? ' auto-agent' : ''), onclick: on, disabled: o.disabled, title: o.title,
      'aria-pressed': o.pressed === undefined ? undefined : String(o.pressed) }, label);
    const mine = agentStory() ? null : h('p', { class: 'hs-note' }, 'The agent’s turns are saved to your story like your own. Undo works one turn back.');
    opener.textContent = open ? '✓ Watch an agent play' : 'Watch an agent play';
    opener.setAttribute('aria-pressed', String(open));
    // on the agent's own story the opener and the "Its own story" choice turn yellow instead of a banner (no extra row)
    opener.classList.toggle('auto-agent', agentStory());
    opener.title = agentStory() ? 'You’re watching the agent’s own story. Your story is kept as it is.' : 'An agent plays while you watch, with spoken commentary';
    if (!open) { el.replaceChildren(); return; }
    const persona = h('select', { 'aria-label': 'Playstyle', onchange: (e: Event) => { prefs.persona = (e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      PERSONA_NAMES.map(([id, name]) => h('option', { value: id, selected: prefs.persona === id }, name)));
    const style = h('select', { 'aria-label': 'Voice style', onchange: (e: Event) => { prefs.style = (e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      VOICE_STYLES.map(([id, name]) => h('option', { value: id, selected: prefs.style === id }, name)));
    const rv = rpgVoice();
    const voicePick = h('select', { 'aria-label': 'Speaking voice', onchange: (e: Event) => { prefs.voiceName = (e.target as HTMLSelectElement).value; rpgDown = false; voiceNote = ''; writePrefs(prefs); } },
      mcp ? h('optgroup', { label: 'RPG Voice (acted)' }, voices.map(({ voice, style }) => h('option', { value: `rpg:${voice}`, selected: rv === voice }, style ? `${voice} · ${style}` : voice))) : '',
      h('optgroup', { label: 'Claude' }, CLAUDE_VOICES.map((v) => h('option', { value: `claude:${v}`, selected: !rv && claudeVoice() === v }, `${v[0].toUpperCase()}${v.slice(1)}`))));
    const rate = h('select', { 'aria-label': 'Speaking speed', onchange: (e: Event) => { prefs.rate = +(e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      RATES.map((r) => h('option', { value: String(r), selected: prefs.rate === r }, `${r}×`)));
    const noVoice = prefs.voice && !tts && !rv ? 'Claude’s voice isn’t available in this view, so the commentary is shown only.' : '';
    const wait = h('select', { 'aria-label': 'Wait between turns', onchange: (e: Event) => { prefs.waitS = +(e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      WAITS.map((s) => h('option', { value: String(s), selected: prefs.waitS === s }, `${s} s a turn`)));
    const mode = h('select', { 'aria-label': 'Mode', onchange: (e: Event) => { prefs.mode = (e.target as HTMLSelectElement).value as Prefs['mode']; writePrefs(prefs); update(); } },
      MODES.map(([id, name]) => h('option', { value: id, selected: prefs.mode === id }, name)));
    const sid = api.state()?.storyId;
    const orders = prefs.mode === 'guided' && sid ? h('label', { class: 'auto-field auto-orders' }, 'Standing orders',
      h('input', { type: 'text', value: readOrders(sid), placeholder: 'e.g. never kill; save coin for a horse', 'aria-label': 'Standing orders the agent always follows',
        onchange: (e: Event) => writeOrders(sid, (e.target as HTMLInputElement).value), onblur: () => update() })) : '';
    const q = question;
    const own = h('input', { type: 'text', placeholder: 'Or say what to do in your own words', 'aria-label': 'Your own answer',
      onkeydown: (e: KeyboardEvent) => { const t = (e.target as HTMLInputElement).value.trim(); if (e.key === 'Enter' && t) reply({ words: t }); } }) as HTMLInputElement;
    const card = q ? h('div', { class: 'auto-ask', role: 'group', 'aria-label': 'Your call' },
      h('p', { class: 'auto-say' }, h('span', { class: 'auto-who' }, 'Your call'), q.ja ? h('span', {}, `“${plainLine(q.ja)}”`, h('span', { class: 'auto-en' }, plainLine(q.say))) : `“${plainLine(q.say)}”`),
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
    el.replaceChildren(h('div', { class: 'auto-panel' },
      h('div', { class: 'auto-row' },
        h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Which story' },
          btn('On my story', () => void useSave('player'), { pressed: !agentStory(), disabled: switching }),
          btn('Its own story', () => void useSave('agent'), { pressed: agentStory(), disabled: switching, agent: true })),
        h('label', { class: 'auto-field' }, 'Mode', mode),
        h('label', { class: 'auto-field' }, 'Playstyle', persona),
        h('label', { class: 'auto-field' }, 'Pace', wait),
        h('label', { class: 'auto-field' }, 'Style', style),
        h('label', { class: 'auto-field' }, 'Speaker', voicePick),
        h('label', { class: 'auto-field' }, 'Speed', rate),
        btn(prefs.voice ? '✓ Voice' : 'Voice', () => { prefs.voice = !prefs.voice; writePrefs(prefs); if (!prefs.voice) hush(); update(); },
          { pressed: prefs.voice, title: prefs.voice ? 'The agent’s commentary is read aloud. Click to mute it' : 'Click to read the agent’s commentary aloud' }),
        h('div', { class: 'auto-go' },
          talking ? btn('Stop voice', () => { hush(); update(); }, { title: 'Stop reading this line aloud' }) : '',
          btn('One turn', () => play(true), { disabled: playing || switching || !api.state() }),
          playing ? btn('Pause', () => pause('Paused'), { main: true }) : btn('Play', () => play(), { main: true, disabled: switching || !api.state() }),
          h('button', { type: 'button', class: 'hs-btn-text auto-x', 'aria-label': 'Close the agent bar', title: 'Close', onclick: () => { pause(''); open = false; update(); } }, '×'))),
      orders ? h('div', { class: 'auto-row' }, orders) : '',
      card || (said ? h('p', { class: 'auto-say' }, h('span', { class: 'auto-who' }, 'Agent'), saidJa ? h('span', {}, `“${plainLine(saidJa)}”`, h('span', { class: 'auto-en' }, plainLine(said))) : `“${plainLine(said)}”`) : ''),
      !q && prefs.mode === 'guided' && guidance && guidance.scene === scene() ? h('p', { class: 'hs-note' }, `Your guidance this scene: ${guidance.text}`) : '',
      !q && prefs.mode === 'guided' && lastCall ? h('p', { class: 'hs-note' }, `Last call: ${lastCall}`) : '',
      status || (!playing && mine) ? h('p', { class: 'hs-note', role: 'status' }, status || mine!.textContent) : '',
      noVoice || voiceNote ? h('p', { class: 'hs-note' }, noVoice || voiceNote) : ''));
  }
  update();
  return { el, opener, update, playing: () => playing, asking: () => !!question,
    playedTurn: () => { if (!question || question.perk) return; before = api.state() ? turnSnap(api.state()!) : null; reply({ played: true }); } };
}
