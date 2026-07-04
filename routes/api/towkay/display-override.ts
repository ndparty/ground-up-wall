import { toPublicError } from "../../../lib/api/public_error.ts";
import { BodyTooLargeError, readFormDataWithLimit } from "../../../lib/security/body_limit.ts";
import { define } from "../../../utils.ts";

// Cap admin override image uploads at the same limit as public uploads (NFR-23).
const MAX_OVERRIDE_BYTES = 12 * 1024 * 1024;

export const handlers = define.handlers({
  async GET(ctx) {
    const state = await ctx.state.services.photoWall.getResolvedDisplayOverrideState();
    return ctx.json(state ?? { type: "normal" });
  },
  async POST(ctx) {
    const admin = ctx.state.user!;
    let form: FormData;
    try {
      form = await readFormDataWithLimit(ctx.req, MAX_OVERRIDE_BYTES);
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        return ctx.json({ error: "Upload too large" }, { status: 413 });
      }
      throw err;
    }
    const type = form.get("type");
    if (
      type !== "blank" && type !== "placeholder" && type !== "resume" &&
      type !== "reload" && type !== "panic"
    ) {
      return ctx.json({ error: "Invalid override type" }, { status: 400 });
    }
    const imageFile = form.get("image");
    const image = imageFile instanceof File && imageFile.size > 0 ? imageFile : undefined;

    try {
      if (type === "reload") {
        await ctx.state.services.photoWall.reloadDisplay(admin.id);
      } else if (type === "panic") {
        await ctx.state.services.photoWall.panicDisplay(admin.id);
      } else {
        await ctx.state.services.photoWall.commandDisplayOverride(type, admin.id, image);
      }
      return ctx.json({ ok: true });
    } catch (err) {
      return ctx.json({ error: toPublicError(err, "Override failed") }, { status: 400 });
    }
  },
});
