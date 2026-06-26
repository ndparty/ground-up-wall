import { CHALLENGE_TTL_MS, POW_CACHE_REFRESH_BEFORE_MS, solvePowSync } from "./pow.ts";
import { solvePowInWorker } from "./pow_worker.ts";

export type PowFailureReason = "rate_limit" | "fetch_failed" | "solve_failed" | "network";

export type PowResult =
  | { ok: true; token: string }
  | { ok: false; reason: PowFailureReason };

interface PowCache {
  token: string;
  expiresAt: number;
}

let cache: PowCache | null = null;
let inflight: Promise<PowResult> | null = null;
let staffPrefetchChecked = false;
let staffPrefetchSkip = false;

/**
 * Start solving a proof-of-work challenge in the background (NFR-23).
 * Safe to call on page mount; deduplicates concurrent prefetches.
 * Skips when the visitor is already logged in as admin/moderator.
 */
export function prefetchPowToken(): void {
  void (async () => {
    if (await shouldSkipPowPrefetch()) return;
    void ensurePowToken();
  })();
}

/** Returns a ready `nonce.solution` token, or null if unavailable. */
export async function obtainPowToken(): Promise<string | null> {
  const result = await ensurePowToken();
  return result.ok ? result.token : null;
}

/** Like obtainPowToken but exposes the failure reason for UI messaging. */
export async function obtainPowTokenDetailed(): Promise<PowResult> {
  return await ensurePowToken();
}

/** Clear cached token (e.g. after a rejected submit). */
export function invalidatePowCache(): void {
  cache = null;
}

async function shouldSkipPowPrefetch(): Promise<boolean> {
  if (staffPrefetchChecked) return staffPrefetchSkip;
  staffPrefetchChecked = true;
  try {
    const res = await fetch("/api/masuk/me");
    if (res.ok) {
      const data = await res.json() as { user?: { role?: string } };
      const role = data.user?.role;
      staffPrefetchSkip = role === "admin" || role === "moderator";
    }
  } catch {
    staffPrefetchSkip = false;
  }
  return staffPrefetchSkip;
}

async function ensurePowToken(): Promise<PowResult> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + POW_CACHE_REFRESH_BEFORE_MS) {
    return { ok: true, token: cache.token };
  }
  if (inflight) return await inflight;
  inflight = fetchAndSolve();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function fetchAndSolve(): Promise<PowResult> {
  try {
    const res = await fetch("/api/masuk/challenge");
    if (res.status === 429) return { ok: false, reason: "rate_limit" };
    if (!res.ok) return { ok: false, reason: "fetch_failed" };
    const { nonce, difficulty } = await res.json() as { nonce: string; difficulty: number };
    if (!nonce || typeof difficulty !== "number") {
      return { ok: false, reason: "fetch_failed" };
    }

    let solution = await solvePowInWorker(nonce, difficulty);
    if (!solution) {
      solution = solvePowSync(nonce, difficulty);
    }
    if (!solution) return { ok: false, reason: "solve_failed" };

    const token = `${nonce}.${solution}`;
    cache = { token, expiresAt: Date.now() + CHALLENGE_TTL_MS };
    return { ok: true, token };
  } catch (err) {
    if (err instanceof TypeError) return { ok: false, reason: "network" };
    return { ok: false, reason: "solve_failed" };
  }
}
