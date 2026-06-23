import TrainDisplay from "../islands/TrainDisplay.tsx";
import { loginPageRedirect, roleHomeRedirect } from "../lib/auth/login_redirect.ts";
import { define } from "../utils.ts";

function canAccessDisplay(role: string): boolean {
  return role === "display_wall" || role === "moderator" || role === "admin";
}

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return loginPageRedirect(ctx.req);
    }
    if (!canAccessDisplay(user.role)) {
      return roleHomeRedirect(ctx.req, user.role);
    }
    return {};
  },
});

export default define.page(function DisplayPage() {
  return <TrainDisplay />;
});
