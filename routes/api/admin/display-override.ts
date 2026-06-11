import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    const state = await ctx.state.services.photoWall.getDisplayOverrideState();
    return ctx.json(state ?? { type: "normal" });
  },
  async POST(ctx) {
    const admin = ctx.state.user!;
    const form = await ctx.req.formData();
    const type = form.get("type");
    if (type !== "blank" && type !== "placeholder" && type !== "resume") {
      return ctx.json({ error: "Invalid override type" }, { status: 400 });
    }
    const imageFile = form.get("image");
    const image = imageFile instanceof File && imageFile.size > 0 ? imageFile : undefined;

    await ctx.state.services.photoWall.commandDisplayOverride(type, admin.id, image);
    return ctx.json({ ok: true });
  },
});
