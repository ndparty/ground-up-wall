import { isMessageValid, type MessageLengthConfig } from "../validation/message_length.ts";
import type { SubmissionInput } from "../types.ts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Upload form converts HEIC/WebP/AVIF to JPEG client-side before POST.
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
/** Bound free-text identity fields so they cannot bloat DB/SSE/render (NFR-23). */
export const MAX_SUBMITTER_NAME_LENGTH = 100;
export const MAX_SOCIAL_HANDLE_LENGTH = 100;

export interface ParsedSubmissionRequest {
  data: SubmissionInput;
}

export function parseSubmissionForm(
  form: FormData,
  lengthConfig: MessageLengthConfig,
): ParsedSubmissionRequest {
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("Photo is required");
  }
  if (!ALLOWED_TYPES.has(photo.type)) {
    throw new Error("Invalid file type");
  }
  if (photo.size > MAX_FILE_BYTES) {
    throw new Error("File too large");
  }

  const message = String(form.get("message") ?? "").trim();
  const submitterName = String(form.get("submitter_name") ?? "").trim();
  const socialRaw = form.get("social_handle");
  const socialHandle = socialRaw ? String(socialRaw).trim() : undefined;

  if (!submitterName) {
    throw new Error("Name is required");
  }
  if (submitterName.length > MAX_SUBMITTER_NAME_LENGTH) {
    throw new Error("Name is too long");
  }
  if (socialHandle && socialHandle.length > MAX_SOCIAL_HANDLE_LENGTH) {
    throw new Error("Social handle is too long");
  }
  if (!isMessageValid(message, lengthConfig)) {
    throw new Error("Message exceeds length limit");
  }

  const acknowledged = form.get("acknowledged");
  if (acknowledged !== "true" && acknowledged !== "on") {
    throw new Error("Privacy notice acknowledgment is required");
  }

  return {
    data: {
      image: photo,
      message,
      submitter_name: submitterName,
      social_handle: socialHandle || undefined,
    },
  };
}
