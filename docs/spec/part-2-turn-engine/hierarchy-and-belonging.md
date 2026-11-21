### Hierarchy and belonging

**Decided, step 1 of 4 partly built (D-1768).** Built (BEL-61 step 1, PR for issue #1772): the organization, link and
tie records (`Organization`, `OrgLink`, `Tie` in src/types/core.ts; `GameState.organizations` and `orgLinks`,
`Actor.ties`, `Place.holder` and `law`), the group's new fields on the band (`purpose`, `leaderId`, `officerIds`,
`backer`, `parentId`), the names tables `TIE_STATUS`, `COMMITMENT`, `TIE_COVER` and `LINK_KINDS` (src/scales.ts), the
save keeping all of them, the library table renamed to `castRecipes` (BEL-17), and a recipe's lead and seconds made
its group's leader and officers (BEL-09). Waiting on the owner (Questions hub page "Belonging build"): which
organization each recipe names and what its ties hold (BB1), and ties for one-person roster hooks (BB2). No reader uses
the new records yet, so the band rules in [Information model](information-model.md) are still what the game does, and
where this topic and the code differ the code wins.

Who a character belongs to, whom it serves, whom it works beside right now, who may give it orders, and what each
character knows about the others' ties. Decided by the owner on the Questions hub page "Hierarchy and belonging",
21/11/2026, OB1 a to OB13 a (OB7 read "a. d." with nothing after the d, and the owner confirmed a on a decision
card the same day). The study behind it, with nine worked cases, is the page "Hierarchy and Belonging Study"
(https://claude.ai/artifact/Nn9vfRT7cdEDxSmz3hv6H7). Each rule starts with a stable ID (BEL-nn); a number is never
reused.

No rule here asks "which level". Rules ask about a tie, a seat, a group or a place, so a new kind of body or relation
is new data and never new structure.

#### Words

- **Organization**: any lasting body of people or beasts: a kingdom, a legion, a squad, a guild, a household, a gang,
  a pack. **Unit**: an organization that has a parent.
- **Crew**: an organization marked close-knit. A mark, not a level.
- **Link**: a typed relation between two organizations that is not containment.
- **Tie**: one character's bond to one organization or one person.
- **Seat**: head or officer of an organization or a group. **Title**: plain text on a seat or a tie.
- **Group**: the team for the job at hand. It is today's band, grown (BEL-11).
- **Regard**: how one character personally feels about another. It exists today (overrides, and the regard score of
  D-206) and this topic does not change it.
- "Rank" stays the power rank (Novice to Paragon). Standing inside an organization is a seat, never a rank.
- "Group" in the library today names a spawn recipe; BEL-17 renames that table.

#### What is stored

- **BEL-01** One structure with three parts (OB1 a): organizations that nest to any depth, typed links between
  organizations, and ties from characters. There is no fixed ladder of levels. The five rungs asked about in "Bands
  and groups" (bandmates, group, crew, faction, affiliation) are replaced by these records and by the worked-out
  answers below.
- **BEL-02** An organization holds: a name, a kind word for display (army, guild, pack), a parent, a head, officers,
  a seat (a place), the close-knit mark, hidden goals and temperament, its stances (BEL-16), and its stance toward
  strangers. The kind word never decides a rule and never places a body above or below another. Size and power are
  not levels: a guild and a kingdom are both top-level organizations.
- **BEL-03** B is a unit of A (A is B's parent) only when every member of B is thereby a member of A, and A names
  B's head. The Royal Army is a unit of the Crown. A vassal house is not: it keeps its own head, so it is a link.
  An organization has at most one parent. A body with two masters is a group with two backers or a top-level
  organization with two links, never a unit with two parents.
- **BEL-04** A crew is an organization marked close-knit: its members know each other by name and face. A squad,
  an adventuring party, a gang, a household staff and a wolf pack are crews; a legion is not, its squads are.
- **BEL-05** A link joins two organizations; either end may instead be one powerful person, so land held "under the
  Great" (TL7 c) needs no special case. A link holds its two ends, its kind, the default stance it implies, and a
  cover (BEL-10). Kinds to start with: ally, vassal of, hired by, registered with, rival, at war, owns, secret pact.
  A new kind is a new row.
- **BEL-06** Each character holds a short ordered list of ties, any number of them (OB3 a). A tie points at one
  organization or one person and holds a status (BEL-07), a commitment (BEL-08), a cover (BEL-10), a title, and
  since and until dates. The order of the list says which tie comes first when two of equal commitment clash
  (BEL-42). Membership, employment and allegiance are one record: for most people they are the same fact, and an
  exception changes one field.
- **BEL-07** Status, a names table so a row can be added: member; hired; associate (registered, a guest, a lay
  follower); supporter (backs it with no standing in it).
- **BEL-08** Commitment, a names table, lowest first (OB4 a): feigned; bound (by pay, fear or a spell); sworn;
  devoted. Nobody but the character can ever see a commitment: no view, check or agent prompt gives one character
  another's. A bound tie ends with what holds it: the pay, the threat, the spell.
- **BEL-09** Seats (OB8 a): an organization has a head, officers and members; a group has a leader, officers and
  members. A title is plain text for display and speech only. Seniority is the tie's since date. There is no rank
  ladder: command comes from the seat held over someone (BEL-30), never from a title. A recipe's lead, seconds and
  followers (NF7 a) are leader, officers and members.
- **BEL-10** Cover, on every tie and every link (OB9 a): open (shown: livery, a known face), quiet (known to fellow
  members and to anyone told), secret (known only to those who learned it).
- **BEL-11** The band is the group (OB2 a). The band record gains a purpose, a leader, officers, a backer (whom it
  works for) and a parent group, and keeps its fields of today: this job's hidden goals, lethal, the chase range and
  its stances for this job. Lasting belonging is new and sits beside it, in organizations and ties. Members keep
  every tie while in a group. Until a reader is moved (BEL-50 to BEL-55) it reads the band as it does today, so
  every band of today is already a valid group. This replaces GQ6 (the band record becomes the crew) and rewords
  GQ1 a: members keep their ties, not their band.
- **BEL-12** A character is directly in one group, and a group can sit inside a bigger group; the groups above it
  come along (OB5 a). This replaces "at most one group" in GQ1 a. Two unrelated jobs at once are not held: a covert
  job run inside another rides on ties and hidden plans.
- **BEL-13** A group starts from a recipe or the Weaver (GQ2 b, unchanged). It lasts while its purpose stands,
  however far apart its members are. It ends when the purpose is met or dropped, when its leader or backer ends it,
  or when its last member leaves. A member leaves by release, desertion or death. Forming and leaving a group in
  play stays parked (D-202).
- **BEL-14** A group's leader has authority only inside the group's purpose (BEL-30). A group can hold people from
  many organizations.
- **BEL-15** Places and organizations stay apart. Three stored facts connect them (OB11 a): the seat of an
  organization (its home place), the holder of a place, and whose law runs in a place. The holder and the law-giver
  may each be an organization or one person. Where a character is, and where its group is posted, are worked out.
  A soldier posted to a castle is not in its garrison.
- **BEL-16** Stances between organizations (OB10 a): an entry is stored only where it differs from neutral, on any
  organization, toward another organization or a person. A unit inherits its parent's entries, and the nearest
  entry wins, so one squad can differ from its army and two units of one body can be at war. A group holds only the
  stances of its own job. No full table of pairs is stored, and nothing is copied onto members.
- **BEL-17** Recipes, organizations and groups are three things (OB12 a). A recipe is library data that makes
  people. It spawns its people as one group and may name the organization they belong to; code finds that
  organization at the site or makes it, and gives each spawned person a tie. The library table "groups" is renamed
  "cast recipes".

#### What each character knows

- **BEL-20** Every worked-out answer below takes a viewer and uses only the ties and links that viewer knows
  (OB9 a). A character knows all of its own ties. An open tie is known to anyone who perceives the character; a
  quiet tie to fellow members and anyone told; a secret tie only to those who learned it, through the knowledge and
  secret rules that exist today.
- **BEL-21** A character judges others by the ties it knows them to have, and itself by all of its own. Until
  someone learns an infiltrator's secret tie, every reaction to them reads the livery they wear.
- **BEL-22** The player holds no stances and no beliefs. The world reads the ties the player shows and judges what
  the player does; no rule needs the player's commitment.

#### Worked out, never stored

- **BEL-25** Default attitude of A toward B. The first step with an answer wins:
  1. A's personal regard for B.
  2. The fight's own state (truce, yielded, spar), as today.
  3. A's group and the groups above it: what this job says about B or B's organizations.
  4. A's ties, highest commitment first, then list order: what each organization says about B or the organizations
     A knows B to be in, the nearest unit with an entry winning. Same crew is friendly.
  5. The stance toward strangers of A's first organization. Neutral unless set.
  Fighting by duty therefore leaves no grudge: when a hired guard leaves the group, the entry is gone, and only
  regard that someone earned remains.
- **BEL-26** Who is with you (OB6 a): your group, your side in the current fight, and whoever follows you. Each is
  read from what exists (the group, each fighter's engagement, the follow routine); no activity record is stored.
  A rule names which of the three it reads. "Together" (YD7: each perceives the other now) stays the test for deals
  made on the spot.
- **BEL-27** A fight's sides are read from the fighters' engagements: your side is everyone fighting your foes who
  is not your foe. A passer-by who joins the fight is on your side without joining your group.
- **BEL-28** Reporting lines, workplace and home posting are worked out: a character reports to the head of every
  organization and the leader of every group it is in, one line per capacity; its workplace is its group's place;
  its home base is its organization's seat.
- **BEL-29** When a head or leader falls, the seat passes to an officer, then to the longest-serving member present.
  A title without a seat gives no claim.

#### Orders

- **BEL-30** A right to give an order rests on one of four bases, and reaches only as far as that basis:
  - **Command**: the giver holds a seat in an organization the receiver belongs to, in the receiver's unit or above
    it. Scope: that organization's own business.
  - **Lead**: the giver leads, or is an officer of, a group the receiver is in. Scope: the group's purpose.
  - **Link**: a link gives the giver's organization direction over the receiver's (liege over vassal, client over a
    hired company). Scope: the link's kind. It runs from seat to seat: the king orders the lord, not the lord's
    cook.
  - **Ground**: the giver acts for whoever holds the place or whose law runs there. Scope: conduct in that place.
    It reaches everyone standing there.
- **BEL-31** Influence (a trusted friend, a famous name) and force (a captor, a monster over its thralls) are not
  bases. Influence works through regard and the speech contests of today. Force holds a bound tie only while the
  threat is present.
- **BEL-32** The order check, in this order:
  1. Heard: the order reached the receiver, by today's speech and hearing rules.
  2. Basis: the strongest basis the receiver believes the giver holds (BEL-20). A stranger in a captain's cloak has
     a basis only for those he fools.
  3. Scope: the order is of a kind that basis covers, the group still exists, and the giver still holds the seat.
  4. Clash: it does not go against a tie the receiver holds with a higher commitment, or against a standing order
     from a stronger basis (BEL-40 to BEL-46).
  5. Will: commitment to the body behind the order, morale, danger, regard for the giver, and the power of each.
  Steps 1 to 4 are the right to be obeyed; step 5 is control. A rightful captain can fail step 5, and someone with
  no basis can still be followed, by influence or force.
- **BEL-33** Four verdicts: obeys; obeys the letter (does the least that counts); refuses openly; pretends (seems to
  obey and does otherwise). Only a feigned tie, or a secret tie of higher commitment, leads to pretends.
- **BEL-34** Who decides (OB7 a): code works out the basis, the scope, any clash and the verdict. A code-run
  character follows the verdict. An agent-run character is told the verdict and chooses, and can never claim a
  right it lacks. Checking scope needs each order sorted into a small set of kinds, as the Parser sorts intents.
- **BEL-35** Lead against command: the group's leader decides how the job in front of you is done; the home
  organization decides whether you stay on it, and can recall you. The law of the place can stop either, unless a
  link exempts the receiver's organization.

#### When ties clash

Applied in this order.

- **BEL-40** Regard decides how a character treats a person. Commitment decides whose order it follows and whose
  side it takes.
- **BEL-41** The higher commitment wins: devoted over sworn, sworn over bound, bound over feigned.
- **BEL-42** At equal commitment the tie listed first wins, and the character holds back against the other: it
  will not strike first.
- **BEL-43** Lead against command is BEL-35.
- **BEL-44** A feigned tie is acted out until a real tie has something at stake. Then the real one wins, in secret
  if it can.
- **BEL-45** Others are judged by the ties one knows them to have (BEL-21).
- **BEL-46** A bound tie ends with what holds it (BEL-08).

#### What moves from the band, reader by reader

Each reader keeps reading the band until its own change moves it (BEL-11). "Crew" below means the crews a character
has a tie to, as the viewer knows them.

- **BEL-50** Stay on the group, unchanged: yield among those together (YD2, YD7); offers among those who heard
  (TF6); one spokesperson per group, and calm members taking its routine; lethal and the chase range; the "band out"
  scenario ending; the trip taking followers only (D-202 b); your side at a scenario's end (BG-1508); sleep watches
  (NW15); a follower copying your posture; health and morale shown for your own (YB2); addressing a group in speech.
- **BEL-51** Read "group or crew": seeing one of yours attacked turns you hostile (RS6), and engagement with the
  attacker spreading; fear when one goes down or breaks (MB23); the wake shout (NW21); witnesses ignoring their own
  (filching, drawing steel, a guard's suspicion, hunches, coming near, a readied "anyone"); a stealthy ally not
  hidden from you; warnings to allies (D-51 b); Battle Cry, Fall Back On Me and the first-sight quirk, which also
  read the fight's side.
- **BEL-52** Read the fight's side (BEL-27): the Planner's "own side" (NV1 b); backing off toward, or drawing a
  foe toward, a free ally (B4, S1); a feigned flight not fooling its own, which reads the side and the group.
- **BEL-53** Move to the lasting records: "same band is friendly" and band relations as the default stance split in
  two, what lasts going to organizations and links (BEL-16) and this job's own staying on the group; knowing each
  other's names goes to the crew, and a group's members are introduced when it forms; hidden goals and temperament
  split into an organization's lasting aims and a group's purpose.
- **BEL-54** Becomes the order check: Command lifting a fight rule when orders are heard from a bandmate (TC7)
  reads an order from someone who holds a basis over you (BEL-30).
- **BEL-55** Not designed here: the Weaver's stage plan naming organizations; an organization's lasting stance
  toward the player; faction clocks (D-13, parked).

#### Build order

- **BEL-60** The foundation is five pieces: the organization record; the tie list on each character; the group
  (the band with a leader, purpose, parent and backer); four helpers (default attitude, who is with you, the
  fight's sides, who may order whom); and the knowledge rule (BEL-20) in every helper.
- **BEL-61** Steps, each leaving the game working:
  1. The records exist and are filled by recipes and rosters. Every reader still uses the band. No behaviour
     changes.
  2. Default attitude reads organizations under the group (BEL-25).
  3. Readers move one at a time (BEL-51 to BEL-53), each with its own evidence.
  4. The order check replaces "heard from a bandmate" for Command (BEL-54), then covers NPC obedience.
- **BEL-62** Kept out on purpose: a rank ladder across organizations; a loyalty number on each tie; stored
  reporting lines; a full table of every organization's stance toward every other; copies of an organization's
  stances on its members; a generic activity record; separate records for employment, workplace and assignment;
  levels decided by the kind of organization.
- **BEL-63** Not covered by OB1 to OB13, each a question of its own before it is built: terms on a link (what a
  contract or an oath asks, and when it lapses); named offices with their own charge; law by matter, and an owner
  apart from a holder; signs of a tie on gear, and so disguise; commitment that shifts with events; orders carried
  by a messenger or forged; beliefs about who holds a disputed seat; the living world changing links and stances
  between scenarios (D-13).

#### On the power ladder

- At 50 and 75, organizations outweigh people: no professional or record-holder stands against a watch or a
  company, so the chain of command is what moves the world.
- From 100 up, one person can rival an organization. Either end of a link, the holder of a place and the law of a
  place can each be a person (BEL-05, BEL-15).
- Flagged for 150, 200 and up: the will step (BEL-32, step 5) must read power, or a far stronger "subordinate" would
  obey a clerk. The commitment scale is not a power measure and needs no rows past devoted.
- Titles, cover and links are for peoples. Beasts use head, crew, group and territory only.
- Any number this design comes to need (how much a crew-mate's fall costs against a job-mate's, when a bound
  fighter quits) is a named setting in config when it is built.

#### Earlier answers this changes

- GQ6 (the band record becomes the crew): replaced by OB2 a (BEL-11).
- GQ1 a: "members keep their own band" becomes "members keep their ties", and "at most one group at a time" becomes
  one direct group with groups nesting (OB2 a, OB5 a; BEL-11, BEL-12). The rest of GQ1 a stands: a group has a
  leader and one purpose and is kept in the save while it lasts; a recipe's people are one group from the moment
  they spawn; your companions are your group.
- GQ3 (bandmate, group, crew as rising levels): crew is a mark on an organization (BEL-04), the group is the
  current team (BEL-11), and "bandmate" is one of the three readings of who is with you (BEL-26).
- GQ9, GQ10 and GQ12 to GQ15, open on "Bands and groups": withdrawn (OB13 a). GQ9 and GQ10 became the reader list
  above; OB1, OB3, OB6 and OB10 answer what GQ12 to GQ15 asked.
- Unchanged: GQ2 b (only recipes and the Weaver form and break groups), D-202 b (the trip is follow-only), NF7 a
  (larger groups with one notable head).
- The kind word never changes a rule (BEL-02), so whether a land has an order or a church with power is lore
  (TL15 a) and is not decided here.
