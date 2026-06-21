import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const user = ctx.state.user!;
    const form = await ctx.req.formData();
    const type = form.get("type");
    if (type !== "blank" && type !== "placeholder" && type !== "resume") {
      return ctx.json({ error: "Invalid override type" }, { status: 400 });
    }
    const imageFile = form.get("image");
    const image = imageFile instanceof File && imageFile.size > 0 ? imageFile : undefined;
    try {
      await ctx.state.services.photoWall.commandDisplayOverride(type, user.id, image);
      return ctx.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Display override failed";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
