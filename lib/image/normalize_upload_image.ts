import { Image } from "imagescript";
import { CABIN_PHOTO_ASPECT, centerCropRect, scaleToMaxPixels } from "./cabin_image.ts";
import { readImageDimensionsFromHeader } from "./image_dimensions.ts";

/** Maximum decoded pixel count (4096×4096). Reject before processing oversized uploads. */
export const MAX_DECODE_PIXELS = 4096 * 4096;

function assertDecodeDimensions(width: number, height: number): void {
  if (width * height > MAX_DECODE_PIXELS) {
    throw new Error("Image dimensions too large");
  }
}

export async function normalizeUploadImageBytes(input: Uint8Array): Promise<Uint8Array> {
  // Decompression-bomb guard: reject oversized images from their header BEFORE
  // Image.decode allocates the full bitmap (NFR-23). Falls through when the header
  // is unknown; the post-decode check below stays as defense-in-depth.
  const header = readImageDimensionsFromHeader(input);
  if (header) assertDecodeDimensions(header.width, header.height);

  const img = await Image.decode(input);
  assertDecodeDimensions(img.width, img.height);
  const crop = centerCropRect(img.width, img.height, CABIN_PHOTO_ASPECT);
  const cropped = img.crop(crop.sx, crop.sy, crop.sw, crop.sh);
  const scaled = scaleToMaxPixels(cropped.width, cropped.height);
  const resized = cropped.width === scaled.width && cropped.height === scaled.height
    ? cropped
    : cropped.resize(scaled.width, scaled.height);
  return await resized.encodeJPEG(85);
}

export async function normalizeUploadImage(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const normalized = await normalizeUploadImageBytes(bytes);
  return new Blob([normalized.slice()], { type: "image/jpeg" });
}
