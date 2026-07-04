import { DECODE_IMAGE_FAILED_MESSAGE, UploadImageError } from "./decode_upload_image.ts";

/**
 * A decoded image ready for canvas drawing. `close()` releases bitmap memory
 * or the fallback element's object URL.
 */
export interface DecodedImageSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** Injectable decode strategies (tests replace these; production uses defaults). */
export interface DecodeImageDeps {
  createBitmap: (file: Blob) => Promise<DecodedImageSource>;
  decodeViaElement: (file: Blob) => Promise<DecodedImageSource>;
  wait: (ms: number) => Promise<void>;
}

async function defaultCreateBitmap(file: Blob): Promise<DecodedImageSource> {
  const img = await createImageBitmap(file);
  return {
    source: img,
    width: img.width,
    height: img.height,
    close: () => img.close(),
  };
}

/**
 * Fallback decoder using a detached <img>. Browsers (notably Android Chrome)
 * can natively decode images here even when createImageBitmap fails, e.g.
 * under memory pressure right after page load.
 */
async function defaultDecodeViaElement(file: Blob): Promise<DecodedImageSource> {
  const url = URL.createObjectURL(file);
  const img = document.createElement("img");
  try {
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error("empty image");
    }
  } catch (err) {
    URL.revokeObjectURL(url);
    img.src = "";
    throw err;
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => {
      URL.revokeObjectURL(url);
      img.src = "";
    },
  };
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const RETRY_DELAY_MS = 60;

/**
 * Decode an image blob to a drawable source with layered fallbacks:
 * createImageBitmap → one delayed retry → <img>.decode(). Field reports
 * (Pixel 6 Chrome) show the first createImageBitmap after page load can fail
 * on images the browser renders fine via <img>.
 */
export async function decodeImageSource(
  file: Blob,
  deps: DecodeImageDeps = {
    createBitmap: defaultCreateBitmap,
    decodeViaElement: defaultDecodeViaElement,
    wait: defaultWait,
  },
): Promise<DecodedImageSource> {
  try {
    return await deps.createBitmap(file);
  } catch {
    // fall through to retry
  }

  await deps.wait(RETRY_DELAY_MS);
  try {
    return await deps.createBitmap(file);
  } catch {
    // fall through to element decode
  }

  try {
    return await deps.decodeViaElement(file);
  } catch {
    throw new UploadImageError(DECODE_IMAGE_FAILED_MESSAGE, "decode");
  }
}
