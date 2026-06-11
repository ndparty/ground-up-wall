export interface MessageSegment {
  text: string;
  highlighted: boolean;
}

function escapeRegex(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightFlaggedWords(
  message: string,
  flaggedWords: string[] = [],
): MessageSegment[] {
  const words = flaggedWords.filter((w) => w.length > 0);
  if (words.length === 0) {
    return [{ text: message, highlighted: false }];
  }

  const pattern = new RegExp(`(${words.map(escapeRegex).join("|")})`, "gi");
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of message.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ text: message.slice(lastIndex, index), highlighted: false });
    }
    segments.push({ text: match[0], highlighted: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < message.length) {
    segments.push({ text: message.slice(lastIndex), highlighted: false });
  }

  return segments.length > 0 ? segments : [{ text: message, highlighted: false }];
}
