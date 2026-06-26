import {
  normalizeWordListInput,
  validateParameterValue,
} from "../../../../lib/admin/parameter_validation.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { key, value } = await ctx.req.json() as { key: string; value: string };

    let normalized = value;
    if (key === "auto_moderator_word_list") {
      normalized = normalizeWordListInput(value);
    }

    const error = validateParameterValue(key, normalized);
    if (error) return ctx.json({ error }, { status: 400 });

    await ctx.state.services.photoWall.updateSystemParameter(key, normalized, admin.id);
    return ctx.json({ ok: true });
  },
});
