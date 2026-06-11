import { define } from "../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    return ctx.redirect("/upload");
  },
});
