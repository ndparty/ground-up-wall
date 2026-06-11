import { parseSubmissionForm } from "../../../lib/api/submission_request.ts";
import { getUploadFormConfig } from "../../../lib/upload_config.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
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
