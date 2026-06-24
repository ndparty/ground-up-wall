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

    const res = await fetch("/api/towkay/parameters");

    if (!res.ok) return;

    const data: SystemConfig[] = await res.json();

    setParams(data);

    const next: Record<string, string> = {};

    for (const p of data) {

      next[p.key] = p.key === "auto_moderator_word_list" ? formatWordListForEdit(p.value) : p.value;

    }

    setDrafts(next);

  }



  useEffect(() => {

    load();

  }, []);



  async function save(key: string) {

    setMessage("");

    const res = await fetch("/api/towkay/parameters/update", {

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

    const res = await fetch("/api/towkay/parameters/reset", {

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

    const res = await fetch("/api/towkay/parameters/upload-placeholder", {

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



  async function clearPlaceholder() {

    const res = await fetch("/api/towkay/parameters/clear-placeholder", { method: "POST" });

    const body = await res.json();

    if (!res.ok) {

      setMessage(body.error ?? "Remove failed");

      return;

    }

    setMessage("Placeholder image removed");

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

        <section key={category} class="param-section">

          <h3 class="heading-section">{category}</h3>

          {items.map((p) => (

            <div

              key={p.key}

              class="panel--form"

            >

              <strong>{PARAMETER_LABELS[p.key] ?? p.key}</strong>

              <p class="panel__desc">

                Default: {p.key === "auto_moderator_word_list"

                  ? formatWordListForEdit(p.default_value)

                  : p.default_value}

              </p>

              {p.key === "auto_moderator_word_list"

                ? (

                  <textarea

                    rows={4}

                    class="w-full"

                    aria-label={PARAMETER_LABELS[p.key] ?? p.key}

                    value={drafts[p.key] ?? ""}

                    onInput={(e) =>

                      setDrafts({ ...drafts, [p.key]: (e.target as HTMLTextAreaElement).value })}

                  />

                )

                : p.key === "message_length_unit"

                ? (

                  <select

                    aria-label={PARAMETER_LABELS[p.key] ?? p.key}

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

                      aria-label="Upload default placeholder image"

                      onChange={(e) => {

                        const file = (e.target as HTMLInputElement).files?.[0];

                        if (file) uploadPlaceholder(file);

                      }}

                    />

                    {drafts[p.key] && (

                      <button

                        type="button"

                        class="ml-sm"

                        onClick={() => clearPlaceholder()}

                      >

                        Remove

                      </button>

                    )}

                  </div>

                )

                : (p.key === "pow_challenge_enabled" ||

                    p.key === "system_killswitch_enabled" ||

                    p.key === "uploads_enabled")

                ? (

                  <select

                    aria-label={PARAMETER_LABELS[p.key] ?? p.key}

                    value={drafts[p.key] ?? (p.key === "uploads_enabled" ? "true" : "false")}

                    onChange={(e) =>

                      setDrafts({ ...drafts, [p.key]: (e.target as HTMLSelectElement).value })}

                  >

                    <option value="false">Off</option>

                    <option value="true">On</option>

                  </select>

                )

                : (

                  <input

                    type={p.key === "train_dwell_time" || p.key === "message_length_limit"

                      ? "number"

                      : "text"}

                    aria-label={PARAMETER_LABELS[p.key] ?? p.key}

                    class="param-input"

                    value={drafts[p.key] ?? ""}

                    onInput={(e) =>

                      setDrafts({ ...drafts, [p.key]: (e.target as HTMLInputElement).value })}

                  />

                )}

              {p.key !== "default_placeholder_image" && (

                <div class="form-row--actions">

                  <button

                    type="button"

                    onClick={() =>

                      save(p.key)}

                  >

                    Save

                  </button>

                  <button

                    type="button"

                    onClick={() =>

                      reset(p.key)}

                  >

                    Reset to default

                  </button>

                </div>

              )}

            </div>

          ))}

        </section>

      ))}

    </div>

  );

}

