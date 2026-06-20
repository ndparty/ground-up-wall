import { DECODE_IMAGE_FAILED_MESSAGE } from "./decode_upload_image.ts";
import {
  CABIN_PHOTO_ASPECT,
  centerCropRect,
  scaleToMaxPixels,
} from "./cabin_image.ts";

export async function compressImage(
  file: File | Blob,
  maxWidth = 1200,
  quality = 0.8,
): Promise<Blob> {
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(file);
  } catch {
    throw new Error(DECODE_IMAGE_FAILED_MESSAGE);
  }

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
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
      "image/jpeg",
      quality,
    );
  });
  img.close();
  return blob;
}

/** Crop + compress for live upload preview (same pipeline as submit). */
export async function prepareCabinPreviewBlob(file: File | Blob): Promise<Blob> {
  return compressImage(file, 960, 0.85);
}
