import TrainDisplay from "../islands/TrainDisplay.tsx";
import { define } from "../utils.ts";

const ACCESS_DENIED_MESSAGE =
  "Access not allowed. Please refer to the organiser's screen instead.";

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (
      !user ||
      (user.role !== "display_wall" && user.role !== "moderator" && user.role !== "admin")
    ) {
      return new Response(ACCESS_DENIED_MESSAGE, {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return {};
  },
});

export default define.page(function DisplayPage() {
  return <TrainDisplay />;
});
