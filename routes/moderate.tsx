import DisplayOverrideControls from "../islands/DisplayOverrideControls.tsx";
import ModerationQueue from "../islands/ModerationQueue.tsx";
import ModeratorTrainPanel from "../islands/ModeratorTrainPanel.tsx";
import { loginPageRedirect, roleHomeRedirect } from "../lib/auth/login_redirect.ts";
import { define } from "../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return loginPageRedirect(ctx.req);
    }
    if (user.role !== "moderator" && user.role !== "admin") {
      return roleHomeRedirect(ctx.req, user.role);
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
