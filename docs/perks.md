# Perks: chosen and banked

<!-- Generated from src/library/perks.ts by `npm run perks-doc`. Edit that file, not this one. -->

Ladder perks by skill and milestone (Part 1 §5, Skill ladders), as Ali picked them on the 20 milestone page (https://claude.ai/artifact/WkMeSULi8AjSWxeK4jAdwg), 07/11/2026. Review page: https://claude.ai/artifact/DE4FDK98f9uBy7s9Ce41qn. Perks are coded, so each one states exactly when it applies (Ali).

Each perk has two views that must say the same thing (Ali, 07/11/2026). **Story** is what a player reads when choosing. **Rules** is exactly what code applies, and is the basis for building it. The Perks screen in the game switches between them.

**Terms.** *Owner*: the actor who has the perk. *Hits*: an attack whose outcome is grazed, blocked, full hit, heavy hit or crushing hit (not missed or dodged). *Light/medium/heavy melee or ranged mode*: the attack mode's tree and class (Part 5 §5); thrown weapons are ranged. *Gap* and *tier shift*: Part 1 §4 and Part 3, Defense. *Next turn*: until the end of that actor's next turn. *Engagement*: Part 2, Encounter modes (E1). *Move*: an action the owner chooses on its turn.

The 40, 80 and 120 perks are simple number boosts (such as +5/+10/+15 true skill). Swordsman, lockpicking and slime skills have no perks for now.

## 20 milestone

### Hidden Strike (Light weapons) · A1

*Story:* A short blade is deadliest when the victim never sees it coming. Your light-weapon attacks against someone who hasn't noticed you land one outcome better.

- **Kind:** Always on
- **Trigger:** The owner makes a melee attack.
- **Conditions:** The attack uses a light melee mode (skill melee_light). The target is unaware of the owner when the attack resolves (the same test that starts an ambush).
- **Effect:** Tier shift +1 on the attack roll.
- **Lasts:** That attack.

### Turn the Blade (Medium weapons) · A2

*Story:* You catch their swing on your own blade and turn it aside. When you block a melee attack cleanly with a medium weapon (not a shield), the attacker is left open: your next melee attack on it, before the end of your next turn, lands one outcome better.

- **Kind:** Always on
- **Trigger:** The owner blocks a melee attack.
- **Conditions:** The owner blocks with a medium melee weapon held in a working Grip arm (not a shield). The gap is +2 or better for the owner.
- **Effect:** The attacker is marked as open to the owner. The owner's next melee attack on that attacker gets tier shift +1, and the mark clears.
- **Lasts:** Until the end of the owner's next turn.

### Shield Breaker (Heavy weapons) · A3

*Story:* Your heavy weapon has no patience for shields. When a foe blocks your heavy weapon with a shield, the shield takes double damage and soon splinters.

- **Kind:** Always on
- **Trigger:** The owner's melee attack is resolved.
- **Conditions:** The attack uses a heavy melee mode (skill melee_heavy). The defender blocked with a shield, so the hit lands on the shield (location how = shield).
- **Effect:** The shield's pool takes double the damage. Damage to the defender itself is unchanged.
- **Lasts:** That attack.

### Point Blank (Light ranged) · A4

*Story:* Most archers panic when a foe closes in. You keep your nerve: with a light ranged weapon you take no penalty for shooting while a hostile is in your zone.

- **Kind:** Always on
- **Trigger:** The owner makes a ranged attack.
- **Conditions:** The attack uses a light ranged mode (shortbow, thrown dagger; skill ranged_light). A hostile actor is in the owner's zone.
- **Effect:** The −10 ranged modifier for a hostile in the shooter's zone is not applied.
- **Lasts:** That attack.

### Hunter's Mark (Medium ranged) · A5

*Story:* Once your arrow has found a foe, you have its measure. After a medium ranged hit, your next shot at that foe lands one outcome better, as long as it comes in the same fight.

- **Kind:** Always on
- **Trigger:** The owner's ranged attack hits (outcome grazed, blocked, full, heavy or crushing hit).
- **Conditions:** The attack uses a medium ranged mode (longbow, thrown spear; skill ranged_medium).
- **Effect:** The target is marked. The owner's next ranged attack on that target gets tier shift +1, and the mark clears.
- **Lasts:** Until it is used or the engagement ends.
- **Open:** Should the follow-up be any ranged attack (as written) or only a medium ranged one?

### Leg Bolt (Heavy ranged) · A6

*Story:* Your crossbow bolts go for the legs. A bolt that wounds a leg hurts the leg one and a half times as much as usual, and the target is slowed: it can move only one zone link until the end of its next turn.

- **Kind:** Always on
- **Trigger:** The owner's ranged attack hits a part with the Move role (a leg) and deals damage.
- **Conditions:** It is a ranged attack with a heavy ranged mode (crossbow; skill ranged_heavy). The location is a part with the Move role. Damage after armor is above 0.
- **Effect:** The leg's pool takes 1.5× the damage the hit puts on the health track. The target is slowed: it can move at most one zone link.
- **Lasts:** The slow lasts until the end of the target's next turn.
- **Needs first:** A slowed state; a move allowance per turn (part of the action-economy talk).

### Open-Hand Guard (Strike) · A7

*Story:* You catch and turn blows on your hands and forearms. With empty hands and no weapon or shield, you can still block.

- **Kind:** Always on
- **Trigger:** The owner defends with block.
- **Conditions:** The owner holds no shield or weapon, and has at least one working Grip arm with an empty hand.
- **Effect:** The owner may block (block normally needs a held shield or weapon). The block uses the block column of the gap ladder.
- **Lasts:** Each defense.
- **Open:** Where does a blocked hit that still deals damage land? I suggest the blocking arm, the way a shield takes the hit for a shield block.

### Hold (Grapple) · A8

*Story:* When your grapple lands with a Great Success or better, you lock on. The target is held: it can't leave your zone or use a two-handed weapon until it breaks free, you go down, or you leave the zone.

- **Kind:** Always on
- **Trigger:** The owner's grapple attack is resolved.
- **Conditions:** The attack uses skill unarmed_grapple. The attack roll is Great Success or better. The attack hits (not missed or dodged).
- **Effect:** The target is held by the owner: it can't leave the owner's zone and can't use a two-handed attack mode.
- **Lasts:** Until the target breaks free, the owner is downed, or the owner leaves the zone.
- **Needs first:** A held state; a break-free move.
- **Open:** How does the target break free? I suggest a move: a grapple-against-grapple contest; the target wins on a gap of 0 or better.

### Dirt in the Eyes (Improvisation) · A9

*Story:* A fistful of dirt, a splash of ale, whatever is close. Once per fight, with a free hand, you throw it in the face of a foe in your zone. It tries to dodge; if it fails, its next roll that needs sight is two outcomes worse.

- **Kind:** Move, once per engagement
- **Trigger:** The owner uses the move on a foe in the owner's zone.
- **Conditions:** The owner has a free hand. Not used yet in this engagement.
- **Effect:** An unarmed_improvised attack roll against the foe's dodge. If the foe does not win, its next roll that needs sight gets tier shift −2.
- **Lasts:** Until that roll is made, or the end of the foe's next turn.
- **Needs first:** Moves; engagement tracking.
- **Open:** Is a contest against the foe's dodge right, or should it always work?

### Make Them Stumble (Dodge) · A10

*Story:* Slip a melee blow cleanly and the attacker lurches past you, off balance. Its next defense, before the end of its next turn, is one outcome worse.

- **Kind:** Always on
- **Trigger:** The owner dodges a melee attack.
- **Conditions:** The gap is +2 or better for the owner.
- **Effect:** The attacker's next defense roll gets tier shift −1.
- **Lasts:** Until the end of the attacker's next turn.

### Cover Ally (Block) · A11

*Story:* You step in front of a friend. While you stand ready to block, you can block an attack aimed at an ally in your zone, using your own block. It counts as one of your defenses that turn.

- **Kind:** Always on
- **Trigger:** An attack targets an actor friendly to the owner in the owner's zone.
- **Conditions:** The owner's standing defense is block and the owner can block (working Grip arm with a shield or weapon). The owner is active.
- **Effect:** The owner defends in the ally's place with the owner's own block roll. It counts as one of the owner's defenses this turn (outnumbered).
- **Lasts:** Each attack.
- **Open:** Is it automatic, or only when the owner's block is better than the ally's own defense? And does a hit that gets through land on the ally or on the owner?

### Iron Frame (Endurance) · A12

*Story:* Bruises and sprains don't slow you. A Damaged body part gives you no penalty; only Crippled or Destroyed parts still hold you back.

- **Kind:** Always on
- **Trigger:** Any roll by the owner.
- **Conditions:** A body part is Damaged.
- **Effect:** Damaged parts give no role penalty. Crippled and Destroyed parts still do.
- **Lasts:** Always.

### Read Wounds (Sight) · A13

*Story:* You notice a limp, a favoured arm, a bleeding hand. You can see which of a foe's body parts are Damaged, though not how close it is to falling.

- **Kind:** Always on
- **Trigger:** The owner perceives a foe by sight.
- **Conditions:** The owner can see the foe.
- **Effect:** The foe's Damaged body parts are visible to the owner (normally hidden). The foe's health-track level stays hidden.
- **Lasts:** While the owner sees it.

### Keen Ear (Hearing) · A14

*Story:* You hear footsteps and voices from farther away than most. Your hearing reaches one zone link further.

- **Kind:** Always on
- **Trigger:** A perception check for the owner by sound.
- **Effect:** The owner's hearing range is one zone link longer.
- **Lasts:** Always.

### Quick Word (Persuasion) · A15

*Story:* In the heat of a fight, a short line costs you nothing. Once a turn, a one-sentence remark is spoken without using up your action.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner both speaks and acts.
- **Conditions:** The line is short (one sentence).
- **Effect:** The line resolves as talk without using the owner's action.
- **Lasts:** Once per turn.

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
- **Needs first:** Buying and selling.

## Higher milestone

### Precise (Light weapons) · B1

*Story:* With a light blade you pick your spot. Aiming at a small body part costs you only half the usual penalty.

- **Kind:** Always on
- **Trigger:** The owner makes an aimed melee attack.
- **Conditions:** The attack uses a light melee mode.
- **Effect:** The aim penalty for the part's size is halved.
- **Lasts:** That attack.

### Disarming Cut (Medium weapons) · B2

*Story:* A cut to the arm makes the hand open. When your medium weapon wounds an arm, the target drops whatever that hand holds.

- **Kind:** Always on
- **Trigger:** The owner's melee attack hits a part with the Grip role (an arm) and deals damage.
- **Conditions:** The attack uses a medium melee mode. Damage to that part is above 0.
- **Effect:** The target drops what that arm's hand holds, into its zone.
- **Lasts:** That attack.
- **Open:** Should it also drop a shield, or weapons only?

### Cleave (Heavy weapons) · B3

*Story:* When your heavy swing fells a foe, it carries on. Once a turn, you get a free attack at another foe in reach in your zone.

- **Kind:** Always on
- **Trigger:** The owner's heavy melee attack downs its target.
- **Conditions:** Another hostile active actor is in the owner's zone, within reach.
- **Effect:** The owner makes one extra attack at that actor at once, with the same weapon. Code picks the target at random (seeded) if there are several.
- **Lasts:** Once per turn.

### Shoot and Move (Light ranged) · B4

*Story:* You loose an arrow and change position in the same breath. On a turn you shoot a light ranged weapon, you can also move one zone link.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner's order is a light ranged attack.
- **Effect:** The owner may also move one zone link, before or after the shot.
- **Lasts:** Each turn.
- **Needs first:** Action economy.

### Pinning Shot (Medium ranged) · B5

*Story:* An arrow through the leg keeps a foe where it stands. When your medium ranged shot wounds a leg, the target can't leave its zone until the end of its next turn.

- **Kind:** Always on
- **Trigger:** The owner's medium ranged attack hits a part with the Move role and deals damage.
- **Effect:** The target can't leave its zone.
- **Lasts:** Until the end of the target's next turn.
- **Needs first:** A pinned state.

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

### Untouchable (Dodge) · B8

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
- **Open:** Shield only (as the name says), or any block?

### Refuse to Fall (Endurance) · B10

*Story:* Once per fight, when a blow should drop you, you stay on your feet at the last health level before going down, unless the blow destroyed your head or neck.

- **Kind:** Always on, once per engagement
- **Trigger:** Damage would down the owner.
- **Conditions:** Not used yet in this engagement. The damage did not destroy an essential part (head, neck).
- **Effect:** The owner stays active at the lowest health level above downed.
- **Lasts:** Once per engagement.
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

*Story:* When you cut a foe down, those who see it lose heart. Every other foe that sees it makes a morale check at once.

- **Kind:** Always on
- **Trigger:** The owner's attack downs a foe.
- **Conditions:** Other foes hostile to the owner see it happen.
- **Effect:** Each of those foes makes a morale check at once.
- **Lasts:** Each time.

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
- **Lasts:** Once per engagement.
- **Needs first:** Moves.
- **Open:** Once per engagement, or unlimited?

### Buy Them Off (Barter) · C3

*Story:* In the middle of a fight you offer coin. Win a barter contest and the foe takes the coin and stops attacking you for the rest of the fight.

- **Kind:** Move
- **Trigger:** The owner offers coin to a foe in a fight.
- **Conditions:** The owner has the coin.
- **Effect:** Barter contest against the foe. If the owner wins, the coin changes hands and the foe stops attacking the owner.
- **Lasts:** For the rest of the engagement.
- **Needs first:** Moves.
- **Open:** How much coin? I suggest the owner names the amount and a bigger offer adds a modifier.

## Banked, no milestone yet

### Held Shot (Medium ranged) · D8

*Story:* You hold your bow drawn and wait. Instead of acting, you ready a medium ranged weapon: the first hostile to enter your zone before the end of your next turn takes a shot before it can act.

- **Kind:** Move
- **Trigger:** The owner readies a medium ranged weapon instead of acting.
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

*Story:* With both hands free, you throw two quick punches a turn, each one outcome less sure.

- **Kind:** Always on
- **Trigger:** A tactical turn in which the owner's order is an unarmed strike.
- **Conditions:** Both Grip arms work and hold nothing.
- **Effect:** The owner attacks twice, each attack with tier shift −1.
- **Lasts:** Each turn.
- **Needs first:** Action economy.

### Roll With It (Dodge) · D5

*Story:* A blow that only grazes you does no harm at all.

- **Kind:** Always on
- **Trigger:** The owner dodges and the gap is +1 (a graze).
- **Effect:** The multiplier is 0× instead of 0.8×.
- **Lasts:** Always.

### Tough It Out (Endurance) · D6

*Story:* Pain slows you later than it slows others. Your wound penalty is taken as if you were one health level less hurt.

- **Kind:** Always on
- **Trigger:** Any roll by the owner.
- **Effect:** The health-track penalty is taken from one level less hurt.
- **Lasts:** Always.

### Night Eyes (Sight) · D7

*Story:* Darkness doesn't hinder your eyes. Dim light and darkness give you no penalty to anything that needs sight.

- **Kind:** Always on
- **Trigger:** A roll by the owner that needs sight.
- **Effect:** Dim and dark light give no penalty: both count as bright.
- **Lasts:** Always.
