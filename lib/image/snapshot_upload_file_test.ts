import { assertEquals, assertNotStrictEquals, assertStrictEquals } from "@std/assert";
import { snapshotUploadFile } from "./snapshot_upload_file.ts";

Deno.test("snapshotUploadFile copies bytes and metadata into a new in-memory File", async () => {
  const original = new File([new Uint8Array([1, 2, 3, 4])], "photo.jpg", {
    type: "image/jpeg",
    lastModified: 1234567890,
  });

  const snapshot = await snapshotUploadFile(original);

  assertNotStrictEquals(snapshot, original);
  assertEquals(snapshot.name, "photo.jpg");
  assertEquals(snapshot.type, "image/jpeg");
  assertEquals(snapshot.lastModified, 1234567890);
  assertEquals(new Uint8Array(await snapshot.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
});

Deno.test("snapshotUploadFile keeps the original reference when the read fails", async () => {
  class StaleFile extends File {
    override arrayBuffer(): Promise<ArrayBuffer> {
      return Promise.reject(new DOMException("stale handle", "NotReadableError"));
    }
  }
  const stale = new StaleFile(["x"], "stale.jpg", { type: "image/jpeg" });

  const result = await snapshotUploadFile(stale);

  assertStrictEquals(result, stale);
});
