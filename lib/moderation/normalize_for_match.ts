/** Character substitutions for leetspeak (FR-09a). Single-char in, single-char out. */
export const SUBSTITUTIONS: Record<string, string> = {
  "@": "a",
  "0": "o",
  "$": "s",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "!": "i",
  "7": "t",
  "8": "b",
  "6": "g",
  "9": "g",
};

function substituteChar(ch: string): string {
  const lower = ch.toLowerCase();
  const sub = SUBSTITUTIONS[lower];
  if (sub && sub.length === 1) return sub;
  return lower.length === 1 ? lower : ch[0]?.toLowerCase() ?? ch;
}

export interface FoldedText {
  folded: string;
  /** Original message index where folded[i] begins. */
  startMap: number[];
  /** Original message index where folded[i] ends (exclusive). */
  endMap: number[];
}

interface AlphaUnit {
  ch: string;
  start: number;
  end: number;
}

function collectAlphaUnits(message: string): AlphaUnit[] {
  const normalized = message.normalize("NFKC");
  const units: AlphaUnit[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const ch = substituteChar(normalized[i]);
    if (!/[a-z0-9]/.test(ch)) continue;
    units.push({ ch, start: i, end: i + 1 });
  }
  return units;
}

/**
 * Lowercase + NFKC + substitutions, then drop non-alphanumeric separators.
 * Optionally collapse runs of 3+ identical letters to one (evasion: "shiiit" -> "shit")
 * while preserving double letters in normal words ("hell", "bullshit").
 */
export function foldForMatching(message: string, collapseRepeats = true): FoldedText {
  const units = collectAlphaUnits(message);
  const foldedChars: string[] = [];
  const startMap: number[] = [];
  const endMap: number[] = [];

  let i = 0;
  while (i < units.length) {
    let j = i + 1;
    while (j < units.length && units[j].ch === units[i].ch) j++;
    const runLen = j - i;

    if (collapseRepeats && runLen >= 3) {
      foldedChars.push(units[i].ch);
      startMap.push(units[i].start);
      endMap.push(units[j - 1].end);
    } else {
      for (let k = i; k < j; k++) {
        foldedChars.push(units[k].ch);
        startMap.push(units[k].start);
        endMap.push(units[k].end);
      }
    }
    i = j;
  }

  return {
    folded: foldedChars.join(""),
    startMap,
    endMap,
  };
}

/** Find all original-message spans matching a word (evasion-aware). */
export function findFoldedMatches(message: string, word: string): Array<[number, number]> {
  const msg = foldForMatching(message, true);
  const needle = foldForMatching(word, false).folded;
  if (needle.length === 0) return [];

  const ranges: Array<[number, number]> = [];
  let from = 0;
  while (true) {
    const idx = msg.folded.indexOf(needle, from);
    if (idx === -1) break;
    const start = msg.startMap[idx];
    const end = msg.endMap[idx + needle.length - 1];
    ranges.push([start, end]);
    from = idx + 1;
  }
  return ranges;
}
