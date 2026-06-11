import { useState } from "preact/hooks";

export default function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(data.get("currentPassword") ?? ""),
          newPassword: String(data.get("newPassword") ?? ""),
          confirmPassword: String(data.get("confirmPassword") ?? ""),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Password change failed");
        return;
      }
      setSuccess(true);
      form.reset();
    } catch {
      setError("Password change failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style="display: block; margin-bottom: 1rem;">
        Current password
        <input
          name="currentPassword"
          type="password"
          required
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
      </label>
      <label style="display: block; margin-bottom: 1rem;">
        New password
        <input
          name="newPassword"
          type="password"
          required
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
      </label>
      <label style="display: block; margin-bottom: 1rem;">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
      </label>
      {error && <p style="color: #ef3340;">{error}</p>}
      {success && <p style="color: #2e7d32;">Password updated successfully.</p>}
      <button
        type="submit"
        disabled={loading}
        style="background: #ef3340; color: white; border: none; padding: 0.5rem 1.5rem; cursor: pointer;"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
