import { toPublicError } from "../../../lib/api/public_error.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const state = await ctx.state.services.photoWall.getResolvedDisplayOverrideState();
    return ctx.json(state ?? { type: "normal" });
  },
  async POST(ctx) {
    const admin = ctx.state.user!;
    const form = await ctx.req.formData();
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
