import DisplayOverrideControls from "../islands/DisplayOverrideControls.tsx";
import ModerationQueue from "../islands/ModerationQueue.tsx";
import ModeratorTrainPanel from "../islands/ModeratorTrainPanel.tsx";
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
    <div class="page page--moderate">
      <h2 class="heading-brand">Moderation</h2>
      <DisplayOverrideControls />
      <ModeratorTrainPanel />
      <ModerationQueue />
    </div>
  );
});
