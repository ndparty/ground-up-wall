import LoginForm from "../islands/LoginForm.tsx";
import { define } from "../utils.ts";

export default define.page(function LoginPage() {
  return (
    <div style="max-width: 400px; margin: 3rem auto; padding: 0 1rem;">
      <h2 style="color: #ef3340;">Sign in</h2>
      <LoginForm />
    </div>
  );
});
