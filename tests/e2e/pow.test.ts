import { assertEquals } from "@std/assert";
import { createTestHandler, serveInfo, teardownTestDb } from "../helpers.ts";

Deno.test({
  name: "smoke: PoW challenge returns nonce and configurable difficulty",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/api/masuk/challenge"), serveInfo);
    assertEquals(res.status, 200);
    const body = await res.json() as { nonce: string; difficulty: number };
    assertEquals(typeof body.nonce, "string");
    assertEquals(body.nonce.length > 0, true);
    assertEquals(body.difficulty, 16);
    await teardownTestDb();
  },
});
