# Questions hub

The tooling behind the owner's Questions hub: the one page where the owner reads and answers every list of questions.
This file says what the hub is, how a Claude thread writes to it, and what an agent that cannot reach it needs to
build to offer the owner something similar.

## What the hub is

One private web page (a claude.ai artifact) with a small document database behind it. Its home screen lists every
questionnaire, newest change first, with open ones apart from completed ones. Opening a questionnaire shows numbered
questions in rounds. Each question has:

- an ID (`RH3`), a kind pill, and a title;
- a body of short labelled colour blocks (Today, Problem, Proposal, Formula, Example), never a wall of text;
- lettered options and the agent's recommendation with its reason;
- one answer box. Clicking an option adds its letter ("b.") to the box; the owner can type anything after it.

Answers save by themselves as the owner types. A Submit button copies one line for the owner to send to the agent
("I answered RH1, RH2 in "Title". Please read and act."). When the agent has read an answer and acted on it, it marks
the question done with a one-line result, and the hub shows "Read by Claude" on that answer. A questionnaire moves to
Completed only when every answer has been read.

Why it exists: the owner answers many design questions a day, so questions must be in one place, never scattered
through chat, and each one must be answerable in a few seconds.

## Where the data lives

Since 20/11/2026 the documents live in one Supabase table that both of the owner's Claude accounts write to, so either
account's hub page shows every new questionnaire. The table is `hub_docs` (`path` text key, `data` jsonb, `updated_at`)
in the Supabase project named `questions-hub`, reached through the Supabase connector: `list_projects` gives the
project's id, `execute_sql` reads and writes. Supabase's public roles have no access to the table.

- The page reads the table through the viewer's Supabase connector, and also its own database, where questionnaires
  written before the move still live. The home list shows both. Each questionnaire's rounds, questions and answers stay
  in the store that holds its page, so a thread keeps reading and writing where it started.
- While the page's own database still holds questionnaires the table lacks, the home list shows a button, "Move N
  older questionnaires to the shared table". Pressing it copies each of them whole (page, rounds, questions, answers)
  into Supabase, never over a row that is already there, and leaves the own copies in place. From then on the page
  reads and writes those questionnaires in Supabase, so the thread that pressed for the move checks the counts and
  then deletes the own copies. The button exists because a thread can only send SQL by writing it out, which does not
  work for megabytes of old questionnaires; the page reads both stores directly.
- Each connector call is a slow round trip, so the page sends the reads it needs at the same moment as one query, and
  the home list also checks the names of all questionnaires, so one copied in with an older `updated` still shows.
- New questionnaires go to Supabase only. Supabase cannot push changes, so an open page reads what it watches again
  every 20 seconds.
- A red line at the bottom left means Supabase could not be reached, for example because the free project paused after
  a week without use. The page then shows only its own database. Opening the project in the Supabase dashboard
  restores it.

## If you cannot write to the hub

The hub's database takes writes only from Claude sessions signed in to the owner's account. Other agents cannot add a
questionnaire to it. The rule in `docs/instructions.md` section 5 applies: show the owner what you can offer and
agree with them how you will ask. What made the hub work, in order of importance:

1. One place per batch of questions, with a link the owner can reopen.
2. Stable question IDs, with a two-letter prefix per questionnaire, never reused.
3. Options and a recommendation on every question, so most answers are one letter.
4. Long questions broken into the labelled colour blocks above.
5. Answered questions stay visible above the open ones; new ones go at the bottom.
6. A visible mark showing which answers the agent has read and acted on.
7. Nothing scrolls sideways.

`hub.html` here is the whole page: one file, no framework. It talks to its database through the host's small
document API (get, set, list by collection). `checks/mock.js` is a stand-in for that API that keeps everything in
memory, so the page can be opened locally with made-up data. The same seam is where another backend (a JSON file, a
small server) would plug in. Reusing the page elsewhere is a piece of work of its own: answers need somewhere to be
saved, and the read mark's wording names Claude. A plain numbered list that keeps the seven points above is a fair
start; the owner decides with you.

