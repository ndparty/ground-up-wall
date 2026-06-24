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
      const res = await fetch("/api/masuk/tukar", {
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
    <form method="post" action="/tukar" onSubmit={handleSubmit}>
      <label class="form-label">
        Current password
        <input
          name="currentPassword"
          type="password"
          required
          class="form-input"
        />
      </label>
      <label class="form-label">
        New password
        <input
          name="newPassword"
          type="password"
          required
          class="form-input"
        />
      </label>
      <label class="form-label">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          class="form-input"
        />
      </label>
      {error && <p class="text-error">{error}</p>}
      {success && <p class="text-success">Password updated successfully.</p>}
      <button
        type="submit"
        disabled={loading}
        class="btn btn--primary"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
