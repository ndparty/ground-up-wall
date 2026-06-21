/** Decorative MRT-style line badges for cabin roof signs (not real station mappings). */

const PRIMARY_CODES = ["NS9", "EW12", "NE4", "CC10", "DT5", "TE2", "CG1"] as const;
const SECONDARY_CODES = ["TE2", "BP1", "PE7", "JS5"] as const;
const EXIT_LETTERS = ["A", "B", "C", "D"] as const;
const PLATFORM_NUMBERS = ["1", "2", "3", "4"] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface DecorativeLineBadge {
  primary: string;
  secondary?: string;
  exit: string;
  platform: string;
}

export function pickDecorativeLineBadge(stationName: string): DecorativeLineBadge {
  const h = hashString(stationName.toLowerCase());
  const primary = PRIMARY_CODES[h % PRIMARY_CODES.length];
  const secondary = SECONDARY_CODES[(h >> 3) % SECONDARY_CODES.length];
  return {
    primary,
    secondary: secondary !== primary
      ? secondary
      : SECONDARY_CODES[(h >> 5) % SECONDARY_CODES.length],
    exit: EXIT_LETTERS[h % EXIT_LETTERS.length],
    platform: PLATFORM_NUMBERS[(h >> 2) % PLATFORM_NUMBERS.length],
  };
}
