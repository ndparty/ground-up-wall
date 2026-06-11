import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsAdmin,
  loginAsModerator,
  serveInfo,
} from "../../lib/api/display_route_test_helpers.ts";
import { cleanupTestData } from "../../lib/test_helpers.ts";

Deno.test({
  name: "testAdminRouteBlocksModerator",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(authedRequest("http://localhost/admin", token), serveInfo);
    assertEquals(res.status, 403);
    await cleanupTestData();
  },
});

Deno.test({
  name: "testAdminRouteAllowsAdmin",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(authedRequest("http://localhost/admin", token), serveInfo);
    assertEquals(res.status, 200);
    const html = await res.text();
    assertEquals(html.includes("Admin Panel"), true);
    await cleanupTestData();
  },
});