## Files

- `hub.html`: the page. The published copy also carries fonts and a background image under `kit/`: the same files
  as `src/ui/assets/` (`docs/assets.md`). Opened locally without them, the page falls back to system fonts.
- `blocks.py`: helpers that build a question's body, plus `lint()`, which refuses a wall of text.
- `hubdb.py`: builds the small database writes for a new questionnaire, a new round, or marking questions done.
- `checks/stores.mjs`: checks that the page shows both stores, writes each questionnaire to its own, and copies older
  questionnaires whole (run with Node).
- `checks/render.cjs`: draws one questionnaire with the local `hub.html` and saves a picture (needs Playwright).
- `checks/livecheck.cjs`, `checks/test.cjs`, `checks/mkseeds.py`: regression checks from the move to small documents.
  They compare against an older copy of the page and saved real questionnaires, which are kept only in the Claude
  project's shared folder, so they run only there.

## Data layout

A questionnaire named `<name>` is split into small documents, so a new round or a question marked done never
re-saves the whole page:

- `pages/<name>` = `{title, updated, spec}`. `spec` is JSON text holding only the header: `title`, `intro` (a list of
  plain-text paragraphs; HTML is escaped), `K` (the kinds: `{kind: {name, meaning, k}}`, in legend order), optional
  `NOTE`, optional `sections`, `rules` (`{title, intro, lead}`), optional `css`. It stays text because the database
  does not keep key order.
- `rounds/<name>/items/<g>` = `{title, sub, n}`: one per round. Rounds show in `n` order.
- `qs/<name>/items/<ID>` = one question: `k` (kind), `g` (round), `title`, `body` (or a short `ctx`), `o` (options),
  `rec`, `f` (the one-line form used in the answers summary), `i` (order), and later `done`, `reask` or `withdrawn`.
- `answers/<name>/items/<ID>` = `{text, at, auto}`: written by the page when the owner types.
- `hub/index`: the home list's cache. The page writes it; agents never do.

Older questionnaires keep their rounds and questions inside `spec`. A `qs` document with the same ID is laid over
that entry. Never move a questionnaire back into one large `spec`.

## Writing to the hub (Claude threads)

Run from the repo root. Each function writes its documents as files under the folder you give it (`OUT` below: any
scratch folder outside the repo) and returns the list for one database batch call (at most 50 writes; `chunks()`
splits longer lists). "ArtifactData" in the helpers' comments is the Claude tool that reads and writes an
artifact's database; the batch call is made with it.

For a questionnaire in Supabase (every new one), print `sql(w)` instead of `print_writes(w)` and run the result with the
Supabase connector's `execute_sql` on the project named `questions-hub`. Supabase keeps no versions: give `mark()` any
number (e.g. `1`) as each question's version, so the change is merged into the question. With `None`, `sql()` refuses,
because it would replace the whole question.
Current documents: `select path, data from hub_docs where starts_with(path, 'qs/<name>/items/')`.

```python
import sys; sys.path.insert(0, 'tools/questions-hub')
from hubdb import *; from blocks import *

def q(id, kind, kname, title, blocks, o, rec, f):
    d = dict(id=id, k=kind, g='r1', title=title, o=o, rec=rec, f=f)
    d['body'] = head(d, kname) + ''.join(blocks)
    return d

q1 = q('XY1', 'ask', 'Question', 'Short title', [
    blk('today', 'Today', p('What happens now.')),
    blk('prob', 'Problem', p('Why that is not good enough.')),
    blk('prop', 'Proposal', p('<b>a.</b> First option.'), p('<b>b.</b> Second option.')),
], [['a', 'first option'], ['b', 'second option'], ['c', 'something else: say what']],
   'a. One sentence of reason.', 'XY1: first option')

header = dict(title='Page title', intro=['Plain text paragraph.'],
              K={'ask': {'name': 'Question', 'meaning': 'needs an answer', 'k': 'var(--accent)'}},
              rules={'title': 'Answers, ready to paste', 'intro': '', 'lead': ''})
print_writes(new_page('page-name', header['title'], header, [('r1', 'Round 1', 'what it asks', [q1])], OUT))
```

