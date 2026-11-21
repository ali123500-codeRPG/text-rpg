### Action time

How long actions take, what a turn is, long actions, initiative, the world clock and timers. Each rule starts with a
stable ID (ACT-nn) that code, tests and reviews cite; a number is never reused. Provenance (owner, date, question IDs,
BG/D numbers) sits in one trailing parenthesis.

#### Scope

- **ACT-10** Settled by Ali 13/11/2026 on the Action Time pages (part one
  https://claude.ai/artifact/X5qfW3RXXFhzV51nbmC9tr, part two https://claude.ai/artifact/7Vzne1WtdZ6DeH77xzfWVg, part
  three https://claude.ai/artifact/Hazzen8xGG66boCGkixaYd; AT1 to AT84).
- **ACT-11** It replaces the slots of the Action economy section above as it is built, in four stages; each rule names
  its stage. Until a stage is built, the Action economy section still describes the code.

#### Units and turns

- **ACT-20** **Seconds and rounds.** Every action has a time in seconds. Short durations are counted in rounds:
  CONFIG.ROUND\_S (3 s, one exchange of blows) is the one lever for them, and anything may be a fraction of a round
  (twice a round is ROUND\_S / 2) (AT35, AT74; stage 1).
- **ACT-21** "Round" is a code ID only: the game never shows it, only the final number of seconds ("slowed for 6 s").
- **ACT-22** Turns are only the player's input. The world lives in time; a turn is when the game stops to ask the player
  (AT13, AT37).
- **ACT-23** A turn lasts as long as the player's order (AT13 c), at least CONFIG.FIGHT\_TURN\_MIN\_S (3 s) and at most
  FIGHT\_TURN\_S (6 s) in a fight; outside a fight at most CONFIG.EXPLORE\_TURN\_S (30 s, Ali 14/11/2026; was 120 s,
  AT46), and an order with no time of its own takes the Action times table's action row (30 s). Unused time carries
  (AT20). Stage 2.
- **ACT-24** **Repeating orders and chains.** An attack or shot order repeats until the turn's time is used, and stops
  early when the target is out of reach after the actor's move has followed it, goes down, yields or is out of sight, or
  when the clock pauses (AT65) (AT78; stage 2).
- **ACT-25** One order can name a short chain ("draw and strike"); the chain fills the turn the same way, a chain that
  ends in an attack repeats it, and what is not started when the turn ends is dropped (AT53; stage 2).
- **ACT-26** Long actions lift the cap: while the player keeps at an action that runs by itself, or a walk, time runs
  until it is done or the clock pauses (AT65) (AT45; stage 3).

#### The Action times table

- **ACT-30** One library table, `actionTimes`: per action, its seconds at a time factor of 1, whether it locks movement
  (AT19), its focus and stop (AT57), its output (AT27), what is left when broken off (AT6, AT28) and an optional speed
  function (D-248). Values are for a skill-50 professional, from real references (the Part Three page cites each; a
  second agent checked them) (AT1, AT11, AT12; stage 1).
- **ACT-31** Blows by class, the same way as shots: unarmed and natural attacks 2 s, light weapons 3 s, medium 4 s,
  heavy 5 s (an improvised strike by its weight class; no lock, reflex; once one 3 s row for every blow).
- **ACT-32** Throw 3 s (locks, reflex).
- **ACT-33** One shot time per weapon class, all Hard: light bows 3 s, medium bows 4 s, crossbows 5 s (locks, steady)
  (TP9 a; once light bow 5 s, medium bow 6 s, crossbow 2 s Light).
- **ACT-34** A crossbow's spanning is a row of its own that is instant for every crossbow (TP6 f, TP8 a: once light 4 s,
  stirrup 8 s, heavy 28 s all-out).
- **ACT-35** Battle Cry 1 s; plain talk instant in a fight (TP6 c, TK6), and a turn of it outside a fight 3 s like skill
  speech (the world moves on while you talk); persuading, lying or threatening 3 s however long the words (TK1 c, the
  Speech row); barks stay free (AE7).
- **ACT-36** Draw, stow, swap, pick up and hand over: instant, base effort (less realism, TP6 a: once 1 to 4 s).
- **ACT-37** A door open or close, a bar, a key: instant, and the walk goes on (TP6 b: once 1 to 4 s and you stopped at
  the door); pick a lock 30 s (TP5; locks, careful, kept when broken).
- **ACT-38** Bandage 20 s (TP5; locks, careful, lost when broken, the bandage not used up); drink a potion 3 s (lost);
  hide 2 s (locks); look around 3 s (steady).
- **ACT-39** Rest 60 min (locks, deep, share), sleep the night (careful, stop never, steps), wait until the time named
  (deep); trade takes no time, and a turn that only trades takes none either (once 3 s, and before that 10 min, TP5).
- **ACT-40** Armour on and off: instant at base effort, every weight (less realism, Ali 14/11/2026; once light 2 min,
  medium 1 min, heavy 10 min with help and twice that alone).
