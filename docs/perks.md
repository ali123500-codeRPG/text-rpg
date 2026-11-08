# Perks: chosen and banked

<!-- Generated from src/library/perks.ts by `npm run perks-doc`. Edit that file, not this one. -->

Ladder perks by skill and milestone (Part 1 §5, Skill ladders), as Ali picked them on the 20 milestone page (https://claude.ai/artifact/WkMeSULi8AjSWxeK4jAdwg), 07/11/2026. Review page: https://claude.ai/artifact/DE4FDK98f9uBy7s9Ce41qn. Perks are coded, so each one states exactly when it applies (Ali).

Each perk has two views that must say the same thing (Ali, 07/11/2026). **Story** is what a player reads when choosing. **Rules** is exactly what code applies, and is the basis for building it. The Perks screen in the game switches between them.

**Terms.** *Owner*: the actor who has the perk. *Hits*: an attack whose outcome is grazed, blocked, full hit, heavy hit or crushing hit (not missed or dodged). *Light/medium/heavy melee or ranged mode*: the attack mode's tree and class (Part 5 §5); thrown weapons are ranged. *Gap* and *tier shift*: Part 1 §4 and Part 3, Defense. *Next turn*: until the end of that actor's next turn. *Engagement*: Part 2, Encounter modes (E1). *Move*: an action the owner chooses on its turn.

The 20, 60, 100 and 140 perks change what a character can do. The 40, 80 and 120 perks raise numbers only, with no conditions: +5 true skill in the skill, +1 to every skill of its function, itself included, and one more number (Ali, 08/11/2026). Swordsman, lockpicking and slime skills have no perks for now.

## 20 milestone

### Hidden Strike (Light weapons) · A1

*Story:* Strike someone who never sees you coming. Any attack you make on someone who hasn't noticed you lands one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes an attack.
- **Conditions:** Any attack (Ali, 07/11/2026). The target is unaware of the owner when the attack resolves (the same test that starts an ambush).
- **Effect:** Tier shift +1 on the attack roll.
- **Lasts:** That attack.

### Turn the Blade (Medium weapons) · A2

*Story:* You catch their swing on your own blade and turn it aside. When you block a melee attack cleanly with any melee weapon, the attacker is left open: your next melee attack on it lands one outcome better, any time before the fight ends.

- **Kind:** Always on
- **Trigger:** The owner blocks a melee attack.
- **Conditions:** The owner blocks with any melee weapon held in a working Grip arm. The gap is +2 or better for the owner.
- **Effect:** The attacker is marked as open to the owner. The owner's next melee attack on that attacker gets tier shift +1, and the mark clears.
- **Lasts:** Until it is used or the engagement ends.

### Shield Breaker (Heavy weapons) · A3

*Story:* Your heavy weapon has no patience for shields. When a foe blocks your heavy weapon with a shield, the shield takes double damage and soon splinters.

- **Kind:** Always on
- **Trigger:** The owner's melee attack is resolved.
- **Conditions:** The attack uses a heavy melee mode (skill melee_heavy). The defender blocked with a shield, so the hit lands on the shield (location how = shield).
- **Effect:** The shield's pool takes double the damage. Damage to the defender itself is unchanged.
- **Lasts:** That attack.

### Point Blank (Light ranged) · A4

*Story:* Most archers panic when a foe closes in. You keep your nerve: with any ranged weapon you take no penalty for shooting while a hostile is in your zone.

- **Kind:** Always on
- **Trigger:** The owner makes a ranged attack.
- **Conditions:** Any ranged attack, thrown included. A hostile actor is in the owner's zone.
- **Effect:** The −10 ranged modifier for a hostile in the shooter's zone is not applied.
- **Lasts:** That attack.

### Hunter's Mark (Medium ranged) · A5

*Story:* Once your shot has found a foe, you have its measure. After any ranged hit, your next shot at that foe lands one outcome better, as long as it comes in the same fight.

- **Kind:** Always on
- **Trigger:** The owner's ranged attack hits (outcome grazed, blocked, full, heavy or crushing hit).
- **Conditions:** Any ranged attack.
- **Effect:** The target is marked. The owner's next ranged attack on that target gets tier shift +1, and the mark clears.
- **Lasts:** Until it is used or the engagement ends.

### Leg Bolt (Heavy ranged) · A6

*Story:* Your bolts and arrows go for the legs. With a medium or heavy ranged weapon, a shot that wounds a leg hurts it one and a half times as much as usual, and the target is slowed: it can move only one zone link until the end of its next turn.

- **Kind:** Always on
- **Trigger:** The owner's ranged attack hits a part with the Move role (a leg) and deals damage.
- **Conditions:** It is a ranged attack with a medium or heavy ranged mode (skill ranged_medium or ranged_heavy) (Ali, 07/11/2026). The location is a part with the Move role. Damage after armor is above 0.
- **Effect:** The leg's pool takes 1.5× the damage the hit puts on the health track. The target is slowed: it can't dash (AE2).
- **Lasts:** The slow lasts until the end of the target's next turn.

### Open-Hand Guard (Strike) · A7

*Story:* You catch and turn blows on your hands and forearms. With empty hands and no weapon or shield, you can still block. A blow that gets through lands half on your arm and half on your body.

- **Kind:** Always on
- **Trigger:** The owner defends with block.
- **Conditions:** The owner holds no shield or weapon, and has at least one working Grip arm with an empty hand.
- **Effect:** The owner may block (block normally needs a held shield or weapon). The block uses the block column of the gap ladder. A hit that gets through is split: 0.5× of its damage goes to the blocking arm (a working Grip arm with an empty hand) and 0.5× to the general area; both count on the health track. The 0.5 shares are placeholders to test (Ali, 07/11/2026).
- **Lasts:** Each defense.

### Hold (Grapple) · A8

*Story:* When your grapple lands with a Great Success or better, you lock on. The target is held: it can't leave your zone or use a two-handed weapon until it wins a grapple contest against you (a tie is enough), you go down, or you leave the zone. Anyone can grapple: without the skill, a fighter uses a weapon skill at a fifth of its value, or another unarmed skill at two fifths.

- **Kind:** Always on
- **Trigger:** The owner's grapple attack is resolved.
- **Conditions:** The attack uses skill unarmed_grapple. The attack roll is Great Success or better. The attack hits (not missed or dodged).
- **Effect:** The target is held by the owner: it can't leave the owner's zone and can't use a two-handed attack mode. On its turn the held target can try to break free as its move: a grapple contest against the owner, which the target wins on a gap of 0 or better. A held target that tries to leave the zone makes this try instead, and stays in the zone either way. The grapple check uses unarmed_grapple at full value, any skill with function arms at 0.2×, or any other skill with function unarmed at 0.4× (Ali, 07/11/2026; docs/skill-tags.md).
- **Lasts:** Until the target breaks free, the owner is downed, or the owner leaves the zone.

### Dirt in the Eyes (Improvisation) · A9

*Story:* A fistful of dirt, a splash of ale, whatever is close. Once per fight, with a free hand and without giving up your action, you throw it in the face of a foe in your zone. It tries to dodge; if it fails, its next roll that needs sight is two outcomes worse.

- **Kind:** Free move
- **Trigger:** The owner uses the move on a foe in the owner's zone. It does not use the owner's action (Ali, 07/11/2026).
- **Conditions:** The owner has a free hand.
- **Effect:** An unarmed_improvised attack roll against the foe's dodge. If the foe does not win, its next roll that needs sight gets tier shift −2.
- **Lasts:** Until that roll is made, or the end of the foe's next turn.
- **Cooldown:** Once per engagement.

### Make Them Stumble (Dodge) · A10

*Story:* Slip a melee blow cleanly and the attacker lurches past you, off balance. Its next defense, before the end of its next turn, is one outcome worse.

- **Kind:** Always on
- **Trigger:** The owner dodges a melee attack.
- **Conditions:** The gap is +2 or better for the owner.
- **Effect:** The attacker's next defense roll gets tier shift −1.
- **Lasts:** Until the end of the attacker's next turn.

### Cover Ally (Block) · A11

*Story:* You step in front of a friend. When an arrow or bolt flies at an ally in your zone and your block is better than the ally's own defense, you block it in their place; anything that gets through hits you. It counts as one of your defenses that turn. You can switch it off for any character.

- **Kind:** Always on; can be switched off per character (on by default)
- **Trigger:** A ranged attack targets an actor friendly to the owner in the owner's zone.
- **Conditions:** The owner's standing defense is block and the owner can block (working Grip arm with a shield or weapon). The owner is active. The owner's block value is higher than the value of the ally's own standing defense. Cover Ally is switched on for the owner (a per-character switch, on by default).
- **Effect:** The owner defends in the ally's place with the owner's own block roll. A hit that gets through lands on the owner, who stepped into its path. It counts as one of the owner's defenses this turn (outnumbered).
- **Lasts:** Each attack.

### Iron Frame (Endurance) · A12

*Story:* Bruises and sprains don't slow you. A body part that counts as Damaged gives you no penalty; worse wounds still hold you back. With Tough It Out, even a Crippled part no longer slows you.

- **Kind:** Always on
- **Trigger:** Any roll by the owner.
- **Conditions:** A body part's effective state is Damaged or milder (see Effect).
- **Effect:** Part states are read on their reference scale, by position in the part-state names table (Healthy, Damaged, Crippled, Destroyed). A part's effective state is its state after any perk that shifts it (Tough It Out moves each one step milder). A part whose effective state is at the Damaged position or milder gives no role penalty; worse effective states still do. So with Tough It Out a Crippled part counts as Damaged and gives no penalty.
- **Lasts:** Always.

### Read Wounds (Sight) · A13

*Story:* You notice a limp, a favoured arm, a bleeding hand. You can see which of a foe's body parts are Damaged, and you can tell a foe is hurt one step sooner than others can: from Injured instead of Wounded.

- **Kind:** Always on
- **Trigger:** The owner perceives a foe by sight.
- **Conditions:** The owner can see the foe.
- **Effect:** The foe's Damaged body parts are shown to the owner (foes' part states are otherwise never shown). The foe's health level also shows one step earlier on the health track: the level where it starts to show moves one position milder in the health-track names table (from Wounded to Injured today) (Ali, 07/11/2026).
- **Lasts:** While the owner sees it.

