import { isManagedRole } from "../../../../lib/admin/user_route_helpers.ts";
import { toPublicError } from "../../../../lib/api/public_error.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { userId, confirmed } = await ctx.req.json() as {
      userId: string;
      confirmed?: boolean;
    };

    if (!userId || !confirmed) {
      return ctx.json({ error: "Confirmation required" }, { status: 400 });
    }

    const target = await ctx.state.services.repository.getUserById(userId);
    if (!target || !isManagedRole(target.role)) {
      return ctx.json({ error: "User not found" }, { status: 404 });
    }

    const service = ctx.state.services.photoWall;
    try {
      if (target.role === "moderator") {
        await service.deleteModerator(userId, admin.id);
      } else {
        await service.deleteDisplayWallUser(userId, admin.id);
      }
      ctx.state.services.auth.invalidateSessionsForUser(userId);
      return ctx.json({ ok: true });
    } catch (err) {
      return ctx.json({ error: toPublicError(err, "Delete failed") }, { status: 400 });
    }
  },
});
