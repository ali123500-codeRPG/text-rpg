# Perks: chosen and banked

<!-- Generated from src/library/perks.ts by `npm run perks-doc`. Edit that file, not this one. -->

Ladder perks by skill and milestone (Part 1 §5, Skill ladders), as picked on the 20 milestone page (https://claude.ai/artifact/WkMeSULi8AjSWxeK4jAdwg). Review page: https://claude.ai/artifact/DE4FDK98f9uBy7s9Ce41qn. Perks are coded, so each one states exactly when it applies.

Each perk has two views that must say the same thing. **Story** is what a player reads when choosing. **Rules** is exactly what code applies, and is the basis for building it. The Perks screen in the game switches between them.

**Terms.** *Owner*: the actor who has the perk. *Hits*: an attack whose outcome is grazed, blocked, full hit, heavy hit or crushing hit (not missed or dodged). *Light/medium/heavy melee or ranged mode*: the attack mode's tree and class (Part 5 §5); thrown weapons are ranged. *Gap* and *tier shift*: Part 1 §4 and Part 3, Defense. *Next turn*: until the end of that actor's next turn. *Engagement*: Part 2, Encounter modes (E1). *Move*: an action the owner chooses on its turn.

The 20, 60, 100 and 140 perks change what a character can do. The 40, 80 and 120 perks raise numbers only, with no conditions: +5 true skill in the skill, +1 to every skill of its group, itself included, and one more number. Thievery and slime skills have no perks for now.

## 20 milestone

### Hidden Strike (Light weapons) · A1

*Story:* Too slow. By the time they sense you, it's already over. Any attack you make on someone who hasn't noticed you lands one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes an attack.
- **Conditions:** Any attack. The target is unaware of the owner when the attack resolves (the same test that starts an ambush).
- **Effect:** Tier shift +1 on the attack roll.
- **Lasts:** That attack.

### Turn the Blade (Medium weapons) · A2

*Story:* Their steel meets yours and slides away, and for one heartbeat they are wide open. When you parry a melee attack cleanly with any melee weapon, the attacker is left open: your next melee attack on it lands one outcome better, any time before the fight ends.

- **Kind:** Always on
- **Trigger:** The owner parries a melee attack.
- **Conditions:** The owner parries with any melee weapon held in a working Grip arm (not barehanded). The gap is +2 or better for the owner.
- **Effect:** The attacker is marked as open to the owner. The owner's next melee attack on that attacker gets tier shift +1, and the mark clears.
- **Lasts:** Until it is used or the engagement ends.

### Shield Breaker (Heavy weapons) · A3

*Story:* A shield is a polite request. Your heavy weapon declines. When a foe blocks your heavy weapon with a shield, the shield takes double damage and soon splinters.

- **Kind:** Always on
- **Trigger:** The owner's melee attack is resolved.
- **Conditions:** The attack uses a heavy melee mode (skill Heavy weapons). The defender blocked with a shield, so the hit lands on the shield (location how = shield).
- **Effect:** The shield's pool takes double the damage. Damage to the defender itself is unchanged.
- **Lasts:** That attack.

### Point Blank (Light ranged) · A4

*Story:* Most archers panic when a blade closes in. You just smile: with any ranged weapon you take no penalty for shooting while a hostile is close enough to strike you.

- **Kind:** Always on
- **Trigger:** The owner makes a ranged attack.
- **Conditions:** Any ranged attack, thrown included. A hostile actor is within 2 m of the owner (HOSTILE_NEAR_M).
- **Effect:** The −10 ranged modifier for a hostile close to the shooter is not applied.
- **Lasts:** That attack.

### Hunter's Mark (Medium ranged) · A5

*Story:* The first arrow tastes their blood. The next one already knows the way. After any ranged hit, your next shot at that foe lands one outcome better, as long as it comes in the same fight.

- **Kind:** Always on
- **Trigger:** The owner's ranged attack hits (outcome grazed, blocked, full, heavy or crushing hit).
- **Conditions:** Any ranged attack.
- **Effect:** The target is marked. The owner's next ranged attack on that target gets tier shift +1, and the mark clears.
- **Lasts:** Until it is used or the engagement ends.

### Leg Bolt (Heavy ranged) · A6

*Story:* Prey that cannot run is prey already caught. Your bolts and arrows go for the legs. With a medium or heavy ranged weapon, a shot that wounds a leg hurts it one and a half times as much as usual, and the target is slowed: it can move only one zone link until the end of its next turn.

- **Kind:** Always on
- **Trigger:** The owner's ranged attack hits a part with the Move role (a leg) and deals damage.
- **Conditions:** It is a ranged attack with a medium or heavy ranged mode (skill Medium ranged or Heavy ranged). The location is a part with the Move role. Damage after armor is above 0.
- **Effect:** The leg's pool takes 1.5× the damage the hit puts on the health track. The target is slowed: it can't dash (AE2).
- **Lasts:** The slow lasts until the end of the target's next turn.

### Open-Hand Guard (Strike) · A7

*Story:* Who said you need a weapon to stop one? You catch and turn blows on bare hands and forearms. With empty hands and no weapon or shield, you can still parry. A blow that gets through lands half on your arm and half on your body.

- **Kind:** Always on
- **Trigger:** The owner defends with parry.
- **Conditions:** The owner holds no shield or weapon, and has at least one working Grip arm with an empty hand.
- **Effect:** The owner may parry (parry normally needs a held melee weapon). The parry uses the parry column of the gap ladder, and a parry that earns the free strike back strikes with a fist. A hit that gets through is split: 0.5× of its damage goes to the parrying arm (a working Grip arm with an empty hand) and 0.5× to the general area; both count on the health track. The 0.5 shares are placeholders to test.
- **Lasts:** Each defense.

### Don't Let Go (Grapple) · A8

*Story:* Once you have them, there is no escape. When your grapple lands with a Great Success or better, you lock on. The target is held: it can't leave your zone or use a two-handed weapon until it wins a grapple contest against you (a tie is enough), you go down, or you leave the zone. Anyone can grapple: without the skill, a fighter uses a weapon skill at a fifth of its value, or another unarmed skill at two fifths.

- **Kind:** Always on
- **Trigger:** The owner's grapple attack is resolved.
- **Conditions:** The attack uses skill Grapple. The attack roll is Great Success or better. The attack hits (not missed or dodged).
- **Effect:** The target is held by the owner: it can't leave the owner's zone and can't use a two-handed attack mode. On its turn the held target can try to break free as its move: a grapple contest against the owner, which the target wins on a gap of 0 or better. A held target that tries to leave the zone makes this try instead, and stays in the zone either way. The grapple check uses Grapple at full value, any skill with function arms at 0.2×, or any other skill with function unarmed at 0.4×.
- **Lasts:** Until the target breaks free, the owner is downed, or the owner leaves the zone.

### Dirt in the Eyes (Improvisation) · A9

*Story:* Honor is for those who can afford to lose. A fistful of dirt, a splash of ale, whatever is close. Once per fight, with a free hand and without giving up your action, you throw it in the face of a foe in your zone. It tries to dodge; if it fails, its next roll that needs sight is two outcomes worse.

- **Kind:** Free move
- **Trigger:** The owner uses the move on a foe in the owner's zone. It does not use the owner's action.
- **Conditions:** The owner has a free hand.
- **Effect:** An Improvisation attack roll against the foe's dodge. If the foe does not win, its next roll that needs sight gets tier shift −2.
- **Lasts:** Until that roll is made, or the end of the foe's next turn.
- **Cooldown:** Once per engagement.

### Make Them Stumble (Dodge) · A10

*Story:* They swing at an afterimage and stumble into nothing. Slip a melee blow cleanly and the attacker lurches past you, off balance. Its next defense, before the end of its next turn, is one outcome worse.

- **Kind:** Always on
- **Trigger:** The owner dodges a melee attack.
- **Conditions:** The gap is +2 or better for the owner.
- **Effect:** The attacker's next defense roll gets tier shift −1.
- **Lasts:** Until the end of the attacker's next turn.

### Cover Ally (Block) · A11

*Story:* Not while you still stand. You step in front of a friend. When an arrow or bolt flies at an ally in your zone and your block is better than the ally's own defense, you block it in their place; anything that gets through hits you. It counts as one of your defenses that turn. You can switch it off for any character.

- **Kind:** Always on; can be switched off per character (on by default)
- **Trigger:** A ranged attack targets an actor friendly to the owner in the owner's zone.
- **Conditions:** The owner's standing defense is block and the owner can block (a shield held in a working Grip arm). The owner is active. The owner's block value is higher than the value of the ally's own standing defense. Cover Ally is switched on for the owner (a per-character switch, on by default).
- **Effect:** The owner defends in the ally's place with the owner's own block roll. A hit that gets through lands on the owner, who stepped into its path. It counts as one of the owner's defenses this turn (outnumbered).
- **Lasts:** Each attack.

### Iron Body (Endurance) · A12

*Story:* Pain is just information, and you stopped listening long ago. A body part that counts as Damaged gives you no penalty; worse wounds still hold you back. With Tough It Out, even a Crippled part no longer slows you.

- **Kind:** Always on
- **Trigger:** Any roll by the owner.
- **Conditions:** A body part's effective state is Damaged or milder (see Effect).
- **Effect:** Part states are read on their reference scale, by position in the part-state names table (Healthy, Damaged, Crippled, Destroyed). A part's effective state is its state after any perk that shifts it (Tough It Out moves each one step milder). A part whose effective state is at the Damaged position or milder gives no role penalty; worse effective states still do. So with Tough It Out a Crippled part counts as Damaged and gives no penalty.
- **Lasts:** Always.

### Read Wounds (Eyesight) · A13

*Story:* A limp, a favoured arm, a bleeding hand: every weakness shows itself to you. You can see which of a foe's body parts are Damaged, and you can tell a foe is hurt one step sooner than others can: from Injured instead of Wounded.

- **Kind:** Always on
- **Trigger:** The owner perceives a foe by sight.
- **Conditions:** The owner can see the foe.
- **Effect:** The foe's Damaged body parts are shown to the owner (foes' part states are otherwise never shown). The foe's health level also shows one step earlier on the health track: the level where it starts to show moves one position milder in the health-track names table (from Wounded to Injured today).
- **Lasts:** While the owner sees it.

