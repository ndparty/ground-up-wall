import { useState } from "preact/hooks";

export default function LoginForm() {
  const [error, setError] = useState("");
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Login failed");
        return;
      }
      globalThis.location.href = "/upload";
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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
