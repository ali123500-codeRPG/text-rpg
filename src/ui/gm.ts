// GM debug view (Part 2, Leak prevention…; Part 4 §11): full state, hidden plans, rolls, beliefs, each agent's exact
// input and output, the red fallback banner, the backup list with restore, and the "Download backup" button.
import { tierName } from '../ruleset';
import { getLibrary } from '../library';
import { ageText, talentName } from '../ruleset/age';
import type { BlueprintPage, GameApi, GameState, ScenarioRecord } from '../types';
import { GRADES } from '../types';
import { HIT_OUTCOMES, QUALITY_LEVELS, TIERS } from '../scales';
import { fmtDate, h, openPanel, readouts, plural, unitOf } from './kit';
import { ICON_CREDIT } from './itemIcons';
import { openPop } from './pop';
import { CONFIG } from '../config';

/** BA8: the ended scenarios' barriers summed by tier, best tier first */
function waysByTier(scenarios: ScenarioRecord[]): { tier: string; scenarios: number; barriers: number; shut: string; grades: string }[] {
  return [...TIERS.keys].reverse().map((t) => {
    const of = scenarios.filter((r) => r.tier === t);
    const sum = (k: 'barriers' | 'locked' | 'barred' | 'blocked' | 'guarded') => of.reduce((n, r) => n + (r.ways?.[k] ?? 0), 0);
    const grades = GRADES.map((g) => [g, of.reduce((n, r) => n + (r.ways?.grades[g] ?? 0), 0)] as const).filter(([, n]) => n);
    return { tier: tierName({ tier: t }), scenarios: of.length, barriers: sum('barriers'),
      shut: (['locked', 'barred', 'blocked', 'guarded'] as const).filter((k) => sum(k)).map((k) => `${sum(k)} ${k}`).join(' · '),
      grades: grades.map(([g, n]) => `${n} ${g}`).join(' · ') };
  }).filter((r) => r.scenarios);
}

type CommentsApi = { anchorFor(el: Element): Promise<unknown>; canSendToClaude(): Promise<string>; sendToClaude(t: { anchor: unknown; text: string }): Promise<unknown> };
const KIND_WORD: Record<BlueprintPage['kind'], string> = { item: 'an item', body_type: 'a body type', npcTemplate: 'an NPC template' };

const json = (v: unknown) => h('pre', { class: 'json' }, JSON.stringify(v, null, 2) ?? 'null');