### Keen Ear (Hearing) · A14

*Story:* You hear footsteps and voices from farther away than most. Your hearing reaches one zone link further.

- **Kind:** Always on
- **Trigger:** A perception check for the owner by sound.
- **Effect:** Sound reaches the owner one zone link further: both the clear and the half reach of every noise level go up one link (CONFIG.NOISE_REACH). Nowhere is the step below the same zone, so a Silent sound is heard like a Hushed one, and a Quiet sound is heard clearly one link away (Ali, 08/11/2026).
- **Lasts:** Always.

### Quick Word (Persuasion) · A15

*Story:* In the heat of a fight, a short line costs you nothing. Once a turn, a one-sentence remark is spoken without using up your action, and the answer it gets costs the other side nothing either.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner both speaks and acts.
- **Conditions:** The line is short (one sentence).
- **Effect:** The line resolves as talk without using the owner's action. An NPC's spoken reply to that line is also free: it doesn't use the NPC's action (Ali, 07/11/2026).
- **Lasts:** That line.
- **Cooldown:** Once per turn.
- **Open:** Trial perk: test in play how NPCs answer. Ali drops it if the free exchange doesn't work.

### Threaten for Answers (Intimidation) · A16

*Story:* When someone won't help you willingly, fear works as well as charm. Asking an unfriendly or hostile person for information, your intimidation counts at its full value instead of half.

