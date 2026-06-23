import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { FileStorageService } from "../repositories/file_storage_service.ts";
import { assertStoragePathSafe, serveStorageFile } from "./serve_storage.ts";

Deno.test({
  name: "testServeStorageFileReturnsImage",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      const storage = new FileStorageService(dir);
      const content = new Uint8Array([0xff, 0xd8, 0xff]);
      const path = await storage.uploadImage(
        new Blob([content], { type: "image/jpeg" }),
        "submissions/photo.jpg",
      );
      const url = storage.getImageUrl(path);
      const res = await serveStorageFile(dir, url);
      assertEquals(res?.status, 200);
      assertEquals(res?.headers.get("content-type"), "image/jpeg");
      const bytes = new Uint8Array(await res!.arrayBuffer());
      assertEquals(bytes, content);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testServeStorageFileIgnoresUnrelatedPaths",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      const res = await serveStorageFile(dir, "/static/logo-dark.png");
      assertEquals(res, null);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testServeStorageFileBlocksPathTraversal",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      const secretPath = join(dir, "secret.txt");
      await Deno.writeTextFile(secretPath, "secret");
      const res = await serveStorageFile(dir, "/submissions/../secret.txt");
      assertEquals(res?.status, 404);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testServeStorageFileMissingFile404",
  async fn() {
    const dir = await Deno.makeTempDir();
    try {
      const res = await serveStorageFile(dir, "/submissions/missing.jpg");
      assertEquals(res?.status, 404);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testAssertStoragePathSafeRejectsTraversal",
  fn() {
    let threw = false;
    try {
      assertStoragePathSafe("../secret.txt");
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
  },
});
