import { assertEquals, assertRejects } from "@std/assert";
import { Image } from "imagescript";
import {
  MAX_DECODE_PIXELS,
  normalizeUploadImage,
  normalizeUploadImageBytes,
} from "./normalize_upload_image.ts";
import { TEST_JPEG_BYTES } from "./test_jpeg.ts";

Deno.test("normalizeUploadImageBytes decodes and re-encodes valid JPEG", async () => {
  const out = await normalizeUploadImageBytes(TEST_JPEG_BYTES);
  assertEquals(out.length > 0, true);
  const decoded = await Image.decode(out);
  assertEquals(decoded.width, decoded.height);
});

Deno.test("normalizeUploadImage throws on invalid bytes", async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
  await assertRejects(() => normalizeUploadImage(blob));
});

Deno.test("normalizeUploadImageBytes rejects oversized decode", async () => {
  const side = Math.ceil(Math.sqrt(MAX_DECODE_PIXELS)) + 1;
  const img = new Image(side, side);
  img.fill(0xff0000ff);
  const huge = await img.encodeJPEG(50);
  await assertRejects(
    () => normalizeUploadImageBytes(huge),
    Error,
    "Image dimensions too large",
  );
});
