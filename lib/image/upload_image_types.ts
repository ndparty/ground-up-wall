export const UPLOAD_ACCEPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export const UPLOAD_ACCEPT_ATTR = UPLOAD_ACCEPT_MIME_TYPES.join(",");

export const UNSUPPORTED_IMAGE_TYPE_MESSAGE = "Unsupported image type";

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

const ALLOWED_TYPES = new Set<string>(UPLOAD_ACCEPT_MIME_TYPES);

function getExtension(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  return name.slice(dot).toLowerCase();
}

export function isHeicFamily(mime: string): boolean {
  return mime === "image/heic" || mime === "image/heif";
}

export function resolveUploadImageMime(file: File): string | null {
  const type = file.type.trim().toLowerCase();
  if (type && ALLOWED_TYPES.has(type)) {
    return type;
  }

  const ext = getExtension(file.name);
  if (ext && EXTENSION_TO_MIME[ext]) {
    return EXTENSION_TO_MIME[ext];
  }

  return type || null;
}

export function isAllowedUploadImage(file: File): boolean {
  const mime = resolveUploadImageMime(file);
  return mime !== null && ALLOWED_TYPES.has(mime);
}