- **New questionnaire:** `new_page(name, title, header, [(g, title, sub, [questions])], OUT)`.
- **New round:** `new_round(name, page_version, g, title, sub, [questions], OUT)`. It takes its place from the write
  time, so it lands last, and runs `lint()`.
- **Mark done, re-ask, withdraw:** `mark(name, page_version, {ID: (doc_version or None, fields)}, OUT)`. A field set to
  `None` is removed. Version `None` is for a question that still lives inside an older page's `spec`.
- Every write also updates the page's `updated` time in the same batch. The home list and the read mark depend on it.
- Read the current versions first: get `pages/<name>` and list `qs/<name>/items`.
- Before writing, draw the page and look at it: `node tools/questions-hub/checks/render.cjs <page.json> <out.png> 1440`.
  `<page.json>` is the questionnaire as one document, `{"title", "updated", "spec"}`, where `spec` is JSON text of
  the header plus `GROUPS` (`[[g, title, sub], ...]`) and `QS` (the list of questions): the older one-document
  shape, which the page still draws.
- Then give the owner the hub link and the questionnaire's title.

## Reading answers

- In Supabase: `select path, data from hub_docs where starts_with(path, 'answers/<name>/items/')`. A questionnaire
  written into a hub's own database before 20/11/2026 is still read there.
- Answers are in `answers/<name>/items`. Act only on what the owner wrote.
- After acting on an answer, mark its question `done` with a one-line result. The page shows the read mark only when
  the page's `updated` is later than the answer's time.
- To ask a question again, set `reask` to the time of that same write (an ISO time, never `true`, never a later
  time). The earlier answer is kept as the previous one.
- New questions always go in a new round at the bottom. Answered ones show first, in the order asked.

## Publishing a new hub

A hub belongs to one Claude account. A session on another account cannot save to it or reach its database, so
that account publishes its own hub, as a new private page. Never pass an existing hub's link when you do.

- Page: `tools/questions-hub/hub.html`. The publish refuses a page that does not begin with `<!DOCTYPE html>`, so
  keep that first line.
- Files beside it, under `kit/`: `HISABRound-Regular.woff2`, `HISABRound-Bold.woff2`, `HISABRound-ExtraBold.woff2`,
  `Literata-Regular.woff2` and `night-sky.webp`, all from `src/ui/assets/`.
- Database rules, declared at the first publish: `pages`, `rounds` and `qs` are read at `view` and written at
  `admin`. Answers keep the default rule.

```json
{"db": {"rules": [{"path": "pages", "read": "view", "write": "admin"},
                  {"path": "rounds", "read": "view", "write": "admin"},
                  {"path": "qs", "read": "view", "write": "admin"}]},
 "mcp": {"servers": [{"server": "Supabase", "tools": ["list_projects", "execute_sql"]}]}}
```

- The viewer's account needs the Supabase connector, allowed for the organization that holds `questions-hub`. The
  first open asks to let the page use it. A hub published before 20/11/2026 needs this declaration and a republish of
  today's `hub.html` to show the shared questionnaires.
- A new hub starts empty. Write its first questionnaire with `new_page` (above), then give the owner the link.
- In the same thread, record the new hub's link in `docs/providers/claude.md`, "Every thread", beside the hub links
  already there. It opens only for the owner.

## Changing the page itself

Only a change to the hub's own layout needs a new publish. Several threads edit it: read the live page first, keep
`hub.html` here in step with it, and publish from this file. Never paste fonts or images into the page as base64.
