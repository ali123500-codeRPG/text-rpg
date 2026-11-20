### Agent Parser

Agent Parser turns the player's free text into a structured request. It runs on the smallest fast model, sees only PlayerView, and never narrates or decides outcomes.

Output shape (notation, not literal JSON):

```
{
  move:    { toZone: zone_id, after?: true } | null,
  action:  {
    type:     attack | hide | sneak | talk | persuade | deceive | barter | intimidate | use_item | give | observe | interact | other | rest,
    skill:    skill_id,
    target:   actor_id | zone_id | item_id | furniture_id | null,   // furniture only for use_item, interact, observe, other
    targetPart: part_id | null,     // a body part of the target the player named; never implies aiming
    item:     item_instance_id | null,     // weapon, consumable, tool or item given
    mode:     mode_id | null,              // attack mode; code default if null (Part 5 §5)
    approach: short phrase in the player's style,   // flavor only
    improvised: { base: improvised_light | improvised_medium | improvised_heavy, name: short phrase } | null,  // a scenario object used as a weapon (Part 5 §7)
    noSkillFits?: true,  // no skill in PlayerView fits the deed; the closest is used and the game flags it (skill_gap)
    grade?: none | minor | moderate | major | extreme,  // OD3: how hard the deed is (use_item, interact, observe, other), used when its thing has no grade
    fall?: metres        // OD5: a climb or balance's drop; a Critical Failure falls that far
  } | null,
  perkMove:   { perk: perk_id, target: actor_id | null } | null,   // an owned perk move (AE8); a free one rides beside the action
  gear:       [ { op: draw | stow | swap | wear_acc | remove_acc | pick_up,
                  item: item_instance_id, from?: actor_id } ] | null,   // free; before the action
  spoken:     words said aloud | null,   // the speech if the main action is a
                                         // speech action; otherwise a bark
  addressees: [actor_id | band_id | "everyone"] | null,
  deferred:   [actions that didn't fit this turn],
  clarify:    one short question | null
}
```

- approach is flavor: the engine ignores it unless an active skill or perk names it as a trigger. It is passed to Agent Narrator so the prose keeps the player's style.
- **No skill fits** (Ali, 15/11/2026, thread "Give each obstacle its own difficulty"): when no skill in PlayerView fits the deed, the Parser still picks the closest and sets noSkillFits. Every such turn is flagged: the log code skill\_gap (a bug code, so it is filed on the Bugs page with the player's words, the action type, the skill used and the target). The flags show which skills the game is missing as play goes on.
- **The rest of a long order is queued** (D-20 b, Ali, Questions hub page "Open parked items", 18/11/2026). A turn holds one move and one main action (Parser rule 2); deferred holds the later steps, one entry each, in the player's order and in their words. The narration line carries them as its queue (LogLine.queue). The play screen offers the first as the next step ("Next step of your order · Enter plays it, Esc drops the rest", with Play it and Drop the rest): Enter in the empty box sends it, and it plays as a whole turn of its own, read by the Parser as if typed, with the rest kept behind its own deferred. Anything else the player sends (a new order, a clicked action) drops the rest; a / command passes no time and keeps it (orderQueue.ts queuedSteps).
- **The queue stops the moment anything new happens** (orderQueue.ts orderStops): the player is hit or spoken to (contact: an attack at them, words to them they hear, a noise at WAKE\_NOISE or louder; never the answer to their own words this turn), someone comes into view (newly in the player's senses and either moved this turn or opposed or colder to them; walking up to someone who stands there is the order going as planned), the player is seen (someone newly aware of them while they sneak, or someone opposed or colder), or the player's own step fails (wasted, refused, a way found shut, a roll short of Success, a filch gone wrong). A stopped queue is only offered back as a suggestion (Q16, next) for the player to take or clear.
- A clarify answer stops the turn: no resolution, turn unchanged. Planner outputs are kept and apply when the turn resolves.
- Code adds aimed: true | false to the player's order from the Aim toggle or /aim (Part 1 §7), or when the Parser says the player's words aim at the part they name (BF26: "aimed": true with a targetPart).

Fixed instructions: the exact text is PARSER_INSTRUCTIONS in src/agents/prompts.ts, the one copy (CS6; the spec no longer copies it, a test keeps it so). In short, it turns the player's words into structured actions from PLAYER_VIEW only; at most one move and one main action a turn, the player's words in spoken, gear ops free; asks one short clarify question only when the intent is truly unclear. Never narrates, never decides outcomes, never assumes success; sets aimed only when the player's words aim at the part they name (BF26).

Rules 1 and 5 are provisional: how to handle a player naming something that doesn't exist is still open, because a clarify question can reveal what exists in the world (D-21).
