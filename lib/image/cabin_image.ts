/** Cabin photo aspect ratio (width / height) matching display CSS proportions. */
export const CABIN_PHOTO_ASPECT = 480 / 446;

/** Maximum output pixel count (8 megapixels). */
export const MAX_IMAGE_PIXELS = 8_000_000;

export function centerCropRect(
  width: number,
  height: number,
  aspect: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const sourceAspect = width / height;
  if (sourceAspect > aspect) {
    const sh = height;
    const sw = Math.round(height * aspect);
    const sx = Math.round((width - sw) / 2);
    return { sx, sy: 0, sw, sh };
  }
  const sw = width;
  const sh = Math.round(width / aspect);
  const sy = Math.round((height - sh) / 2);
  return { sx: 0, sy, sw, sh };
}

export function scaleToMaxPixels(
  width: number,
  height: number,
  maxPixels = MAX_IMAGE_PIXELS,
): { width: number; height: number } {
  const pixels = width * height;
  if (pixels <= maxPixels) return { width, height };
  const scale = Math.sqrt(maxPixels / pixels);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