### Keen Ear (Earshot) · A14

*Story:* A whisper two rooms away might as well be a shout. You hear sounds 10 decibels quieter than most people can.

- **Kind:** Always on
- **Trigger:** A perception check for the owner by sound.
- **Effect:** The owner hears 10 dB quieter (hearingDb): every sound counts 10 dB louder for the owner against their background, so it carries about three times as far (a normal voice is clear to about 18 m in a quiet place instead of about 6 m). A Silent sound stays unheard.
- **Lasts:** Always.

### Quick Word (Persuasion) · A15

*Story:* Blades clash, and you still have time for the last word. Once a turn, a one-sentence remark is spoken without using up your action, and the answer it gets costs the other side nothing either.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner both speaks and acts.
- **Conditions:** The line is short (one sentence).
- **Effect:** The line resolves as talk without using the owner's action. An NPC's spoken reply to that line is also free: it doesn't use the NPC's action.
- **Lasts:** That line.
- **Cooldown:** Once per turn.
- **Open:** Trial perk: test in play how NPCs answer. It is dropped if the free exchange doesn't work.

### Threaten for Answers (Intimidation) · A16

*Story:* Charm is a request. Fear is an answer. Asking an unfriendly or hostile person for information, your intimidation counts at its full value instead of half.

- **Kind:** Always on
- **Trigger:** The owner tries to get information from an NPC.
- **Conditions:** The NPC's stance to the owner is opposed or hostile.
- **Effect:** Intimidation counts as a named skill for the request (full value), not a substitute at half value.
- **Lasts:** Each request.

### Hard Bargain (Barter) · A17

*Story:* Merchants go pale when your shadow falls across their stall. You buy for 10% less and sell for 10% more.

- **Kind:** Always on
- **Trigger:** The owner buys or sells.
- **Effect:** Buying prices ×0.9; selling prices ×1.1.
- **Lasts:** Always.
- **Needs first:** Buying and selling (D-93).
- **Open:** Kept only if trade prices make a sale at 1.1× still pay less than buying the same item at 0.9×. That needs the price a merchant pays the player to be under 0.81× of the price it charges (1.1 × sell < 0.9 × buy).

### Soft Tread (Sneaking) · A18

*Story:* You know where to put your feet. While you move unseen, your steps are one step quieter.

- **Kind:** Always on
- **Trigger:** The owner moves while Stealthy.
- **Effect:** The move's noise is read one step quieter on the noise scale (Normal as Quiet), after worn armor's steps.
- **Lasts:** That move.

### Melt Away (Vanishing) · A19

*Story:* Shadow and clutter are enough. With cover or shade around you, you can vanish right where you stand.

- **Kind:** Always on
- **Trigger:** The owner Vanishes without a zone to go to.
- **Conditions:** The owner's zone has some or heavy cover, or its light is dim or dark.
- **Effect:** The owner vanishes in place: it stays in its zone, and each observer makes a Vanishing contest against it, as a Vanish does. One who saw the owner and loses drops to suspicious at that zone. It uses the main action, as a Hide does.
- **Lasts:** That Vanish.

### Slip the Blow (Light Armor) · A20

*Story:* Light armor lets you roll with a blow. When your dodge only ties, the hit becomes a graze.

- **Kind:** Always on
- **Trigger:** The owner dodges an attack.
- **Conditions:** The owner wears light armor. The gap is 0.
- **Effect:** The gap counts as +1: a graze for 0.8× damage.
- **Lasts:** That attack.

### Quiet Mail (Medium Armor) · A21

*Story:* You know how to wear armor quietly. Whatever its weight, your armor makes one step less noise.

- **Kind:** Always on
- **Trigger:** The owner moves its body (move, attack, perk move, break free, pick up) while wearing armor.
- **Effect:** Worn armor adds one noise step less, never below none: medium armor adds none, heavy armor adds one.
- **Lasts:** Always.

### Turn Aside (Heavy Armor) · A22

*Story:* Plate takes the worst out of any blow. A heavy or crushing hit on a part your heavy armor covers lands as a plain full hit.

- **Kind:** Always on
- **Trigger:** An attack hits the owner.
- **Conditions:** The hit is a heavy hit or a crushing hit (gap −4 or −5). The owner wears heavy armor that covers the struck part.
- **Effect:** The hit counts as a full hit: damage multiplier 1× instead of 1.5× or 2×.
- **Lasts:** That hit.

### In and Out (Combat Stealth) · A23

