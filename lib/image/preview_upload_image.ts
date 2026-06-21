import {
  DECODE_IMAGE_FAILED_MESSAGE,
  decodeUploadImage,
  UploadImageError,
} from "./decode_upload_image.ts";
import { isHeicFamily, resolveUploadImageMime } from "./upload_image_types.ts";

const PREVIEW_MAX_WIDTH = 800;
const PREVIEW_QUALITY = 0.85;

export function shouldAttemptPreviewRepair(repairAttempted: boolean): boolean {
  return !repairAttempted;
}

export function previewRepairUsesHeicDecode(file: File): boolean {
  const mime = resolveUploadImageMime(file);
  return mime !== null && isHeicFamily(mime);
}

async function bitmapToPreviewBlob(source: File | Blob): Promise<Blob> {
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(source);
  } catch {
    throw new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE);
  }

  const ratio = Math.min(PREVIEW_MAX_WIDTH / img.width, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    img.close();
    throw new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE))),
      "image/jpeg",
      PREVIEW_QUALITY,
    );
  });
  img.close();
  return blob;
}

export async function repairPreviewUrl(file: File): Promise<string> {
  if (previewRepairUsesHeicDecode(file)) {
    const decoded = await decodeUploadImage(file);
    if (decoded instanceof File && decoded === file) {
      const blob = await bitmapToPreviewBlob(file);
      return URL.createObjectURL(blob);
    }
    return URL.createObjectURL(decoded);
  }

  const blob = await bitmapToPreviewBlob(file);
  return URL.createObjectURL(blob);
}
