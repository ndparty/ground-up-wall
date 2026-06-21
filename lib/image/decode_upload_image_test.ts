import { assertEquals, assertRejects } from "@std/assert";
import { decodeUploadImage, UploadImageError } from "./decode_upload_image.ts";

Deno.test("decodeUploadImage returns non-HEIC file unchanged", async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", {
    type: "image/jpeg",
  });
  const result = await decodeUploadImage(file);
  assertEquals(result, file);
});

Deno.test("decodeUploadImage rejects unsupported types", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "doc.pdf", {
    type: "application/pdf",
  });
  await assertRejects(
    () => decodeUploadImage(file),
    UploadImageError,
  );
});
