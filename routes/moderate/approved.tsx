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
    <div style="padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto;">
      <p style="margin: 0 0 1rem;">
        <a href="/moderate" style="color: #ef3340;">← Back to moderation</a>
      </p>
      <h2 style="color: #ef3340;">Gallery</h2>
      <DisplayOverrideControls />
      <ModeratorTrainPanel />
      <ModerateApprovedGallery />
    </div>
  );
});
