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
    <section class="panel">
      <p>
        Current state: <strong>{statusLabel}</strong>
      </p>
      {state.imageUrl && <p class="text-small">Image: {state.imageUrl}</p>}
      <div class="panel__actions panel__actions--spaced">
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
          class="btn btn--danger-dark"
        >
          Panic
        </button>
        <label class="inline-check">
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
      {message && <p class="panel__message">{message}</p>}
    </section>
  );
}
