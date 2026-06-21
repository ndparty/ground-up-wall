import { assertEquals } from "@std/assert";
import {
  isAllowedUploadImage,
  isHeicFamily,
  resolveUploadImageMime,
} from "./upload_image_types.ts";

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

Deno.test("resolveUploadImageMime uses file type when present", () => {
  const file = makeFile("photo.webp", "image/webp");
  assertEquals(resolveUploadImageMime(file), "image/webp");
});

Deno.test("resolveUploadImageMime falls back to HEIC extension when type empty", () => {
  const file = makeFile("IMG_1234.HEIC", "");
  assertEquals(resolveUploadImageMime(file), "image/heic");
});

Deno.test("resolveUploadImageMime falls back to mixed-case extension", () => {
  const file = makeFile("photo.JpEg", "");
  assertEquals(resolveUploadImageMime(file), "image/jpeg");
});

Deno.test("isAllowedUploadImage rejects unknown types", () => {
  const file = makeFile("doc.pdf", "application/pdf");
  assertEquals(isAllowedUploadImage(file), false);
});

Deno.test("isAllowedUploadImage accepts AVIF by extension", () => {
  const file = makeFile("photo.avif", "");
  assertEquals(isAllowedUploadImage(file), true);
});

Deno.test("isHeicFamily identifies HEIC and HEIF", () => {
  assertEquals(isHeicFamily("image/heic"), true);
  assertEquals(isHeicFamily("image/heif"), true);
  assertEquals(isHeicFamily("image/jpeg"), false);
});
