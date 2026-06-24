import { useState } from "preact/hooks";

export default function DisplayOverrideControls() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCommand(
    type: "blank" | "placeholder" | "resume" | "reload" | "panic",
    confirmMessage?: string,
    image?: File,
  ) {
    if (confirmMessage && !globalThis.confirm(confirmMessage)) return;
    setLoading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("type", type);
      if (image) form.append("image", image);
      const res = await fetch("/api/semak/display-override", { method: "POST", body: form });
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
          : type === "resume"
          ? "Display resumed"
          : type === "reload"
          ? "Display reloaded"
          : "Panic activated — displays blanked and reset",
      );
    } catch {
      setMessage("Command failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section class="panel--muted">
      <h3 class="panel__title">Display override</h3>
      <div class="panel__actions">
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCommand("blank")}
          class="btn btn--nav"
        >
          Blank screen
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCommand("placeholder")}
          class="btn btn--danger"
        >
          Show placeholder
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCommand("resume")}
          class="btn btn--navy"
        >
          Resume display
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            sendCommand(
              "reload",
              "Rebuild the display from the server? The train will restart at the first cabin.",
            )}
          class="btn btn--secondary"
        >
          Reload display
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => sendCommand("panic")}
          class="btn btn--danger-dark"
        >
          Panic
        </button>
        <label class="inline-check">
          Custom placeholder image
          <input
            type="file"
            accept="image/*"
            disabled={loading}
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) sendCommand("placeholder", undefined, file);
            }}
          />
        </label>
      </div>
      {message && <p class="panel__message">{message}</p>}
    </section>
  );
}
