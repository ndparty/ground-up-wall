/**
 * Hashcash-style proof-of-work (NFR-23). Isomorphic: uses Web Crypto (`crypto.subtle`)
 * so the same module runs in Deno (server verify) and the browser (client solve).
 *
 * A challenge is a `{ nonce, difficulty }`. A solution `s` is valid when
 * sha256(`${nonce}.${s}`) has at least `difficulty` leading zero bits. Verification
 * is a single hash; solving costs ~2^difficulty hashes — the intended asymmetry.
 */
export const DEFAULT_POW_DIFFICULTY_BITS = 16;

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasLeadingZeroBits(hexDigest: string, bits: number): boolean {
  if (bits <= 0) return true;
  let remaining = bits;
  for (const ch of hexDigest) {
    const nibble = Number.parseInt(ch, 16);
    if (Number.isNaN(nibble)) return false;
    if (remaining >= 4) {
      if (nibble !== 0) return false;
      remaining -= 4;
    } else {
      const mask = (0xf << (4 - remaining)) & 0xf;
      return (nibble & mask) === 0;
    }
    if (remaining === 0) return true;
  }
  return remaining === 0;
}

export async function verifyPow(
  nonce: string,
  solution: string,
  difficulty: number,
): Promise<boolean> {
  if (!nonce || !solution) return false;
  const digest = await sha256Hex(`${nonce}.${solution}`);
  return hasLeadingZeroBits(digest, difficulty);
}

/** Solve a challenge (client-side). Returns the solution string, or null if not found. */
export async function solvePow(
  nonce: string,
  difficulty: number,
  maxIterations = 5_000_000,
): Promise<string | null> {
  for (let i = 0; i < maxIterations; i++) {
    const solution = i.toString(36);
    const digest = await sha256Hex(`${nonce}.${solution}`);
    if (hasLeadingZeroBits(digest, difficulty)) return solution;
  }
  return null;
}
