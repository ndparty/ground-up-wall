import { assertEquals } from "@std/assert";
import { Image } from "imagescript";
import { readImageDimensionsFromHeader } from "./image_dimensions.ts";
import { TEST_JPEG_BYTES } from "./test_jpeg.ts";

Deno.test("reads dimensions from a real JPEG header (8x8)", () => {
  const dims = readImageDimensionsFromHeader(TEST_JPEG_BYTES);
  assertEquals(dims, { width: 8, height: 8 });
});

Deno.test("reads dimensions from a PNG header", async () => {
  const png = await new Image(12, 34).encode();
  const dims = readImageDimensionsFromHeader(png);
  assertEquals(dims, { width: 12, height: 34 });
});

Deno.test("reads dimensions from a large JPEG header without full decode", async () => {
  const jpeg = await new Image(5000, 3000).encodeJPEG(50);
  const dims = readImageDimensionsFromHeader(jpeg);
  assertEquals(dims, { width: 5000, height: 3000 });
});

Deno.test("returns null for non-image bytes", () => {
  assertEquals(readImageDimensionsFromHeader(new Uint8Array([1, 2, 3, 4])), null);
});

Deno.test("returns null for empty input", () => {
  assertEquals(readImageDimensionsFromHeader(new Uint8Array()), null);
});
