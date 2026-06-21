import DisplayOverrideControls from "../../islands/DisplayOverrideControls.tsx";
import ModerateApprovedGallery from "../../islands/ModerateApprovedGallery.tsx";
import ModeratorTrainPanel from "../../islands/ModeratorTrainPanel.tsx";
import { define } from "../../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user || (user.role !== "moderator" && user.role !== "admin")) {
      return Response.redirect(new URL("/login", ctx.req.url), 302);
    }
    return {};
  },
});

export default define.page(function ModerateApprovedPage() {
  return (
    <div class="page page--moderate">
      <p class="mb-md">
        <a href="/moderate" class="link-back">← Back to moderation</a>
      </p>
      <h2 class="heading-brand">Gallery</h2>
      <DisplayOverrideControls />
      <ModeratorTrainPanel />
      <ModerateApprovedGallery />
    </div>
  );
});
