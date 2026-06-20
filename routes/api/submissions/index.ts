import { parseSubmissionForm } from "../../../lib/api/submission_request.ts";
import { getUploadFormConfig } from "../../../lib/upload_config.ts";
import {
  clientKey,
  exceedsBodyLimit,
  RateLimiter,
  tooManyRequests,
} from "../../../lib/security/rate_limit.ts";
import { verifyPowToken } from "../../../lib/security/pow_challenge_store.ts";
import { securityGatesDisabled } from "../../../lib/security/gate_mode.ts";
import { define } from "../../../utils.ts";

// Public upload endpoint: cap request size before buffering, and rate-limit per IP (NFR-23).
const MAX_UPLOAD_REQUEST_BYTES = 12 * 1024 * 1024;
const uploadRateLimiter = new RateLimiter(15, 60_000);

export const handlers = define.handlers({
  async POST(ctx) {
    const gatesOn = !securityGatesDisabled();
    // Proof-of-work gate (NFR-23) — when enabled, verified as a cheap early no-op
    // BEFORE buffering the multipart body or touching storage/DB.
    if (gatesOn && await ctx.state.services.photoWall.isPowChallengeEnabled()) {
      const ok = await verifyPowToken(ctx.req.headers.get("x-pow"));
      if (!ok) {
        return ctx.json({ error: "Proof-of-work required", powRequired: true }, { status: 428 });
      }
    }
    if (exceedsBodyLimit(ctx.req, MAX_UPLOAD_REQUEST_BYTES)) {
      return ctx.json({ error: "Upload too large" }, { status: 413 });
    }
    if (gatesOn) {
      const limit = uploadRateLimiter.check(clientKey(ctx.req, ctx.info));
      if (!limit.allowed) {
        return tooManyRequests(limit.retryAfterMs);
      }
    }
    try {
      const form = await ctx.req.formData();
      const uploadConfig = await getUploadFormConfig(ctx.state.services.photoWall);
      const { data } = parseSubmissionForm(form, {
        limit: uploadConfig.messageLengthLimit,
        unit: uploadConfig.messageLengthUnit,
      });
      const submission = await ctx.state.services.photoWall.submitPublicSubmission(data);
      return ctx.json(
        {
          submission_id: submission.id,
          status: submission.status,
          is_flagged: submission.is_flagged,
        },
        { status: 201 },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid submission";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
