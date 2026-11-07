// W4 — Resolution engine, triggers, hidden state, modes, spokespeople, gear ops.
export * from './types';
export { computePending, engagedActors } from './mode';
export { selectSpokespeople, unclearAddressee, resolveSpeech, impressionWords, SPEECH_SKILL } from './speech';
export { resolveTurn, isMajorAction } from './resolve';
export { fromIntent } from './merge';
export { firedOrders } from './triggers';
export { checkSecrets } from './secrets';
