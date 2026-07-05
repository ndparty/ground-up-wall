import { findFoldedMatches } from "./normalize_for_match.ts";

export interface MessageSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Split a message into highlighted/plain segments. Matching mirrors the auto-moderator
 * (substitutions, separator folding, repeat collapse), and highlighted spans are taken
 * from the ORIGINAL text so evasion like `cr@p` or `f*ck` is highlighted correctly.
 */
export function highlightFlaggedWords(
  message: string,
  flaggedWords: string[] = [],
): MessageSegment[] {
  const words = flaggedWords.filter((w) => w.trim().length > 0);
  if (words.length === 0) {
    return [{ text: message, highlighted: false }];
  }

  const ranges: Array<[number, number]> = [];

  for (const word of words) {
    ranges.push(...findFoldedMatches(message, word));
  }

  if (ranges.length === 0) {
    return [{ text: message, highlighted: false }];
  }

  // Merge overlapping/adjacent ranges.
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  for (const [start, end] of merged) {
    if (start > lastIndex) {
      segments.push({ text: message.slice(lastIndex, start), highlighted: false });
    }
    segments.push({ text: message.slice(start, end), highlighted: true });
    lastIndex = end;
  }
  if (lastIndex < message.length) {
    segments.push({ text: message.slice(lastIndex), highlighted: false });
  }

  return segments.length > 0 ? segments : [{ text: message, highlighted: false }];
}