export function gmPage(api: GameApi) {
  const el = h('main');
  const how = h('p', { class: 'how', hidden: true });
  let confirm: { kind: 'restore'; turn: number } | { kind: 'download' } | { kind: 'newSave' } | { kind: 'endScenario' } | null = null;

  function download() {
    const snap = api.gm();
    const blob = new Blob([JSON.stringify({ state: snap.state, backups: snap.backups }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `backup-${snap.state?.storyId ?? 'story'}-turn-${snap.state?.turn ?? 0}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // HF34 a: what the Weaver made in this story, each with Send to library (the send list, then a comment that wakes Claude)
  const notes = new Map<string, string>();
  let sent = new Set<string>(), sendsAt = 0;
  let comments: CommentsApi | null = null;
  const rt = (window as unknown as { claude?: { use(n: string): Promise<CommentsApi | null> } }).claude;
  rt?.use('comments').then(async (c) => { if (c && (await c.canSendToClaude().catch(() => 'off')) === 'available') comments = c; }).catch(() => undefined);
  function refreshSends(storyId: string) {
    if (Date.now() - sendsAt < 5000) return;
    sendsAt = Date.now();
    api.librarySends().then((xs) => { sent = new Set(xs.filter((x) => x.storyId === storyId).map((x) => String(x.data.id ?? ''))); update(); }).catch(() => undefined);
  }
  async function sendMade(b: BlueprintPage, btn: HTMLButtonElement) {
    btn.disabled = true;
    const r = await api.sendBlueprint(b.id).catch(() => ({ error: 'The send couldn’t be saved. Try again.' }));
    if ('error' in r) { notes.set(b.id, r.error); return update(); }
    const name = String(b.data.name ?? b.data.label ?? b.id);
    const woke = comments ? await comments.sendToClaude({ anchor: await comments.anchorFor(btn), text: `"${name}" (${KIND_WORD[b.kind]} the Weaver made in a story) was sent to the library for review: if it fits, add it to the code library by PR, from db library_sends/${r.id} (thread "Turn hall of fame heroes into NPCs").` }).then(() => true, () => false) : false;
    notes.set(b.id, woke ? 'Sent to Claude.' : 'Saved to the send list; Claude couldn’t be reached from here.');
    sent.add(b.id);
    update();
  }
  function madeSection(s: GameState | null) {
    const made = s?.blueprints ?? [];
    if (s) refreshSends(s.storyId);
    return h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Made this story · send what should stay to the library'),
      made.length ? h('table', { class: 'hs-tbl' },
        h('thead', {}, h('tr', {}, ['Name', 'Kind', 'Built from', 'Quality', 'Id', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, made.map((b) => {
          const d = b.data as { name?: string; label?: string; base?: { itemId: string; quality: string } };
          const btn = h('button', { class: 'hs-btn-text', type: 'button', onclick: (e: Event) => { e.stopPropagation(); void sendMade(b, btn as HTMLButtonElement); } }, sent.has(b.id) ? 'Send again' : 'Send to library');
          return h('tr', { style: 'cursor:pointer', title: 'Open what it is made of', onclick: () => openPanel(String(d.name ?? d.label ?? b.id), [{ k: 'Kind', v: KIND_WORD[b.kind].replace(/^an? /, '') }, { k: 'Id', v: b.id }, { k: 'Data', v: json(b.data) }]) },
            h('td', {}, d.name ?? d.label ?? b.id), h('td', {}, KIND_WORD[b.kind].replace(/^an? /, '')),
            h('td', {}, ((id) => (id ? getLibrary().items[id]?.name ?? id : '–'))(d.base?.itemId ?? (b.kind === 'item' ? b.id.replace(/_i\d+$/, '') : undefined))),
            h('td', { class: 'hs-num' }, d.base ? QUALITY_LEVELS.keyOf(d.base.quality) ? QUALITY_LEVELS.name(QUALITY_LEVELS.keyOf(d.base.quality)!) : String(d.base.quality) : '–'), h('td', {}, b.id),
            h('td', { class: 'r' }, btn, notes.has(b.id) ? h('span', { class: 'hs-note' }, ` ${notes.get(b.id)}`) : sent.has(b.id) ? h('span', { class: 'hs-note' }, ' Sent') : ''));
        })))
        : h('p', { class: 'empty' }, 'Nothing made yet. Items the Weaver makes live only in this story until you send them to the library.'));
  }

  /** one person's last agent calls (exact input, then output), newest first, in a movable pop-up */
  async function showCalls(id: string, name: string, opener: HTMLElement) {
    const title = `${name} · last ${CONFIG.GM_AGENT_CALLS_SHOWN} agent calls`;
    openPop({ title, opener, cls: 'gm-calls', body: [h('p', { class: 'hs-note' }, 'Reading the kept turns…')] });
    const calls = await api.agentHistory(id).catch(() => null);
    openPop({ title, opener, cls: 'gm-calls', body: calls === null ? [h('p', { class: 'hs-note' }, 'The turn records couldn’t be read.')]
      : calls.length ? calls.map((c) => h('div', { class: 'gm-call' },
        h('p', {}, h('b', {}, `Turn ${c.turn} · ${c.agent}`), h('span', { class: 'hs-note' }, ` · ${c.status} · ${c.modelApplied ?? c.modelTierApplied ?? '–'}${c.errors.length ? ` · ${c.errors.join(', ')}` : ''}`)),
        h('p', { class: 'hs-label' }, 'Input'), json(c.input),
        h('details', {}, h('summary', {}, 'Output'), json(c.output))))
      : [h('p', { class: 'hs-note' }, `No agent call for ${name} in the last ${CONFIG.TURN_RECORDS_KEPT} turns.`)] });
  }

  function update() {
    const g = api.gm(), s = g.state;
    const ways = waysByTier(s?.hidden.scenarios ?? []);
    const rolls = (s?.events ?? []).filter((e) => e.attack || e.contest || e.check);
    const confirmRow = (text: string, yes: string, act: () => void) => h('div', { class: 'confirm' }, h('span', { class: 'hs-note' }, text),
      h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { confirm = null; act(); update(); } }, yes),
      h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { confirm = null; update(); } }, 'Cancel'));

    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'GM debug'), h('p', {}, 'Everything the game knows this turn, hidden parts included. Never shown to the player.')),
        h('div', { class: 'actions' },
          confirm?.kind === 'download'
            ? confirmRow('Download the whole story as a file?', 'Download backup', download)
            : h('button', { class: 'hs-btn-text', type: 'button', title: 'Owner only. Asks to confirm each time', onclick: () => { confirm = { kind: 'download' }; update(); } }, 'Download backup'),
          // SC15: end the running scenario, for testing; it ends after the next turn and is recorded as interrupted
          s?.stage.scenario && !s.stage.breakCause ? (confirm?.kind === 'endScenario'
            ? confirmRow(`End scenario ${s.stage.scenarioNumber} ("${s.stage.scenario.question}") after the next turn?`, 'End scenario', () => api.endScenario())
            : h('button', { class: 'hs-btn-text', type: 'button', title: 'Ends the running scenario after the next turn, recorded as interrupted. Asks to confirm', onclick: () => { confirm = { kind: 'endScenario' }; update(); } }, 'End scenario')) : '',
          // The GM can start a new save, with warnings. The old story is archived, not deleted (D-73).
          s ? (confirm?.kind === 'newSave'
            ? h('div', { class: 'confirm', role: 'alert' },
                h('span', { class: 'hs-note' }, `Warning: "${s.meta.title}" (turn ${s.turn}) ends now and you make a new character. Play can't return to it: it is archived, not deleted. Download a backup first if you want a copy.`),
                h('button', { class: 'hs-btn-text', type: 'button', onclick: download }, 'Download backup'),
                h('button', { class: 'hs-btn-text danger', type: 'button', onclick: async () => { confirm = null; await api.reset(); } }, 'Start a new save'),
                h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { confirm = null; update(); } }, 'Keep playing'))
            : h('button', { class: 'hs-btn-text danger', type: 'button', title: 'Ends this story and starts a new one. Asks to confirm', onclick: () => { confirm = { kind: 'newSave' }; update(); } }, 'Start a new save')) : '')),
      g.fallbackBanner ? h('div', { class: 'gm-banner', role: 'alert' }, s?.stage.fallback?.reason ?? 'the stage is the flagged placeholder area') : '',
      h('div', { class: 'sec' }, readouts([
        { label: 'Turn', value: String(s?.turn ?? '–'), unit: s?.mode ?? '', sub: s ? `scenario ${s.stage.scenarioNumber} · since turn ${s.stage.scenarioStartTurn}` : 'No story', how: 'The committed turn and the encounter mode.' },
        { label: 'Actors', value: String(s?.actors.length ?? 0), unit: unitOf(s?.actors.length ?? 0, 'NPC'), sub: s ? plural(s.bands.length, 'band') : '–', how: 'NPCs and enemies in the story (the player not counted).' },
        { label: 'Agent calls', value: String(g.agentLog.length), unit: unitOf(g.agentLog.length, 'call'), sub: `${g.agentLog.filter((a) => a.errors.length).length} with errors`, how: 'Claude calls made for the last turn.' },
        { label: 'Rolls', value: String(rolls.length), unit: unitOf(rolls.length, 'roll'), sub: plural(g.log.length, 'log code'), how: 'Attacks, contests and checks among this turn’s events.' },
      ], how), how,
        // moved here from the play header: the count and the running agents change with the encounter mode (hidden)
        h('p', { class: 'hs-note' }, `${plural(api.calls(), 'Claude call')} this session`,
          api.working().length ? ` · running now: ${api.working().map((w) => w.agent).join(', ')}${api.busy() ? '' : ' (in the background)'}` : '')),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Agent calls · exact input and output'),
        g.agentLog.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Agent', 'Actor', 'Status', 'Model', 'Errors'].map((t) => h('th', {}, t)))),
          h('tbody', {}, g.agentLog.map((a) => h('tr', { style: 'cursor:pointer', title: 'Open the exact input and output', onclick: () => openPanel(`${a.agent} · turn ${a.turn}`, [
            { k: 'Status', v: a.status }, { k: 'Model', v: a.modelApplied ?? a.modelTierApplied ?? '–' }, { k: 'Errors', v: a.errors.join(', ') || 'none' },
            { k: 'Input', v: json(a.input) }, { k: 'Output', v: json(a.output) }, { k: 'Raw', v: json(a.rawOutputs ?? []) }]) },
            h('td', {}, a.agent), h('td', {}, a.actorId ?? '–'), h('td', {}, a.status), h('td', {}, a.modelApplied ?? a.modelTierApplied ?? '–'), h('td', {}, a.errors.join(', ') || '–')))))
          : h('p', { class: 'empty' }, 'No agent calls this turn.')),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Rolls'),
        rolls.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Actor', 'Kind', 'Target', 'Result', 'Detail'].map((t) => h('th', {}, t)))),
          h('tbody', {}, rolls.map((e) => h('tr', {}, h('td', {}, e.actorId), h('td', {}, e.kind), h('td', {}, e.target ?? '–'),
            h('td', {}, e.attack ? `${HIT_OUTCOMES.name(e.attack.outcome)} · ${e.attack.damage} dmg` : e.contest ? `${e.contest.winner} by ${e.contest.gap}` : e.check ? (e.check.passed ? 'passed' : 'failed') : (e.tier !== undefined ? tierName(e.tier) : '–')),
            h('td', {}, e.attack ? `d100 ${e.attack.attack.d100} vs ${e.attack.defense?.d100 ?? '–'} · gap ${e.attack.gap ?? '–'} · ${e.attack.location ?? '–'}` : '')))))
          : h('p', { class: 'empty' }, 'No rolls this turn.')),

      // AG16: exact ages, which the play screen never shows for NPCs; and who an agent runs, with their last agent calls in a pop-up
      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'People · age and who an agent runs'),
        s ? h('table', { class: 'hs-tbl gm-people' },
          h('thead', {}, h('tr', {}, ['Actor', 'Age · talent', 'Run by', 'Agent calls this turn'].map((t) => h('th', {}, t)))),
          h('tbody', {}, [s.player, ...s.actors].map((a) => {
            const mine = g.agentLog.filter((l) => l.actorId === a.id);
            const runBy = a.id === s.player.id ? 'Player' : a.mind?.control === 'agent' ? 'Agent' : 'Code';
            const name = a.id === s.player.id ? a.names.current
              : h('button', { class: 'hs-btn-text gm-who', type: 'button', title: 'Open their last agent calls', onclick: (e: Event) => void showCalls(a.id, a.names.current, e.currentTarget as HTMLElement) }, a.names.current);
            return h('tr', { 'data-actor': a.id }, h('td', {}, name), h('td', {}, [ageText(s, a) ?? 'Ageless', a.core.talent ? talentName(a.core.talent) : ''].filter(Boolean).join(' · ')),
              h('td', {}, runBy === 'Agent' ? h('span', { class: 'hs-chip gm-agent' }, 'Agent') : h('span', { class: 'hs-note' }, runBy)),
              h('td', {}, mine.length ? mine.map((l) => l.agent).join(', ') : '–'));
          })))
          : h('p', { class: 'empty' }, 'No story yet.')),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Beliefs'),
        s?.actors.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Actor', 'About', 'Status', 'Last known', 'Source'].map((t) => h('th', {}, t)))),
          h('tbody', {}, s.actors.flatMap((a) => Object.entries(a.mind?.knowledge ?? {}).map(([who, b]) =>
            h('tr', {}, h('td', {}, a.names.current), h('td', {}, who), h('td', {}, b.status), h('td', {}, b.lastKnownZone ?? '–'), h('td', {}, b.source))))))
          : h('p', { class: 'empty' }, 'No NPCs yet.')),

      // BA8: the barriers each tier's scenarios put on ways, so the tier's lean can be checked
      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Ways per tier · barriers the scenarios put on ways'),
        ways.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Tier', 'Scenarios', 'Barriers', 'Of them', 'Grades'].map((t) => h('th', {}, t)))),
          h('tbody', {}, ways.map((r) => h('tr', {}, h('td', {}, r.tier), h('td', { class: 'hs-num' }, String(r.scenarios)),
            h('td', { class: 'hs-num' }, String(r.barriers)), h('td', {}, r.shut || '–'), h('td', {}, r.grades || '–')))))
          : h('p', { class: 'empty' }, 'No scenario has ended yet.')),

      // NG15: who the Weaver wanted and couldn't field (templateGap), so a template can be made; composed presets are under "Made this story"
      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Templates wanted · who the Weaver could not field'),
        s?.hidden.templateWants?.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Scenario', 'Cast as', 'Wanted', 'Used instead'].map((t) => h('th', {}, t)))),
          h('tbody', {}, [...s.hidden.templateWants].reverse().map((w) => h('tr', {}, h('td', { class: 'hs-num' }, `${w.scenario} · turn ${w.turn}`),
            h('td', {}, w.label), h('td', {}, w.wanted), h('td', {}, w.template || '–')))))
          : h('p', { class: 'empty' }, 'Nothing wanted yet. The Weaver writes templateGap when no template or composition gives who it means.')),

      // NG16 b: the hostile cast's power against the player's, by the challenge grade's band; logged only while the bands are tuned
      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Cast power · against the challenge grade'),
        s?.hidden.castPower?.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Scenario', 'Challenge', 'Hostile power', 'Player power', 'Ratio', 'Band', ''].map((t) => h('th', {}, t)))),
          h('tbody', {}, [...s.hidden.castPower].reverse().map((c) => h('tr', {}, h('td', { class: 'hs-num' }, `${c.scenario} · turn ${c.turn}`), h('td', {}, c.challenge),
            h('td', { class: 'hs-num' }, String(c.hostile)), h('td', { class: 'hs-num' }, String(c.player)), h('td', { class: 'hs-num' }, c.ratio.toFixed(2)),
            h('td', {}, c.band ? `${c.band[0]}–${c.band[1]}` : '–'), h('td', {}, c.off ? h('span', { class: 'hs-chip' }, 'Off band') : '')))))
          : h('p', { class: 'empty' }, 'No scenario has opened yet.')),

      madeSection(s),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Hidden plans'), s ? json(s.hidden) : h('p', { class: 'empty' }, 'No story yet.')),
      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Engine log'), g.log.length ? json(g.log) : h('p', { class: 'empty' }, 'Nothing logged this turn.')),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Backups'),
        g.backups.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Turn'), h('th', {}, 'Where'), h('th', { class: 'r' }, ''))),
          h('tbody', {}, [...g.backups].sort((a, b) => b.turn - a.turn).map((b) => h('tr', {}, h('td', { class: 'hs-num' }, `Turn ${b.turn}`), h('td', {}, b.path),
            h('td', { class: 'r' }, confirm?.kind === 'restore' && confirm.turn === b.turn
              ? confirmRow(`Restore turn ${b.turn}? The current head is kept as the safety bookmark.`, 'Restore', () => void api.restoreBackup(b.turn))
              : h('button', { class: 'hs-btn-text', type: 'button', onclick: () => { confirm = { kind: 'restore', turn: b.turn }; update(); } }, 'Restore'))))))
          : h('p', { class: 'empty' }, 'No backups yet. One is written every few turns.')),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Full state'),
        h('p', { class: 'hs-note' }, s ? `Story “${s.meta.title}” · started ${fmtDate(s.meta.createdAt)}` : 'No story yet.'),
        h('details', { class: 'raw' }, h('summary', {}, 'Show the full state'), json(s))),
      h('p', { class: 'hs-note' }, ICON_CREDIT),
    );
  }
  return { el, update };
}
