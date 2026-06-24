import { isManagedRole } from "../../../../lib/admin/user_route_helpers.ts";
import { toPublicError } from "../../../../lib/api/public_error.ts";
import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { userId, action } = await ctx.req.json() as {
      userId: string;
      action: "disable" | "enable";
    };

    if (!userId || (action !== "disable" && action !== "enable")) {
      return ctx.json({ error: "Invalid request" }, { status: 400 });
    }

    const target = await ctx.state.services.repository.getUserById(userId);
    if (!target || !isManagedRole(target.role)) {
      return ctx.json({ error: "User not found" }, { status: 404 });
    }

    const service = ctx.state.services.photoWall;
    try {
      if (target.role === "moderator") {
        if (action === "disable") await service.disableModerator(userId, admin.id);
        else await service.enableModerator(userId, admin.id);
      } else if (action === "disable") {
        await service.disableDisplayWallUser(userId, admin.id);
      } else {
        await service.enableDisplayWallUser(userId, admin.id);
      }
      if (action === "disable") {
        ctx.state.services.auth.invalidateSessionsForUser(userId);
      }
      return ctx.json({ ok: true });
    } catch (err) {
      return ctx.json({ error: toPublicError(err, "Update failed") }, { status: 400 });
    }
  },
});
