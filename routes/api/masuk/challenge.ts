import { issueChallenge } from "../../../lib/security/pow_challenge_store.ts";
import { clientKey, RateLimiter, tooManyRequests } from "../../../lib/security/rate_limit.ts";
import { isStaffRequest } from "../../../lib/security/staff_gates.ts";
import { define } from "../../../utils.ts";

// Public PoW challenge issuer (NFR-23). Lightly rate-limited so it is not an
// amplification target. Issuing a challenge is cheap (random nonce + map insert).
const challengeRateLimiter = new RateLimiter(60, 60_000);

export const handlers = define.handlers({
  async GET(ctx) {
    if (!isStaffRequest(ctx)) {
      const limit = challengeRateLimiter.check(clientKey(ctx.req, ctx.info));
      if (!limit.allowed) {
        return tooManyRequests(limit.retryAfterMs);
      }
    }
    const difficulty = await ctx.state.services.photoWall.getPowDifficultyBits();
    const challenge = issueChallenge(difficulty);
    return ctx.json(challenge);
  },
});
