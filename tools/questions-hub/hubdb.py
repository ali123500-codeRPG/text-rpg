"""Questions hub writes, one small doc per round and per question (hub v31). README "Write only what changed".

A questionnaire is:
    pages/<name>               {title, updated, spec}   spec = the header only (title, intro, K, NOTE, sections, rules, css)
    rounds/<name>/items/<g>    {title, sub, n}          one per round (group); rounds sort by n
    qs/<name>/items/<ID>       question fields + g, i   one per question; sorted by round, then i
Every function writes the doc files into `out` and returns the `writes` list for ONE ArtifactData batch call
(max 50 writes per batch; split longer lists with chunks()). Paste the printed list as `writes`.

    import sys; sys.path.insert(0, 'tools/questions-hub'); from hubdb import *; from blocks import *   # path from the repo root
    # page version: ArtifactData get pages/<name> with out_dir (the result line shows `version N`)
    w = new_round('my-page', 7, 'r3', 'Round 3', 'what this round asks', [q1, q2], OUT)   # lint() runs on the round
    w = mark('my-page', 8, {'LG23': (3, {'done': 'a. Built in PR #1080.'}), 'LG24': (None, {'reask': now()})}, OUT)
    print_writes(w)
Doc versions for mark(): ArtifactData list qs/<name>/items with out_dir; the result lists each doc's version.
A question that still lives inside an older page's spec (no doc yet) gets version None: the new doc is laid over it.
"""
import json, os, datetime

try:
    from blocks import lint
except ImportError:  # blocks.py sits next to this file
    import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from blocks import lint

def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def ms(iso):
    return int(datetime.datetime.strptime(iso, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)

def _file(out, coll, doc_id, data):
    path = os.path.abspath(os.path.join(out, coll.split('/')[0][0] + '-' + doc_id + '.json'))  # r-, q-, p- prefixes
    os.makedirs(out, exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, ensure_ascii=False)
    return path

def _w(op, coll, doc_id, data, out, version=None):
    w = {'op': op, 'collection': coll, 'doc_id': doc_id, 'file_path': _file(out, coll, doc_id, data)}
    if version: w['if_version'] = version
    return w

def bump(name, page_version, out, at=None, **fields):
    """The page's `updated` (and any other header field) as an update. Every write bumps it: the home list and the read check need it."""
    return _w('update', 'pages', name, {'updated': at or now(), **fields}, out, page_version)

def _q(q, g, i):
    d = {k: v for k, v in q.items() if k != 'id'}
    d['g'] = g; d['i'] = i
    return d

def new_round(name, page_version, g, title, sub, qs, out, at=None):
    """A new round at the bottom: its group doc, one doc per question, and the page's `updated`."""
    at = at or now(); lint({'QS': qs}); base = ms(at)
    for q in qs:
        if q.get('reask') is True: raise ValueError(f"{q['id']}: reask must be a fixed ISO time (BG-292)")
    w = [_w('set', f'rounds/{name}/items', g, {'title': title, 'sub': sub, 'n': base}, out)]
    w += [_w('set', f'qs/{name}/items', q['id'], _q(q, g, base + j), out) for j, q in enumerate(qs)]
    return w + [bump(name, page_version, out, at)]

def mark(name, page_version, changes, out, at=None):
    """changes = {ID: (doc version or None, fields)}: done, reask, withdrawn... A field set to None clears it (e.g. body when
    withdrawing). Writes only those question docs and the page's `updated`, which must be later than the answers it marks read."""
    at = at or now(); w = []
    for qid, (ver, fields) in changes.items():
        if fields.get('reask') is True: raise ValueError(f'{qid}: reask must be a fixed ISO time (BG-292)')
        if ver: w.append(_w('update', f'qs/{name}/items', qid, {k: ({'__delete__': True} if v is None else v) for k, v in fields.items()}, out, ver))
        else: w.append(_w('set', f'qs/{name}/items', qid, fields, out))  # over a question still inside the page spec
    return w + [bump(name, page_version, out, at)]

def new_page(name, title, header, rounds, out, at=None):
    """A whole new questionnaire. header = spec without GROUPS/QS. rounds = [(g, title, sub, [questions])]."""
    at = at or now(); base = ms(at); w = []
    for r, (g, rt, rs, qs) in enumerate(rounds):
        lint({'QS': qs})
        w.append(_w('set', f'rounds/{name}/items', g, {'title': rt, 'sub': rs, 'n': base + r}, out))
        w += [_w('set', f'qs/{name}/items', q['id'], _q(q, g, j), out) for j, q in enumerate(qs)]
    # spec stays JSON text: the db does not keep an object's key order, and K's order is the legend's order
    return w + [_w('set', 'pages', name, {'title': title, 'updated': at, 'spec': json.dumps({**header, 'title': header.get('title', title)}, ensure_ascii=False)}, out)]

def migrate(name, page_doc, page_version, out, at=None):
    """Move an older page's GROUPS and QS into docs, keeping their order; the page keeps only its header."""
    sp = page_doc['spec']; sp = json.loads(sp) if isinstance(sp, str) else dict(sp)
    groups, qs = sp.pop('GROUPS', []), sp.pop('QS', [])
    known = {g[0] for g in groups}
    w = [_w('set', f'rounds/{name}/items', str(g[0]), {'title': g[1], 'sub': g[2] if len(g) > 2 else '', 'n': n}, out) for n, g in enumerate(groups)]
    w += [_w('set', f'qs/{name}/items', q['id'], _q(q, q.get('g'), i), out) for i, q in enumerate(qs)]
    if any(q.get('g') not in known for q in qs): print('note: some questions have no round; they show last, as before')
    # keep `updated` as it was: moving changes nothing the owner can see, so it must not mark answers read
    return w + [_w('set', 'pages', name, {'title': page_doc.get('title', sp.get('title')), 'updated': page_doc['updated'], 'spec': json.dumps(sp, ensure_ascii=False)}, out, page_version)]

def chunks(w, n=50):
    return [w[i:i + n] for i in range(0, len(w), n)]

def print_writes(w):
    for c in chunks(w): print(json.dumps(c, ensure_ascii=False))
