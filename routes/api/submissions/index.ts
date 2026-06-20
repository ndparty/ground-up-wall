import { parseSubmissionForm } from "../../../lib/api/submission_request.ts";
import { getUploadFormConfig } from "../../../lib/upload_config.ts";
import {
  clientKey,
  exceedsBodyLimit,
  RateLimiter,
  tooManyRequests,
} from "../../../lib/security/rate_limit.ts";
import { define } from "../../../utils.ts";

// Public upload endpoint: cap request size before buffering, and rate-limit per IP (NFR-23).
const MAX_UPLOAD_REQUEST_BYTES = 12 * 1024 * 1024;
const uploadRateLimiter = new RateLimiter(15, 60_000);

export const handlers = define.handlers({
  async POST(ctx) {
    if (exceedsBodyLimit(ctx.req, MAX_UPLOAD_REQUEST_BYTES)) {
      return ctx.json({ error: "Upload too large" }, { status: 413 });
    }
    const limit = uploadRateLimiter.check(clientKey(ctx.req, ctx.info));
    if (!limit.allowed) {
      return tooManyRequests(limit.retryAfterMs);
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
