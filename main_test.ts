import { assertEquals } from "@std/assert";
import { Builder } from "$fresh/dev";
import { FileStorageService } from "./lib/repositories/file_storage_service.ts";
import { app } from "./main.ts";

const serveInfo: Deno.ServeHandlerInfo = {
  remoteAddr: { hostname: "127.0.0.1", port: 8000, transport: "tcp" },
  completed: Promise.resolve(),
};

async function createTestHandler() {
  const builder = new Builder({ ignore: [/.*_test\.ts$/] });
  const applySnapshot = await builder.build({ snapshot: "memory" });
  applySnapshot(app);
  return app.handler();
}

Deno.test({
  name: "testServerStarts",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/"), serveInfo);
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "/upload");
  },
});

Deno.test({
  name: "test404Page",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(
      new Request("http://localhost/this-route-does-not-exist"),
      serveInfo,
    );
    const html = await res.text();
    assertEquals(html.includes("404"), true);
    assertEquals(html.includes("parade route"), true);
    assertEquals(res.status === 404 || res.status === 200, true);
  },
});

Deno.test({
  name: "testServesUploadedImage",
  async fn() {
    const handler = await createTestHandler();
    const storage = new FileStorageService("./uploads");
    const content = new Uint8Array([0xff, 0xd8, 0xff]);
    const relativePath = `submissions/test-${crypto.randomUUID()}.jpg`;
    await storage.uploadImage(new Blob([content], { type: "image/jpeg" }), relativePath);
    try {
      const res = await handler(
        new Request(`http://localhost/${relativePath}`),
        serveInfo,
      );
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("content-type"), "image/jpeg");
      const bytes = new Uint8Array(await res.arrayBuffer());
      assertEquals(bytes, content);
    } finally {
      await storage.deleteImage(relativePath);
    }
  },
});
