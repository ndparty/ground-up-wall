import { BodyTooLargeError, readFormDataWithLimit } from "../../../../lib/security/body_limit.ts";
import { define } from "../../../../utils.ts";

// Cap staff placeholder uploads at the same limit as public uploads (NFR-23).
const MAX_PLACEHOLDER_BYTES = 12 * 1024 * 1024;

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    try {
      const form = await readFormDataWithLimit(ctx.req, MAX_PLACEHOLDER_BYTES);
      const image = form.get("image");
      if (!(image instanceof File) || image.size === 0) {
        return ctx.json({ error: "Image file is required" }, { status: 400 });
      }

      await ctx.state.services.photoWall.uploadDefaultPlaceholder(image, admin.id);
      return ctx.json({ ok: true });
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        return ctx.json({ error: "Upload too large" }, { status: 413 });
      }
      throw err;
    }
  },
});
