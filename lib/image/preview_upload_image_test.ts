import { assertEquals } from "@std/assert";
import { previewRepairUsesHeicDecode, shouldAttemptPreviewRepair } from "./preview_upload_image.ts";

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

Deno.test("shouldAttemptPreviewRepair returns false after attempt", () => {
  assertEquals(shouldAttemptPreviewRepair(false), true);
  assertEquals(shouldAttemptPreviewRepair(true), false);
});

Deno.test("previewRepairUsesHeicDecode identifies HEIC by extension", () => {
  const file = makeFile("photo.heic", "");
  assertEquals(previewRepairUsesHeicDecode(file), true);
});

Deno.test("previewRepairUsesHeicDecode returns false for JPEG", () => {
  const file = makeFile("photo.jpg", "image/jpeg");
  assertEquals(previewRepairUsesHeicDecode(file), false);
});
