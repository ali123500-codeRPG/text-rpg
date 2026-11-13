// HF34 a: unique NPC templates, one row per Hall of fame hero sent with "Send to NPC template". Each row is an echo: the
// hero's whole sheet at death (src/library/echo.ts echoSheet), built into a template by uniqueTemplate. Claude adds rows
// here by PR from the send list; their ids go in TP (src/library/templateIds.ts) like any template's. Never reuse an id.
import type { NpcTemplate } from '../types';

export const UNIQUES: Record<string, NpcTemplate> = {};
