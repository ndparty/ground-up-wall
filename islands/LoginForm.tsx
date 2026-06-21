import { useState } from "preact/hooks";
import { loginRedirectPath } from "../lib/auth/login_redirect.ts";
import { readJsonError, uploadErrorMessage } from "../lib/api/upload_client.ts";
import { obtainPowToken } from "../lib/security/pow_client.ts";
import type { User } from "../lib/types.ts";

export interface LoginFormProps {
  initialError?: string;
}

export default function LoginForm({ initialError = "" }: LoginFormProps) {
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    setLoading(true);
    setError("");
    try {
      const payload = JSON.stringify({ username, password });
      const send = (powToken?: string) =>
        fetch("/api/auth/login", {
          method: "POST",
          headers: powToken
            ? { "Content-Type": "application/json", "x-pow": powToken }
            : { "Content-Type": "application/json" },
          body: payload,
        });

      let res = await send();
      if (res.status === 428) {
        const token = await obtainPowToken();
        if (!token) {
          setError(uploadErrorMessage(null, 428));
          return;
        }
        res = await send(token);
      }
      if (!res.ok) {
        const bodyError = await readJsonError(res);
        setError(uploadErrorMessage(null, res.status, bodyError));
        return;
      }
      const body = await res.json();
      const role = body.user?.role as User["role"] | undefined;
      if (role) {
        globalThis.location.href = loginRedirectPath(role);
      } else {
        globalThis.location.href = "/upload";
      }
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form method="post" action="/login" onSubmit={handleSubmit}>
      <label style="display: block; margin-bottom: 1rem;">
        Username
        <input
          name="username"
          required
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
      </label>
      <label style="display: block; margin-bottom: 1rem;">
        Password
        <input
          name="password"
          type="password"
          required
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
      </label>
      {error && <p style="color: #ef3340;">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        style="background: #ef3340; color: white; border: none; padding: 0.5rem 1.5rem; cursor: pointer;"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
