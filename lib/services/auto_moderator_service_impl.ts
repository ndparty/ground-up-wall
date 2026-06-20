import type {
  AutoModeratorService,
  FlagResult,
} from "../interfaces/auto_moderator_service.ts";

export const SEEDED_DEFAULT_WORD_LIST = [
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
];

export const SUBSTITUTIONS: Record<string, string> = {
  "@": "a",
  "0": "o",
  "$": "s",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "!": "i",
};

function normalizeForMatching(text: string): string {
  let normalized = text.toLowerCase().normalize("NFKC");
  let result = "";
  for (const char of normalized) {
    result += SUBSTITUTIONS[char] ?? char;
  }
  return result;
}

export class AutoModeratorServiceImpl implements AutoModeratorService {
  checkMessage(message: string, wordList: string[]): FlagResult {
    const normalizedMessage = normalizeForMatching(message);
    const flaggedWords: string[] = [];
    const positions: { word: string; index: number }[] = [];

    for (const word of wordList) {
      if (!word.trim()) continue;
      const normalizedWord = normalizeForMatching(word);
      const index = normalizedMessage.indexOf(normalizedWord);
      if (index !== -1) {
        flaggedWords.push(word);
        positions.push({ word, index });
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
