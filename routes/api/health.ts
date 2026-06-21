import { define } from "../../utils.ts";

export const handlers = define.handlers({
  async GET(ctx) {
    let dbOk = false;
    try {
      await ctx.state.services.repository.connect();
      await ctx.state.services.repository.getSystemConfig("train_dwell_time");
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const ok = dbOk;
    return ctx.json({ ok, db: dbOk }, { status: ok ? 200 : 503 });
  },
});
