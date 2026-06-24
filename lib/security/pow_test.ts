import { assertEquals } from "@std/assert";
import { hasLeadingZeroBits, solvePow, solvePowSync, verifyPow } from "./pow.ts";
import { _clearChallenges, issueChallenge, verifyPowToken } from "./pow_challenge_store.ts";

Deno.test("solvePowSync matches solvePow", async () => {
  const nonce = "sync-test";
  const difficulty = 8;
  const sync = solvePowSync(nonce, difficulty);
  const async = await solvePow(nonce, difficulty);
  assertEquals(sync, async);
});

Deno.test("hasLeadingZeroBits checks bit prefix", () => {
  assertEquals(hasLeadingZeroBits("00ff", 8), true);
  assertEquals(hasLeadingZeroBits("00ff", 9), false);
  assertEquals(hasLeadingZeroBits("0fff", 4), true);
  assertEquals(hasLeadingZeroBits("0fff", 5), false);
  assertEquals(hasLeadingZeroBits("ffff", 1), false);
  assertEquals(hasLeadingZeroBits("anything", 0), true);
});

Deno.test("solvePow produces a solution that verifyPow accepts", async () => {
  const nonce = "test-nonce";
  const difficulty = 8;
  const solution = await solvePow(nonce, difficulty);
  assertEquals(solution !== null, true);
  assertEquals(await verifyPow(nonce, solution!, difficulty), true);
  assertEquals(await verifyPow(nonce, "wrong-solution-xyz", difficulty), false);
});

Deno.test("verifyPowToken accepts a solved challenge once (single-use)", async () => {
  _clearChallenges();
  const { nonce, difficulty } = issueChallenge(8);
  const solution = await solvePow(nonce, difficulty);
  const token = `${nonce}.${solution}`;

  assertEquals(await verifyPowToken(token), true);
  // Nonce consumed — replay rejected.
  assertEquals(await verifyPowToken(token), false);
});

Deno.test("verifyPowToken rejects malformed or unknown tokens", async () => {
  _clearChallenges();
  assertEquals(await verifyPowToken(null), false);
  assertEquals(await verifyPowToken(""), false);
  assertEquals(await verifyPowToken("no-dot"), false);
  assertEquals(await verifyPowToken("unknown-nonce.solution"), false);
});
