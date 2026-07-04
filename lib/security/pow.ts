/**
 * Hashcash-style proof-of-work (NFR-23). Isomorphic: sync SHA-256 runs in Deno, browser, and
 * static/pow-worker.js so solving works on HTTP LAN (no crypto.subtle required).
 */
import { sha256HexSync } from "./sha256.ts";

export const DEFAULT_POW_DIFFICULTY_BITS = 16;

export const CHALLENGE_TTL_MS = 2 * 60_000;
/** Refresh cached client tokens this many ms before server nonce expiry. */
export const POW_CACHE_REFRESH_BEFORE_MS = 30_000;

export function sha256Hex(input: string): string {
  return sha256HexSync(input);
}

/** @deprecated Use sha256Hex — kept for callers expecting async. */
export function sha256HexAsync(input: string): Promise<string> {
  return Promise.resolve(sha256HexSync(input));
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

export function verifyPow(
  nonce: string,
  solution: string,
  difficulty: number,
): Promise<boolean> {
  if (!nonce || !solution) return Promise.resolve(false);
  const digest = sha256Hex(`${nonce}.${solution}`);
  return Promise.resolve(hasLeadingZeroBits(digest, difficulty));
}

/** Solve a challenge synchronously (Deno tests and main-thread fallback). */
export function solvePowSync(
  nonce: string,
  difficulty: number,
  maxIterations = 5_000_000,
): string | null {
  for (let i = 0; i < maxIterations; i++) {
    const solution = i.toString(36);
    const digest = sha256Hex(`${nonce}.${solution}`);
    if (hasLeadingZeroBits(digest, difficulty)) return solution;
  }
  return null;
}

/** Solve a challenge (client-side). Returns the solution string, or null if not found. */
export function solvePow(
  nonce: string,
  difficulty: number,
  maxIterations = 5_000_000,
): Promise<string | null> {
  return Promise.resolve(solvePowSync(nonce, difficulty, maxIterations));
}
