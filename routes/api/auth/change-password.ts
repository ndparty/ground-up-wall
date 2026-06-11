import { getSessionToken } from "../../../lib/cookies.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const token = getSessionToken(ctx.req);
    const user = ctx.state.services.auth.getCurrentUser(token);
    if (!user) {
      return ctx.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { currentPassword, newPassword, confirmPassword } = await ctx.req.json();
    if (newPassword !== confirmPassword) {
      return ctx.json({ error: "Passwords do not match" }, { status: 400 });
    }
    try {
      await ctx.state.services.auth.changePassword(
        user.id,
        currentPassword,
        newPassword,
      );
      return ctx.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Password change failed";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
