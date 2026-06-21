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
    <div style="max-width: 400px; margin: 3rem auto; padding: 0 1rem;">
      <h2 style="color: #ef3340;">Change password</h2>
      <ChangePasswordForm />
    </div>
  );
});
