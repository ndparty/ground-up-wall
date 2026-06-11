import DisplayOverrideControls from "../islands/DisplayOverrideControls.tsx";
import ModerationQueue from "../islands/ModerationQueue.tsx";
import { define } from "../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user || (user.role !== "moderator" && user.role !== "admin")) {
      return Response.redirect(new URL("/login", ctx.req.url), 302);
    }
    return {};
  },
});

export default define.page(function ModeratePage() {
  return (
    <div style="padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto;">
      <h2 style="color: #ef3340;">Moderation</h2>
      <DisplayOverrideControls />
      <ModerationQueue />
    </div>
  );
});