- **Kind:** Always on
- **Trigger:** The owner tries to get information from an NPC.
- **Conditions:** The NPC's stance to the owner is opposed or hostile.
- **Effect:** Intimidation counts as a named skill for the request (full value), not a substitute at half value.
- **Lasts:** Each request.

### Haggler (Barter) · A17

*Story:* Merchants sigh when they see you coming. You buy for 10% less and sell for 10% more.

- **Kind:** Always on
- **Trigger:** The owner buys or sells.
- **Effect:** Buying prices ×0.9; selling prices ×1.1.
- **Lasts:** Always.
- **Needs first:** Buying and selling (D-93).
- **Open:** Kept only if trade prices make a sale at 1.1× still pay less than buying the same item at 0.9× (Ali, 07/11/2026). That needs the price a merchant pays the player to be under 0.81× of the price it charges (1.1 × sell < 0.9 × buy).

## 40 milestone

### Keen Edge (Light weapons) · P1

*Story:* +5 Light weapons, +1 Melee. Your light weapons find their mark: +10 to hit with them.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in melee_light. +1 true skill in every skill of group melee. +10 on attack rolls with skill melee_light.
- **Lasts:** Always.

### Guard Drill (Medium weapons) · P2

*Story:* +5 Medium weapons, +1 Melee. Your blocks get better too: +10 Block.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in melee_medium. +1 true skill in every skill of group melee. +10 true skill in block.
- **Lasts:** Always.

