import { Image } from "imagescript";
import {
  CABIN_PHOTO_ASPECT,
  centerCropRect,
  scaleToMaxPixels,
} from "./cabin_image.ts";

export async function normalizeUploadImageBytes(input: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(input);
  const crop = centerCropRect(img.width, img.height, CABIN_PHOTO_ASPECT);
  const cropped = img.crop(crop.sx, crop.sy, crop.sw, crop.sh);
  const scaled = scaleToMaxPixels(cropped.width, cropped.height);
  const resized = cropped.width === scaled.width && cropped.height === scaled.height
    ? cropped
    : cropped.resize(scaled.width, scaled.height);
  return await resized.encodeJPEG(85);
}

export async function normalizeUploadImage(blob: Blob): Promise<Blob> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const normalized = await normalizeUploadImageBytes(bytes);
    return new Blob([normalized.slice()], { type: "image/jpeg" });
  } catch {
    return blob;
  }
}
