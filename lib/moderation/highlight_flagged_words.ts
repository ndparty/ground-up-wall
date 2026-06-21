import { SUBSTITUTIONS } from "../services/auto_moderator_service_impl.ts";

export interface MessageSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Normalize a single UTF-16 unit for matching: lowercase + character substitution
 * (e.g. `@`->a, `3`->e). Kept strictly 1:1 (one unit in, one unit out) so normalized
 * string indices map directly back onto the original message (FR-09a).
 */
function normalizeUnit(ch: string): string {
  const lower = ch.toLowerCase();
  const base = lower.length === 1 ? lower : ch;
  const sub = SUBSTITUTIONS[base];
  if (sub && sub.length === 1) return sub;
  return base.length === 1 ? base : ch[0];
}

function normalizeForHighlight(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += normalizeUnit(text[i]);
  }
  return out;
}

/**
 * Split a message into highlighted/plain segments. Matching is substitution-aware
 * (mirrors the auto-moderator), and highlighted spans are taken from the ORIGINAL
 * text so leetspeak like `cr@p` is highlighted even though the word list has `crap`.
 */
export function highlightFlaggedWords(
  message: string,
  flaggedWords: string[] = [],
): MessageSegment[] {
  const words = flaggedWords.filter((w) => w.trim().length > 0);
  if (words.length === 0) {
    return [{ text: message, highlighted: false }];
  }

  const normalizedMessage = normalizeForHighlight(message);
  const ranges: Array<[number, number]> = [];

  for (const word of words) {
    const normalizedWord = normalizeForHighlight(word);
    if (normalizedWord.length === 0) continue;
    let from = 0;
    while (true) {
      const idx = normalizedMessage.indexOf(normalizedWord, from);
      if (idx === -1) break;
      ranges.push([idx, idx + normalizedWord.length]);
      from = idx + normalizedWord.length;
    }
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