### Heavy Hand (Heavy weapons) · P3

*Story:* +5 Heavy weapons, +1 Melee. Your heavy weapons hit 20% harder.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in melee_heavy. +1 true skill in every skill of group melee. Damage of an attack with skill melee_heavy is ×1.2, before armor.
- **Lasts:** Always.

### Sharp Eyes (Light ranged) · P4

*Story:* +5 Light ranged, +1 Ranged. You spot more: +10 Sight.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in ranged_light. +1 true skill in every skill of group ranged. +10 true skill in sight.
- **Lasts:** Always.

### Steady Draw (Medium ranged) · P5

*Story:* +5 Medium ranged, +1 Ranged. A little of both: +5 to hit with medium ranged weapons, and they hit 10% harder.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in ranged_medium. +1 true skill in every skill of group ranged. +5 on attack rolls with skill ranged_medium, and its damage is ×1.1, before armor.
- **Lasts:** Always.

### Armor Piercer (Heavy ranged) · P6

*Story:* +5 Heavy ranged, +1 Ranged. Your bolts punch through armor: it stops 2 less of each hit.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in ranged_heavy. +1 true skill in every skill of group ranged. On a hit with skill ranged_heavy, each armor the hit passes (worn and natural) reduces the damage by 2 less (never below 0).
- **Lasts:** Always.

### Street Fighter (Strike) · P7

*Story:* +5 Strike, +1 Melee. Anything in reach becomes a weapon: +10 Improvisation.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in unarmed_strike. +1 true skill in every skill of group melee. +10 true skill in unarmed_improvised.
- **Lasts:** Always.

### Iron Grip (Grapple) · P8

*Story:* +5 Grapple, +1 Melee. Your holds are harder to escape: +10 on every grapple roll, breaking free included.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in unarmed_grapple. +1 true skill in every skill of group melee. +10 on every roll with skill unarmed_grapple (grapple attacks, and both sides of a break-free contest).
- **Lasts:** Always.

### Brawler's Eye (Improvisation) · P9

*Story:* +5 Improvisation, +1 Melee. Your fists and your eyes sharpen: +5 Strike, +5 Sight.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in unarmed_improvised. +1 true skill in every skill of group melee. +5 true skill in unarmed_strike and +5 in sight.
- **Lasts:** Always.

### Light Feet (Dodge) · P10

*Story:* +5 Dodge, +1 Defense. Quick feet are quiet feet: +10 Sneaking.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in dodge. +1 true skill in every skill of group defense. +10 true skill in sneaking.
- **Lasts:** Always.

### Braced (Block) · P11

*Story:* +5 Block, +1 Defense. Taking blows hardens you: +10 Endurance.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in block. +1 true skill in every skill of group defense. +10 true skill in endurance.
- **Lasts:** Always.

### Quick Mend (Endurance) · P12

*Story:* +5 Endurance, +1 Health. Your body heals twice as fast on its own.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in endurance. +1 true skill in every skill of group health. Natural recovery (the hourly healing row read from endurance) is ×2.
- **Lasts:** Always.

### Marksman's Eye (Sight) · P13

*Story:* +5 Sight, +1 Notice. A good eye guides your shots: +5 Light ranged, +5 Medium ranged.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in sight. +1 true skill in every skill of group notice. +5 true skill in ranged_light and +5 in ranged_medium.
- **Lasts:** Always.

### Soft Step (Hearing) · P14

*Story:* +5 Hearing, +1 Notice. Knowing what others hear, you move quieter: +10 Sneaking.

