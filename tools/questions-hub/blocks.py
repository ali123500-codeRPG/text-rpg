"""Hub question layout: every question longer than two sentences is short labelled colour blocks.

Use from a page builder script:
    import sys; sys.path.insert(0, 'tools/questions-hub'); from blocks import *   # path from the repo root
    q['body'] = head(q, 'Gap') + blk('today', 'Today', p('...')) + blk('prob', 'Problem', p('...')) \
        + blk('prop', 'Proposal', p('...')) + blk('form', 'Formula', eq('stop = ARMOR_FACTOR × need'), p('ARMOR_FACTOR = 0.08 (placeholder)')) \
        + blk('ex', 'Example', exr('Half plate, skill 50', [('fists', '3.9'), ('greatsword', D('3.3'))])) + scl('ok', 'At 50 ... 75 ... 100 ... 200 ...')
    # the block CSS is built into the hub (v16); CSS here is a copy for local previews with an older hub
    lint(spec)                 # raises if a question is still a wall of text; run before ArtifactData set
Keep `o` and `rec` as usual (the options). Render a preview (README) before setting the page.
"""
import re

CSS = """
.blk{--b:var(--c3);border-left:3px solid var(--b);background:color-mix(in srgb,var(--b) 9%,var(--surface));padding:7px 11px;border-radius:6px;margin-top:8px;font-size:13.5px;color:var(--muted)}
.blk>.tag{display:block;color:var(--b);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.blk.today{--b:var(--c3)}.blk.prob{--b:var(--danger)}.blk.prop{--b:var(--accent)}.blk.form{--b:var(--gold)}.blk.ex{--b:var(--c5)}
.blk b{color:var(--text)}
.eq{display:block;font:13px/1.5 ui-monospace,Consolas,monospace;color:var(--gold);background:#050a1d;border-radius:4px;padding:4px 8px;margin:4px 0;white-space:pre-wrap;word-break:break-word}
.exr{margin-top:7px}.exr>b{display:block;color:var(--text);font-size:13px}
.exr .cells{display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}
.exr .cells span{font-size:12.5px;padding:2px 8px;border-radius:5px;background:color-mix(in srgb,var(--c5) 13%,var(--surface));color:var(--text)}
.exr .cells i{font-style:normal;color:var(--muted);margin-right:4px}
.exr .cells .up,.up{color:var(--ok);font-weight:800;background:none;padding:0}.exr .cells .down,.down{color:var(--danger);font-weight:800;background:none;padding:0}
.ckey{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted);margin-top:8px}
.ckey span{display:inline-flex;align-items:center;gap:6px}.ckey i{width:10px;height:10px;border-radius:2px;background:var(--b)}
.q .rec .opts li{border-left:3px solid var(--k);padding:6px 10px}
"""

def esc(t): return str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def blk(kind, tag, *parts):
    """kind: today (grey) | prob (red) | prop (blue) | form (gold) | ex (violet). One idea per block."""
    return f'<div class="blk {kind}"><span class="tag">{tag}</span>{"".join(parts)}</div>'
def eq(t): return f'<span class="eq">{esc(t)}</span>'          # one formula per line; explain constants in p() below it
def p(t): return f'<div>{t}</div>'
def exr(name, cells): return f'<div class="exr"><b>{name}</b><div class="cells">' + ''.join(f'<span><i>{a}</i>{b}</span>' for a, b in cells) + '</div></div>'
U = lambda t: f'<span class="up">{t}</span>'                       # a raise, green
D = lambda t: f'<span class="down">{t}</span>'                     # a cut, red
KEY = ('<div class="ckey">' + ''.join(f'<span style="--b:var({v})"><i></i>{n}</span>' for v, n in
       [('--c3', 'Today'), ('--danger', 'Problem'), ('--accent', 'Proposal'), ('--gold', 'Formula'), ('--c5', 'Example')]) + '</div>')
def head(q, kname):
    """`body` replaces the pill + title, so it must carry them (and the Answered / Answer again pills)."""
    return (f'<span class="pill">{kname}</span><span class="pill ans" id="ans-{q["id"]}" hidden>Answered</span>'
            + (f'<span class="pill again" id="again-{q["id"]}">Answer again</span>' if q.get('reask') else '')
            + f'<h3><span class="id">{q["id"]}</span>{esc(q["title"])}</h3>' + KEY)
def opts(q):
    """Not needed since hub v16 (BG-260 fixed: the hub shows `o` under the recommendation for body questions too)."""
    return ('<ul class="opts">' + ''.join(f'<li><b>{esc(l)}</b>{esc(t)}</li>' for l, t in q['o']) + '</ul>') if q.get('o') else ''
def scl(kind, t): return f'<div class="scale {kind}"><span class="lbl">{"How it scales · flagged" if kind == "flag" else "How it scales"}</span>{t}</div>'

def sentences(t): return len(re.findall(r'[.!?](?:\s|$)', re.sub(r'<[^>]+>', ' ', t or '')))

def lint(spec):
    """Raise if an open question is a wall of text: plain `ctx` over two sentences, or a `body` without blocks."""
    bad = []
    for q in spec.get('QS', []):
        if q.get('done') or q.get('withdrawn'): continue
        b = q.get('body')
        if b is None and sentences(q.get('ctx')) > 2: bad.append(f"{q['id']}: ctx has {sentences(q.get('ctx'))} sentences, use body + blk()")
        if b is not None and 'class="blk' not in b and sentences(b) > 2: bad.append(f"{q['id']}: body has no blk() blocks")
        if b is not None and 'class="ckey' not in b and 'class="blk' in b: bad.append(f"{q['id']}: body lacks the colour key (head())")
    if bad: raise SystemExit('Hub layout lint failed (README "Question layout"):\n  ' + '\n  '.join(bad))
    return True
