import ChangePasswordForm from "../islands/ChangePasswordForm.tsx";
import { define } from "../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return Response.redirect(new URL("/login", ctx.req.url), 302);
    }
    return {};
  },
});

export default define.page(function ChangePasswordPage() {
  return (
    <div class="page page--narrow">
      <h2 class="heading-brand">Change password</h2>
      <ChangePasswordForm />
    </div>
  );
});