- **Kind:** Always on
- **Trigger:** Always.
- **Effect:** +5 true skill in hearing. +1 true skill in every skill of group notice. +10 true skill in sneaking.
- **Lasts:** Always.

## Higher milestone

### Precise (Light weapons) · B1

*Story:* You pick your spot. With any attack, aiming at a small body part costs you only half the usual penalty.

- **Kind:** Always on
- **Trigger:** The owner makes an aimed attack.
- **Conditions:** Any attack (Ali, 07/11/2026).
- **Effect:** The aim penalty for the part's size is halved.
- **Lasts:** That attack.

### Disarming Cut (Medium weapons) · B2

*Story:* A cut to the arm makes the hand open. When your medium or heavy weapon wounds an arm, the target drops whatever that hand holds, shield included.

- **Kind:** Always on
- **Trigger:** The owner's melee attack hits a part with the Grip role (an arm) and deals damage.
- **Conditions:** The attack uses a medium or heavy melee mode (Ali, 07/11/2026). Damage to that part is above 0.
- **Effect:** The target drops what that arm's hand holds, weapon or shield, into its zone.
- **Lasts:** That attack.

### Cleave (Heavy weapons) · B3

*Story:* When your heavy swing fells a foe, it carries on. Once a turn, you get a free attack at another foe in reach in your zone.

- **Kind:** Always on
- **Trigger:** The owner's heavy melee attack downs its target.
- **Conditions:** Another hostile active actor is in the owner's zone, within reach.
- **Effect:** The owner makes one extra attack at that actor at once, with the same weapon. Code picks the target at random (seeded) if there are several.
- **Lasts:** That attack.
- **Cooldown:** Once per turn.

### Shoot and Move (Light ranged) · B4

*Story:* You loose a shot and change position in the same breath. On a turn you shoot a light or medium ranged weapon, you can also move one zone link.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner's order is a light or medium ranged attack (Ali, 07/11/2026).
- **Effect:** The owner may also move one zone link, before or after the shot.
- **Lasts:** Each turn.
- **Needs first:** Action economy.

### Human Shield (Grapple) · B6

*Story:* While you hold someone, you turn them into the path of incoming arrows. A ranged attack at you that doesn't beat your defense hits the person you hold instead.

- **Kind:** Always on
- **Trigger:** A ranged attack targets the owner.
- **Conditions:** The owner is holding an actor (Hold).
- **Effect:** If the gap is 0 or better for the owner, the attack resolves against the held actor instead, with no defense from it.
- **Lasts:** Each attack.
- **Needs first:** Hold.

### Anything Goes (Improvisation) · B7

*Story:* A chair leg or a bottle serves you as well as a proper weapon. Improvised weapons lose their hit penalty.

- **Kind:** Always on
- **Trigger:** The owner attacks with an improvised weapon.
- **Effect:** The improvised hit penalty (−10) is not applied.
- **Lasts:** Always.

### Slip the Crowd (Dodge) · B8

*Story:* Surrounded, you slip blows as if you faced only one foe. Your dodge never takes the outnumbered penalty.

- **Kind:** Always on
- **Trigger:** The owner dodges.
- **Effect:** The outnumbered modifier is not applied.
- **Lasts:** Always.

### Shield Wall (Block) · B9

*Story:* Behind your shield, numbers don't matter. Your shield blocks never take the outnumbered penalty.

- **Kind:** Always on
- **Trigger:** The owner blocks.
- **Conditions:** The owner blocks with a shield.
- **Effect:** The outnumbered modifier is not applied.
- **Lasts:** Always.

### Refuse to Fall (Endurance) · B10

*Story:* Once per fight, when a blow should drop you, you stay on your feet at the last health level before going down, unless the blow destroyed your head or neck.

- **Kind:** Always on
- **Trigger:** Damage would down the owner.
- **Conditions:** The damage did not destroy an essential part (head, neck).
- **Effect:** The owner stays active at the lowest health level above downed.
- **Lasts:** Instant.
- **Cooldown:** Once per engagement.
- **Needs first:** Engagement tracking.

### Calm Words (Persuasion) · B11

*Story:* Talk well enough and a foe who wanted you dead lowers its weapon. Winning a persuasion contest by two outcomes or more against someone hostile makes it only wary of you: it stops attacking on sight.

