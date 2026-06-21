import { validateParameterValue } from "../../../../lib/admin/parameter_validation.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { key } = await ctx.req.json() as { key: string };
    if (!key) return ctx.json({ error: "key is required" }, { status: 400 });

    const validationError = validateParameterValue(key, "");
    if (validationError?.startsWith("Unknown parameter key:")) {
      return ctx.json({ error: validationError }, { status: 400 });
    }

    await ctx.state.services.photoWall.resetSystemParameterToDefault(key, admin.id);
    return ctx.json({ ok: true });
  },
});
