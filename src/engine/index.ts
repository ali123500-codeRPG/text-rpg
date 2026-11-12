// W4 — Resolution engine, triggers, hidden state, modes, spokespeople, gear ops.
export * from './types';
export { computePending, engagedActors } from './mode';
export { fillSpeech, quickWord, selectSpokespeople, unclearAddressee, resolveSpeech, impressionWords, NO_WORDS, BEAT_OPENING, SPEECH_SKILL, TELL, tellFor } from './speech';
export { resolveTurn, isMajorAction } from './resolve';
export { achievementInfo, achievementName, earnedAtText, awardXp, charLevel, grantAchievement, defeatXp, xpToNext } from './xp';
export { fromIntent } from './merge';
export { beatSpeakers, firedOrders } from './triggers';
export { checkSecrets } from './secrets';
export { applyHealing, healingName } from './heal';
export { updateEngagements, usableThisEngagement, useThisEngagement, engagedThisTurn } from './engagement';
export { endScenario } from './scenarioEnd';
export { essenceSlots, essenceText, passEssence, playerAtRest, removeEssence, takeEssence } from './essence';