- **Kind:** Always on
- **Trigger:** The owner wins a persuasion contest against an NPC hostile to the owner.
- **Conditions:** The gap is −2 or lower (the owner wins by 2 tiers or more).
- **Effect:** The NPC's stance toward the owner becomes opposed: it stops attacking on sight.
- **Lasts:** Until something changes it again.

### Plead (Persuasion) · B12

*Story:* Beaten and about to fall, you beg for mercy. At the last health level before going down, you can plead with a hostile foe; win a persuasion contest and it stops attacking you for the rest of the fight.

- **Kind:** Move
- **Trigger:** The owner pleads for mercy with a foe.
- **Conditions:** The owner is at the lowest health level above downed. The foe is hostile to the owner.
- **Effect:** Persuasion contest against the foe. If the owner wins, the foe stops attacking the owner.
- **Lasts:** For the rest of the engagement.
- **Needs first:** Moves.

### Menace (Intimidation) · B13

*Story:* When you cut a foe down, those who see or hear it lose heart. Every other foe that sees or hears it makes a morale check at once.

- **Kind:** Always on
- **Trigger:** The owner's attack downs a foe.
- **Conditions:** Other foes hostile to the owner see or hear it happen.
- **Effect:** Each of those foes makes a morale check at once.
- **Lasts:** Each time.

### Unblinking (Sight) · B14

*Story:* Once you have someone in your sights, they don't slip away easily. When someone you can see vanishes and gets past you, they still have to sneak past you as well before you lose them.

- **Kind:** Always on
- **Trigger:** A character the owner sees (aware or tracking) vanishes, and the owner loses the Vanishing contest.
- **Conditions:** The owner saw the character before the Vanish.
- **Effect:** The character must also win a Sneaking contest against the owner, or a Combat Stealth contest while engaged, using the owner's sight. If the character doesn't win it, the owner keeps seeing them.
- **Lasts:** That Vanish.
- **Open:** Sight 60 (Ali, 08/11/2026: "link it"). Works for the player too since NPC stealth (NS10).

### Set Them Up (Strike) · B15

*Story:* Fists and whatever's at hand work together. Every punch you throw at a foe, landed or not, sets up your next improvised attack on it, and every improvised attack sets up your next punch: that attack lands one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes an attack with skill unarmed_strike or unarmed_improvised, hit or miss (Ali, 08/11/2026: it counts on the attempt).
- **Effect:** A Strike attack marks the target for the owner's next unarmed_improvised attack on it; an improvised attack marks the target for the owner's next unarmed_strike attack on it. That attack gets tier shift +1, and the mark clears.
- **Lasts:** Until it is used or the engagement ends.

### One-Two (Improvisation) · B16

*Story:* A bottle in one hand, a fist in the other. When you hit a foe with an improvised weapon and your other hand is empty, you follow up with a free punch at the same foe.

- **Kind:** Always on
- **Trigger:** The owner's attack with skill unarmed_improvised hits (outcome grazed, blocked, full, heavy or crushing hit).
- **Conditions:** The owner has a working Grip arm with an empty hand. The target is still active and in the owner's zone.
- **Effect:** The owner makes one extra attack with skill unarmed_strike (fists) at the same target at once. It doesn't use the owner's action, and can't trigger One-Two again.
- **Lasts:** That attack.

## Very high milestone

### Never Surprised (Hearing) · C1

*Story:* If you could hear it coming, it can't catch you off guard. An attacker within your hearing range never counts as unseen: you lose no initiative or defense for being unaware.

- **Kind:** Always on
- **Trigger:** An attack on the owner while the owner is unaware of the attacker.
- **Conditions:** The attacker's approach or attack is within the owner's hearing range.
- **Effect:** The owner counts as aware: no unaware initiative or defense penalty.
- **Lasts:** Always.

### Battle Cry (Intimidation) · C2

*Story:* Your roar shakes the nerve of every foe close by. Once per fight, every hostile in your zone that hears it makes a morale check.

- **Kind:** Move
- **Trigger:** The owner uses the move.
- **Effect:** Every foe hostile to the owner in the owner's zone that hears it makes a morale check.
- **Lasts:** Instant.
- **Cooldown:** Once per engagement.
- **Needs first:** Moves.

