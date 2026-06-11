import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const form = await ctx.req.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return ctx.json({ error: "Image file is required" }, { status: 400 });
    }

    await ctx.state.services.photoWall.uploadDefaultPlaceholder(image, admin.id);
    return ctx.json({ ok: true });
  },
});
