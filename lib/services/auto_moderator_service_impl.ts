import type { AutoModeratorService, FlagResult } from "../interfaces/auto_moderator_service.ts";
import { findFoldedMatches, SUBSTITUTIONS } from "../moderation/normalize_for_match.ts";

export { SUBSTITUTIONS };

/** Seeded PG-13 default word list (FR-09a). Admin "Reset to default" uses this constant. */
export const SEEDED_DEFAULT_WORD_LIST = [
  // Core profanity
  "damn",
  "hell",
  "crap",
  "shit",
  "fuck",
  "bastard",
  "bitch",
  "asshole",
  "piss",
  "dick",
  "cock",
  "porn",
  "slut",
  "whore",
  // Compound profanity
  "bullshit",
  "goddamn",
  "douche",
  "douchebag",
  "motherfucker",
  // Abbrev / internet
  "wtf",
  "stfu",
  "gtfo",
  "lmfao",
  // Common misspellings / truncations
  "fuk",
  "fck",
  "fcuk",
  "shyt",
  "biatch",
  // Sexual / explicit (PG-13 advisory)
  "sex",
  "nude",
  "naked",
  "xxx",
  "boob",
  "penis",
  "vagina",
];

export class AutoModeratorServiceImpl implements AutoModeratorService {
  checkMessage(message: string, wordList: string[]): FlagResult {
    const flaggedWords: string[] = [];
    const positions: { word: string; index: number }[] = [];

    for (const word of wordList) {
      if (!word.trim()) continue;
      const matches = findFoldedMatches(message, word);
      if (matches.length > 0) {
        flaggedWords.push(word);
        positions.push({ word, index: matches[0][0] });
      }
    }

    return {
      is_flagged: flaggedWords.length > 0,
      flagged_words: flaggedWords,
      positions,
    };
  }

  getFlaggedWords(message: string, wordList: string[]): string[] {
    return this.checkMessage(message, wordList).flagged_words;
  }
}