### Buy Them Off (Barter) · C3

*Story:* In the middle of a fight you offer coin, as much as you choose; a bigger offer is harder to refuse. Win a barter contest and the foe takes the coin and stops attacking you for the rest of the fight.

- **Kind:** Move
- **Trigger:** The owner offers coin to a foe in a fight.
- **Conditions:** The owner has the coin.
- **Effect:** The owner names the amount. Barter contest against the foe; a bigger offer adds a modifier to the owner's roll (scale set with trade prices). If the owner wins, the coin changes hands and the foe stops attacking the owner.
- **Lasts:** For the rest of the engagement.
- **Needs first:** Moves.

### Tough It Out (Endurance) · D6

*Story:* Pain slows you later than it slows others. Your wound penalty is taken as if you were one health level less hurt, and every wounded body part hinders you as if it were one step better: a destroyed arm works like a crippled one.

- **Kind:** Always on
- **Trigger:** Any roll by the owner.
- **Effect:** The owner's health-track penalty is taken from one level less hurt. Each body part's effective state is one step milder on the part-state scale, by position in the names table: Destroyed counts as Crippled, Crippled as Damaged, Damaged as Healthy. Only penalties change: a Destroyed part is still gone from the hit table.
- **Lasts:** Always.

## Banked, no milestone yet

### Held Shot (Medium ranged) · D8

*Story:* You hold your shot and wait. Instead of acting, you ready a ranged weapon: the first hostile to enter your zone before the end of your next turn takes a shot before it can act.

- **Kind:** Move
- **Trigger:** The owner readies any ranged weapon instead of acting (Ali, 07/11/2026).
- **Effect:** When a hostile actor enters the owner's zone, the owner shoots it at once, before it acts.
- **Lasts:** Until the end of the owner's next turn, one shot.
- **Needs first:** Moves; reactions.

### Crushing Blow (Heavy weapons) · D1

*Story:* Your heavy blows drive through a block harder than anyone else's. Against a block, your heavy weapon pushes the outcome two steps your way instead of one.

- **Kind:** Always on
- **Trigger:** The owner's heavy melee attack is blocked.
- **Effect:** The heavy-weapon gap shift is −2 instead of −1.
- **Lasts:** That attack.

### Punch Through (Heavy ranged) · D2

*Story:* Your bolt hits a shield so hard that the arm behind it is hurt too. The shield arm takes half the damage the shield took.

- **Kind:** Always on
- **Trigger:** The owner's heavy ranged attack is blocked with a shield.
- **Effect:** The arm holding the shield also takes half the damage the shield took, and it counts on the health track.
- **Lasts:** That attack.

### Staggering Bolt (Heavy ranged) · D3

*Story:* A solid hit from your bolt knocks a foe back. On a full hit or better, the target acts last on its next turn.

- **Kind:** Always on
- **Trigger:** The owner's heavy ranged attack is a full hit or better.
- **Effect:** The target acts last next turn.
- **Lasts:** Its next turn.

### Flurry (Strike) · D4

*Story:* With both hands free, you throw two quick punches a turn; the second is one outcome less sure.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner's order is an unarmed strike.
- **Conditions:** Both Grip arms work and hold nothing.
- **Effect:** The owner attacks twice. The second attack gets tier shift −1 (Ali, 07/11/2026).
- **Lasts:** Each turn.
- **Needs first:** Action economy.

### Roll With It (Dodge) · D5

*Story:* A blow that only grazes you does no harm at all.

- **Kind:** Always on
- **Trigger:** The owner dodges and the gap is +1 (a graze).
- **Effect:** The multiplier is 0× instead of 0.8×.
- **Lasts:** Always.

### Night Eyes (Sight) · D7

*Story:* Darkness doesn't hinder your eyes. Dim light and darkness give you no penalty to anything that needs sight.

- **Kind:** Always on
- **Trigger:** A roll by the owner that needs sight.
- **Effect:** Light is read two steps brighter on the light scale, by position in the names table (dark counts as bright, dim counts as bright). It is coded as +2 steps, not as 'no penalty', so light levels added later shift the same way (Ali, 07/11/2026).
- **Lasts:** Always.
