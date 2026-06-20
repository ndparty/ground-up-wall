import { useEffect, useState } from "preact/hooks";
import {
  formatWordListForEdit,
  PARAMETER_CATEGORIES,
  PARAMETER_LABELS,
} from "../lib/admin/parameter_validation.ts";
import type { SystemConfig } from "../lib/types.ts";

export default function SystemParameters() {
  const [params, setParams] = useState<SystemConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/admin/parameters");
    if (!res.ok) return;
    const data: SystemConfig[] = await res.json();
    setParams(data);
    const next: Record<string, string> = {};
    for (const p of data) {
      next[p.key] = p.key === "auto_moderator_word_list"
        ? formatWordListForEdit(p.value)
        : p.value;
    }
    setDrafts(next);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    setMessage("");
    const res = await fetch("/api/admin/parameters/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: drafts[key] }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Update failed");
      return;
    }
    setMessage(`Updated ${key}`);
    await load();
  }

  async function reset(key: string) {
    const res = await fetch("/api/admin/parameters/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Reset failed");
      return;
    }
    setMessage(`Reset ${key} to default`);
    await load();
  }

  async function uploadPlaceholder(file: File) {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/admin/parameters/upload-placeholder", {
      method: "POST",
      body: form,
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Upload failed");
      return;
    }
    setMessage("Placeholder image updated");
    await load();
  }

  const grouped = new Map<string, SystemConfig[]>();
  const paramsByKey = new Map(params.map((p) => [p.key, p]));
  for (const p of params) {
    const cat = PARAMETER_CATEGORIES[p.key] ?? "Other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }
  for (const [key, category] of Object.entries(PARAMETER_CATEGORIES)) {
    if (paramsByKey.has(key)) continue;
    const placeholder: SystemConfig = {
      key,
      value: "",
      default_value: "",
      updated_at: "",
    };
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(placeholder);
  }

  return (
    <div>
      {message && <p>{message}</p>}
      {[...grouped.entries()].map(([category, items]) => (
        <section key={category} style="margin-bottom: 2rem;">
          <h3 style="color: #ef3340;">{category}</h3>
          {items.map((p) => (
            <div
              key={p.key}
              style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #ddd; border-radius: 8px;"
            >
              <strong>{PARAMETER_LABELS[p.key] ?? p.key}</strong>
              <p style="margin: 0.25rem 0; font-size: 0.85rem; color: #666;">
                Default: {p.key === "auto_moderator_word_list"
                  ? formatWordListForEdit(p.default_value)
                  : p.default_value}
              </p>
              {p.key === "auto_moderator_word_list"
                ? (
                  <textarea
                    rows={4}
                    style="width: 100%;"
                    value={drafts[p.key] ?? ""}
                    onInput={(e) =>
                      setDrafts({ ...drafts, [p.key]: (e.target as HTMLTextAreaElement).value })}
                  />
                )
                : p.key === "message_length_unit"
                ? (
                  <select
                    value={drafts[p.key] ?? "characters"}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [p.key]: (e.target as HTMLSelectElement).value })}
                  >
                    <option value="characters">Characters</option>
                    <option value="words">Words</option>
                  </select>
                )
                : p.key === "default_placeholder_image"
                ? (
                  <div>
                    <p>{drafts[p.key] || "No image set"}</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) uploadPlaceholder(file);
                      }}
                    />
                  </div>
                )
                : (
                  <input
                    type={p.key === "train_dwell_time" || p.key === "message_length_limit"
                      ? "number"
                      : "text"}
                    style="width: 100%; padding: 0.5rem;"
                    value={drafts[p.key] ?? ""}
                    onInput={(e) =>
                      setDrafts({ ...drafts, [p.key]: (e.target as HTMLInputElement).value })}
                  />
                )}
              {p.key !== "default_placeholder_image" && (
                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                  <button type="button" onClick={() => save(p.key)}>Save</button>
                  <button type="button" onClick={() => reset(p.key)}>Reset to default</button>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
