// W4 — Resolution engine, triggers, hidden state, modes, spokespeople, gear ops.
export * from './types';
export { computePending, engagedActors } from './mode';
export { fillSpeech, quickWord, selectSpokespeople, unclearAddressee, resolveSpeech, impressionWords, NO_WORDS, MUFFLED, BEAT_OPENING, SPEECH_SKILL, TELL, tellFor } from './speech';
export { offerNote } from './offer';
export { resolveTurn, isMajorAction, nerveTurnsBack } from './resolve';
export { farBelow, finishFight, type FinishStop } from './finish';
export { achievementInfo, achievementName, earnedAtText, awardXp, charLevel, grantAchievement, defeatXp, xpToNext } from './xp';
export { fromIntent } from './merge';
export { beatSpeakers, firedOrders } from './triggers';
export { checkSecrets } from './secrets';
export { applyHealing, healingName } from './heal';
export { updateEngagements, usableThisEngagement, useThisEngagement, engagedThisTurn } from './engagement';
export { endScenario } from './scenarioEnd';
export { essenceSlots, essenceText, essenceValue, giveEssence, passEssence, playerAtRest, removeCostText, removeEssence, sellEssence, takeEssence } from './essence';
