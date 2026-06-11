import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { userId, newPassword, role } = await ctx.req.json() as {
      userId: string;
      newPassword: string;
      role: "moderator" | "display_wall";
    };

    if (!userId || !newPassword) {
      return ctx.json({ error: "userId and newPassword are required" }, { status: 400 });
    }

    const service = ctx.state.services.photoWall;
    if (role === "moderator") {
      await service.resetModeratorPassword(userId, newPassword, admin.id);
    } else {
      await service.resetDisplayWallUserPassword(userId, newPassword, admin.id);
    }

    return ctx.json({ ok: true });
  },
});
