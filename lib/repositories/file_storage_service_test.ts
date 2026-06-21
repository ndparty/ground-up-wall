import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { FileStorageService } from "./file_storage_service.ts";

Deno.test({
  name: "testUploadAndGetImage",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      const storage = new FileStorageService(dir);
      const content = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const blob = new Blob([content], { type: "image/png" });
      const path = await storage.uploadImage(blob, "test/photo.png");
      assertEquals(path, "test/photo.png");
      assertEquals(storage.getImageUrl(path), "/test/photo.png");

      const fileBytes = await Deno.readFile(join(dir, "test/photo.png"));
      assertEquals(fileBytes, content);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testDeleteImage",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      const storage = new FileStorageService(dir);
      const blob = new Blob([new Uint8Array([1, 2, 3])]);
      const path = await storage.uploadImage(blob, "delete-me.png");
      await storage.deleteImage(path);
      let exists = true;
      try {
        await Deno.stat(join(dir, "delete-me.png"));
      } catch {
        exists = false;
      }
      assertEquals(exists, false);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});
