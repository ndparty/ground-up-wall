import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsAdmin,
  loginAsDisplayWall,
  loginAsModerator,
  serveInfo,
} from "../lib/api/display_route_test_helpers.ts";
import { cleanupTestData } from "../lib/test_helpers.ts";

const ACCESS_DENIED =
  "Access not allowed. Please refer to the organiser's screen instead.";

Deno.test({
  name: "testUnauthenticatedGets403",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/display"), serveInfo);
    assertEquals(res.status, 403);
    assertEquals(await res.text(), ACCESS_DENIED);
    await cleanupTestData();
  },
});

Deno.test({
  name: "testDisplayWallUserAllowed",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const res = await handler(
      authedRequest("http://localhost/display", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const html = await res.text();
    assertEquals(html.includes("display-wall") || html.includes("TrainDisplay"), true);
    await cleanupTestData();
  },
});

Deno.test({
  name: "testModeratorAllowed",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(
      authedRequest("http://localhost/display", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await cleanupTestData();
  },
});

Deno.test({
  name: "testAdminAllowed",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/display", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await cleanupTestData();
  },
});
