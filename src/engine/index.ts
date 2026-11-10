// W4 — Resolution engine, triggers, hidden state, modes, spokespeople, gear ops.
export * from './types';
export { computePending, engagedActors } from './mode';
export { fillSpeech, quickWord, selectSpokespeople, unclearAddressee, resolveSpeech, impressionWords, SPEECH_SKILL, TELL } from './speech';
export { resolveTurn, isMajorAction } from './resolve';
export { achievementName, awardXp, charLevel, grantAchievement, killXp, xpToNext } from './xp';
export { fromIntent } from './merge';
export { firedOrders } from './triggers';
export { checkSecrets } from './secrets';
export { applyHealing, healingName } from './heal';
export { updateEngagements, usableThisEngagement, useThisEngagement, engagedThisTurn } from './engagement';
