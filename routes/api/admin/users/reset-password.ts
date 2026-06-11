import { isManagedRole } from "../../../../lib/admin/user_route_helpers.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { userId, newPassword } = await ctx.req.json() as {
      userId: string;
      newPassword: string;
    };

    if (!userId || !newPassword) {
      return ctx.json({ error: "userId and newPassword are required" }, { status: 400 });
    }

    const target = await ctx.state.services.repository.getUserById(userId);
    if (!target || !isManagedRole(target.role)) {
      return ctx.json({ error: "User not found" }, { status: 404 });
    }

    const service = ctx.state.services.photoWall;
    try {
      if (target.role === "moderator") {
        await service.resetModeratorPassword(userId, newPassword, admin.id);
      } else {
        await service.resetDisplayWallUserPassword(userId, newPassword, admin.id);
      }
      ctx.state.services.auth.invalidateSessionsForUser(userId);
      return ctx.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset failed";
      return ctx.json({ error: message }, { status: 400 });
    }
  },
});
