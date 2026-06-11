import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { userId, action, role } = await ctx.req.json() as {
      userId: string;
      action: "disable" | "enable";
      role: "moderator" | "display_wall";
    };

    if (!userId || (action !== "disable" && action !== "enable")) {
      return ctx.json({ error: "Invalid request" }, { status: 400 });
    }

    const service = ctx.state.services.photoWall;
    if (role === "moderator") {
      if (action === "disable") await service.disableModerator(userId, admin.id);
      else await service.enableModerator(userId, admin.id);
    } else {
      if (action === "disable") await service.disableDisplayWallUser(userId, admin.id);
      else await service.enableDisplayWallUser(userId, admin.id);
    }

    return ctx.json({ ok: true });
  },
});
