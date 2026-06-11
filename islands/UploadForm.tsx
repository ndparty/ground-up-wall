import { useState } from "preact/hooks";
import { POSTING_GUIDELINES_DISCLAIMER } from "../lib/copy/disclaimers.ts";
import { PRIVACY_NOTICE } from "../lib/copy/privacy_notice.ts";
import { compressImage } from "../lib/image/compress.ts";
import type { UploadFormConfig } from "../lib/upload_config.ts";
import {
  getRemainingLength,
  isMessageValid,
  type MessageLengthConfig,
} from "../lib/validation/message_length.ts";

export interface UploadFormProps extends UploadFormConfig {}

export default function UploadForm({
  messagePromptText,
  messageLengthLimit,
  messageLengthUnit,
}: UploadFormProps) {
  const lengthConfig: MessageLengthConfig = {
    limit: messageLengthLimit,
    unit: messageLengthUnit,
  };

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const remaining = getRemainingLength(message, lengthConfig);
  const counterOver = remaining < 0;

  async function handlePhotoChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setFieldErrors((prev) => ({ ...prev, photo: "" }));
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!photo) {
      setFieldErrors({ photo: "Please select a photo" });
      return;
    }
    if (!submitterName.trim()) {
      setFieldErrors({ submitter_name: "Name is required" });
      return;
    }
    if (!isMessageValid(message, lengthConfig)) {
      setFieldErrors({ message: "Message exceeds length limit" });
      return;
    }
    if (!acknowledged) {
      setError("Please acknowledge the privacy notice");
      return;
    }

    setLoading(true);
    try {
      const compressed = await compressImage(photo);
      const form = new FormData();
      form.append("photo", compressed, "photo.jpg");
      form.append("message", message);
      form.append("submitter_name", submitterName.trim());
      form.append("acknowledged", "true");
      if (socialHandle.trim()) form.append("social_handle", socialHandle.trim());

      const res = await fetch("/api/submissions", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Submission failed");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Submission failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style="text-align: center; padding: 2rem 0;">
        <h2 style="color: #2e7d32;">Thank you!</h2>
        <p>Your photo has been submitted and is waiting for moderation.</p>
        <p style="margin-top: 1.5rem; font-size: 0.9rem; color: #555;">
          {POSTING_GUIDELINES_DISCLAIMER}
        </p>
        <a href="/upload" style="display: inline-block; margin-top: 1.5rem; color: #ef3340;">
          Submit another photo
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style="max-width: 520px; margin: 0 auto;">
      <section
        style="background: #fff5f5; border: 1px solid #ef3340; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; white-space: pre-line; font-size: 0.95rem;"
      >
        {PRIVACY_NOTICE}
      </section>

      <label style="display: block; margin-bottom: 1rem;">
        Photo (JPEG or PNG)
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handlePhotoChange}
          style="display: block; margin-top: 0.25rem;"
        />
        {fieldErrors.photo && <span style="color: #ef3340;">{fieldErrors.photo}</span>}
        {preview && (
          <img
            src={preview}
            alt="Preview"
            style="display: block; max-width: 100%; margin-top: 0.5rem; border-radius: 4px;"
          />
        )}
      </label>

      <label style="display: block; margin-bottom: 1rem;">
        Message
        <textarea
          value={message}
          onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
          placeholder={messagePromptText}
          rows={4}
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
        <span style={`font-size: 0.85rem; color: ${counterOver ? "#ef3340" : "#666"};`}>
          {remaining} {messageLengthUnit} remaining
        </span>
        {fieldErrors.message && <span style="color: #ef3340;"> {fieldErrors.message}</span>}
      </label>

      <label style="display: block; margin-bottom: 1rem;">
        Your name
        <input
          value={submitterName}
          onInput={(e) => setSubmitterName((e.target as HTMLInputElement).value)}
          required
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
        {fieldErrors.submitter_name && (
          <span style="color: #ef3340;">{fieldErrors.submitter_name}</span>
        )}
      </label>

      <label style="display: block; margin-bottom: 1rem;">
        Social handle (optional)
        <input
          value={socialHandle}
          onInput={(e) => setSocialHandle((e.target as HTMLInputElement).value)}
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
      </label>

      <label style="display: flex; gap: 0.5rem; align-items: flex-start; margin-bottom: 1rem;">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged((e.target as HTMLInputElement).checked)}
        />
        <span>I've read and understood the privacy notice and posting guidelines</span>
      </label>

      {error && <p style="color: #ef3340;">{error}</p>}

      <button
        type="submit"
        disabled={!acknowledged || loading || counterOver}
        style="background: #ef3340; color: white; border: none; padding: 0.6rem 1.5rem; cursor: pointer; opacity: 1;"
      >
        {loading ? "Submitting…" : "Submit"}
      </button>

      <p style="margin-top: 1.5rem; font-size: 0.9rem; color: #555;">
        {POSTING_GUIDELINES_DISCLAIMER}
      </p>
    </form>
  );
}
