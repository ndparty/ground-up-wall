import { solvePow } from "./pow.ts";

/**
 * Fetch a proof-of-work challenge from the server and solve it (browser-side, NFR-23).
 * Returns an `X-PoW: nonce.solution` token, or null if a challenge/solution is unavailable.
 */
export async function obtainPowToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/pow/challenge");
    if (!res.ok) return null;
    const { nonce, difficulty } = await res.json() as { nonce: string; difficulty: number };
    if (!nonce || typeof difficulty !== "number") return null;
    const solution = await solvePow(nonce, difficulty);
    return solution ? `${nonce}.${solution}` : null;
  } catch {
    return null;
  }
}
