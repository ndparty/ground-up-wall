import {
  isAllowedUploadImage,
  isHeicFamily,
  resolveUploadImageMime,
  UNSUPPORTED_IMAGE_TYPE_MESSAGE,
} from "./upload_image_types.ts";

export const DECODE_IMAGE_FAILED_MESSAGE =
  "This photo format couldn't be opened. Try saving as JPEG in your Photos app, or use a different browser.";

/** Pipeline stage that failed — diagnostic only, never shown to the user. */
export type UploadImageErrorStage =
  | "type"
  | "heic"
  | "decode"
  | "canvas"
  | "encode";

export class UploadImageError extends Error {
  readonly stage?: UploadImageErrorStage;

  constructor(message: string, stage?: UploadImageErrorStage) {
    super(message);
    this.name = "UploadImageError";
    this.stage = stage;
  }
}

export async function decodeUploadImage(file: File): Promise<File | Blob> {
  const mime = resolveUploadImageMime(file);
  if (!mime || !isAllowedUploadImage(file)) {
    throw new UploadImageError(UNSUPPORTED_IMAGE_TYPE_MESSAGE, "type");
  }

  if (!isHeicFamily(mime)) {
    return file;
  }

  // Chrome often hangs on createImageBitmap for HEIC; convert directly.
  try {
    const { heicTo } = await import("heic-to/csp");
    return await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });
  } catch {
    throw new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE, "heic");
  }
}
