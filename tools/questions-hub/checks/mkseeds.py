import json, sys, glob, os, shutil
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from hubdb import *
D = '../db/pages/'
def load(w):  # apply a writes list to a dict store like the server would
    st = {}
    for x in w:
        data = json.load(open(x['file_path'])); p = x['collection'] + '/' + x['doc_id']
        if x['op'] == 'set': st[p] = data
        else: st.setdefault(p, {}); st[p].update({k: v for k, v in data.items() if not (isinstance(v, dict) and v.get('__delete__'))}); [st[p].pop(k, None) for k, v in data.items() if isinstance(v, dict) and v.get('__delete__')]
    return st
out = {}
for n in ['open-parked-items', 'missing-20-and-40-perks', 'lying-and-guile', 'search-by-sound']:
    doc = json.load(open(D + n + '.json'))
    shutil.rmtree('w', ignore_errors=True)
    mig = load(migrate(n, doc, 7, 'w'))
    out[n] = {'legacy': {'pages/' + n: doc}, 'migrated': mig}
# a new round on the migrated open-parked-items, and marks
n = 'open-parked-items'; shutil.rmtree('w2', ignore_errors=True)
q = lambda i: {'id': i, 'k': 'core', 'title': 'New ' + i, 'ctx': 'Short.', 'o': [['a', 'yes'], ['b', 'no']], 'rec': 'a'}
nr = new_round(n, 8, 'r7', 'Round 7', 'new round', [q('D-40'), q('D-41')], 'w2', at='2026-11-19T03:00:00Z')
out['round7'] = load(nr)
mk = mark(n, 9, {'D-21': (None, {'done': 'a. Done in test.'})}, 'w2', at='2026-11-19T03:05:00Z')
out['markLegacy'] = load(mk)
mk2 = mark(n, 9, {'D-32': (3, {'done': 'b. Done.', 'body': None})}, 'w2', at='2026-11-19T03:06:00Z')
out['markDoc'] = load(mk2)
json.dump(out, open('seeds.json', 'w'))
print({k: len(v) if isinstance(v, dict) else 0 for k, v in out.items()}, len(nr), len(mk))
print(json.dumps(mk2[0])[:300])
