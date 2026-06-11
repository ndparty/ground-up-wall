import { define } from "../../../../utils.ts";

export const handlers = define.handlers({
  async POST(ctx) {
    const admin = ctx.state.user!;
    const { userId, role, confirmed } = await ctx.req.json() as {
      userId: string;
      role: "moderator" | "display_wall";
      confirmed?: boolean;
    };

    if (!userId || !confirmed) {
      return ctx.json({ error: "Confirmation required" }, { status: 400 });
    }

    const service = ctx.state.services.photoWall;
    if (role === "moderator") {
      await service.deleteModerator(userId, admin.id);
    } else {
      await service.deleteDisplayWallUser(userId, admin.id);
    }

    return ctx.json({ ok: true });
  },
});
