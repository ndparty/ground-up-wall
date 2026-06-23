import ChangePasswordForm from "../islands/ChangePasswordForm.tsx";
import { loginPageRedirect } from "../lib/auth/login_redirect.ts";
import { define } from "../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    if (!ctx.state.user) {
      return loginPageRedirect(ctx.req);
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