*Story:* Only the one you strike ever sees you. When you strike from hiding, everyone else still has to spot you.

- **Kind:** Always on
- **Trigger:** The owner makes a melee attack while Stealthy.
- **Effect:** The owner stays Stealthy. The target becomes aware of the owner. Every other observer makes a Combat Stealth contest against the owner instead of seeing it, as for a shot.
- **Lasts:** That attack.

### Bluff (Lying) · LI1c

*Story:* Half a second of doubt is all a knife needs. "Behind you!" Once per foe in a fight, and without giving up your action, you throw a lie at a foe in your zone. If it believes you, it hesitates and acts last next turn.

- **Kind:** Free move
- **Trigger:** The owner uses the move on a foe in the owner's zone. It does not use the owner's action.
- **Effect:** A Lying roll against the foe's answer to a lie (Insight). Unless the foe wins, it believes the lie and acts last next turn, as if caught unaware.
- **Lasts:** The foe's next turn.
- **Cooldown:** Once per foe per engagement.

### Overheard (Insight) · LI5a

*Story:* Not every lie is meant for you, and you catch those too. When someone within your earshot lies to someone else, you can see through it as if it were told to you.

- **Kind:** Always on
- **Trigger:** Someone lies (a deceive) to someone else, and the owner hears it: the words, or the sound of the voice.
- **Conditions:** The owner is not the one lied to and did not already answer the lie.
- **Effect:** The speaker's Lying against the owner's answer to a lie (Insight, or the better of Insight and Lying with Takes One to Know One). If the owner wins, the owner sees through it: the hint that something doesn't sit right, or plainly a lie with Plain as Day. Seeing through it changes nothing else.
- **Lasts:** Each lie overheard.

## 40 milestone

### Keen Edge (Light weapons) · P1

*Story:* +5 Light weapons, +1 Melee. Your blade has learned where flesh is softest: +10 to hit with light weapons.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Light weapons. +1 true skill in every skill of group Melee. +10 on attack rolls with skill Light weapons.
- **Lasts:** Always.

### Guard Drill (Medium weapons) · P2

*Story:* +5 Medium weapons, +1 Melee. Every guard you hold makes the next one harder to break: +10 Parry.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Medium weapons. +1 true skill in every skill of group Melee. +10 true skill in Parry.
- **Lasts:** Always.

### Heavy Hand (Heavy weapons) · P3

*Story:* +5 Heavy weapons, +1 Melee. Armor dents, bones give: your heavy weapons hit 20% harder.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Heavy weapons. +1 true skill in every skill of group Melee. Damage of an attack with skill Heavy weapons is ×1.2, before armor.
- **Lasts:** Always.

### Sharp Eyes (Light ranged) · P4

*Story:* +5 Light ranged, +1 Ranged. Nothing escapes the archer's eye: +10 Eyesight.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Light ranged. +1 true skill in every skill of group Ranged. +10 true skill in Eyesight.
- **Lasts:** Always.

### Steady Draw (Medium ranged) · P5

*Story:* +5 Medium ranged, +1 Ranged. Steady hands, a heavier bite: +5 to hit with medium ranged weapons, and they hit 10% harder.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Medium ranged. +1 true skill in every skill of group Ranged. +5 on attack rolls with skill Medium ranged, and its damage is ×1.1, before armor.
- **Lasts:** Always.

### Armor Piercer (Heavy ranged) · P6

*Story:* +5 Heavy ranged, +1 Ranged. Steel plate is just a suggestion to your bolts: it stops 2 less of each hit.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Heavy ranged. +1 true skill in every skill of group Ranged. On a hit with skill Heavy ranged, each armor the hit passes (worn and natural) reduces the damage by 2 less (never below 0).
- **Lasts:** Always.

### Street Fighter (Strike) · P7

*Story:* +5 Strike, +1 Melee. Fists taught you that anything in reach is a weapon: +10 Improvisation.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Strike. +1 true skill in every skill of group Melee. +10 true skill in Improvisation.
- **Lasts:** Always.

### Iron Grip (Grapple) · P8

*Story:* +5 Grapple, +1 Melee. Once you take hold, struggling only tires them out: +10 on every grapple roll, breaking free included.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Grapple. +1 true skill in every skill of group Melee. +10 on every roll with skill Grapple (grapple attacks, and both sides of a break-free contest).
- **Lasts:** Always.

### Brawler's Eye (Improvisation) · P9

*Story:* +5 Improvisation, +1 Melee. A brawler sees the opening before the punch: +5 Strike, +5 Eyesight.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Improvisation. +1 true skill in every skill of group Melee. +5 true skill in Strike and +5 in Eyesight.
- **Lasts:** Always.

### Light Feet (Dodge) · P10

*Story:* +5 Dodge, +1 Defense. Feet that never get hit never make a sound: +10 Sneaking.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Dodge. +1 true skill in every skill of group Defense. +10 true skill in Sneaking.
- **Lasts:** Always.

### Take the Hit (Block) · P11

*Story:* +5 Block, +1 Defense. Every blow you stop leaves you harder: +10 Endurance.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Block. +1 true skill in every skill of group Defense. +10 true skill in Endurance.
- **Lasts:** Always.

### Fast Healer (Endurance) · P12

*Story:* +5 Endurance, +1 Health. Your flesh knits itself shut, twice as fast as it has any right to.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Endurance. +1 true skill in every skill of group Health. Natural recovery (the hourly healing row read from Endurance) is ×2.
- **Lasts:** Always.

### Marksman's Eye (Eyesight) · P13

*Story:* +5 Eyesight, +1 Notice. What your eye finds, your arrow follows: +5 Light ranged, +5 Medium ranged.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Eyesight. +1 true skill in every skill of group Notice. +5 true skill in Light ranged and +5 in Medium ranged.
- **Lasts:** Always.

### Soft Step (Earshot) · P14

*Story:* +5 Earshot, +1 Notice. You know what every footstep sounds like, so yours make none: +10 Sneaking.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Earshot. +1 true skill in every skill of group Notice. +10 true skill in Sneaking.
- **Lasts:** Always.

## Higher milestone

### Find the Gap (Light weapons) · B1

*Story:* There is a gap in every guard, and you see it. With any attack, aiming at a small body part costs you only half the usual penalty.

- **Kind:** Always on
- **Trigger:** The owner makes an aimed attack.
- **Conditions:** Any attack.
- **Effect:** The aim penalty for the part's size is halved.
- **Lasts:** That attack.
- **Banked as:** a later Light weapons perk, suggested for the 60 perk

### Disarming Cut (Medium weapons) · B2

*Story:* A cut to the arm, and the hand forgets what it was holding. When your medium or heavy weapon wounds an arm, the target drops whatever that hand holds, shield included.

- **Kind:** Always on
- **Trigger:** The owner's melee attack hits a part with the Grip role (an arm) and deals damage.
- **Conditions:** The attack uses a medium or heavy melee mode. Damage to that part is above 0.
- **Effect:** The target drops what that arm's hand holds, weapon or shield, into its zone.
- **Lasts:** That attack.
- **Banked as:** a later Medium weapons perk, suggested for the 60 perk

### Cleave (Heavy weapons) · B3

*Story:* One falls. The swing doesn't stop. Once a turn, you get a free attack at another foe in reach in your zone.

