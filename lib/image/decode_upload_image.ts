import {
  isAllowedUploadImage,
  isHeicFamily,
  resolveUploadImageMime,
  UNSUPPORTED_IMAGE_TYPE_MESSAGE,
} from "./upload_image_types.ts";

export const DECODE_IMAGE_FAILED_MESSAGE =
  "This photo format couldn't be opened. Try saving as JPEG in your Photos app, or use a different browser.";

export class UploadImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadImageError";
  }
}

export async function decodeUploadImage(file: File): Promise<File | Blob> {
  const mime = resolveUploadImageMime(file);
  if (!mime || !isAllowedUploadImage(file)) {
    throw new UploadImageError(UNSUPPORTED_IMAGE_TYPE_MESSAGE);
  }

  if (!isHeicFamily(mime)) {
    return file;
  }

  // Chrome often hangs on createImageBitmap for HEIC; convert directly.
  try {
    const { heicTo } = await import("heic-to");
    return await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });
  } catch {
    throw new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE);
  }
}
