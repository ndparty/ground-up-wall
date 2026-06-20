import { useEffect, useRef, useState } from "preact/hooks";
import { obtainPowToken } from "../lib/security/pow_client.ts";
import { POSTING_GUIDELINES_DISCLAIMER } from "../lib/copy/disclaimers.ts";
import { PRIVACY_NOTICE_ITEMS } from "../lib/copy/privacy_notice.ts";
import { loadFormProfile, saveFormProfile } from "../lib/upload/form_profile_storage.ts";
import { compressImage, prepareCabinPreviewBlob } from "../lib/image/compress.ts";
import TrainCabin from "./TrainCabin.tsx";
import type { Submission } from "../lib/types.ts";
import {
  DECODE_IMAGE_FAILED_MESSAGE,
  decodeUploadImage,
  UploadImageError,
} from "../lib/image/decode_upload_image.ts";
import { repairPreviewUrl, shouldAttemptPreviewRepair } from "../lib/image/preview_upload_image.ts";
import {
  isAllowedUploadImage,
  UNSUPPORTED_IMAGE_TYPE_MESSAGE,
  UPLOAD_ACCEPT_ATTR,
} from "../lib/image/upload_image_types.ts";
import type { UploadFormConfig } from "../lib/upload_config.ts";
import {
  clampMessageToLimit,
  getRemainingLength,
  isAtMessageLimit,
  isMessageValid,
  type MessageLengthConfig,
  normalizeMessageLengthConfig,
} from "../lib/validation/message_length.ts";

export interface UploadFormProps extends UploadFormConfig {}

const NAVIGATION_KEYS = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Tab",
  "Home",
  "End",
  "Escape",
]);

const VALIDATION_FIELD_ORDER = ["photo", "message", "submitter_name", "acknowledged"] as const;

function collectValidationErrors(
  photo: File | null,
  submitterName: string,
  message: string,
  acknowledged: boolean,
  lengthConfig: MessageLengthConfig,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!photo) errors.photo = "Please select a photo";
  if (!submitterName.trim()) errors.submitter_name = "Name is required";
  if (!isMessageValid(message, lengthConfig)) {
    errors.message = "Message exceeds length limit";
  }
  if (!acknowledged) {
    errors.acknowledged = "Please acknowledge the privacy notice before submitting";
  }
  return errors;
}

