import { DEFAULT_POW_DIFFICULTY_BITS, verifyPow } from "./pow.ts";

/**
 * In-memory, single-use proof-of-work challenge store (NFR-23).
 * Nonces are issued with a short TTL and deleted on first consumption (anti-replay).
 * Single-instance only (Phase 1): state lives in process memory.
 */
interface Challenge {
  difficulty: number;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 2 * 60_000;
const store = new Map<string, Challenge>();

export interface IssuedChallenge {
  nonce: string;
  difficulty: number;
}

/**
 * Drop expired, never-consumed nonces so the in-memory store cannot grow without
 * bound under sustained challenge issuance (NFR-23 memory-DoS defense).
 */
function purgeExpired(now: number): void {
  for (const [nonce, challenge] of store) {
    if (challenge.expiresAt < now) store.delete(nonce);
  }
}

export function issueChallenge(
  difficulty: number = DEFAULT_POW_DIFFICULTY_BITS,
  now: number = Date.now(),
): IssuedChallenge {
  purgeExpired(now);
  const nonce = crypto.randomUUID();
  store.set(nonce, { difficulty, expiresAt: now + CHALLENGE_TTL_MS });
  return { nonce, difficulty };
}

/** Consume a nonce (single-use). Returns the challenge if valid and unexpired, else null. */
function consumeChallenge(nonce: string, now: number = Date.now()): Challenge | null {
  const challenge = store.get(nonce);
  if (!challenge) return null;
  store.delete(nonce);
  if (challenge.expiresAt < now) return null;
  return challenge;
}

/**
 * Verify an `X-PoW: nonce.solution` token: parse, consume the nonce (single-use),
 * and check the solution against the issued difficulty. Cheap: one Map lookup + one hash.
 */
export async function verifyPowToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const sep = token.indexOf(".");
  if (sep <= 0 || sep === token.length - 1) return false;
  const nonce = token.slice(0, sep);
  const solution = token.slice(sep + 1);
  const challenge = consumeChallenge(nonce);
  if (!challenge) return false;
  return await verifyPow(nonce, solution, challenge.difficulty);
}

export function _clearChallenges(): void {
  store.clear();
}
