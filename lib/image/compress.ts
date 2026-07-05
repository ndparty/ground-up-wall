import { DECODE_IMAGE_FAILED_MESSAGE, UploadImageError } from "./decode_upload_image.ts";
import { decodeImageSource } from "./decode_image_source.ts";
import { CABIN_PHOTO_ASPECT, centerCropRect, scaleToMaxPixels } from "./cabin_image.ts";

export async function compressImage(
  file: File | Blob,
  maxWidth = 1200,
  quality = 0.8,
): Promise<Blob> {
  const img = await decodeImageSource(file);
  try {
    const crop = centerCropRect(img.width, img.height, CABIN_PHOTO_ASPECT);
    let outW = crop.sw;
    let outH = crop.sh;

    const capped = scaleToMaxPixels(outW, outH);
    outW = capped.width;
    outH = capped.height;

    const widthCap = Math.min(maxWidth, outW);
    if (widthCap < outW) {
      outW = widthCap;
      outH = Math.round(outW / CABIN_PHOTO_ASPECT);
    }

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE, "canvas");
    ctx.drawImage(img.source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE, "encode")),
        "image/jpeg",
        quality,
      );
    });
    return blob;
  } finally {
    img.close();
  }
}

/** Crop + compress for live upload preview (same pipeline as submit). */
export function prepareCabinPreviewBlob(file: File | Blob): Promise<Blob> {
  return compressImage(file, 960, 0.85);
}
