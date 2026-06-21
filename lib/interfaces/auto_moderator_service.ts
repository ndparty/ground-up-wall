export interface FlagResult {
  is_flagged: boolean;
  flagged_words: string[];
  positions?: { word: string; index: number }[];
}

export interface AutoModeratorService {
  checkMessage(message: string, wordList: string[]): FlagResult;
  getFlaggedWords(message: string, wordList: string[]): string[];
}