- **ACT-41** Perk moves name their own time (the speech perks take talking time, Dirt in the Eyes a throw's 3 s).

#### Time factor

- **ACT-50** An action's seconds for an actor = the row's seconds × that actor's time factor (1 for everyone for now)
  (AT22).
- **ACT-51** The time factor is the backbone for D-248: a row may name a speed function whose effective skill halves its
  time every N points above 50 and slows it the same way below (N a lever on the row).
- **ACT-52** Picking a lock is the first row on it: its speed function is Lockpicking (rolled by Filching, D-89 RP20) with N = PICK\_HALVING\_PER (25),
  the BA2 rule it always had.
- **ACT-53** Which rows name one, and what else feeds the factor, waits for the speed skills (D-248).
- **ACT-54** Healing draught: it gets a healing row: 25% of health and parts up to Damaged, any time, 3 s (placeholder)
  (AT10).

#### Spending time

- **ACT-60** Movement locks: each action locks movement or not; a locking action takes the same seconds from move time
  as from main time. Shoot and Move (B4, banked) becomes "your shots don't lock movement" (AT19; stage 2).
- **ACT-61** Leftover: the time left after the actor's last finished action carries, each pool on its own, for
  CONFIG.CARRY\_TURNS turns (2): carried time is spent oldest first and what is left of it carries on until it is too
  old; each pool holds at most CARRY\_MAX\_TURNS fight turns of it (2, so 12 s; the oldest goes first) (AT20, TP4 b).
- **ACT-62** Held time and a turn where nothing finished carry nothing new (a unit test checks the cap).
- **ACT-63** **Time back:** an action that could not happen (all the actor did with it was a wasted event because its
  target or thing was gone, dead, down or out of reach, or no room: resolve.ts STALE\_REASONS) spends none of its time:
  its main time, the move time it locked and its clock come back, and the time carries (TP3 a).
- **ACT-64** A miss, a failed roll, a refusal, a yield or a truce keeps its cost; the walk before it stays walked. For
  an NPC the TP2 swap uses the time this turn.
- **ACT-65** Reach this turn: whatever asks how far an actor's move reaches this fight turn counts its carried move
  time, as the engine walks it (engine/speed.ts turnMetres): who an NPC can strike this turn (BG-306), the tactics
  view's zones within one move (TC18) and the Gang up, Feigned flight and Play Dead rows, where the player's words are
  heard from (BG-84), and the minimap ring and dash (MAP-83) (CU3 a, Ali, Questions hub page "Cutting test and tooling
  overhead", 20/11/2026).
- **ACT-66** A walk planned over later turns counts plain turns.
- **ACT-67** Fast fighters: time decides how many blows fit; AE4 goes (AT21).
- **ACT-68** Flurry: every unarmed strike its owner throws brings one free strike at the same target at once, costing no
  time and no action, one tier less sure; the free strike can't trigger Flurry again but triggers every other perk a
  strike does, and a free punch from another perk (One-Two) does trigger Flurry. Flurry and One-Two name Grip parts, not
  hands (AT79).
- **ACT-69** Order inside a turn: actions resolve in the order they finish; the fight's initiative roll breaks ties
  (AT48).

#### Walks carry on

- **ACT-80** A walk not yet at its goal carries on next turn by itself until the actor orders something else; a dash
  runs for the turn's seconds (AT49).
- **ACT-81** Built for the player (stage 3d-1): Actor.walking keeps the move; a turn whose intent has no move and no
  action (or only words) carries it on (resolve.ts carryOnWalk), with the action it carries (ACT-334); any other action or a new move ends it; the Parser is
  told (rule 24), and a stop where they stand is a move to their own zone.
- **ACT-82** Outside a fight a walk runs on the world clock to its goal (AT45/AT46, below); in a fight it walks the
  turn's move time and carries on. A way found shut ends it (BG-69). NPCs' walks carrying on wait (they get an order
  each turn).
- **ACT-83** **Following:** a move with spot near someone and follow set (the Parser sets it for "follow him", "tail
  her") keeps after them: reaching them does not end it, and it carries on toward where they are now while the player
  can see or hear them (resolve.ts keepFollowing); a sneak with no move sneaks along a walk (reading choice: sneaking is
  a way of moving) (BG-190).
- **ACT-84** Lost, it ends and the player is told why once, the turn after (Actor.followLost; logged follow\_lost): seen
  going down, slipped from sight in the zone the player had them in, or gone on out of sight.
- **ACT-334** **Walk then act (MQ8):** the player's action on a thing out of reach (a door's way op, picking or breaking
  a lock, breaking through a wall or door, opening, forcing or filching a container, picking something up, Sleep on a
  bed) walks there and is done on arrival, wherever on the map the thing is; never an attack (it runs on, BG-255) and
  never someone. The walk goes to the thing's reach point (FR4: a doorway of the title you stand in, else where the
  thing is), or to the order's own move for a door or wall of another title and for a bed. The walk carries its action
  like a walk (Actor.walking.then, the shape of busy.order with the way op or the pick-ups). Outside a fight it is one
  turn: the turn's move time, then the world clock (ACT-82) to the thing, and the action as the turn's own (a long one
  then runs on the world clock, AT45; Sleep runs its night on the bed). In a fight a thing within this turn's walk (the
  move time, the minimap's walk ring) is walked to and the action done the same turn; one beyond it is dashed toward as a
  plain move dashes (the move time walked, then the main time run, BF91; a lame or Spent walker only walks, AE2, FT10),
  and the action waits for a later turn even when the run gets there; a take still follows BF91 a, picked up where the run
  reaches it, now in any title, also after a dash (MQ20 a, MQ22 a; Ali, 21/11/2026, Questions hub page "Map and minimap: one map, doors"). Stopped on the way (contact, someone closing, a fight), the walk keeps its
  action ("Walking to …, then unlock"); a turn with no move and no action (Keep walking), or one of only words or a sneak,
  finishes the walk and does it; any other order cancels both; a way found shut ends both (BG-69). Within one move
  slot's walk it is done the same turn, as closing in (FR4, BG-86) (MQ15 a / MQ16 a; Ali, 20/11/2026, Questions hub page "Map and minimap: one map, doors").
- **ACT-85** The Parser reads input that only carries on ("continue", "keep following") as a turn with no move and no
  action (rule 24).
- **ACT-86** **On screen:** while following, the action box shows the following line in place of the walk line:
  "Following Bren · in the Upstairs landing · 24 m · 17 s to go" (or "close behind" with no walk left), with Keep
  following ("I keep following Bren") and Stop here.
- **ACT-87** The turn they are lost it reads "Lost Bren · they slipped out of sight in the Upstairs landing" (went down
  in / went on out of sight from), in the warning colour, with Look for them ("I look around for Bren").
- **ACT-88** The chips only fill the box (src/ui/doing.ts followingNow). The fake page's "follow" and "lose" show both.

#### NPCs

- **ACT-90** Same times and rules. An NPC's Planner or code is asked for a new order only when its current action ends
  or the clock pauses for it (AT67); mid-action it carries on (AT16, AT47).
- **ACT-91** Built: an NPC at a long action is asked again once its own coming-near check fires (stage 3d-3, below).

#### Built so far (stage 2)

- **ACT-100** **Pools.** Each actor's turn is seconds of main time and of move time, each the turn's length plus what
  carried (src/engine/resolve.ts slotsOf).
- **ACT-101** A fight turn lasts FIGHT\_TURN\_S for an attack, a hold or a move, else the player's order's seconds
  within FIGHT\_TURN\_MIN\_S to FIGHT\_TURN\_S.
- **ACT-102** Outside a fight a turn lasts as long as the player's order, at most EXPLORE\_TURN\_S (30 s): its walk, its
  way and gear ops and its action's seconds (resolve.ts exploreSeconds; a look around is 3 s); an action with no time of
  its own (a hold, an untimed action), or a turn with nothing timed in it, lasts the default action row (30 s) (stage
  3d-2, AT46).
- **ACT-103** Haggling (barter) is words, so its turn is capped. Longer actions, walks, rests and waits run on the world
  clock instead (AT45).
- **ACT-110** **Costs (orderCost).** A blow, throw or shot takes its row (bows and crossbows name theirs on the item:
  shotTime, and a crossbow's spanTime before each shot); the first of its rows that takes time governs the action's lock,
  focus and effort, so an instant spanning leaves the shot's (BG-340).
- **ACT-111** A bandage, a drink, a hide, a look around, a trade (haggling too) and persuading, lying or threatening
  (the Speech row, 3 s however long the words, TK1 c) take theirs; plain talk takes none in a fight (TP6 c, TK6) and the
  Speech row's time outside one.
- **ACT-112** Gear ops (draw, stow, swap, pick-up, taking out of a sack, a hand-over), armour on or off, doors, bars and
  keys are instant and cost no strain (less realism, Ali 14/11/2026, TP6 a and b: their rows are 0 s at base effort).
- **ACT-113** An order with no row takes all the main time left; one with a row that ends this turn takes what is left
  of it.
- **ACT-114** **Locks.** A shot or throw that reaches from here takes its seconds from the move time first; the move
  walks on what is left (a crossbow's 5 s leaves 1 s of a 6 s turn's walk).
- **ACT-115** **Walking.** A walk pays its seconds from the move time, then from the main time when no action is planned
  (a dash); metres not walked go back as seconds.
- **ACT-120** **Order and repeats.** Pass one runs everyone's order in initiative order; then attack orders repeat in
  the order the next one finishes (initiative breaks ties) while main time lasts and the turn has not ended for the
  actor (a walk first pushes its clock on).
- **ACT-121** Before each repeat, the attacker follows its target on the move time left; it stops once the target is
  down, yields, breaks, is out of reach after following, or the attack came to nothing.
- **ACT-122** Words said in the exchange are that speaker's main action for the turn.
- **ACT-123** **Per round.** Defences (outnumbered after the first) count per round (the round in which the action
  finishes).
- **ACT-124** Counter and a parry's strike-back each come at most STRIKE\_BACK\_LIMIT (1) per round, counted apart;
  Every Answer, Ceaseless Guard and Endless Answer raise or lift it (D-337).
- **ACT-130** **Long actions.** In a fight, an action longer than a whole turn's time (picking a lock; a row over 6 s)
  is a long action (src/engine/resolve.ts longAction): it takes all the time left each turn, the actor is busy
  (Actor.busy: row, seconds done of need) and an event of kind busy says so; it takes effect in the turn its seconds are
  done.
- **ACT-131** The player carries it on by giving the same order again (same row; the same item and target); any other
  order sets it aside.
- **ACT-132** An NPC at one is not asked for a new order (plannerActors skips it, AT47) and carries it on, unless a
  trigger fires for it.
- **ACT-133** An attack aimed at someone at a long action breaks it by the row's focus (careful and deep: any attack;
  steady: a hit that wounds; breakFocus); broken off or set aside, its work is kept when the row's onBreak keeps it at
  that progress (picking a lock), else lost (a bandage: lost, and not used up).
- **ACT-134** Outside a fight the player's action longer than EXPLORE\_TURN\_S (a rest) runs on the world clock at the
  end of the turn (a stretch of kind busy, posed standing) and takes effect when its time is done; one that would be
  refused (no coin, nothing they'd buy) is refused at once instead (resolve.ts wouldGo; buy, sell and equipArmor have a
  dry run) (stage 3d-2, AT45).
- **ACT-135** Stopped on the way, it stays busy with its seconds done and goes on when the player gives the same order
  again, unless its focus is deep (AT65: broken, by its onBreak); the mechanics line names it by its row ("Break through
  a wall or barrier stopped after 2 min: a fight in sight or hearing"; a break keeps its work on the wall, BW13 a).
- **ACT-136** The one the player is at it with (the seller at a trade) talking to them is part of it, not contact.
- **ACT-137** An NPC's long action outside a fight still takes effect at once.
- **ACT-138** Not yet: misfire and fires (no long fight action uses them; a rest's share does, ACT-139); words stay said
  all at once in the turn they are ordered (a long line takes the turn).
- **ACT-139** A rest in a fight is a long action too (deep; broken off, it heals by the share done).
- **ACT-140** **Reaction and hesitation.** In a fight, an actor's initiative is rolled once, when its fight starts (a
  fight turn after a turn without one): its reaction time is ruleset/actionTime.ts reactSeconds, the Action-times
  equation with REACT\_BASE\_S (2 s) at a total of 50, halving every REACT\_HALVING (50) points (Actor.react) (AT58,
  AT60).
- **ACT-141** Its first fight turn starts that many seconds in (main time and walking alike); the roll orders it for the
  rest of the fight.
- **ACT-142** Turn order: the unaware last (as before), then whoever starts first, then the roll.
- **ACT-143** A believed Bluff makes the foe hesitate: its next turn starts after its reaction time again, and the mark
  is spent.
- **ACT-144** Outside a fight the roll is fresh each turn, as before. Never Surprised is unchanged (hearing the attack
  coming, the owner is not caught unaware).
- **ACT-150** **Flurry.** Built in the engine (src/engine/resolve.ts doAttack): every unarmed strike its owner throws
  with two Grip parts working and holding nothing, hit or miss, brings one free strike at the same target at once (no
  time, no action) with tier shift −1; its own free strike never sets it off again, and it triggers every other perk a
  strike does; One-Two's free punch sets it off (AT79).
- **ACT-151** The perk is still banked (Unarmed Strike 100), so no one has it yet. One-Two's condition now names a Grip
  part holding nothing.
- **ACT-152** **Rounds for perks.** Gut Feeling rolls against each hidden watcher at most once every
  HUNCH\_EVERY\_ROUNDS (20) rounds of game time. Timed perk marks (Leg Bolt's slow, Make Them Stumble, Dirt in the Eyes,
  Bluff) last PERK\_MARK\_ROUNDS (2) rounds of game time after the turn they were made (PerkMark.made) (AT74).
- **ACT-153** **Leftover.** A fight turn's finished action leaves its unused seconds (main, and move once the walk
  arrived) to the next turn, minus any carried seconds it did not use; holds, idles, waits, sleeps and rests carry
  nothing. Carried time never passes CARRY\_MAX\_TURNS fight turns (ACT-61; tests/cases/s269).

#### Long actions (stage 2)

- **ACT-160** **Over several turns.** A long action takes effect when its seconds are done; until then the actor is busy
  and it carries on by itself each turn; ordering anything else stops it (if its stop allows) (AT2, AT17).
- **ACT-161** **Focus:** what breaks it from outside, an ordered scale FOCUS: reflex (nothing; too quick), steady (a hit
  that wounds), careful (any attack aimed at the actor, hit or miss), deep (also the coming-near check, AT67) (AT25,
  AT57).
- **ACT-162** Sleep is careful; readying a shot or a grand spell is steady.
- **ACT-163** **Stop:** whether the actor may choose to stop: any (default), never (sleep), or until a share of progress
  (a grand spell: free to stop before 60%, committed after) (AT26, AT57).
- **ACT-164** Only the actor loses the choice; its focus's breaks still break it.
- **ACT-165** **Output:** end (the whole effect when done), share (in proportion), steps (points along the way) (AT27).
- **ACT-166** **When broken off:** bands by progress, each lost (nothing happens, nothing used up), kept (the work
  counts later), share, misfire (names a row of a Misfires table, empty until spells exist) or fires (takes effect as if
  finished) (AT6, AT28).
- **ACT-167** Example: a fire spell 0 to 60% lost, 60 to 90% misfire (explodes in the hand), 90 to 100% fires.
- **ACT-168** In a fight today lost, kept and share occur (share: a rest, ACT-139); misfire and fires wait for rows that
  use them there (talk and spells are never long in a fight; CS5).
- **ACT-169** **Defending while busy.** Defences as normal, unless the action carries a tag that blocks or penalises
  defence; every defence roll gets the same penalties (AT7).
- **ACT-170** **No gates.** Rest, wait, sleep and heal items can always be started; their time and what breaks them are
  the cost. The healing rows' inFight flag is gone (AT8, BG-107; built in stage 3b).
- **ACT-171** Rest keeps its REST\_COOLDOWN\_MIN (the Part Two page kept it).
- **ACT-172** In a fight the clock is already paused, so a wait or a sleep ordered there does nothing ("not while a
  fight is going on around you").

#### Initiative (stage 2)

- **ACT-180** A reaction time, rolled once when a fight starts for the actor: CONFIG.REACT\_BASE\_S (2 s) at a total of
  50, halving every REACT\_HALVING (50) points, times the time factor; the same roll breaks ties for the rest of the
  fight (AT58, AT60).
- **ACT-181** Someone unaware starts only once they notice.
- **ACT-182** "Acts last" (Bluff, Staggering Bolt) becomes hesitating: the target's next action starts only after its
  own reaction delay again.
- **ACT-183** Never Surprised: when the owner hears the attacker coming, its reaction starts when the attack starts, and
  it defends as aware.

#### Per-round limits (stage 2)

- **ACT-190** Counted per round, ROUND\_S the lever: every defence after the first within a round takes the outnumbered
  modifier (AT50, AT51, AT74).
- **ACT-191** Counter and a parry's strike-back come at most STRIKE\_BACK\_LIMIT (1) per round each (D-337).
- **ACT-192** Gut Feeling rolls once every HUNCH\_EVERY\_ROUNDS (20).
- **ACT-193** Perk marks that lasted "the next turn" (Leg Bolt's slow, Make Them Stumble, Dirt in the Eyes) last 2
  rounds.

#### The world clock (stage 3)

- **ACT-200** One loop for every span of time an order covers (a turn, a walk, a rest, a trip, a night) (AT56, AT65 to
  AT71, AT61, AT63, AT66).
- **ACT-201** Inside it the world steps: one round while a fight is going on anywhere; elsewhere everyone catches up
  every WORLD\_STEP\_S (60 s); actors near the player, fighting or hunting are stepped one by one, the rest jump ahead
  as the night does.

#### The coming-near check

- **ACT-210** For every actor, run on what it perceives now, people outside its band only, hostility never used (AT67,
  AT68).
- **ACT-211** It fires at the first of: contact (an attack aimed at it, words to it, a touch, a noise at WAKE\_NOISE or
  louder); closing (someone whose visible path ends at it, or who closes faster than RUSH\_SHARE (1.5) × their kind's
  walk, once their time to reach it is WARN\_S or less); a change (someone already accepted starts closing, readies a
  weapon, or is seen sneaking).
- **ACT-212** Time to reach = (distance − STRIKE\_M) ÷ closing speed; WARN\_S = READY\_S for the posture (lying 3,
  sitting 2, standing 1) + DECIDE\_S (3).
- **ACT-213** Accepted: everyone perceived at the start and everyone listed at a stop the actor carries on past; they
  fire again only on contact or a change, and stop being accepted when out of the senses or more than REARM\_FACTOR (2)
  × their trigger distance away.
- **ACT-214** Seeing a path needs the person made out clearly.
- **ACT-215** Steps are at most half the shortest time anyone perceived needs to trigger, between STEP\_MIN\_S (3) and
  STEP\_MAX\_S (60); noticing is rolled per second. The 60 s cap holds even when nobody is near (NP2 a): longer quiet
  steps, which would notice someone walking in later, were turned down.

#### Pause or break

- **ACT-220** The clock pauses and gives the player the turn on the coming-near check, a fight the player can see or
  hear, and someone seen going down, yielding or running (AT65).
- **ACT-221** The action is broken only if its focus says so; otherwise it carries on (AT17). Deep breaks on any stop
  and on anyone not accepted coming within STRIKE\_M.
- **ACT-222** A companion's words to a resting player pause it but never break it; anyone else's break it (AT69).
- **ACT-223** Sleeping alone gives no warning until the sleeper wakes (AT71).
- **ACT-224** What stops the clock is one rule for everyone (AT70; a player setting is parked as D-246).

#### Nothing hidden

- **ACT-230** Fight turns start only from what the player perceives (attacked, or seeing or hearing a fight or a foe
  closing in); threatHere goes everywhere; asleep, the player notices only what would wake them (AT61).
- **ACT-231** Built so far: fight turns (src/engine/mode.ts fightTurns): an attack on the player this turn, a foe after
  them (relations.ts foesAfter, the same list isEngaged uses) that they can see or hear just being there, or a fight
  between others they can see or hear; a foe after them out of their senses keeps normal turns, even one that traded
  blows with them and went off (BG-189).

#### Stretches, unseen fights and trips

- **ACT-240** **Agent NPCs in a stretch.** Their Planner order covers the first step; then they run on code until the
  clock stops, and their next call is told what happened meanwhile (AT63).
- **ACT-241** Unique NPCs follow their goals on code, not routines.
- **ACT-242** **Unseen fights.** A fight the player can't perceive runs on code rules every step, with no Planner calls
  (AT55).
- **ACT-243** **Trips.** A road trip runs on this clock too (see Travel, Legs) (RE5, built).
- **ACT-244** **Walks off the road** are trips too; their encounter odds are parked (AT24, D-245).
- **ACT-245** **Build notes.** Timers count elapsed time at every step; engaged or hunting NPCs follow their fallback
  orders on coarse steps; scenario endings, leaving the ground, free-roam starts and reach and find quest goals are
  checked at every step, and a scenario break stops the clock; what the player is told is one summary of time spent,
  distance, why it stopped and what they perceived, never anything else (AT66).

#### Finishing a fight far below you

- **ACT-250** A fight is far below the player when each foe of it (yieldHearers) has a power (the defeat XP rating plus
  gear, `power`) of at most CONFIG.OUTCLASS\_EACH (¼) of the player's and all of them together at most
  CONFIG.OUTCLASS\_ALL (1×) of it (*placeholders*); only in fight turns, never while the player's nerve is broken, they
  have yielded or lie at someone's mercy (`farBelow`) (IQ4 a, IQ6 a, IQ7 a; src/engine/finish.ts).
- **ACT-251** While it is, PlayerView.player.finishable is set, the action deck's Fight group offers **Finish the
  fight** (the suggestion may pick it, SUGGEST.finish) and the Parser sets `finish` for words like "finish them off";
  asked for when it is not, the game answers like a clarify (agents/game.ts FINISH\_REFUSED) and no time passes.
- **ACT-252** Any other action plays the turn as usual, so the player accepts or turns it down case by case.
- **ACT-253** Taking it plays the fight in this one turn, a fight turn (round) at a time (`finishFight`): the first
  round takes the turn's own input, Planner outputs included, later rounds run everyone else on code (fallback orders),
  and the player attacks the foe struck last, else the nearest, with what is in hand.
- **ACT-254** Before each round it stops when the fight is over or no longer far below the player; after one it stops
  when the player was hurt, someone new came into their senses, a foe stands outside the fight (yielded, fled, gone from
  sight), the scenario broke or the player fell, or after CONFIG.FINISH\_MAX\_ROUNDS (60).
- **ACT-255** The Narrator gets `fightFinished` (rounds, why it stopped) and tells the whole fight as one passage
  (Narrator rule 33; TL28 a). The road encounters review's Iliad Quest comparison asked for it.

#### The world clock: built so far (stages 3b to 3d-2)

- **ACT-260** The player's rest and wait outside a fight run on the world clock at the end of the turn
  (src/engine/resolve.ts runStretch; the check is src/engine/comingNear.ts).
- **ACT-261** Each step moves the clock on (natural recovery, aging) and everyone on their routines (catchUp), and lasts
  at most half the shortest time anyone perceived and not accepted would need to fire the check at their run speed,
  within STEP\_MIN\_S and STEP\_MAX\_S.
- **ACT-262** It stops on contact (an attack aimed at the player, words to them they hear, a sound at WAKE\_NOISE or
  louder), on the closing and change checks above, or on a fight in the player's senses (mode.ts fightInSenses).
- **ACT-263** The levers are CONFIG.READY\_S per body pose (BODY\_POSES: a rest is spent lying, a wait standing),
  DECIDE\_S, RUSH\_SHARE, REARM\_FACTOR; the strike distance (the page's STRIKE\_M) is hostileNearM:
  HOSTILE\_NEAR\_STEP\_M plus the closer's own melee reach (SZ19, GSM-174; `src/ruleset/gear.ts`).
- **ACT-264** Someone whose path ends at the player is someone tracking, hunting or engaging them.
- **ACT-265** Reading choice: someone newly perceived who does not fire the check is listed (accepted) at once, so steps
  stay long and only a change fires them again.
- **ACT-266** A rest is deep: any stop breaks it and it heals by the share that ran; the mechanics line says "Rest
  stopped after 12 min: someone is coming at you".
- **ACT-267** Stage 3c: NPCs after someone (engaged or hunting, whom catchUp leaves alone) follow their fallback orders
  on code each step of a stretch and of the night (resolve.ts huntOnCode), with no Planner calls: seeing whom they are
  after tells them where that one is; a move or search walks there at a run (a turn's dash); an attack walks up and, in
  reach, strikes as in a turn (doAttack), a blow a round, the steps one round while such a fight is on.
- **ACT-268** A foe that reaches the player strikes no blow in the stretch: it stops (contact) and the next turn is a
  fight; asleep, the night stops when the foe comes into the zone (no warning, AT71).
- **ACT-269** After the first step an agent-run NPC's own order is spent and it runs on code too (AT63).
- **ACT-270** Walks: outside a fight, what of a player's walk the turn's move time left is walked on the world clock at
  a walk, step by step, to its goal (resolve.ts walkStep), stopping like any stretch; stopped on the way it carries on
  (AT49) (stage 3d-1, AT45/AT46).
- **ACT-271** A road trip keeps its own rules (TV1), and a walk through an old map's zone with no rectangle walks the
  turn's move time only.
- **ACT-272** PlayerView.player.walking says where to and the metres and seconds still to go (stage 4);
  PlayerView.player.following {who, name, lost?, zone?} says whom it keeps after, or, the turn after, that they were
  lost and why (BG-190).
- **ACT-273** Stage 3d-2: turns outside a fight last as long as their order (AT46, Pools above) and the player's long
  actions run on the world clock (AT45, Long actions above).
- **ACT-274** The night is one stretch (AT42): it stops on a newcomer hostile to the sleeper or a foe after them
  reaching them (huntOnCode, its blow comes next turn); still asleep after a turn, it runs on with the people already
  there accepted, and the game plays the sleeper's turns until they wake or a turn moves the clock on no further
  (ASLEEP\_AUTO\_TURNS is gone).
- **ACT-275** Stage 3d-3: an NPC at a long action in a fight runs the coming-near check each turn on what it perceives
  (comingNear.ts busyCheck; its watch kept on Actor.busy.watch, started the turn it first runs, standing); when it fires
  (contact, closing, a change) busy.alert is set and logged (busy\_alert), so next turn its own order stands and
  plannerActors asks it, instead of carrying the long action on (AT47); the alert is spent then.
- **ACT-276** An agent-run NPC whose order covered only the first step of a stretch or a night is told how long time ran
  on (Mind.meanwhile, shown as self.meanwhile.minutes on its next Planner call; the Planner instructions say what it
  means); what it perceived meanwhile is in its events (AT63).
- **ACT-277** Reading choice: NPCs outside a fight never hold a long action (theirs take effect at once), so their check
  during a stretch is their code orders (huntOnCode, routines) and does not stop the player's clock.
- **ACT-278** Not yet: the night still steps by SLEEP\_STEP\_MIN with its own arrival rule rather than the coming-near
  check.

#### Sight, unseen blows and impacts

- **ACT-290** **Sight.** Someone sneaking or hidden is noticed only on a won detection roll (sight or hearing function
  against stealth); someone not hiding is seen within their visibility's reach with a clear line of sight, no roll; the
  sight skill doesn't stretch that reach (AT81).
- **ACT-291** **Unseen blows and bodies.** A blow or shot that hurts or downs someone is felt by them and seen by anyone
  who sees them, as a `struck` event by the victim (the hit, the fall or the death; its effects), even when the attack
  itself reached no one because the striker was hidden or unknown: the striker stays hidden exactly as the stealth rolls
  say (src/engine/resolve.ts struckSeen) (BF65).
- **ACT-292** It raises the alarm in the victim and in those who saw it (updateAlarms), and the health, part and
  bandmate fears count it.
- **ACT-293** Someone awake who first sees a body (down or dead) it did not see fall finds it, once per body
  (Mind.bodiesFound): a `found_body` event, alarm, and the bandmate fear when it is one of its own (findBodies, each
  turn's end).
- **ACT-294** Anyone struck unseen, seeing such a blow, or finding a body is startled (Mind.startled): an agent-run one
  gets a Planner call to react even outside a fight (plannerActors).
- **ACT-295** Someone on a sleep step who is awake shows the activity `lie_awake` ("lying awake"), never asleep.
- **ACT-296** **Where a shot lands.** A shot or throw, hit or miss, makes an `impact` event by its target, at the
  target's spot: heard and seen from there, never showing where it came from (BG-251, Ali BF73).
- **ACT-297** It is Loud (88 dB) on armour (the part hit is covered), a shield, or a weapon that parried it, or for a
  miss indoors (a wall, floor or furniture); Raised (70 dB) on flesh or clothing, or for a miss outdoors (earth, grass)
  (CONFIG.IMPACT\_NOISE; real references: chopping wood 66-71 dBA at 5 m and pounding tent stakes 66 dBA at 15.2 m,
  about 80-90 dB at 1 m, 3M Noise Navigator; soft-material impacts peak 20-25 dB below metal, Brüel, so 70 dB on flesh
  is an estimate).
- **ACT-298** It reaches those the shot itself didn't (not the target when the hit was felt); it raises their alarm
  (ALARM\_KINDS, the target's own too) and startles them, so they get a Planner call.
- **ACT-299** A shot or throw is felt by its target only when it meets them (blocked or past): a miss reaches them by
  its impact. Melee makes none: a blow already sounds beside its target.

#### Timers (stage 1)

- **ACT-300** In game time: an engagement ends after ENGAGEMENT\_END = the longest attack or reload time in the Action
  times table + one round, never under ENGAGEMENT\_END\_MIN\_TURNS (3) fight turns (TP10: 18 s today; the slowest cycle
  is a 5 s crossbow shot, 8 s; it was 33 s before the crossbow spans went), with no blow and no closing in (AT72) (AT15,
  AT30 to AT43, AT72 to AT77, AT80, AT83, AT84).
- **ACT-301** A chase is lost after CHASE\_LOST\_S (60 s) (AT31).
- **ACT-302** Belief decay is three levers, tracking to aware after DECAY\_TRACKING\_S (600 s; AT85: a hunter on a trail
  keeps at it longer), aware to suspicious after DECAY\_AWARE\_S (120 s) and suspicious to unaware after
  DECAY\_SUSPICIOUS\_S (900 s) with no new sight or sound, never while hunting or engaged, and only the alertness fades
  (AT73, AT80; an alarm stands down after DECAY\_AWARE\_S with no new alarm).
- **ACT-303** An NPC stays where its own agent put it AGENT\_STAY\_S (180 s) (AT33); a guide waits LEAD\_WAIT\_S (90 s)
  (AT34); an essence offer waits ESSENCE\_OFFER\_ROUNDS (200 rounds, 10 min) or until a new scenario (AT75).
- **ACT-304** Still in turns, since they pace the player's decisions: STALL\_TURNS (never counting a turn in a fight,
  AT76), CHECKIN\_GAP\_TURNS, ROAM\_MIN\_TURNS, Weaver beats (AT39 to AT41), and the bookkeeping counts (AT43).
- **ACT-305** ASLEEP\_AUTO\_TURNS went with the world clock: a night runs as one stretch (AT42; stage 3d-2).
- **ACT-306** **How timers count (built).** Every stamp stays a turn number; the game keeps the clock time each recent
  turn ended (TURN\_ENDS\_KEPT, 500) and a timer reads the game seconds since its stamp (time.ts secondsSince). Tracking
  fades on its own lever, DECAY\_TRACKING\_S (AT85).
- **ACT-310** **Scenario budgets in game time.** Moment 5 min (1 place), situation 15 min (2 places), episode 45 min (4
  places), journey 3 days (8 places), venture 7 days (any number of places), placeholders sized for turns of about 30
  seconds (AT83, AT84; BG-240, SW9 a on the "Scenario event rolls" page, Ali, 15/11/2026).
- **ACT-311** Moment, situation and episode count only **acting time** (actingOnly in CONFIG.SCENARIO\_SCALE): the
  player's waits, rests, nights and trips (a road walked in one turn, a long walk) are noted on the scenario and the one
  it sits in as idle minutes (noteIdle, src/engine/scenarioEnd.ts) and left out.
- **ACT-312** Journey and venture count all game time, being made of travel and nights.
- **ACT-313** Fights count by their real seconds; a long action uses the budget by its real length.
- **ACT-314** A place is one location the Weaver builds (a tavern, a farmstead, a stretch of road), made of zones.

#### What the player sees (stage 4)

- **ACT-320** The Play screen shows what each perceived character is doing: done, or the time left. An active move order
  shows with its goal and time left. Only what the player perceives; seconds and minutes only (AT11a, AT49).
- **ACT-321** **Built so far (engine side).** A long action under way shows in the views as `doing` {what (the Action
  times row's name), done, left (whole seconds)}: on each fully seen actor (SeenActor.doing, in the PlayerView and NPC
  views) and on the player (PlayerView.player.doing; src/engine/busy.ts doingOf). The Parser is told (rule 23) that the
  same action again carries it on.
- **ACT-322** The active move order waits for walks that carry on (AT49, stage 3).
- **ACT-323** **Built (screen side).** Who's here: each fully seen person at a long action gets a teal chip with a small
  meter of the share done and "pick a lock · 20 s left".
- **ACT-324** The action box: the player's own long action shows above the chips ("Bandage · 15 s done · 25 s to go", a
  meter, and a Keep going chip that fills the box with "I keep going: bandage"; nothing is sent until Send), since only
  the same order again carries it on.
- **ACT-325** Each turn's results: an Actions row of the long actions the player saw (LogLine.actions, built from the
  PlayerView before and after the turn): still going with the time to go, ✓ done, broken off (busy\_broken) or set aside
  (busy\_set\_aside); one whose actor is out of full sight after the turn is left out.
- **ACT-326** Times read "40 s", "2 min", "1 min 30 s" (src/ui/doing.ts secsText); the meter is drawn once and never
  moves by itself.
- **ACT-330** **Built (screen side, AT49).** While PlayerView.player.walking is there, the action box shows the walk
  under the long action, in the accent the map uses for you: "➜ Walking to village square · 24 m · 17 s to go", the note
  "Carries on next turn while you only talk; any other order stops it.", and two chips that fill the box: Keep walking
  ("I keep walking to village square") and Stop here ("I stop and wait here"); nothing is sent until Send. A walk that
  carries an action (ACT-334) names it and measures to the thing: "➜ Walking to the bed, then sleep · 24 m · 17 s to go"
  (WalkingView.then, the action's deck name, a way op by its own word), and the deck's Keep walking reads "Keep walking
  to the bed, then sleep". A walk to a door names the door, never the way's label: its kind (the barrier on it, else a
  doorway's door) and, once the player knows the title it leads into (Journal.zonesSeen), that title: "Walking to the
  door to the common room, then unlock", "Walking to the gate, then unlock"; into a title not yet seen it is just "the door"
  (views walkingOf, doorName; MAP-40) (MQ21 b, MQ23 a;
  Ali, 21/11/2026, Questions hub page "Map and minimap: one map, doors").
- **ACT-331** A goal with no open way reads "no open way there" (src/ui/doing.ts walkLeft).
- **ACT-332** On the Map the goal zone gets a dashed accent outline and "Heading here", and its card says "Heading here
  · 24 m · 17 s to go".
- **ACT-333** The fake page's "walk <zone>" sets a walk; "stop" ends it.
