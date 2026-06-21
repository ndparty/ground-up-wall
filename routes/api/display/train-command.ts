import type { TrainCommand } from "../../../lib/interfaces/realtime_service.ts";
import { define } from "../../../utils.ts";

function canControlTrain(role: string | undefined): boolean {
  return role === "moderator" || role === "admin";
}

export const handlers = define.handlers({
  async POST(ctx) {
    const user = ctx.state.user;
    if (!user || !canControlTrain(user.role)) {
      return ctx.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await ctx.req.json() as TrainCommand;
    if (body.type !== "pause" && body.type !== "play" && body.type !== "jump") {
      return ctx.json({ error: "Invalid command type" }, { status: 400 });
    }
    if (body.type === "jump" && body.cabinNumber === undefined) {
      return ctx.json({ error: "cabinNumber required for jump" }, { status: 400 });
    }

    await ctx.state.services.photoWall.publishTrainCommand(body);
    return ctx.json({ ok: true });
  },
});
