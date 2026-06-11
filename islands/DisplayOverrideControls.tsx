import { useState } from "preact/hooks";

export default function DisplayOverrideControls() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCommand(
    type: "blank" | "placeholder" | "resume",
    confirmMessage?: string,
  ) {
    if (confirmMessage && !globalThis.confirm(confirmMessage)) return;
    setLoading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("type", type);
      const res = await fetch("/api/moderate/display-override", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error ?? "Command failed");
        return;
      }
      setMessage(
        type === "blank"
          ? "Display blanked"
          : type === "placeholder"
          ? "Placeholder shown"
          : "Display resumed",
      );
    } catch {
      setMessage("Command failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style="margin-bottom: 2rem; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;"
    >
      <h3 style="margin: 0 0 0.75rem; color: #ef3340;">Display override</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCommand("blank", "Blank the display wall?")}
          style="padding: 0.5rem 1rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Blank screen
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCommand("placeholder")}
          style="padding: 0.5rem 1rem; background: #ef3340; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Show placeholder
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCommand("resume")}
          style="padding: 0.5rem 1rem; background: #1a1a2e; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Resume display
        </button>
      </div>
      {message && (
        <p style="margin: 0.75rem 0 0; font-size: 0.9rem; color: #333;">{message}</p>
      )}
    </section>
  );
}
