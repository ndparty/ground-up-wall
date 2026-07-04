/**
 * Header-only image dimension probe for decompression-bomb defense (NFR-23).
 *
 * `imagescript`'s `Image.decode()` allocates the full width×height×4 bitmap before
 * any dimension check can run, so a tiny file that declares enormous dimensions can
 * exhaust memory. We parse just the header of the two server-accepted formats
 * (JPEG, PNG) to reject oversized images BEFORE decoding. Unknown/unparseable
 * headers return null and fall through to the decoder (which still applies the
 * post-decode guard as defense-in-depth).
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  // PNG signature (8 bytes) + IHDR: length(4) + "IHDR"(4) + width(4) + height(4).
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  // JPEG starts with SOI (0xFFD8). Walk marker segments to the first SOF frame header.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1]!;
    // Standalone markers without a length payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) return null;
    // SOF markers carry frame dimensions (skip DHT/DAC/RST/APPn/etc.).
    const isSof = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      // SOF payload: precision(1) + height(2) + width(2).
      const height = view.getUint16(offset + 5, false);
      const width = view.getUint16(offset + 7, false);
      if (width === 0 || height === 0) return null;
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** Best-effort width/height from JPEG/PNG headers without decoding. Null if unknown. */
export function readImageDimensionsFromHeader(bytes: Uint8Array): ImageDimensions | null {
  return pngDimensions(bytes) ?? jpegDimensions(bytes);
}
