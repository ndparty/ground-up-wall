import { useEffect, useState } from "preact/hooks";

interface OverrideState {
  type: "normal" | "blank" | "placeholder";
  imageUrl?: string;
}

export default function AdminDisplayOverride() {
  const [state, setState] = useState<OverrideState>({ type: "normal" });
  const [message, setMessage] = useState("");

  async function loadState() {
    const res = await fetch("/api/admin/display-override");
    if (res.ok) setState(await res.json());
  }

  useEffect(() => {
    loadState();
  }, []);

  async function sendCommand(
    type: "blank" | "placeholder" | "resume" | "reload" | "panic",
    confirmMessage?: string,
    image?: File,
  ) {
    if (confirmMessage && !globalThis.confirm(confirmMessage)) return;
    setMessage("");
    const form = new FormData();
    form.append("type", type);
    if (image) form.append("image", image);
    const res = await fetch("/api/admin/display-override", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Command failed");
      return;
    }
    setMessage("Command sent");
    await loadState();
  }

  const statusLabel = state.type === "normal"
    ? "Normal"
    : state.type === "blank"
    ? "Blank"
    : "Placeholder";

  return (
    <section style="padding: 1rem; border: 1px solid #ddd; border-radius: 8px;">
      <p>
        Current state: <strong>{statusLabel}</strong>
      </p>
      {state.imageUrl && <p style="font-size: 0.85rem;">Image: {state.imageUrl}</p>}
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
        <button type="button" onClick={() => sendCommand("blank")}>
          Blank screen
        </button>
        <button type="button" onClick={() => sendCommand("placeholder")}>
          Show placeholder
        </button>
        <button type="button" onClick={() => sendCommand("resume")}>
          Resume display
        </button>
        <button
          type="button"
          onClick={() =>
            sendCommand(
              "reload",
              "Rebuild the display from the server? The train will restart at the first cabin.",
            )}
        >
          Reload display
        </button>
        <button
          type="button"
          onClick={() => sendCommand("panic")}
          style="background: #8b0000; color: white; font-weight: 600;"
        >
          Panic
        </button>
        <label style="display: inline-flex; align-items: center; gap: 0.5rem;">
          Placeholder image
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) sendCommand("placeholder", undefined, file);
            }}
          />
        </label>
      </div>
      {message && <p style="margin-top: 0.75rem;">{message}</p>}
    </section>
  );
}