function focusFirstValidationError(errors: Record<string, string>) {
  for (const key of VALIDATION_FIELD_ORDER) {
    if (!errors[key]) continue;
    const el = document.querySelector(`[data-field="${key}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
      } else {
        const focusable = el.querySelector("input, textarea");
        if (focusable instanceof HTMLElement) focusable.focus();
      }
    }
    break;
  }
}

export default function UploadForm({
  messagePromptText,
  messageLengthLimit,
  messageLengthUnit,
}: UploadFormProps) {
  const [promptText, setPromptText] = useState(messagePromptText);
  const [lengthLimit, setLengthLimit] = useState(messageLengthLimit);
  const [lengthUnit, setLengthUnit] = useState<"characters" | "words">(messageLengthUnit);
  const lengthConfig: MessageLengthConfig = normalizeMessageLengthConfig({
    limit: lengthLimit,
    unit: lengthUnit,
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const previewRepairAttemptedRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const profile = loadFormProfile();
    setSubmitterName(profile.submitterName);
    setSocialHandle(profile.socialHandle);
  }, []);

  // FR-13a: live-reload prompt/length config when an admin changes it.
  useEffect(() => {
    const es = new EventSource("/api/upload-config/events");
    es.addEventListener("system_config_changed", (e) => {
      try {
        const cfg = JSON.parse((e as MessageEvent).data) as { key: string; value: string };
        if (cfg.key === "message_prompt_text") setPromptText(cfg.value);
        else if (cfg.key === "message_length_limit") setLengthLimit(Number(cfg.value));
        else if (cfg.key === "message_length_unit") {
          setLengthUnit(cfg.value === "words" ? "words" : "characters");
        }
      } catch {
        // ignore malformed payloads
      }
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  function persistProfile(name: string, handle: string) {
    saveFormProfile({ submitterName: name, socialHandle: handle });
  }

  const remaining = Math.max(0, getRemainingLength(message, lengthConfig));

  function revokePreviewUrl() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  function setPreviewUrl(url: string | null) {
    revokePreviewUrl();
    previewUrlRef.current = url;
    setPreview(url);
  }

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function applyMessageValue(input: HTMLTextAreaElement, clamped: string, caret?: number) {
    if (input.value !== clamped) {
      input.value = clamped;
    }
    setMessage(clamped);
    clearFieldError("message");
    const pos = caret ?? Math.min(input.selectionStart ?? clamped.length, clamped.length);
    input.setSelectionRange(pos, pos);
  }

  function applyMessageInput(input: HTMLTextAreaElement) {
    const caret = input.selectionStart ?? input.value.length;
    const clamped = clampMessageToLimit(input.value, lengthConfig);
    applyMessageValue(input, clamped, Math.min(caret, clamped.length));
  }

  function handleMessageKeyDown(e: KeyboardEvent) {
    const input = e.currentTarget as HTMLTextAreaElement;

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (NAVIGATION_KEYS.has(e.key)) return;
    if (!isAtMessageLimit(input.value, lengthConfig)) return;

    const hasSelection = (input.selectionStart ?? 0) !== (input.selectionEnd ?? 0);
    if (hasSelection) return;

    if (lengthConfig.unit === "words" && e.key === " ") {
      e.preventDefault();
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
    }
  }

  function handleMessagePaste(e: ClipboardEvent) {
    e.preventDefault();
    const input = e.currentTarget as HTMLTextAreaElement;
    const paste = e.clipboardData?.getData("text") ?? "";
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const merged = input.value.slice(0, start) + paste + input.value.slice(end);
    const clamped = clampMessageToLimit(merged, lengthConfig);
    applyMessageValue(input, clamped, Math.min(start + paste.length, clamped.length));
  }

  function handlePhotoChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    previewRepairAttemptedRef.current = false;
    setPreviewLoading(false);

    if (!isAllowedUploadImage(file)) {
      setPhoto(null);
      setPreviewUrl(null);
      setFieldErrors((prev) => ({ ...prev, photo: UNSUPPORTED_IMAGE_TYPE_MESSAGE }));
      input.value = "";
      return;
    }

    setPhoto(file);
    clearFieldError("photo");
    void updateCroppedPreview(file);
  }

  async function updateCroppedPreview(file: File) {
    setPreviewLoading(true);
    try {
      const decoded = await decodeUploadImage(file);
      const cropped = await prepareCabinPreviewBlob(decoded);
      setPreviewUrl(URL.createObjectURL(cropped));
    } catch {
      setPreviewUrl(URL.createObjectURL(file));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePreviewError() {
    if (!photo || !shouldAttemptPreviewRepair(previewRepairAttemptedRef.current)) {
      return;
    }

    previewRepairAttemptedRef.current = true;
    setPreviewLoading(true);
    try {
      const repairedUrl = await repairPreviewUrl(photo);
      setPreviewUrl(repairedUrl);
      clearFieldError("photo");
    } catch (err) {
      setPreviewUrl(null);
      const message = err instanceof UploadImageError ? err.message : DECODE_IMAGE_FAILED_MESSAGE;
      setFieldErrors((prev) => ({ ...prev, photo: message }));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");

    const validationErrors = collectValidationErrors(
      photo,
      submitterName,
      message,
      acknowledged,
      lengthConfig,
    );
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      focusFirstValidationError(validationErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const decoded = await decodeUploadImage(photo!);
      const compressed = await compressImage(decoded);
      const form = new FormData();
      form.append("photo", compressed, "photo.jpg");
      form.append("message", message);
      form.append("submitter_name", submitterName.trim());
      form.append("acknowledged", "true");
      if (socialHandle.trim()) form.append("social_handle", socialHandle.trim());

      let res = await fetch("/api/submissions", { method: "POST", body: form });
      if (res.status === 428) {
        // Proof-of-work challenge enabled — solve and retry once.
        const token = await obtainPowToken();
        if (token) {
          res = await fetch("/api/submissions", {
            method: "POST",
            body: form,
            headers: { "x-pow": token },
          });
        }
      }
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Submission failed");
        return;
      }
      persistProfile(submitterName, socialHandle);
      setSuccess(true);
    } catch (err) {
      if (err instanceof UploadImageError) {
        setError(err.message);
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError("Submission failed");
      }
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

  const previewSubmission: Submission | null = preview
    ? {
      id: "preview",
      image_url: preview,
      message: message || "Your message will appear here",
      submitter_name: submitterName.trim() || "Your name",
      social_handle: socialHandle.trim() || undefined,
      status: "approved",
      source: "upload-preview",
      is_flagged: false,
      edit_count: 0,
      created_at: new Date().toISOString(),
    }
    : null;

  return (
    <form onSubmit={handleSubmit} style="max-width: 520px; margin: 0 auto;">
      <link rel="stylesheet" href="/upload.css" />

      <section class="upload-privacy-notice">
        <h3 class="upload-privacy-notice__title">Before you share</h3>
        <ul class="upload-privacy-notice__list">
          {PRIVACY_NOTICE_ITEMS.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <label data-field="photo" style="display: block; margin-bottom: 1rem;">
        Photo
        <input
          type="file"
          accept={UPLOAD_ACCEPT_ATTR}
          onChange={handlePhotoChange}
          style="display: block; margin-top: 0.25rem;"
        />
        {fieldErrors.photo && <span class="upload-field-error">{fieldErrors.photo}</span>}
        {previewLoading && <span class="upload-preview-loading">Loading preview…</span>}
        {previewSubmission && !previewLoading && (
          <div class="upload-cabin-preview">
            <link rel="stylesheet" href="/train.css" />
            <TrainCabin
              submission={previewSubmission}
              isActive={true}
              index={0}
              onPhotoError={() => void handlePreviewError()}
            />
          </div>
        )}
      </label>

      <label data-field="message" style="display: block; margin-bottom: 1rem;">
        Message
        <textarea
          value={message}
          onInput={(e) => applyMessageInput(e.currentTarget as HTMLTextAreaElement)}
          onKeyDown={handleMessageKeyDown}
          onPaste={handleMessagePaste}
          placeholder={promptText}
          rows={4}
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
        <span style="font-size: 0.85rem; color: #666;">
          {remaining} {lengthConfig.unit} remaining
        </span>
        {fieldErrors.message && <span class="upload-field-error">{fieldErrors.message}</span>}
      </label>

      <label data-field="submitter_name" style="display: block; margin-bottom: 1rem;">
        Your name
        <input
          value={submitterName}
          onInput={(e) => {
            const value = (e.target as HTMLInputElement).value;
            setSubmitterName(value);
            persistProfile(value, socialHandle);
            clearFieldError("submitter_name");
          }}
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
        {fieldErrors.submitter_name && (
          <span class="upload-field-error">{fieldErrors.submitter_name}</span>
        )}
      </label>

      <label style="display: block; margin-bottom: 1rem;">
        Social handle (optional)
        <input
          value={socialHandle}
          onInput={(e) => {
            const value = (e.target as HTMLInputElement).value;
            setSocialHandle(value);
            persistProfile(submitterName, value);
          }}
          style="display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem;"
        />
      </label>

      <div data-field="acknowledged" style="margin-bottom: 1rem;">
        <label style="display: flex; gap: 0.5rem; align-items: flex-start;">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              setAcknowledged((e.target as HTMLInputElement).checked);
              clearFieldError("acknowledged");
            }}
          />
          <span>I've read and understood the privacy notice and posting guidelines</span>
        </label>
        {fieldErrors.acknowledged && (
          <span class="upload-field-error">{fieldErrors.acknowledged}</span>
        )}
      </div>

      {error && <p class="upload-field-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        style="background: #ef3340; color: white; border: none; padding: 0.6rem 1.5rem; cursor: pointer; opacity: 1;"
      >
        {loading ? "Processing photo…" : "Submit"}
      </button>

      <p style="margin-top: 1.5rem; font-size: 0.9rem; color: #555;">
        {POSTING_GUIDELINES_DISCLAIMER}
      </p>
    </form>
  );
}
