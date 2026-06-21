import { getSessionToken } from "../../../lib/cookies.ts";
import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = getSessionToken(ctx.req);
    const { currentPassword, newPassword, confirmPassword } = await ctx.req.json();
    if (newPassword !== confirmPassword) {
      return ctx.json({ error: "Passwords do not match" }, { status: 400 });
    }
    try {
      await ctx.state.services.auth.changePassword(
        user.id,
        currentPassword,
        newPassword,
        token ?? undefined,
      );
      return ctx.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Password change failed";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
