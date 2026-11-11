// GM debug view (Part 2, Leak prevention…; Part 4 §11): full state, hidden plans, rolls, beliefs, each agent's exact
// input and output, the red fallback banner, the backup list with restore, and the "Download backup" button.
import { tierName } from '../ruleset';
import type { GameApi, SceneRecord } from '../types';
import { GRADES } from '../types';
import { TIERS } from '../scales';
import { fmtDate, h, openPanel, readouts, plural, unitOf } from './kit';

/** BA8: the ended scenes' barriers summed by tier, best tier first */
function waysByTier(scenes: SceneRecord[]): { tier: string; scenes: number; barriers: number; shut: string; grades: string }[] {
  return [...TIERS.keys].reverse().map((t) => {
    const of = scenes.filter((r) => r.tier === t);
    const sum = (k: 'barriers' | 'locked' | 'barred' | 'blocked' | 'guarded') => of.reduce((n, r) => n + (r.ways?.[k] ?? 0), 0);
    const grades = GRADES.map((g) => [g, of.reduce((n, r) => n + (r.ways?.grades[g] ?? 0), 0)] as const).filter(([, n]) => n);
    return { tier: tierName({ tier: t }), scenes: of.length, barriers: sum('barriers'),
      shut: (['locked', 'barred', 'blocked', 'guarded'] as const).filter((k) => sum(k)).map((k) => `${sum(k)} ${k}`).join(' · '),
      grades: grades.map(([g, n]) => `${n} ${g}`).join(' · ') };
  }).filter((r) => r.scenes);
}

const json = (v: unknown) => h('pre', { class: 'json' }, JSON.stringify(v, null, 2) ?? 'null');

export function gmPage(api: GameApi) {
  const el = h('main');
  const how = h('p', { class: 'how', hidden: true });
  let confirm: { kind: 'restore'; turn: number } | { kind: 'download' } | { kind: 'newSave' } | { kind: 'endScene' } | null = null;

  function download() {
    const snap = api.gm();
    const blob = new Blob([JSON.stringify({ state: snap.state, backups: snap.backups }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `backup-${snap.state?.storyId ?? 'story'}-turn-${snap.state?.turn ?? 0}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function update() {
    const g = api.gm(), s = g.state;
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
          // SC15: end the running scene, for testing; it ends after the next turn and is recorded as interrupted
          s?.stage.scene && !s.stage.breakCause ? (confirm?.kind === 'endScene'
            ? confirmRow(`End scene ${s.stage.sceneNumber} ("${s.stage.scene.question}") after the next turn?`, 'End scene', () => api.endScene())
            : h('button', { class: 'hs-btn-text', type: 'button', title: 'Ends the running scene after the next turn, recorded as interrupted. Asks to confirm', onclick: () => { confirm = { kind: 'endScene' }; update(); } }, 'End scene')) : '',
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
        { label: 'Turn', value: String(s?.turn ?? '–'), unit: s?.mode ?? '', sub: s ? `scene ${s.stage.sceneNumber} · since turn ${s.stage.sceneStartTurn}` : 'No story', how: 'The committed turn and the encounter mode.' },
        { label: 'Actors', value: String(s?.actors.length ?? 0), unit: unitOf(s?.actors.length ?? 0, 'NPC'), sub: s ? plural(s.bands.length, 'band') : '–', how: 'NPCs and enemies in the story (the player not counted).' },
        { label: 'Agent calls', value: String(g.agentLog.length), unit: unitOf(g.agentLog.length, 'call'), sub: `${g.agentLog.filter((a) => a.errors.length).length} with errors`, how: 'Claude calls made for the last turn.' },
        { label: 'Rolls', value: String(rolls.length), unit: unitOf(rolls.length, 'roll'), sub: plural(g.log.length, 'log code'), how: 'Attacks, contests and checks among this turn’s events.' },
      ], how), how,
        // moved here from the play header: the count and the running agents change with the encounter mode (hidden)
        h('p', { class: 'hs-note' }, `${api.calls()} Claude call${api.calls() === 1 ? '' : 's'} this session`,
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
            h('td', {}, e.attack ? `${e.attack.outcome} · ${e.attack.damage} dmg` : e.contest ? `${e.contest.winner} by ${e.contest.gap}` : e.check ? (e.check.passed ? 'passed' : 'failed') : (e.tier !== undefined ? tierName(e.tier) : '–')),
            h('td', {}, e.attack ? `d100 ${e.attack.attack.d100} vs ${e.attack.defense?.d100 ?? '–'} · gap ${e.attack.gap ?? '–'} · ${e.attack.location ?? '–'}` : '')))))
          : h('p', { class: 'empty' }, 'No rolls this turn.')),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Beliefs'),
        s?.actors.length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Actor', 'About', 'Status', 'Last known', 'Source'].map((t) => h('th', {}, t)))),
          h('tbody', {}, s.actors.flatMap((a) => Object.entries(a.mind?.knowledge ?? {}).map(([who, b]) =>
            h('tr', {}, h('td', {}, a.names.current), h('td', {}, who), h('td', {}, b.status), h('td', {}, b.lastKnownZone ?? '–'), h('td', {}, b.source))))))
          : h('p', { class: 'empty' }, 'No NPCs yet.')),

      // BA8: the barriers each tier's scenes put on ways, so the tier's lean can be checked
      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Ways per tier · barriers the scenes put on ways'),
        waysByTier(s?.hidden.scenes ?? []).length ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Tier', 'Scenes', 'Barriers', 'Of them', 'Grades'].map((t) => h('th', {}, t)))),
          h('tbody', {}, waysByTier(s?.hidden.scenes ?? []).map((r) => h('tr', {}, h('td', {}, r.tier), h('td', { class: 'hs-num' }, String(r.scenes)),
            h('td', { class: 'hs-num' }, String(r.barriers)), h('td', {}, r.shut || '–'), h('td', {}, r.grades || '–')))))
          : h('p', { class: 'empty' }, 'No scene has ended yet.')),

      h('section', { class: 'sec' }, h('h2', { class: 'hs-section' }, 'Needs data · items Claude made this story'),
        s?.blueprints.some((b) => b.kind === 'item') ? h('table', { class: 'hs-tbl' },
          h('thead', {}, h('tr', {}, ['Name', 'Built from', 'Quality', 'Id'].map((t) => h('th', {}, t)))),
          h('tbody', {}, s.blueprints.filter((b) => b.kind === 'item').map((b) => {
            const d = b.data as { name?: string; base?: { itemId: string; quality: number } };
            return h('tr', {}, h('td', {}, d.name ?? b.id), h('td', {}, d.base?.itemId ?? b.id.replace(/_i\d+$/, '')), h('td', { class: 'hs-num' }, d.base ? String(d.base.quality) : '–'), h('td', {}, b.id));
          })))
          : h('p', { class: 'empty' }, 'No made items yet. Each one runs on a library base until you give it its own data.')),

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
    );
  }
  return { el, update };
}
