import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsDisplayWall,
  loginAsModerator,
  serveInfo,
} from "../../../lib/api/display_route_test_helpers.ts";
import { cleanupTestData } from "../../../lib/test_helpers.ts";

Deno.test({
  name: "testPublishPauseCommand",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

    const res = await handler(
      authedRequest("http://localhost/api/display/train-command", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pause" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    await cleanupTestData();
  },
});

Deno.test({
  name: "testDisplayWallUserCannotPublishCommand",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);

    const res = await handler(
      authedRequest("http://localhost/api/display/train-command", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pause" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 403);

    await cleanupTestData();
  },
});
