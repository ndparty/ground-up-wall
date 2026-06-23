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
  name: "testAdminRouteRedirectsUnauthenticatedToLogin",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/admin"), serveInfo);
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "http://localhost/login");
    await cleanupTestData();
  },
});

Deno.test({
  name: "testAdminRouteRedirectsModeratorToModerate",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(authedRequest("http://localhost/admin", token), serveInfo);
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "http://localhost/moderate");
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