- **Kind:** Always on
- **Trigger:** The owner's heavy melee attack downs its target.
- **Conditions:** Another hostile active actor is in the owner's zone, within reach.
- **Effect:** The owner makes one extra attack at that actor at once, with the same weapon. Code picks the target at random (seeded) if there are several.
- **Lasts:** That attack.
- **Cooldown:** Once per turn.
- **Banked as:** a later Heavy weapons perk, suggested for the 60 perk

### Shoot and Move (Light ranged) · B4

*Story:* Loose, step, gone. They aim at where you were. On a turn you shoot a light or medium ranged weapon, you can also move one zone link.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner's order is a light or medium ranged attack.
- **Effect:** The owner may also move one zone link, before or after the shot.
- **Lasts:** Each turn.
- **Needs first:** Action economy.
- **Banked as:** a later Light ranged perk, suggested for the 60 perk

### Human Shield (Grapple) · B6

*Story:* Allies, enemies, shields: in your hands they are all the same thing. While you hold someone, you turn them into the path of incoming arrows. A ranged attack at you that doesn't beat your defense hits the person you hold instead.

- **Kind:** Always on
- **Trigger:** A ranged attack targets the owner.
- **Conditions:** The owner is holding an actor (Don't Let Go).
- **Effect:** If the gap is 0 or better for the owner, the attack resolves against the held actor instead, with no defense from it.
- **Lasts:** Each attack.
- **Needs first:** Don't Let Go.
- **Banked as:** a later Grapple perk, suggested for the 60 perk

### Anything Goes (Improvisation) · B7

*Story:* A chair leg, a bottle, a candlestick. In your hands everything is a weapon. Improvised weapons lose their hit penalty.

- **Kind:** Always on
- **Trigger:** The owner attacks with an improvised weapon.
- **Effect:** The improvised hit penalty (−10) is not applied.
- **Lasts:** Always.
- **Banked as:** a later Improvisation perk, suggested for the 100 perk

### Slip the Crowd (Dodge) · B8

*Story:* Surrounded? You've got them right where you want them. Your dodge never takes the outnumbered penalty.

- **Kind:** Always on
- **Trigger:** The owner dodges.
- **Effect:** The outnumbered modifier is not applied.
- **Lasts:** Always.

### Shield Wall (Block) · B9

*Story:* Bring an army. The wall does not care. Your shield blocks never take the outnumbered penalty.

- **Kind:** Always on
- **Trigger:** The owner blocks.
- **Conditions:** The owner blocks with a shield.
- **Effect:** The outnumbered modifier is not applied.
- **Lasts:** Always.

### Refuse to Fall (Endurance) · B10

*Story:* Not here. Not like this. Once per fight, when a blow should drop you, you stay on your feet at the last health level before going down, unless the blow destroyed your head or neck.

- **Kind:** Always on
- **Trigger:** Damage would down the owner.
- **Conditions:** The damage did not destroy an essential part (head, neck).
- **Effect:** The owner stays active at the lowest health level above downed.
- **Lasts:** Instant.
- **Cooldown:** Once per engagement.
- **Needs first:** Engagement tracking.
- **Banked as:** a later Endurance perk, suggested for the 60 perk

### Calm Words (Persuasion) · B11

*Story:* Words cut deeper than steel, and sometimes they cut the will to fight. Winning a persuasion contest by two outcomes or more against someone hostile makes it only wary of you: it stops attacking on sight.

- **Kind:** Always on
- **Trigger:** The owner wins a persuasion contest against an NPC hostile to the owner.
- **Conditions:** The gap is −2 or lower (the owner wins by 2 tiers or more).
- **Effect:** The NPC's stance toward the owner becomes opposed: it stops attacking on sight.
- **Lasts:** Until something changes it again.
- **Banked as:** a later Persuasion perk, suggested for the 60 perk

### Beg for Mercy (Persuasion) · B12

*Story:* Pride is for the living. Beaten and about to fall, you beg for mercy. At the last health level before going down, you can plead with a hostile foe; win a persuasion contest and it stops attacking you for the rest of the fight.

- **Kind:** Move
- **Trigger:** The owner pleads for mercy with a foe.
- **Conditions:** The owner is at the lowest health level above downed. The foe is hostile to the owner.
- **Effect:** Persuasion contest against the foe. If the owner wins, the foe stops attacking the owner.
- **Lasts:** For the rest of the engagement.
- **Needs first:** Moves.
- **Banked as:** a later Persuasion perk, suggested for the 100 perk

### Make an Example (Intimidation) · B13

*Story:* One falls, and the rest remember they can die too. Every other foe that sees or hears it makes a morale check at once.

- **Kind:** Always on
- **Trigger:** The owner's attack downs a foe.
- **Conditions:** Other foes hostile to the owner see or hear it happen.
- **Effect:** Each of those foes makes a morale check at once.
- **Lasts:** Each time.
- **Banked as:** a later Intimidation perk, suggested for the 60 perk

### Unblinking (Eyesight) · B14

*Story:* Once your eyes are on someone, there is nowhere left to run. When someone you can see vanishes and gets past you, they still have to sneak past you as well before you lose them.

- **Kind:** Always on
- **Trigger:** A character the owner sees (aware or tracking) vanishes, and the owner loses the Vanishing contest.
- **Conditions:** The owner saw the character before the Vanish.
- **Effect:** The character must also win a Sneaking contest against the owner, or a Combat Stealth contest while engaged, using the owner's sight. If the character doesn't win it, the owner keeps seeing them.
- **Lasts:** That Vanish.
- **Open:** Eyesight 60. Works for the player too since NPC stealth (NS10).

### Set Them Up (Strike) · B15

*Story:* Left, right, bottle, fist. Every blow opens the door for the next. Every punch you throw at a foe, landed or not, sets up your next improvised attack on it, and every improvised attack sets up your next punch: that attack lands one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes an attack with skill Strike or Improvisation, hit or miss (it counts on the attempt).
- **Effect:** A Strike attack marks the target for the owner's next Improvisation attack on it; an improvised attack marks the target for the owner's next Strike attack on it. That attack gets tier shift +1, and the mark clears.
- **Lasts:** Until it is used or the engagement ends.

### One-Two (Improvisation) · B16

*Story:* A bottle in one hand, a fist in the other, and no mercy in either. When you hit a foe with an improvised weapon and your other hand is empty, you follow up with a free punch at the same foe.

- **Kind:** Always on
- **Trigger:** The owner's attack with skill Improvisation hits (outcome grazed, blocked, full, heavy or crushing hit).
- **Conditions:** The owner has a working Grip arm with an empty hand. The target is still active and in the owner's zone.
- **Effect:** The owner makes one extra attack with skill Strike (fists) at the same target at once. It doesn't use the owner's action, and can't trigger One-Two again.
- **Lasts:** That attack.

### Out of Nowhere (Combat Stealth) · B17

*Story:* They feel the arrow, never the archer. When you shoot from hiding and the target misses you, it still doesn't know you are there.

- **Kind:** Always on
- **Trigger:** The owner makes a ranged attack while Stealthy.
- **Conditions:** The target loses the notice contest (Combat Stealth).
- **Effect:** The target stays unaware of the owner, instead of turning suspicious at the owner's zone. It still knows it was hit.
- **Lasts:** That attack.
- **Banked as:** a later Combat Stealth perk, suggested for the 60 perk

### Answer the Blow (Riposte) · B18

*Story:* A clean parry is half a cut. With a medium weapon you answer sooner: a parry that only turns the blow partly aside already earns your strike back.

- **Kind:** Always on
- **Trigger:** The owner parries a melee attack with a medium melee weapon.
- **Effect:** The parry's free strike back comes at a gap 2 lower (ANSWER_THE_BLOW_DROP): +1 instead of +3. The damage the parry lets through is unchanged. The strike is still once per turn.
- **Lasts:** Each parry.

### Step and Cut (Blade Dance) · B18b

*Story:* The blade passes where you were a moment ago. When you slip a blow cleanly with a light or medium weapon in hand, you cut back at once.

- **Kind:** Always on
- **Trigger:** The owner dodges a melee attack while holding a light or medium melee weapon.
- **Conditions:** The gap is +2 or better for the owner. The attack was not itself a free attack. Once per turn.
- **Effect:** The owner makes one melee attack at the attacker at once, with that weapon. It does not use the owner's action.
- **Lasts:** That attack.

### Blade Wall (Parry) · B19

*Story:* Let them all come. Your sword turns one blow after another. When you parry with a medium or heavy weapon, being outnumbered doesn't hurt your guard.

- **Kind:** Always on
- **Trigger:** The owner parries.
- **Conditions:** The owner parries with a medium or heavy melee weapon.
- **Effect:** The outnumbered modifier is not applied.
- **Lasts:** Always.

### Takes One to Know One (Lying) · LI1a

*Story:* You know every trick in the book, because you wrote half of them. When someone lies to you, you answer with the better of your Insight and your Lying.

- **Kind:** Always on
- **Trigger:** Someone lies to the owner (a lie, or a Bluff).
- **Effect:** The owner's answering roll uses the better of Insight and Lying, each at full value.
- **Lasts:** Each answer to a lie.

### Plain as Day (Insight) · LI2a

*Story:* Some people can't lie to your face, and they all try. A lie you see through is plainly a lie, not a vague feeling that something doesn't sit right.

- **Kind:** Always on
- **Trigger:** The owner sees through a lie (wins the answering roll).
- **Effect:** The owner is told plainly that the speaker is lying, instead of the hint that something doesn't sit right.
- **Lasts:** Each lie seen through.

## Very high milestone

### Never Surprised (Earshot) · C1

*Story:* If you can hear it coming, it was never a surprise. An attacker within your hearing range never counts as unseen: you lose no initiative or defense for being unaware.

- **Kind:** Always on
- **Trigger:** An attack on the owner while the owner is unaware of the attacker.
- **Conditions:** The attacker's approach or attack is within the owner's hearing range.
- **Effect:** The owner counts as aware: no unaware initiative or defense penalty.
- **Lasts:** Always.

### Read Their Face (Insight) · LI2b

*Story:* Words say one thing. Faces say the rest. You see how anyone who speaks to you really stands toward you (hostile, opposed, friendly and so on), even when they hide it.

- **Kind:** Always on
- **Trigger:** Someone the owner sees clearly has spoken to the owner this scenario.
- **Conditions:** The owner sees the speaker clearly (not in the dark or half seen).
- **Effect:** The owner sees that speaker's stance toward the owner.
- **Lasts:** While the owner sees them, for the rest of the scenario.

### Dread Presence (Intimidation) · I1

*Story:* You don't have to say a word. Anyone who means you harm feels it the moment they face you, and it stays with them for the rest of the fight.

- **Kind:** Always on (engagement aura)
- **Trigger:** An actor opposed or hostile to the owner is aware of the owner in the owner's zone or one zone away, for the first time this engagement.
- **Conditions:** Once per target per engagement.
- **Effect:** The owner's Intimidation against the target's Resolve (its morale roll, renown included). If the owner wins, the target is Shaken toward the owner by −5 × the tier gap until the engagement ends (the bigger Shaken stands), and loses 10 morale × the tier gap. Each aura's morale cost adds up on its own.
- **Lasts:** Shaken until the engagement ends.

### Battle Cry (Intimidation) · C2

*Story:* Your roar tells every foe exactly how this ends, and tells your side it isn't over. Once per fight, as your action, every foe that hears it, however far, makes a morale roll against you, and you and every ally that hears it take heart and shake off fear.

- **Kind:** Move (offensive aura)
- **Trigger:** The owner uses the move. The roar is a Loud noise.
- **Effect:** Every foe opposed or hostile to the owner that perceives the roar, at any perception level (half heard counts), wherever it is, rolls its morale skill (Resolve) against the owner's Intimidation. If the owner wins, the foe loses 10 morale per tier of gap (as Dread Presence). Every ally of the owner that perceives the roar (a bandmate, someone who counts the owner a friend or better, or someone fighting beside the owner) gets 10 morale back and loses any Shaken, and so does the owner.
- **Lasts:** Instant.
- **Cooldown:** Once per engagement. It is the owner's main action.

### Overwhelm (Resolve) · MR2

*Story:* Some wills simply give way before yours. A foe who loses badly to any of your auras, and whose nerve is not half of yours, doesn't just waver: it breaks on the spot and gives up.

- **Kind:** Always on (upgrades the owner's auras)
- **Trigger:** Any of the owner's auras (Dread Presence, Battle Cry and any later aura) wins its roll against a target.
- **Conditions:** The owner wins by 3 tiers or more. The target's max morale is at most 50% of the owner's.
- **Effect:** Instead of the aura's normal morale cost, the target loses all its morale: it is Broken at once and surrenders. A player who is overwhelmed is Broken (cannot attack) but keeps control.
- **Lasts:** As any surrender.

### Buy Them Off (Barter) · C3

*Story:* Everyone has a price, even mid-swing. In the middle of a fight you offer coin, as much as you choose; a bigger offer is harder to refuse. Win a barter contest and the foe takes the coin and stops attacking you for the rest of the fight.

- **Kind:** Move
- **Trigger:** The owner offers coin to a foe in a fight.
- **Conditions:** The owner has the coin.
- **Effect:** The owner names the amount. Barter contest against the foe; a bigger offer adds a modifier to the owner's roll (scale set with trade prices). If the owner wins, the coin changes hands and the foe stops attacking the owner.
- **Lasts:** For the rest of the engagement.
- **Needs first:** Moves.
- **Banked as:** a later Barter perk, suggested for the 100 perk

### Tough It Out (Endurance) · D6

*Story:* Broken bones are a problem for later. Your wound penalty is taken as if you were one health level less hurt, and every wounded body part hinders you as if it were one step better: a destroyed arm works like a crippled one.

- **Kind:** Always on
- **Trigger:** Any roll by the owner.
- **Effect:** The owner's health-track penalty is taken from one level less hurt. Each body part's effective state is one step milder on the part-state scale, by position in the names table: Destroyed counts as Crippled, Crippled as Damaged, Damaged as Healthy. Only penalties change: a Destroyed part is still gone from the hit table.
- **Lasts:** Always.
- **Banked as:** an All-X candidate for the Fortitude tree, suggested for All-100

## Banked, no milestone yet

### Go to Ground (Sneaking) · D9

*Story:* Lie still long enough and they decide they imagined you. When you hide, someone who was only suspicious of you can lose you entirely.

- **Kind:** Always on
- **Trigger:** The owner Hides outside an engagement.
- **Conditions:** The observer is suspicious of the owner, not aware.
- **Effect:** An observer who loses the contest drops to unaware, instead of staying suspicious.
- **Lasts:** That contest.
- **Open:** Parked for a hiding perk (D-189).
- **Banked as:** a later Sneaking perk, suggested for the 60 perk

### Held Shot (Medium ranged) · D8

*Story:* Patience is a blade too. You hold your shot and wait. Instead of acting, you ready a ranged weapon: the first hostile to enter your zone before the end of your next turn takes a shot before it can act.

- **Kind:** Move
- **Trigger:** The owner readies any ranged weapon instead of acting.
- **Effect:** When a hostile actor enters the owner's zone, the owner shoots it at once, before it acts.
- **Lasts:** Until the end of the owner's next turn, one shot.
- **Needs first:** Moves; reactions.
- **Banked as:** a later Medium ranged perk, suggested for the 60 perk

### Gut Feeling (Insight) · LI5b

*Story:* You can feel ill will on the back of your neck. When someone who means you harm watches you from hiding, you may get a hunch of where they are, though never who.

- **Kind:** Always on
- **Trigger:** The start of each turn.
- **Conditions:** A watcher is opposed or hostile to the owner, aware of the owner, and in the owner's zone or one sight link away. The owner has not seen or heard the watcher (is unaware of them). Each watcher sets it off at most once a scenario.
- **Effect:** The owner's Insight against the watcher's stealth (Combat Stealth in a fight, Sneaking otherwise). If the owner wins, it gets a hunch of being watched from the watcher's zone, never who, and turns suspicious of the watcher there. It can then look or listen for them as usual.
- **Lasts:** Until the owner's belief changes on its own.
- **Open:** Built, then parked until it has a place on the ladder (Insight 20 holds Overheard); D-176.
- **Banked as:** a later Insight perk

### Not Born Yesterday (Insight) · LI2c

*Story:* Sweet words, and you hear every hook in them. When someone persuades you, you answer with the better of Persuasion and Insight.

- **Kind:** Always on
- **Trigger:** Someone persuades the owner.
- **Effect:** The owner's answering roll uses the better of Persuasion and Insight, each at full value.
- **Lasts:** Each answer to a persuasion.
- **Open:** Parked (D-187).
- **Banked as:** a later Insight perk

### Steady Nerves (Resolve) · MR5a

*Story:* Your hands shake. Your aim doesn't. Being Rattled or Afraid no longer costs you anything on your rolls.

- **Kind:** Always on
- **Trigger:** The owner makes a roll while Rattled or Afraid.
- **Effect:** The Rattled and Afraid roll penalties do not apply to the owner.
- **Lasts:** Always.
- **Open:** Parked (D-188). One of three options for the Resolve 20 perk.
- **Banked as:** a later Resolve perk

### Used to the Pain (Resolve) · MR5b

*Story:* A cut is just a cut. Your own wounds shake you one step later than they would anyone else.

- **Kind:** Always on
- **Trigger:** The owner is wounded.
- **Effect:** The owner's own wounds start costing morale one health level later.
- **Lasts:** Always.
- **Open:** Parked (D-188). One of three options for the Resolve 20 perk (could be Resolve 60 instead).
- **Banked as:** a later Resolve perk

### Run Later (Resolve) · MR5c

*Story:* You can run later. Once in a fight, a blow to your nerve that would break you leaves you Panicking instead.

- **Kind:** Once per fight
- **Trigger:** A morale loss would make the owner Broken.
- **Conditions:** Not used yet this fight.
- **Effect:** The owner is left at Panicking instead of Broken.
- **Lasts:** That morale loss.
- **Open:** Parked (D-188). One of three options for the Resolve 20 perk (could be Resolve 60 instead). Shown on the morale page as Not Yet; renamed because an achievement is already called Not Yet.
- **Banked as:** a later Resolve perk

### Crushing Blow (Heavy weapons) · D1

*Story:* A block only delays the inevitable. Against a block, your heavy weapon pushes the outcome two steps your way instead of one.

- **Kind:** Always on
- **Trigger:** The owner's heavy melee attack is blocked.
- **Effect:** The heavy-weapon gap shift is −2 instead of −1.
- **Lasts:** That attack.
- **Banked as:** a later Heavy weapons perk, suggested for the 100 perk

### Punch Through (Heavy ranged) · D2

*Story:* Hiding behind a shield only moves the wound. The shield arm takes half the damage the shield took.

- **Kind:** Always on
- **Trigger:** The owner's heavy ranged attack is blocked with a shield.
- **Effect:** The arm holding the shield also takes half the damage the shield took, and it counts on the health track.
- **Lasts:** That attack.
- **Banked as:** a later Heavy ranged perk, suggested for the 60 perk

### Staggering Bolt (Heavy ranged) · D3

*Story:* The bolt hits, and the world stops for them a moment. On a full hit or better, the target acts last on its next turn.

- **Kind:** Always on
- **Trigger:** The owner's heavy ranged attack is a full hit or better.
- **Effect:** The target acts last next turn.
- **Lasts:** Its next turn.
- **Banked as:** a later Heavy ranged perk, suggested for the 100 perk

### Flurry (Strike) · D4

*Story:* Faster than the eye can follow. With both hands free, you throw two quick punches a turn; the second is one outcome less sure.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner's order is an unarmed strike.
- **Conditions:** Both Grip arms work and hold nothing.
- **Effect:** The owner attacks twice. The second attack gets tier shift −1.
- **Lasts:** Each turn.
- **Needs first:** Action economy.
- **Banked as:** a later Strike perk, suggested for the 100 perk

### Roll With It (Dodge) · D5

*Story:* Was that supposed to hurt? A blow that only grazes you does no harm at all.

- **Kind:** Always on
- **Trigger:** The owner dodges and the gap is +1 (a graze).
- **Effect:** The multiplier is 0× instead of 0.8×.
- **Lasts:** Always.
- **Banked as:** a later Dodge perk, suggested for the 100 perk

### Night Eyes (Eyesight) · D7

*Story:* The dark hides others. It never hid anything from you. Dim light and darkness give you no penalty to anything that needs sight.

- **Kind:** Always on
- **Trigger:** A roll by the owner that needs sight.
- **Effect:** Light is read two steps brighter on the light scale, by position in the names table (dark counts as bright, dim counts as bright). It is coded as +2 steps, not as 'no penalty', so light levels added later shift the same way.
- **Lasts:** Always.
- **Open:** The perception All-50 Night Eyes (T5e) is the one-step version of this; this two-step one is kept for the All-100 after it.
- **Banked as:** an All-X candidate for the Perception tree, suggested for All-100

## All-X parts (All-50, All-100, All-150)

All-50, All-100 and All-150 work alike. Granted free once enough skills of the tree reach the step in true skill, by the tree's rating (inferior never, normal 3, superior 2, legendary 1): the tree's passive for that step plus the part of each skill at it; a further skill reaching the step adds its part. Each part once it is built. Bundles: Combat – Arms All-50: Warborn; Combat – Ranged All-50: Death from Afar; Combat – Unarmed All-50: Open Hand; Combat – Defense All-50: The Unbroken; Fortitude All-50: Hard to Kill; Perception All-50: Nothing Escapes; Stealth – Conventional All-50: One with the Dark; Speech All-50: Silver Voice; Perception All-150: Nothing Unwitnessed.

### Opening Strike (Combat – Arms, Heavy weapons) · T1a

*Story:* You always make the first blow count. Your first melee attack on each foe in a fight lands one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes a melee attack.
- **Conditions:** It is the owner's first melee attack on that foe in this engagement.
- **Effect:** Tier shift +1 on the attack roll.
- **Lasts:** That attack.
- **Cooldown:** Once per foe per engagement.
- **Built:** yes

### Counter (Combat – Arms, Light weapons) · T1c

*Story:* A clumsy swing is an invitation. When a melee attack on you goes badly wrong, you strike back at once.

- **Kind:** Always on
- **Trigger:** A melee attack on the owner is resolved.
- **Conditions:** The attack roll ends in Critical Failure or worse. The attack was not itself a free attack. The owner is active, in the attacker's zone, and its default mode at that range is melee or unarmed. Once per turn.
- **Effect:** The owner makes one attack at the attacker at once, with that mode. It does not use the owner's action.
- **Lasts:** That attack.
- **Built:** yes

### Fighter's Frame (Combat – Arms, passive) · T1d

*Story:* A body hardened by a thousand bouts. Melee blows that get past your armor cost you a tenth less health.

- **Kind:** Always on
- **Trigger:** A melee or unarmed attack damages the owner's body (not a shield).
- **Conditions:** The attack mode is not ranged.
- **Effect:** The health lost from that hit, after armor, is ×0.9 (CONFIG.FIGHTERS_FRAME_MULT, placeholder).
- **Lasts:** Always.
- **Built:** yes

### Steady Guard (Combat – Arms, Medium weapons) · T1e

*Story:* Your blade knows where the blow will land. Your Parry is 5 higher, and 5 higher again when you parry with a medium weapon.

- **Kind:** Always on
- **Trigger:** Always; and the owner makes a Parry roll.
- **Conditions:** The extra +5 needs the parry to be made with a medium melee weapon.
- **Effect:** +5 true skill in Parry. Parry rolls made with a medium melee weapon also get +5 effective skill (CONFIG.STEADY_GUARD, placeholder).
- **Lasts:** Always.
- **Built:** yes

### Unerring (Combat – Ranged, Light ranged) · T2a

*Story:* Your first shot comes before they are ready. The first time you shoot in a fight, at a foe who hasn't moved yet, it is harder to avoid.

- **Kind:** Always on
- **Trigger:** The owner makes a ranged attack.
- **Conditions:** It is the owner's first ranged attack in this engagement. The target hasn't acted yet in its engagement (it has none, or it began this turn and the target hasn't had its action).
- **Effect:** Tier shift −1 on the target's defense roll.
- **Lasts:** That attack.
- **Cooldown:** Once per engagement.
- **Built:** yes

### Volley (Combat – Ranged, Medium ranged) · T2b

*Story:* One shot is never the last. Once a fight, after a ranged hit, your next shot is already on its way to another foe.

- **Kind:** Automatic
- **Trigger:** The owner's ranged attack hits.
- **Conditions:** Once per engagement. Not after a free attack. Code picks at random among actors already hostile to the owner that the owner is aware of and the weapon reaches; none, no shot.
- **Effect:** The owner makes one more ranged attack at that target with the same weapon. It does not use the owner's action.
- **Lasts:** That attack.
- **Cooldown:** Once per engagement.
- **Built:** yes

### Past the Cover (Combat – Ranged, Heavy ranged) · T2c

*Story:* Cover only hides most of a body. Cover counts one step lighter against your ranged attacks.

- **Kind:** Always on
- **Trigger:** The owner makes a ranged attack.
- **Effect:** The target zone's cover is read one step lighter (heavy as some, some as none).
- **Lasts:** That attack.
- **Built:** yes

### Hunter's Eye (Combat – Ranged, passive) · T2d

*Story:* An archer lives by the eye: +10 to every skill you see with.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +10 true skill in every skill with the sight function.
- **Lasts:** Always.
- **Built:** yes

### Hard to Hold (Combat – Unarmed, Grapple) · T3a

*Story:* Hands never stay on you for long. Your rolls to break a hold land one outcome better.

- **Kind:** Always on
- **Trigger:** The owner, held, tries to break free (its grapple roll in the break-free contest).
- **Effect:** Tier shift +1 on that roll.
- **Lasts:** That roll.
- **Built:** yes

### Iron Knuckles (Combat – Unarmed, Strike) · T3d

*Story:* Your hands are weapons now. Your unarmed hits deal a tenth more damage.

- **Kind:** Always on
- **Trigger:** The owner hits with an unarmed mode (punch, grapple, slam and the rest).
- **Effect:** The hit's damage before armor is ×1.1 (CONFIG.IRON_KNUCKLES_MULT, placeholder).
- **Lasts:** Always.
- **Built:** yes

### Junk Arsenal (Combat – Unarmed, Improvisation) · T3e

*Story:* A chair leg, a bottle, a tankard: in your hands they all hurt. Your improvised weapons hit a fifth harder.

- **Kind:** Always on
- **Trigger:** The owner hits with an improvised weapon (an attack that rolls Improvisation, or a throw that blends it in).
- **Effect:** The hit's damage before armor is ×1.2 (CONFIG.JUNK_ARSENAL_MULT, placeholder).
- **Lasts:** Always.
- **Built:** yes

### Bare-Handed Guard (Combat – Unarmed, passive) · T3d2

*Story:* With nothing in your hands, nothing slows you. Your Dodge is 5 higher, and 5 higher again while you hold no weapon.

- **Kind:** Always on
- **Trigger:** Always; and the owner makes a Dodge roll.
- **Conditions:** The extra +5 needs the owner to hold no item with a weapon mode.
- **Effect:** +5 true skill in Dodge. While holding no weapon, Dodge rolls also get +5 effective skill (CONFIG.BARE_HANDED_GUARD, placeholder).
- **Lasts:** Always.
- **Built:** yes

### Second Wind (Combat – Defense, Endurance) · T4b

*Story:* When the blood starts to run, you find more in you. Once a fight, at your first serious wound, you shake one off.

- **Kind:** Automatic
- **Trigger:** An attack leaves the owner at Wounded or worse on the health track.
- **Conditions:** Once per engagement. The owner is not down (Incapacitated or worse).
- **Effect:** The owner's health lost drops to the top of the level one better (Wounded to Injured: 45% lost). Body parts are unchanged.
- **Lasts:** Permanent (it is healing).
- **Cooldown:** Once per engagement.
- **Built:** yes

### Last to Fall (Fortitude, passive) · T4f

*Story:* The worse it gets, the steadier you are. Once you are badly hurt, fear takes a quarter less out of you.

- **Kind:** Always on
- **Trigger:** The owner loses morale.
- **Conditions:** The owner is at Wounded or worse on the health track.
- **Effect:** The morale lost is ×0.75 (CONFIG.LAST_TO_FALL_MULT, placeholder).
- **Lasts:** Always.
- **Built:** yes

### Dodgy (Combat – Defense, Dodge) · T4d

*Story:* You are never quite where they aim. Attacks on you lose 10 skill.

- **Kind:** Always on
- **Trigger:** An attack roll is made against the owner.
- **Effect:** That attack roll gets −10 effective skill (a foe_perk modifier, CONFIG.DODGY_SKILL, placeholder).
- **Lasts:** That roll.
- **Built:** yes

### Thick Hide (Combat – Defense, passive) · T4e

*Story:* Blows that would cut others only bruise you. Every hit lands a little lighter, before your armor takes its share.

- **Kind:** Always on
- **Trigger:** A hit lands on the owner's body (not a shield).
- **Effect:** The hit's damage before armor is ×0.95 (CONFIG.THICK_HIDE_MULT, placeholder).
- **Lasts:** Always.
- **Built:** yes

### Against the Grain (Combat – Defense, Parry) · T4g

*Story:* A heavy blade is no harder to turn than any other. Heavy weapons lose their edge against your parry.

- **Kind:** Always on
- **Trigger:** The owner parries a heavy melee weapon.
- **Effect:** The heavy-weapon gap shift (−1, HEAVY_VS_BLOCK_GAP) is not applied to the owner's parries. Blocks still take it.
- **Lasts:** Always.
- **Built:** yes

### Iron Rim (Combat – Defense, Block) · T4h

*Story:* Your shield is bound to last. It wears down a quarter slower than anyone else's.

- **Kind:** Always on
- **Trigger:** A blow lands on the owner's shield.
- **Effect:** The damage the shield's pool takes is ×0.75 (CONFIG.IRON_RIM_MULT, placeholder). Shield Breaker's ×2 still applies on top.
- **Lasts:** Always.
- **Built:** yes

### Grit (Fortitude, Resolve) · T4i

*Story:* A hard body makes a hard mind. A quarter of your Endurance adds to every Resolve roll, morale rolls included, and both skills learn from them.

- **Kind:** Always on
- **Trigger:** The owner makes a Resolve roll (a morale roll, or an answer to an aura).
- **Conditions:** The Fortitude tree is open to the owner.
- **Effect:** Endurance augments Resolve: the roll adds the owner's true Endurance × 0.25 (CONFIG.GRIT_SHARE, placeholder) × its tier, the way a skill augment does, and Endurance can learn from the roll the same way.
- **Lasts:** Always.
- **Built:** yes

### Spotter (Perception, passive) · T5b

*Story:* What you see, your people sense. Your band-mates beside you know something is there whenever you do.

- **Kind:** Always on
- **Trigger:** The end of each turn.
- **Conditions:** The owner is aware of an actor outside its band. A band-mate is in the owner's zone and is less than suspicious of that actor.
- **Effect:** That band-mate becomes suspicious of the actor (told by the owner), with its zone as last known.
- **Lasts:** Until the band-mate's belief changes on its own.
- **Built:** yes

### Curiouser and Curiouser (Perception, passive) · T5d

*Story:* Once you notice something, you notice everything. A good sight or hearing roll counts one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes a sight or hearing roll (any skill with that function, Tremor included).
- **Conditions:** The roll ends in Success or better.
- **Effect:** Tier shift +1 on that roll. In a contest it wins more close calls: a tie becomes a win, a loss a tie.
- **Lasts:** That roll.
- **Built:** yes

### Every Sense One (Perception, Eyesight) · T5-150

*Story:* Your senses have run together. What you see, you hear, and what you hear, you see: a voice in the dark has a face, and a figure across the yard has a voice.

- **Kind:** Always on
- **Trigger:** The owner perceives an event, or makes a sight or hearing roll.
- **Conditions:** The All-150 part of both Eyesight and Earshot: granted with the Perception All-150 when either of them is at 150.
- **Effect:** The owner perceives every event as well as the better of its sight and its hearing would allow, and by both senses at once: whatever it hears, it sees as clearly (who and what), and whatever it sees, it hears (spoken words included). Every sight or hearing roll (by function) uses the best of the owner's sight and hearing skills, so light only matters when a sight skill is the one rolling.
- **Lasts:** Always.
- **Built:** yes

### Know the Step (Perception, Earshot) · T5f

*Story:* A cough, a gait, the way a voice drops. You know the people you have met by sound alone.

- **Kind:** Always on
- **Trigger:** The owner hears someone it can't see (sound only).
- **Conditions:** The owner knows that someone's name.
- **Effect:** The owner learns who it is: the heard event and any words spoken name them, as if seen.
- **Lasts:** That event.
- **Built:** yes

### Night Eyes (Perception, Eyesight) · T5e

*Story:* The dark hides little from you. Light counts one step brighter when you look.

- **Kind:** Always on
- **Trigger:** The owner makes an Eyesight roll.
- **Effect:** The light there is read one step brighter (dark as dim, dim as bright). The mirror of Child of Night.
- **Lasts:** That roll.
- **Built:** yes

### Strike and Fade (Stealth – Conventional, Combat Stealth) · T6a

*Story:* They see the blow, never the hand. Right after you strike from hiding, you try to vanish again.

- **Kind:** Automatic
- **Trigger:** The owner attacks while stealthy.
- **Conditions:** The owner is still active after the attack.
- **Effect:** The owner is stealthy again and vanishes in place: each observer makes a Vanishing contest against the owner, as a Vanish does, which can break the sight of those who see the owner. It does not use the owner's action or move.
- **Lasts:** That contest.
- **Built:** yes

### Child of Night (Stealth – Conventional, passive) · T6c

*Story:* The dark knows you. Light counts one step darker for all your stealth.

- **Kind:** Always on
- **Trigger:** The owner makes a roll of a stealth skill (Sneaking, Combat Stealth, Vanishing).
- **Effect:** The light there is read one step darker (bright as dim, dim as dark).
- **Lasts:** That roll.
- **Built:** yes

### Hushed Steps (Stealth – Conventional, Sneaking) · T6d

*Story:* Even your mistakes are quiet. Against someone who can only hear you, a Sneaking slip that only just fails still counts as a success.

- **Kind:** Always on
- **Trigger:** The owner makes a Sneaking roll in a stealth contest.
- **Conditions:** The observer perceives the owner by sound (hearing), not sight. The roll ends in a Near Miss.
- **Effect:** Tier shift +1 on that roll, so it counts as a Success. Only Failure or worse is heard.
- **Lasts:** That roll.
- **Open:** Renamed from the doc's "Light Feet", which is already a 40 perk.
- **Built:** yes

### Soft Landing (Speech, Persuasion) · T7a

*Story:* Even your stumbles sound reasonable. A speech roll that goes wrong counts one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes a Persuasion, Intimidation or Barter roll.
- **Conditions:** The roll ends in a Near Miss or worse.
- **Effect:** Tier shift +1 on that roll.
- **Lasts:** That roll.
- **Built:** yes

### Easy Speaker (Speech, Barter) · T7d

*Story:* Words slide off you. When someone tries to talk you round, your answer lands one outcome better.

- **Kind:** Always on
- **Trigger:** The owner answers a speech contest: someone speaks to it with Persuasion, Intimidation or Barter.
- **Effect:** Tier shift +1 on the owner's answering roll.
- **Lasts:** That roll.
- **Open:** Only the player starts speech contests today, so this helps NPC owners. When NPCs speak to the player with a roll (OQ-29), it covers the player too.
- **Built:** yes

### Silver Words (Speech, passive) · T7e

*Story:* You know which words land. +5 to Persuasion, Intimidation and Barter.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in Persuasion, Intimidation and Barter.
- **Lasts:** Always.
- **Built:** yes

## Linked perks

### Crushing Presence (Intimidation) · L1

*Story:* Your presence and your will have become one thing. Every aura you carry presses harder.

- **Kind:** Always on (linked perk)
- **Trigger:** The owner has both Dread Presence and Overwhelm.
- **Effect:** +5 true skill to every aura skill (the skills the game's auras roll: today Intimidation).
- **Lasts:** While the owner has both perks.
